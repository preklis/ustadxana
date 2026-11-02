"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireActiveUser } from "@/lib/auth/session";
import { getClassroomAccess } from "@/lib/permissions";
import { fail, ok, str, type ActionState } from "@/lib/action";
import { audit, notify } from "@/lib/audit";
import { deleteBlobs, deleteFileObject, filesFrom, saveUploads, UploadError } from "@/lib/storage";

const MAX_POST = 5000;
const MAX_COMMENT = 2000;

function uploadFail(e: unknown): ActionState {
  if (e instanceof UploadError) return fail(e.code === "tooLarge" ? "common.uploadTooLarge" : "common.uploadBlocked");
  throw e;
}

function excerpt(s: string, n = 140) {
  const one = s.replace(/\s+/g, " ").trim();
  return one.length > n ? `${one.slice(0, n - 1)}…` : one;
}

function refresh(classroomId: string) {
  revalidatePath(`/classrooms/${classroomId}`, "layout");
}

async function studentIdsOf(classroomId: string) {
  const rows = await db.classroomMember.findMany({ where: { classroomId, role: "STUDENT" }, select: { userId: true } });
  return rows.map((r) => r.userId);
}

async function mentorIdsOf(classroomId: string) {
  const rows = await db.classroomMember.findMany({ where: { classroomId, role: "MENTOR" }, select: { userId: true } });
  return rows.map((r) => r.userId);
}

async function loadEditablePost(postId: string) {
  const user = await requireActiveUser();
  const post = await db.announcement.findUnique({
    where: { id: postId },
    select: { id: true, classroomId: true, authorId: true, classroom: { select: { archived: true } } },
  });
  if (!post?.classroomId) return null;
  const access = await getClassroomAccess(user, post.classroomId);
  const allowed = access.canTeach && (post.authorId === user.id || access.canManage);
  if (!allowed) return null;
  return { user, post: { ...post, classroomId: post.classroomId }, access };
}

export async function createPost(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireActiveUser();
  const classroom = await db.classroom.findUnique({
    where: { id: str(fd, "classroomId") },
    select: { id: true, name: true, archived: true },
  });
  if (!classroom) return fail();
  const access = await getClassroomAccess(user, classroom.id);
  if (!access.canTeach) return fail("common.denied");
  if (classroom.archived) return fail("classroom.errors.archived");

  const body = str(fd, "body");
  if (!body) return fail("common.invalidInput", { body: "common.required" });
  if (body.length > MAX_POST) return fail("common.invalidInput", { body: "classroom.errors.tooLong" });

  const post = await db.announcement.create({
    data: { classroomId: classroom.id, authorId: user.id, body, pinned: fd.get("pinned") === "on", audience: "EVERYONE" },
  });
  try {
    await saveUploads(filesFrom(fd), user.id, { announcementId: post.id });
  } catch (e) {
    await deleteBlobs({ announcementId: post.id });
    await db.announcement.delete({ where: { id: post.id } });
    return uploadFail(e);
  }

  await audit(user.id, "stream.post", { type: "Announcement", id: post.id }, { classroomId: classroom.id });
  await notify(
    (await studentIdsOf(classroom.id)).filter((id) => id !== user.id),
    { title: "classroom.notify.newPost", body: `${classroom.name}: ${excerpt(body)}`, link: `/classrooms/${classroom.id}` },
  );
  refresh(classroom.id);
  return ok();
}

export async function updatePost(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await loadEditablePost(str(fd, "postId"));
  if (!ctx) return fail("common.denied");
  const { user, post } = ctx;
  if (post.classroom?.archived) return fail("classroom.errors.archived");

  const body = str(fd, "body");
  if (!body) return fail("common.invalidInput", { body: "common.required" });
  if (body.length > MAX_POST) return fail("common.invalidInput", { body: "classroom.errors.tooLong" });

  await db.announcement.update({ where: { id: post.id }, data: { body, pinned: fd.get("pinned") === "on" } });
  try {
    await saveUploads(filesFrom(fd), user.id, { announcementId: post.id });
  } catch (e) {
    refresh(post.classroomId);
    return uploadFail(e);
  }
  const removeIds = fd.getAll("removeFile").filter((v): v is string => typeof v === "string");
  if (removeIds.length) {
    const files = await db.fileObject.findMany({ where: { id: { in: removeIds }, announcementId: post.id }, select: { id: true } });
    for (const f of files) await deleteFileObject(f.id);
  }

  await audit(user.id, "stream.update", { type: "Announcement", id: post.id });
  refresh(post.classroomId);
  return ok("common.saved");
}

