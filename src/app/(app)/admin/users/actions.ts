"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ClassroomRole, Role } from "@prisma/client";
import { db } from "@/lib/db";
import { fail, ok, optStr, str, zodFieldErrors, type ActionState } from "@/lib/action";
import { requirePermission, destroyAllSessions } from "@/lib/auth/session";
import { generateTempPassword, hashPassword } from "@/lib/auth/password";
import { sendWelcomeEmail } from "@/lib/mail";
import { audit, notify } from "@/lib/audit";
import { assignableRoles, can, canEditUser, TEAM_ROLES } from "@/lib/permissions";
import { normalizeEmail } from "@/lib/utils";
import { deleteFileObject } from "@/lib/storage";
import { getLocale } from "@/i18n/server";
import { isUniqueViolation, resolveExtraPermissions } from "../_lib/shared";

const ROLES = ["SUPERADMIN", "ADMIN", "STAFF", "MENTOR", "APPLICANT_CHECKER", "STUDENT"] as const;
const CLASSROOM_ROLES = ["MENTOR", "STAFF", "STUDENT"] as const;

const createSchema = z.object({
  email: z.string().email("admin.errors.invalidEmail"),
  firstName: z.string().min(1).max(60),
  lastName: z.string().min(1).max(60),
  role: z.enum(ROLES),
  title: z.string().max(80).nullable(),
  classroomRole: z.enum(CLASSROOM_ROLES),
});

function defaultClassroomRole(role: Role): ClassroomRole {
  if (role === "MENTOR") return "MENTOR";
  if (role === "STUDENT") return "STUDENT";
  return "STAFF";
}

export async function createUserAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await requirePermission("MANAGE_USERS");
  const parsed = createSchema.safeParse({
    email: normalizeEmail(str(fd, "email")),
    firstName: str(fd, "firstName"),
    lastName: str(fd, "lastName"),
    role: str(fd, "role"),
    title: optStr(fd, "title"),
    classroomRole: str(fd, "classroomRole") || "STAFF",
  });
  if (!parsed.success) return fail("common.invalidInput", zodFieldErrors(parsed.error.issues));
  const d = parsed.data;
  if (!assignableRoles(actor).includes(d.role)) return fail("admin.errors.roleNotAllowed", { role: "admin.errors.roleNotAllowed" });

  const extraPermissions = resolveExtraPermissions(actor, d.role, fd.getAll("permissions").map(String));

  // only people who manage classrooms can enroll
  let classroomIds: string[] = [];
  const requested = [...new Set(fd.getAll("classroomIds").map(String).filter(Boolean))];
  if (requested.length) {
    if (!can(actor, "MANAGE_CLASSROOMS")) return fail("admin.errors.noClassroomPermission");
    const found = await db.classroom.findMany({ where: { id: { in: requested } }, select: { id: true } });
    classroomIds = found.map((c) => c.id);
  }
  const classroomRole = d.role === "STUDENT" ? "STUDENT" : d.classroomRole === "STUDENT" ? defaultClassroomRole(d.role) : d.classroomRole;

  if (await db.user.findUnique({ where: { email: d.email }, select: { id: true } })) {
    return fail("admin.errors.emailTaken", { email: "admin.errors.emailTaken" });
  }

  const tempPassword = generateTempPassword();
  const locale = await getLocale();
  let userId: string;
  try {
    const user = await db.user.create({
      data: {
        email: d.email,
        passwordHash: await hashPassword(tempPassword),
        role: d.role,
        status: "ACTIVE",
        firstName: d.firstName,
        lastName: d.lastName,
        title: d.title,
        extraPermissions,
        mustChangePassword: true,
        locale,
        approvedAt: new Date(),
        approvedById: actor.id,
        memberships: classroomIds.length
          ? { createMany: { data: classroomIds.map((classroomId) => ({ classroomId, role: classroomRole })) } }
          : undefined,
      },
    });
    userId = user.id;
  } catch (e) {
    if (isUniqueViolation(e)) return fail("admin.errors.emailTaken", { email: "admin.errors.emailTaken" });
    throw e;
  }

  await audit(actor.id, "user.create", { type: "user", id: userId }, {
    email: d.email,
    role: d.role,
    extraPermissions,
    classroomIds,
  });
  if (classroomIds.length) {
    await notify([userId], { title: "admin.notify.addedToClassrooms", link: "/classrooms" });
  }
  await sendWelcomeEmail(d.email, tempPassword, locale).catch((e) => console.error("[mail] welcome failed", e));
  revalidatePath("/admin/users");
  return ok("admin.users.created", { tempPassword, email: d.email, userId });
}

