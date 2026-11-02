"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { fail, ok, str, type ActionState } from "@/lib/action";
import { requirePermission } from "@/lib/auth/session";
import { sendStatusEmail } from "@/lib/mail";
import { audit, notify } from "@/lib/audit";
import { getActiveSeason } from "@/lib/season";

const idList = z.array(z.string().min(1).max(40)).max(500);

function revalidate() {
  revalidatePath("/admin/approvals");
  revalidatePath("/admin/users");
  revalidatePath("/", "layout"); // sidebar pending badge
}

export async function approveStudentsAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await requirePermission("APPROVE_STUDENTS");
  const ids = idList.safeParse([...new Set(fd.getAll("userIds").map(String).filter(Boolean))]);
  const cls = idList.safeParse([...new Set(fd.getAll("classroomIds").map(String).filter(Boolean))]);
  if (!ids.success || !cls.success || ids.data.length === 0) return fail("admin.approvals.noneSelected");

  const students = await db.user.findMany({
    where: { id: { in: ids.data }, role: "STUDENT", status: "PENDING_APPROVAL" },
    select: { id: true, email: true, locale: true },
  });
  if (!students.length) return fail("admin.approvals.nothingToApprove");

  let classroomIds: string[] = [];
  if (cls.data.length) {
    const season = await getActiveSeason();
    const found = await db.classroom.findMany({
      where: { id: { in: cls.data }, archived: false, ...(season ? { seasonId: season.id } : {}) },
      select: { id: true },
    });
    classroomIds = found.map((c) => c.id);
  }

  const now = new Date();
  const studentIds = students.map((s) => s.id);
  await db.$transaction([
    db.user.updateMany({
      where: { id: { in: studentIds }, status: "PENDING_APPROVAL" },
      data: { status: "ACTIVE", approvedAt: now, approvedById: actor.id, rejectionReason: null },
    }),
    ...(classroomIds.length
      ? [
          db.classroomMember.createMany({
            data: studentIds.flatMap((userId) => classroomIds.map((classroomId) => ({ userId, classroomId, role: "STUDENT" as const }))),
            skipDuplicates: true,
          }),
        ]
      : []),
  ]);

  for (const s of students) {
    await audit(actor.id, "student.approve", { type: "user", id: s.id }, classroomIds.length ? { classroomIds } : undefined);
    await sendStatusEmail(s.email, true, s.locale).catch((e) => console.error("[mail] approve failed", e));
  }
  await notify(studentIds, { title: "admin.notify.approvedTitle", body: "admin.notify.approvedBody", link: "/dashboard" });
  revalidate();
  return ok(students.length === 1 ? "admin.approvals.approvedOne" : "admin.approvals.approvedMany", { count: String(students.length) });
}

export async function rejectStudentAction(userId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await requirePermission("APPROVE_STUDENTS");
  const reason = str(fd, "reason").slice(0, 2000);
  if (reason.length < 3) return fail("common.invalidInput", { reason: "admin.approvals.reasonRequired" });
  const student = await db.user.findFirst({
    where: { id: userId, role: "STUDENT", status: "PENDING_APPROVAL" },
    select: { id: true, email: true, locale: true },
  });
  if (!student) return fail("admin.approvals.nothingToApprove");
  await db.user.update({ where: { id: student.id }, data: { status: "REJECTED", rejectionReason: reason } });
  await audit(actor.id, "student.reject", { type: "user", id: student.id }, { reason });
  await sendStatusEmail(student.email, false, student.locale, reason).catch((e) => console.error("[mail] reject failed", e));
  revalidate();
  return ok("admin.approvals.rejected");
}

export async function reopenApplicationAction(userId: string): Promise<ActionState> {
  const actor = await requirePermission("APPROVE_STUDENTS");
  const student = await db.user.findFirst({
    where: { id: userId, role: "STUDENT", status: "REJECTED" },
    select: { id: true, profile: { select: { id: true } } },
  });
  if (!student) return fail("common.genericError");
  await db.user.update({
    where: { id: student.id },
    data: { status: student.profile ? "PENDING_APPROVAL" : "PROFILE_INCOMPLETE", rejectionReason: null },
  });
  await audit(actor.id, "student.reopen", { type: "user", id: student.id });
  revalidate();
  return ok();
}