export async function deletePost(postId: string) {
  const ctx = await loadEditablePost(postId);
  if (!ctx) return;
  await deleteBlobs({ announcementId: ctx.post.id });
  await db.announcement.delete({ where: { id: ctx.post.id } });
  await audit(ctx.user.id, "stream.delete", { type: "Announcement", id: ctx.post.id }, { classroomId: ctx.post.classroomId });
  refresh(ctx.post.classroomId);
}

export async function togglePin(postId: string) {
  const user = await requireActiveUser();
  const post = await db.announcement.findUnique({ where: { id: postId }, select: { id: true, classroomId: true, pinned: true } });
  if (!post?.classroomId) return;
  const access = await getClassroomAccess(user, post.classroomId);
  if (!access.canTeach) return;
  await db.announcement.update({ where: { id: post.id }, data: { pinned: !post.pinned } });
  await audit(user.id, post.pinned ? "stream.unpin" : "stream.pin", { type: "Announcement", id: post.id });
  refresh(post.classroomId);
}

// target is "announcement:<id>", "assignment:<id>" or "private:<assignmentId>:<studentId>"
export async function addComment(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireActiveUser();
  const body = str(fd, "body");
  if (!body) return fail("common.invalidInput", { body: "common.required" });
  if (body.length > MAX_COMMENT) return fail("common.invalidInput", { body: "classroom.errors.tooLong" });

  const [kind, id, studentId] = str(fd, "target").split(":");
  if (!id) return fail();

  if (kind === "announcement") {
    const post = await db.announcement.findUnique({
      where: { id },
      select: { id: true, classroomId: true, classroom: { select: { archived: true } } },
    });
    if (!post?.classroomId) return fail();
    const access = await getClassroomAccess(user, post.classroomId);
    if (!access.canView) return fail("common.denied");
    if (post.classroom?.archived) return fail("classroom.errors.archived");
    await db.comment.create({ data: { authorId: user.id, body, announcementId: post.id } });
    refresh(post.classroomId);
    return ok();
  }

  if (kind !== "assignment" && kind !== "private") return fail();

  const a = await db.assignment.findUnique({
    where: { id },
    select: { id: true, title: true, classroomId: true, published: true, type: true, classroom: { select: { archived: true } } },
  });
  if (!a) return fail();
  const access = await getClassroomAccess(user, a.classroomId);
  if (!access.canView || (access.isStudent && !a.published)) return fail("common.denied");
  if (a.classroom.archived) return fail("classroom.errors.archived");

  if (kind === "assignment") {
    await db.comment.create({ data: { authorId: user.id, body, assignmentId: a.id } });
    refresh(a.classroomId);
    return ok();
  }

  if (!studentId || a.type === "MATERIAL") return fail();
  if (access.isStudent ? studentId !== user.id : !access.canTeach) return fail("common.denied");
  const member = await db.classroomMember.findUnique({
    where: { classroomId_userId: { classroomId: a.classroomId, userId: studentId } },
    select: { role: true },
  });
  if (member?.role !== "STUDENT") return fail();

  const sub = await db.submission.upsert({
    where: { assignmentId_studentId: { assignmentId: a.id, studentId } },
    create: { assignmentId: a.id, studentId },
    update: {},
    select: { id: true },
  });
  await db.comment.create({ data: { authorId: user.id, body, submissionId: sub.id } });

  const link = `/classrooms/${a.classroomId}/classwork/${a.id}`;
  if (access.isStudent) {
    await notify(await mentorIdsOf(a.classroomId), {
      title: "classwork.notify.privateComment",
      body: a.title,
      link: `${link}?view=work`,
    });
  } else {
    await notify([studentId], { title: "classwork.notify.privateComment", body: a.title, link });
  }
  refresh(a.classroomId);
  return ok();
}

export async function deleteComment(commentId: string) {
  const user = await requireActiveUser();
  const c = await db.comment.findUnique({
    where: { id: commentId },
    select: {
      id: true,
      authorId: true,
      announcement: { select: { classroomId: true } },
      assignment: { select: { classroomId: true } },
      submission: { select: { assignment: { select: { classroomId: true } } } },
    },
  });
  if (!c) return;
  const classroomId = c.announcement?.classroomId ?? c.assignment?.classroomId ?? c.submission?.assignment.classroomId;
  if (!classroomId) return;
  const access = await getClassroomAccess(user, classroomId);
  if (!access.canView) return;
  const own = c.authorId === user.id;
  if (!own && !access.canTeach) return;

  await db.comment.delete({ where: { id: c.id } });
  if (!own) await audit(user.id, "comment.delete", { type: "Comment", id: c.id }, { classroomId });
  refresh(classroomId);
}