// csv import (team accounts)

type ImportRow = { line: number; email: string; status: "created" | "error"; error?: string; tempPassword?: string };

export async function importUsersAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await requirePermission("MANAGE_USERS");
  let raw = str(fd, "csv");
  const file = fd.get("file");
  if (file && typeof file === "object" && "size" in file && file.size > 0) {
    if (file.size > 512 * 1024) return fail("admin.import.tooLarge");
    raw = (await file.text()).trim();
  }
  if (!raw) return fail("admin.import.empty", { csv: "common.required" });

  const lines = raw.split(/\r?\n/).map((l) => l.trim());
  const rows: { line: number; cols: string[] }[] = [];
  lines.forEach((l, i) => {
    if (!l) return;
    const cols = l.split(/[,;\t]/).map((c) => c.trim().replace(/^"(.*)"$/, "$1").trim());
    if (i === 0 && cols[0]?.toLowerCase() === "email") return; // header
    rows.push({ line: i + 1, cols });
  });
  if (!rows.length) return fail("admin.import.empty");
  if (rows.length > 200) return fail("admin.import.tooMany");

  const allowed = assignableRoles(actor).filter((r) => TEAM_ROLES.includes(r));
  const locale = await getLocale();
  const results: ImportRow[] = [];
  const seen = new Set<string>();

  for (const { line, cols } of rows) {
    const [emailRaw = "", firstName = "", lastName = "", roleRaw = "", title = ""] = cols;
    const email = normalizeEmail(emailRaw);
    const role = roleRaw.toUpperCase() as Role;
    let error: string | undefined;
    if (!z.string().email().safeParse(email).success) error = "admin.errors.invalidEmail";
    else if (!firstName || !lastName) error = "admin.import.missingName";
    else if (!allowed.includes(role)) error = "admin.errors.roleNotAllowed";
    else if (seen.has(email)) error = "admin.import.duplicateInFile";
    if (error) {
      results.push({ line, email: emailRaw, status: "error", error });
      continue;
    }
    seen.add(email);
    const tempPassword = generateTempPassword();
    try {
      const user = await db.user.create({
        data: {
          email,
          passwordHash: await hashPassword(tempPassword),
          role,
          status: "ACTIVE",
          firstName: firstName.slice(0, 60),
          lastName: lastName.slice(0, 60),
          title: title ? title.slice(0, 80) : null,
          mustChangePassword: true,
          locale,
          approvedAt: new Date(),
          approvedById: actor.id,
        },
      });
      await audit(actor.id, "user.create", { type: "user", id: user.id }, { email, role, via: "csv" });
      await sendWelcomeEmail(email, tempPassword, locale).catch((e) => console.error("[mail] welcome failed", e));
      results.push({ line, email, status: "created", tempPassword });
    } catch (e) {
      if (isUniqueViolation(e)) results.push({ line, email, status: "error", error: "admin.errors.emailTaken" });
      else results.push({ line, email, status: "error", error: "common.genericError" });
    }
  }
  const created = results.filter((r) => r.status === "created").length;
  if (created) await audit(actor.id, "user.import", null, { created, failed: results.length - created });
  revalidatePath("/admin/users");
  return ok("admin.import.done", { results: JSON.stringify(results), created: String(created) });
}

async function loadEditableTarget(targetId: string) {
  const actor = await requirePermission("MANAGE_USERS");
  const target = await db.user.findUnique({ where: { id: targetId }, omit: { passwordHash: true } });
  if (!target || !canEditUser(actor, target)) return { actor, target: null };
  return { actor, target };
}

const updateSchema = z.object({
  firstName: z.string().min(1).max(60),
  lastName: z.string().min(1).max(60),
  role: z.enum(ROLES),
  title: z.string().max(80).nullable(),
});

