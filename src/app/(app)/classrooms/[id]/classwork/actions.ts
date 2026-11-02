"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { AssignmentType } from "@prisma/client";
import { db } from "@/lib/db";
import { requireActiveUser } from "@/lib/auth/session";
import { getClassroomAccess } from "@/lib/permissions";
import { fail, ok, str, type ActionState } from "@/lib/action";
import { audit, notify } from "@/lib/audit";
import { deleteBlobs, deleteFileObject, filesFrom, saveUploads, UploadError } from "@/lib/storage";
import { fromDateTimeLocal, splitLinks } from "@/lib/utils";

const TYPES: AssignmentType[] = ["ASSIGNMENT", "MATERIAL", "QUESTION"];
const MAX_TITLE = 200;
const MAX_DESCRIPTION = 10000;
const MAX_TOPIC = 80;
const MAX_POINTS = 1000;
const MAX_TEXT = 10000;
const MAX_FEEDBACK = 5000;

function uploadFail(e: unknown): ActionState {
  if (e instanceof UploadError) return fail(e.code === "tooLarge" ? "common.uploadTooLarge" : "common.uploadBlocked");
  throw e;
}

function refresh(classroomId: string) {
  revalidatePath(`/classrooms/${classroomId}`, "layout");
  revalidatePath("/todo");
}

async function studentIdsOf(classroomId: string) {
  const rows = await db.classroomMember.findMany({ where: { classroomId, role: "STUDENT" }, select: { userId: true } });
  return rows.map((r) => r.userId);
}

async function teacherFor(classroomId: string) {
  const user = await requireActiveUser();
  const classroom = await db.classroom.findUnique({ where: { id: classroomId }, select: { id: true, name: true, archived: true } });
  if (!classroom) return null;
  const access = await getClassroomAccess(user, classroom.id);
  if (!access.canTeach) return null;
  return { user, classroom };
}

export async function saveAssignment(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const assignmentId = str(fd, "assignmentId") || null;
  const existing = assignmentId ? await db.assignment.findUnique({ where: { id: assignmentId } }) : null;
  if (assignmentId && !existing) return fail();
  const ctx = await teacherFor(existing?.classroomId ?? str(fd, "classroomId"));
  if (!ctx) return fail("common.denied");
  const { user, classroom } = ctx;
  if (classroom.archived) return fail("classroom.errors.archived");

  const errors: Record<string, string> = {};
  const typeRaw = str(fd, "type") as AssignmentType;
  const type = TYPES.includes(typeRaw) ? typeRaw : "ASSIGNMENT";
  const isMaterial = type === "MATERIAL";

  const title = str(fd, "title");
  if (!title) errors.title = "common.required";
  else if (title.length > MAX_TITLE) errors.title = "classroom.errors.tooLong";

  const description = str(fd, "description");
  if (description.length > MAX_DESCRIPTION) errors.description = "classroom.errors.tooLong";

  let maxPoints: number | null = null;
  const pointsRaw = str(fd, "maxPoints");
  if (!isMaterial && pointsRaw) {
    const n = Number(pointsRaw);
    if (!Number.isInteger(n) || n < 1 || n > MAX_POINTS) errors.maxPoints = "classwork.errors.points";
    else maxPoints = n;
  }

  let dueAt: Date | null = null;
  const dueRaw = str(fd, "dueAt");
  if (!isMaterial && dueRaw) {
    dueAt = fromDateTimeLocal(dueRaw);
    if (!dueAt) errors.dueAt = "classwork.errors.dueAt";
  }

  const topicSel = str(fd, "topicId");
  const newTopic = str(fd, "newTopic");
  let topicId: string | null = null;
  if (topicSel === "__new") {
    if (!newTopic) errors.newTopic = "common.required";
    else if (newTopic.length > MAX_TOPIC) errors.newTopic = "classroom.errors.tooLong";
  } else if (topicSel) {
    const topic = await db.topic.findFirst({ where: { id: topicSel, classroomId: classroom.id }, select: { id: true } });
    if (!topic) errors.topicId = "classwork.errors.topic";
    else topicId = topic.id;
  }

  if (Object.keys(errors).length) return fail("common.invalidInput", errors);

  if (topicSel === "__new") {
    const agg = await db.topic.aggregate({ where: { classroomId: classroom.id }, _max: { position: true } });
    const topic = await db.topic.create({
      data: { classroomId: classroom.id, name: newTopic, position: (agg._max.position ?? -1) + 1 },
    });
    topicId = topic.id;
  }

  const publish = str(fd, "intent") !== "draft";
  const now = new Date();
  const data = {
    type,
    title,
    description: description || null,
    topicId,
    links: splitLinks(str(fd, "links")),
    maxPoints,
    dueAt,
    allowLate: isMaterial ? true : fd.get("allowLate") === "on",
    published: publish,
  };

  let id: string;
  let newlyPublished: boolean;
  if (existing) {
    newlyPublished = publish && !existing.published;
    await db.assignment.update({
      where: { id: existing.id },
      data: { ...data, publishedAt: newlyPublished ? now : publish ? existing.publishedAt ?? now : null },
    });
    id = existing.id;
    try {
      await saveUploads(filesFrom(fd), user.id, { assignmentId: id });
    } catch (e) {
      refresh(classroom.id);
      return uploadFail(e);
    }
    const removeIds = fd.getAll("removeFile").filter((v): v is string => typeof v === "string");
    if (removeIds.length) {
      const files = await db.fileObject.findMany({ where: { id: { in: removeIds }, assignmentId: id }, select: { id: true } });
      for (const f of files) await deleteFileObject(f.id);
    }
    await audit(user.id, "classwork.update", { type: "Assignment", id }, { published: publish });
  } else {
    newlyPublished = publish;
    const created = await db.assignment.create({
      data: { ...data, classroomId: classroom.id, authorId: user.id, publishedAt: publish ? now : null },
    });
    id = created.id;
    try {
      await saveUploads(filesFrom(fd), user.id, { assignmentId: id });
    } catch (e) {
      await deleteBlobs({ assignmentId: id });
      await db.assignment.delete({ where: { id } });
      return uploadFail(e);
    }
    await audit(user.id, "classwork.create", { type: "Assignment", id }, { type, published: publish });
  }

  if (newlyPublished) {
    await notify(await studentIdsOf(classroom.id), {
      title: `classwork.notify.new${type}`,
      body: `${classroom.name}: ${title}`,
      link: `/classrooms/${classroom.id}/classwork/${id}`,
    });
  }

  refresh(classroom.id);
  redirect(`/classrooms/${classroom.id}/classwork/${id}`);
}

