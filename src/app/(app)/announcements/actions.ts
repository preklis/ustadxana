"use server";

import { revalidatePath } from "next/cache";
import type { AnnouncementAudience, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireActiveUser, type SessionUser } from "@/lib/auth/session";
import { can, isTeam, TEAM_ROLES } from "@/lib/permissions";
import { audit, notify } from "@/lib/audit";
import { fail, ok, str, type ActionState } from "@/lib/action";
import { deleteBlobs, deleteFileObject, filesFrom, saveUploads, UploadError } from "@/lib/storage";
import { getActiveSeason } from "@/lib/season";

const AUDIENCES: AnnouncementAudience[] = ["EVERYONE", "STUDENTS", "TEAM"];
const TITLE_MAX = 200;
const BODY_MAX = 10000;
const COMMENT_MAX = 2000;

function visibleAudiences(user: Pick<SessionUser, "role">): AnnouncementAudience[] {
  return isTeam(user) ? ["EVERYONE", "STUDENTS", "TEAM"] : ["EVERYONE", "STUDENTS"];
}

async function findVisible(user: SessionUser, id: string) {
  return db.announcement.findFirst({
    where: { id, classroomId: null, audience: { in: visibleAudiences(user) } },
    select: { id: true, authorId: true, audience: true, title: true },
  });
}

function parse(fd: FormData) {
  const title = str(fd, "title");
  const body = str(fd, "body");
  const audienceRaw = str(fd, "audience");
  const fe: Record<string, string> = {};
  if (title.length > TITLE_MAX) fe.title = "announcements.errors.titleTooLong";
  if (!body) fe.body = "common.required";
  else if (body.length > BODY_MAX) fe.body = "announcements.errors.bodyTooLong";
  if (!AUDIENCES.includes(audienceRaw as AnnouncementAudience)) fe.audience = "common.required";
  return {
    fe,
    data: { title: title || null, body, audience: audienceRaw as AnnouncementAudience, pinned: fd.get("pinned") === "on" },
  };
}

function uploadFail(e: unknown) {
  if (e instanceof UploadError) return fail(e.code === "tooLarge" ? "common.uploadTooLarge" : "common.uploadBlocked");
  throw e;
}

async function recipients(audience: AnnouncementAudience, exceptId: string) {
  const where: Prisma.UserWhereInput = { status: "ACTIVE", id: { not: exceptId } };
  if (audience === "STUDENTS") where.role = "STUDENT";
  if (audience === "TEAM") where.role = { in: TEAM_ROLES };
  const users = await db.user.findMany({ where, select: { id: true } });
  return users.map((u) => u.id);
}

export async function createAnnouncement(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireActiveUser();
  if (!can(user, "POST_ANNOUNCEMENTS")) return fail("announcements.errors.forbidden");
  const { fe, data } = parse(fd);
  if (Object.keys(fe).length) return fail("common.invalidInput", fe);

  const season = await getActiveSeason();
  const a = await db.announcement.create({ data: { ...data, classroomId: null, seasonId: season?.id ?? null, authorId: user.id } });
  try {
    await saveUploads(filesFrom(fd), user.id, { announcementId: a.id });
  } catch (e) {
    await deleteBlobs({ announcementId: a.id });
    await db.announcement.delete({ where: { id: a.id } });
    return uploadFail(e);
  }

  await audit(user.id, "announcement.create", { type: "announcement", id: a.id }, { audience: a.audience });
  await notify(await recipients(a.audience, user.id), {
    title: "announcements.notify.title",
    body: a.title ?? (a.body.length > 140 ? `${a.body.slice(0, 140)}…` : a.body),
    link: `/announcements#a-${a.id}`,
  });
  revalidatePath("/announcements");
  revalidatePath("/dashboard");
  return ok("announcements.posted");
}

export async function updateAnnouncement(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireActiveUser();
  if (!can(user, "POST_ANNOUNCEMENTS")) return fail("announcements.errors.forbidden");
  const id = str(fd, "id");
  const existing = await db.announcement.findFirst({ where: { id, classroomId: null }, select: { id: true } });
  if (!existing) return fail("announcements.errors.notFound");
  const { fe, data } = parse(fd);
  if (Object.keys(fe).length) return fail("common.invalidInput", fe);

  try {
    await saveUploads(filesFrom(fd), user.id, { announcementId: id });
  } catch (e) {
    return uploadFail(e);
  }
  const removeIds = fd.getAll("removeFile").filter((v): v is string => typeof v === "string");
  if (removeIds.length) {
    const owned = await db.fileObject.findMany({ where: { id: { in: removeIds }, announcementId: id }, select: { id: true } });
    for (const f of owned) await deleteFileObject(f.id);
  }
  await db.announcement.update({ where: { id }, data });
  await audit(user.id, "announcement.update", { type: "announcement", id });
  revalidatePath("/announcements");
  revalidatePath("/dashboard");
  return ok("announcements.updated");
}

export async function deleteAnnouncement(id: string) {
  const user = await requireActiveUser();
  if (!can(user, "POST_ANNOUNCEMENTS")) return;
  const a = await db.announcement.findFirst({ where: { id, classroomId: null }, select: { id: true, title: true } });
  if (!a) return;
  await deleteBlobs({ announcementId: id });
  await db.announcement.delete({ where: { id } });
  await audit(user.id, "announcement.delete", { type: "announcement", id }, { title: a.title });
  revalidatePath("/announcements");
  revalidatePath("/dashboard");
}

export async function togglePin(id: string) {
  const user = await requireActiveUser();
  if (!can(user, "POST_ANNOUNCEMENTS")) return;
  const a = await db.announcement.findFirst({ where: { id, classroomId: null }, select: { pinned: true } });
  if (!a) return;
  await db.announcement.update({ where: { id }, data: { pinned: !a.pinned } });
  await audit(user.id, a.pinned ? "announcement.unpin" : "announcement.pin", { type: "announcement", id });
  revalidatePath("/announcements");
  revalidatePath("/dashboard");
}

export async function addComment(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireActiveUser();
  const announcementId = str(fd, "announcementId");
  const body = str(fd, "body");
  if (!body) return fail("common.invalidInput", { body: "common.required" });
  if (body.length > COMMENT_MAX) return fail("common.invalidInput", { body: "announcements.errors.commentTooLong" });
  const a = await findVisible(user, announcementId);
  if (!a) return fail("announcements.errors.notFound");
  await db.comment.create({ data: { authorId: user.id, body, announcementId: a.id } });
  if (a.authorId !== user.id) {
    await notify([a.authorId], { title: "announcements.notify.comment", body: a.title ?? undefined, link: `/announcements#a-${a.id}` });
  }
  revalidatePath("/announcements");
  return ok();
}

export async function deleteComment(id: string) {
  const user = await requireActiveUser();
  const c = await db.comment.findFirst({ where: { id, announcementId: { not: null }, announcement: { classroomId: null } }, select: { id: true, authorId: true } });
  if (!c) return;
  if (c.authorId !== user.id && !can(user, "POST_ANNOUNCEMENTS")) return;
  await db.comment.delete({ where: { id } });
  if (c.authorId !== user.id) await audit(user.id, "announcement.commentDelete", { type: "comment", id });
  revalidatePath("/announcements");
}
