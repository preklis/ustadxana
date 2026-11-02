"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ClassroomRole, Prisma, Role } from "@prisma/client";
import { db } from "@/lib/db";
import { fail, ok, optStr, str, zodFieldErrors, type ActionState } from "@/lib/action";
import { requirePermission } from "@/lib/auth/session";
import { audit, notify } from "@/lib/audit";
import { deleteBlobs } from "@/lib/storage";
import { CLASSROOM_COLORS } from "@/components/ui/primitives";

const classroomSchema = z.object({
  seasonId: z.string().min(1),
  name: z.string().min(2).max(120),
  track: z.string().max(80).nullable(),
  description: z.string().max(2000).nullable(),
  room: z.string().max(80).nullable(),
  schedule: z.string().max(200).nullable(),
  color: z.string().refine((c) => c in CLASSROOM_COLORS),
});

function revalidateClassroom(id?: string) {
  revalidatePath("/admin/classrooms");
  if (id) revalidatePath(`/admin/classrooms/${id}`);
  revalidatePath("/classrooms");
}

export async function saveClassroomAction(id: string | null, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await requirePermission("MANAGE_CLASSROOMS");
  const parsed = classroomSchema.safeParse({
    seasonId: str(fd, "seasonId"),
    name: str(fd, "name"),
    track: optStr(fd, "track"),
    description: optStr(fd, "description"),
    room: optStr(fd, "room"),
    schedule: optStr(fd, "schedule"),
    color: str(fd, "color") || "blue",
  });
  if (!parsed.success) return fail("common.invalidInput", zodFieldErrors(parsed.error.issues));
  const d = parsed.data;
  const season = await db.season.findUnique({ where: { id: d.seasonId }, select: { id: true } });
  if (!season) return fail("common.invalidInput", { seasonId: "common.required" });

  if (id) {
    const existing = await db.classroom.findUnique({ where: { id }, select: { id: true } });
    if (!existing) return fail("common.genericError");
    await db.classroom.update({ where: { id }, data: d });
    await audit(actor.id, "classroom.update", { type: "classroom", id }, { name: d.name, seasonId: d.seasonId });
    revalidateClassroom(id);
    return ok("common.saved");
  }
  const created = await db.classroom.create({ data: d });
  await audit(actor.id, "classroom.create", { type: "classroom", id: created.id }, { name: d.name, seasonId: d.seasonId });
  revalidateClassroom();
  return ok("admin.classrooms.created", { id: created.id });
}

export async function setClassroomArchivedAction(id: string, archived: boolean): Promise<ActionState> {
  const actor = await requirePermission("MANAGE_CLASSROOMS");
  const res = await db.classroom.updateMany({ where: { id }, data: { archived } });
  if (!res.count) return fail("common.genericError");
  await audit(actor.id, archived ? "classroom.archive" : "classroom.unarchive", { type: "classroom", id });
  revalidateClassroom(id);
  return ok();
}

export async function deleteClassroomAction(id: string, redirectTo?: string): Promise<ActionState> {
  const actor = await requirePermission("MANAGE_CLASSROOMS");
  const classroom = await db.classroom.findUnique({ where: { id }, select: { id: true, name: true, seasonId: true } });
  if (!classroom) return fail("common.genericError");
  const submissions = await db.submission.count({ where: { assignment: { classroomId: id } } });
  if (submissions > 0) return fail("admin.classrooms.hasSubmissions");

  const [assignments, announcements] = await Promise.all([
    db.assignment.findMany({ where: { classroomId: id }, select: { id: true } }),
    db.announcement.findMany({ where: { classroomId: id }, select: { id: true } }),
  ]);
  for (const a of assignments) await deleteBlobs({ assignmentId: a.id });
  for (const a of announcements) await deleteBlobs({ announcementId: a.id });
  await db.classroom.delete({ where: { id } });
  await audit(actor.id, "classroom.delete", { type: "classroom", id }, { name: classroom.name, seasonId: classroom.seasonId });
  revalidateClassroom();
  if (redirectTo) redirect(redirectTo.startsWith("/admin/") ? redirectTo : "/admin/classrooms");
  return ok();
}

const ELIGIBLE: Record<ClassroomRole, Role[]> = {
  MENTOR: ["MENTOR"],
  STAFF: ["STAFF", "ADMIN", "SUPERADMIN"],
  STUDENT: ["STUDENT"],
};

const CLASSROOM_ROLES = ["MENTOR", "STAFF", "STUDENT"] as const;

export type Candidate = { id: string; firstName: string; lastName: string; email: string; avatarFileId: string | null; title: string | null; track: string | null };