export async function deleteAssignment(assignmentId: string) {
  const a = await db.assignment.findUnique({ where: { id: assignmentId }, select: { id: true, classroomId: true, title: true } });
  if (!a) return;
  const ctx = await teacherFor(a.classroomId);
  if (!ctx) return;

  const subs = await db.submission.findMany({ where: { assignmentId: a.id }, select: { id: true } });
  for (const s of subs) await deleteBlobs({ submissionId: s.id });
  await deleteBlobs({ assignmentId: a.id });
  await db.assignment.delete({ where: { id: a.id } });
  await audit(ctx.user.id, "classwork.delete", { type: "Assignment", id: a.id }, { title: a.title });
  refresh(a.classroomId);
  redirect(`/classrooms/${a.classroomId}/classwork`);
}

export async function createTopic(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await teacherFor(str(fd, "classroomId"));
  if (!ctx) return fail("common.denied");
  if (ctx.classroom.archived) return fail("classroom.errors.archived");
  const name = str(fd, "name");
  if (!name) return fail("common.invalidInput", { name: "common.required" });
  if (name.length > MAX_TOPIC) return fail("common.invalidInput", { name: "classroom.errors.tooLong" });

  const agg = await db.topic.aggregate({ where: { classroomId: ctx.classroom.id }, _max: { position: true } });
  const topic = await db.topic.create({
    data: { classroomId: ctx.classroom.id, name, position: (agg._max.position ?? -1) + 1 },
  });
  await audit(ctx.user.id, "topic.create", { type: "Topic", id: topic.id });
  refresh(ctx.classroom.id);
  return ok();
}