export async function updateUserAction(targetId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const { actor, target } = await loadEditableTarget(targetId);
  if (!target) return fail("admin.errors.cannotEdit");
  const parsed = updateSchema.safeParse({
    firstName: str(fd, "firstName"),
    lastName: str(fd, "lastName"),
    role: str(fd, "role"),
    title: optStr(fd, "title"),
  });
  if (!parsed.success) return fail("common.invalidInput", zodFieldErrors(parsed.error.issues));
  const d = parsed.data;
  if (d.role !== target.role && !assignableRoles(actor).includes(d.role)) {
    return fail("admin.errors.roleNotAllowed", { role: "admin.errors.roleNotAllowed" });
  }
  // pending/incomplete students cant be promoted from here
  if (d.role !== target.role && (target.status === "PROFILE_INCOMPLETE" || target.status === "PENDING_APPROVAL")) {
    return fail("admin.errors.roleChangePending", { role: "admin.errors.roleChangePending" });
  }
  const extraPermissions = resolveExtraPermissions(actor, d.role, fd.getAll("permissions").map(String), target.extraPermissions);

  await db.user.update({
    where: { id: target.id },
    data: { firstName: d.firstName, lastName: d.lastName, title: d.title, role: d.role, extraPermissions },
  });
  await audit(actor.id, "user.update", { type: "user", id: target.id }, {
    ...(d.role !== target.role ? { role: { from: target.role, to: d.role } } : {}),
    extraPermissions,
    title: d.title,
    name: `${d.firstName} ${d.lastName}`,
  });
  revalidatePath(`/admin/users/${target.id}`);
  revalidatePath("/admin/users");
  return ok("common.saved");
}

export async function setUserSuspendedAction(targetId: string, suspend: boolean): Promise<ActionState> {
  const { actor, target } = await loadEditableTarget(targetId);
  if (!target) return fail("admin.errors.cannotEdit");
  if (suspend && target.status === "SUSPENDED") return ok();
  if (!suspend && target.status !== "SUSPENDED") return ok();
  await db.user.update({ where: { id: target.id }, data: { status: suspend ? "SUSPENDED" : "ACTIVE" } });
  if (suspend) await destroyAllSessions(target.id);
  await audit(actor.id, suspend ? "user.suspend" : "user.reactivate", { type: "user", id: target.id });
  revalidatePath(`/admin/users/${target.id}`);
  revalidatePath("/admin/users");
  return ok(suspend ? "admin.users.suspended" : "admin.users.reactivated");
}

export async function resetPasswordAction(targetId: string, _prev: ActionState, _fd: FormData): Promise<ActionState> {
  const { actor, target } = await loadEditableTarget(targetId);
  if (!target) return fail("admin.errors.cannotEdit");
  const tempPassword = generateTempPassword();
  await db.user.update({
    where: { id: target.id },
    data: { passwordHash: await hashPassword(tempPassword), mustChangePassword: true },
  });
  await destroyAllSessions(target.id);
  await audit(actor.id, "user.resetPassword", { type: "user", id: target.id });
  await sendWelcomeEmail(target.email, tempPassword, target.locale, "reset").catch((e) => console.error("[mail] reset failed", e));
  revalidatePath(`/admin/users/${target.id}`);
  return ok("admin.users.passwordReset", { tempPassword, email: target.email });
}

export async function deleteUserAction(targetId: string): Promise<ActionState> {
  const { actor, target } = await loadEditableTarget(targetId);
  if (!target) return fail("admin.errors.cannotEdit");
  if (actor.role !== "SUPERADMIN") return fail("admin.errors.superadminOnly");
  const authored = await db.assignment.count({ where: { authorId: target.id } });
  if (authored > 0) return fail("admin.errors.hasAssignments");

  const files = await db.fileObject.findMany({ where: { uploaderId: target.id }, select: { id: true } });
  for (const f of files) await deleteFileObject(f.id).catch(() => {});
  await db.user.delete({ where: { id: target.id } });
  await audit(actor.id, "user.delete", { type: "user", id: target.id }, { email: target.email, role: target.role });
  revalidatePath("/admin/users");
  redirect("/admin/users");
}

export async function removeMembershipAction(targetId: string, classroomId: string): Promise<ActionState> {
  const { actor, target } = await loadEditableTarget(targetId);
  if (!target) return fail("admin.errors.cannotEdit");
  if (!can(actor, "MANAGE_CLASSROOMS")) return fail("admin.errors.noClassroomPermission");
  const res = await db.classroomMember.deleteMany({ where: { userId: target.id, classroomId } });
  if (res.count) {
    await audit(actor.id, "classroom.removeMember", { type: "classroom", id: classroomId }, { userId: target.id });
  }
  revalidatePath(`/admin/users/${target.id}`);
  revalidatePath(`/admin/classrooms/${classroomId}`);
  return ok();
}