function eligibleWhere(classroomId: string, role: ClassroomRole): Prisma.UserWhereInput {
  return {
    role: { in: ELIGIBLE[role] },
    status: "ACTIVE",
    memberships: { none: { classroomId } },
  };
}

export async function searchCandidatesAction(classroomId: string, roleRaw: string, q: string): Promise<Candidate[]> {
  await requirePermission("MANAGE_CLASSROOMS");
  const role = z.enum(CLASSROOM_ROLES).safeParse(roleRaw);
  if (!role.success) return [];
  const terms = q.trim().slice(0, 100).split(/\s+/).filter(Boolean).slice(0, 4);
  const users = await db.user.findMany({
    where: {
      ...eligibleWhere(classroomId, role.data),
      ...(terms.length
        ? {
            AND: terms.map((term) => ({
              OR: [
                { email: { contains: term, mode: "insensitive" as const } },
                { firstName: { contains: term, mode: "insensitive" as const } },
                { lastName: { contains: term, mode: "insensitive" as const } },
                { title: { contains: term, mode: "insensitive" as const } },
                { profile: { preferredTrack: { contains: term, mode: "insensitive" as const } } },
              ],
            })),
          }
        : {}),
    },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    take: 50,
    select: { id: true, firstName: true, lastName: true, email: true, avatarFileId: true, title: true, profile: { select: { preferredTrack: true } } },
  });
  return users.map(({ profile, ...u }) => ({ ...u, track: profile?.preferredTrack ?? null }));
}

export async function addMembersAction(classroomId: string, roleRaw: string, userIds: string[]): Promise<ActionState> {
  const actor = await requirePermission("MANAGE_CLASSROOMS");
  const role = z.enum(CLASSROOM_ROLES).safeParse(roleRaw);
  const ids = z.array(z.string().min(1).max(40)).min(1).max(500).safeParse([...new Set(userIds)]);
  if (!role.success || !ids.success) return fail("admin.members.noneSelected");
  const classroom = await db.classroom.findUnique({ where: { id: classroomId }, select: { id: true, name: true } });
  if (!classroom) return fail("common.genericError");

  const eligible = await db.user.findMany({
    where: { id: { in: ids.data }, ...eligibleWhere(classroomId, role.data) },
    select: { id: true },
  });
  if (!eligible.length) return fail("admin.members.noneEligible");
  const added = eligible.map((u) => u.id);
  await db.classroomMember.createMany({
    data: added.map((userId) => ({ classroomId, userId, role: role.data })),
    skipDuplicates: true,
  });
  await audit(actor.id, "classroom.addMembers", { type: "classroom", id: classroomId }, { role: role.data, userIds: added });
  await notify(added, { title: "admin.notify.addedToClassroom", body: classroom.name, link: `/classrooms/${classroomId}` });
  revalidateClassroom(classroomId);
  return ok("admin.members.added", { count: String(added.length) });
}

export async function removeMemberAction(classroomId: string, userId: string): Promise<ActionState> {
  const actor = await requirePermission("MANAGE_CLASSROOMS");
  const res = await db.classroomMember.deleteMany({ where: { classroomId, userId } });
  if (res.count) await audit(actor.id, "classroom.removeMember", { type: "classroom", id: classroomId }, { userId });
  revalidateClassroom(classroomId);
  revalidatePath(`/admin/users/${userId}`);
  return ok();
}

export async function addMatchingStudentsAction(classroomId: string): Promise<ActionState> {
  const actor = await requirePermission("MANAGE_CLASSROOMS");
  const classroom = await db.classroom.findUnique({ where: { id: classroomId }, select: { id: true, name: true, track: true } });
  if (!classroom) return fail("common.genericError");
  const track = (classroom.track || classroom.name).trim();
  const students = await db.user.findMany({
    where: {
      ...eligibleWhere(classroomId, "STUDENT"),
      profile: { preferredTrack: { equals: track, mode: "insensitive" } },
    },
    select: { id: true },
  });
  if (!students.length) return fail("admin.members.noMatches");
  const ids = students.map((s) => s.id);
  await db.classroomMember.createMany({ data: ids.map((userId) => ({ classroomId, userId, role: "STUDENT" as const })), skipDuplicates: true });
  await audit(actor.id, "classroom.addMembers", { type: "classroom", id: classroomId }, { role: "STUDENT", userIds: ids, byTrack: track });
  await notify(ids, { title: "admin.notify.addedToClassroom", body: classroom.name, link: `/classrooms/${classroomId}` });
  revalidateClassroom(classroomId);
  return ok("admin.members.added", { count: String(ids.length) });
}