export async function renameTopic(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const topic = await db.topic.findUnique({ where: { id: str(fd, "topicId") }, select: { id: true, classroomId: true } });
  if (!topic) return fail();
  const ctx = await teacherFor(topic.classroomId);
  if (!ctx) return fail("common.denied");
  const name = str(fd, "name");
  if (!name) return fail("common.invalidInput", { name: "common.required" });
  if (name.length > MAX_TOPIC) return fail("common.invalidInput", { name: "classroom.errors.tooLong" });

  await db.topic.update({ where: { id: topic.id }, data: { name } });
  await audit(ctx.user.id, "topic.rename", { type: "Topic", id: topic.id }, { name });
  refresh(topic.classroomId);
  return ok("common.saved");
}

export async function deleteTopic(topicId: string) {
  const topic = await db.topic.findUnique({ where: { id: topicId }, select: { id: true, classroomId: true, name: true } });
  if (!topic) return;
  const ctx = await teacherFor(topic.classroomId);
  if (!ctx) return;
  // assignments stay, FK sets topicId to null (onDelete: SetNull)
  await db.topic.delete({ where: { id: topic.id } });
  await audit(ctx.user.id, "topic.delete", { type: "Topic", id: topic.id }, { name: topic.name });
  refresh(topic.classroomId);
}

export async function moveTopic(topicId: string, direction: "up" | "down") {
  const topic = await db.topic.findUnique({ where: { id: topicId }, select: { id: true, classroomId: true } });
  if (!topic) return;
  const ctx = await teacherFor(topic.classroomId);
  if (!ctx) return;

  const all = await db.topic.findMany({
    where: { classroomId: topic.classroomId },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    select: { id: true },
  });
  const ids = all.map((x) => x.id);
  const i = ids.indexOf(topic.id);
  const j = direction === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= ids.length) return;
  [ids[i], ids[j]] = [ids[j], ids[i]];
  await db.$transaction(ids.map((id, position) => db.topic.update({ where: { id }, data: { position } })));
  refresh(topic.classroomId);
}

async function loadForStudent(assignmentId: string) {
  const user = await requireActiveUser();
  const a = await db.assignment.findUnique({
    where: { id: assignmentId },
    select: {
      id: true,
      classroomId: true,
      type: true,
      published: true,
      dueAt: true,
      allowLate: true,
      classroom: { select: { archived: true } },
    },
  });
  if (!a || !a.published || a.type === "MATERIAL") return null;
  const access = await getClassroomAccess(user, a.classroomId);
  if (!access.isStudent) return null;
  return { user, a };
}

export async function saveWork(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await loadForStudent(str(fd, "assignmentId"));
  if (!ctx) return fail("common.denied");
  const { user, a } = ctx;
  if (a.classroom.archived) return fail("classroom.errors.archived");

  const key = { assignmentId_studentId: { assignmentId: a.id, studentId: user.id } };
  const existing = await db.submission.findUnique({ where: key, select: { status: true } });
  if (existing && existing.status !== "DRAFT") return fail("classwork.errors.alreadyTurnedIn");

  const now = new Date();
  const pastDue = !!a.dueAt && now > a.dueAt;
  if (pastDue && !a.allowLate) return fail("classwork.errors.closed");

  const text = str(fd, "text");
  if (text.length > MAX_TEXT) return fail("common.invalidInput", { text: "classroom.errors.tooLong" });
  const isQuestion = a.type === "QUESTION";
  const links = isQuestion ? [] : splitLinks(str(fd, "links"));
  const turnIn = str(fd, "intent") === "turnIn";
  if (turnIn && isQuestion && !text) return fail("classwork.errors.answerRequired", { text: "common.required" });

  const sub = await db.submission.upsert({
    where: key,
    create: { assignmentId: a.id, studentId: user.id, text: text || null, links },
    update: { text: text || null, links },
    select: { id: true },
  });
  if (!isQuestion) {
    try {
      await saveUploads(filesFrom(fd), user.id, { submissionId: sub.id });
    } catch (e) {
      refresh(a.classroomId);
      return uploadFail(e);
    }
  }
  if (turnIn) {
    await db.submission.updateMany({
      where: { id: sub.id, status: "DRAFT" },
      data: { status: "SUBMITTED", submittedAt: now, isLate: pastDue },
    });
  }
  refresh(a.classroomId);
  return ok(turnIn ? "classwork.work.turnedInMsg" : "classwork.work.savedMsg");
}

export async function unsubmitWork(assignmentId: string) {
  const ctx = await loadForStudent(assignmentId);
  if (!ctx) return;
  const { user, a } = ctx;
  if (a.classroom.archived) return;
  // unsubmitting after a hard deadline would lock them out
  if (a.dueAt && new Date() > a.dueAt && !a.allowLate) return;
  await db.submission.updateMany({
    where: { assignmentId: a.id, studentId: user.id, status: "SUBMITTED", grade: null },
    data: { status: "DRAFT", submittedAt: null, isLate: false },
  });
  refresh(a.classroomId);
}

export async function deleteSubmissionFile(fileId: string) {
  const user = await requireActiveUser();
  const file = await db.fileObject.findUnique({
    where: { id: fileId },
    select: {
      id: true,
      uploaderId: true,
      submission: { select: { studentId: true, status: true, assignment: { select: { classroomId: true } } } },
    },
  });
  const sub = file?.submission;
  if (!file || !sub || sub.studentId !== user.id || file.uploaderId !== user.id || sub.status !== "DRAFT") return;
  const access = await getClassroomAccess(user, sub.assignment.classroomId);
  if (!access.isStudent) return;
  await deleteFileObject(file.id);
  refresh(sub.assignment.classroomId);
}

export async function gradeSubmission(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const a = await db.assignment.findUnique({
    where: { id: str(fd, "assignmentId") },
    select: { id: true, title: true, classroomId: true, type: true, maxPoints: true },
  });
  if (!a || a.type === "MATERIAL") return fail();
  const ctx = await teacherFor(a.classroomId);
  if (!ctx) return fail("common.denied");

  const studentId = str(fd, "studentId");
  const member = await db.classroomMember.findUnique({
    where: { classroomId_userId: { classroomId: a.classroomId, userId: studentId } },
    select: { role: true },
  });
  if (member?.role !== "STUDENT") return fail();

  let grade: number | null = null;
  const gradeRaw = str(fd, "grade");
  if (a.maxPoints != null && gradeRaw !== "") {
    const n = Number(gradeRaw);
    if (!Number.isInteger(n) || n < 0 || n > a.maxPoints) {
      return fail("common.invalidInput", { grade: "classwork.errors.grade" });
    }
    grade = n;
  }
  const feedback = str(fd, "feedback");
  if (feedback.length > MAX_FEEDBACK) return fail("common.invalidInput", { feedback: "classroom.errors.tooLong" });

  const ret = str(fd, "intent") === "return";
  const now = new Date();
  const graded = { grade, feedback: feedback || null, gradedById: ctx.user.id, gradedAt: grade != null ? now : null };
  await db.submission.upsert({
    where: { assignmentId_studentId: { assignmentId: a.id, studentId } },
    create: { assignmentId: a.id, studentId, ...graded, ...(ret ? { status: "RETURNED", returnedAt: now } : {}) },
    update: { ...graded, ...(ret ? { status: "RETURNED", returnedAt: now } : {}) },
  });

  await audit(ctx.user.id, ret ? "submission.return" : "submission.grade", { type: "Assignment", id: a.id }, { studentId, grade });
  if (ret) {
    await notify([studentId], {
      title: "classwork.notify.returned",
      body: a.title,
      link: `/classrooms/${a.classroomId}/classwork/${a.id}`,
    });
  }
  refresh(a.classroomId);
  return ok(ret ? "classwork.grading.returnedMsg" : "common.saved");
}

export async function returnAllGraded(assignmentId: string) {
  const a = await db.assignment.findUnique({ where: { id: assignmentId }, select: { id: true, title: true, classroomId: true } });
  if (!a) return;
  const ctx = await teacherFor(a.classroomId);
  if (!ctx) return;
  const subs = await db.submission.findMany({
    where: { assignmentId: a.id, grade: { not: null }, status: { not: "RETURNED" } },
    select: { id: true, studentId: true },
  });
  if (!subs.length) return;
  await db.submission.updateMany({
    where: { id: { in: subs.map((s) => s.id) } },
    data: { status: "RETURNED", returnedAt: new Date() },
  });
  await audit(ctx.user.id, "submission.returnAll", { type: "Assignment", id: a.id }, { count: subs.length });
  await notify(
    subs.map((s) => s.studentId),
    { title: "classwork.notify.returned", body: a.title, link: `/classrooms/${a.classroomId}/classwork/${a.id}` },
  );
  refresh(a.classroomId);
}
