"use server";

import { revalidatePath } from "next/cache";
import type { AttendanceStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { requireActiveUser } from "@/lib/auth/session";
import { getClassroomAccess } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import { fail, ok, str, type ActionState } from "@/lib/action";
import { bakuToday, dayKey, isAttendanceStatus, parseDay } from "@/components/attendance/constants";

const NOTE_MAX = 300;

// students with no status picked get their existing record removed
export async function saveAttendance(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireActiveUser();
  const classroomId = str(fd, "classroomId");
  const access = await getClassroomAccess(user, classroomId);
  if (!access.canView || !access.canTakeAttendance) return fail("attendance.errors.forbidden");

  const date = parseDay(str(fd, "date"));
  if (!date) return fail("common.invalidInput", { date: "attendance.errors.invalidDate" });
  if (dayKey(date) > bakuToday()) return fail("common.invalidInput", { date: "attendance.errors.futureDate" });
  const title = str(fd, "title").slice(0, 120) || null;

  const classroom = await db.classroom.findUnique({ where: { id: classroomId }, select: { archived: true } });
  if (!classroom) return fail("attendance.errors.forbidden");

  const students = await db.classroomMember.findMany({ where: { classroomId, role: "STUDENT" }, select: { userId: true } });
  const marks: { studentId: string; status: AttendanceStatus; note: string | null }[] = [];
  const unmarked: string[] = [];
  for (const { userId } of students) {
    const raw = fd.get(`status:${userId}`);
    if (raw === null || raw === "") {
      unmarked.push(userId);
      continue;
    }
    if (!isAttendanceStatus(raw)) return fail("attendance.errors.invalidStatus");
    marks.push({ studentId: userId, status: raw, note: str(fd, `note:${userId}`).slice(0, NOTE_MAX) || null });
  }
  if (!marks.length) return fail("attendance.errors.nothingMarked");

  const session = await db.$transaction(async (tx) => {
    const s = await tx.attendanceSession.upsert({
      where: { classroomId_date: { classroomId, date } },
      create: { classroomId, date, title, takenById: user.id },
      update: { title, takenById: user.id },
    });
    for (const m of marks) {
      await tx.attendanceRecord.upsert({
        where: { sessionId_studentId: { sessionId: s.id, studentId: m.studentId } },
        create: { sessionId: s.id, studentId: m.studentId, status: m.status, note: m.note },
        update: { status: m.status, note: m.note },
      });
    }
    if (unmarked.length) await tx.attendanceRecord.deleteMany({ where: { sessionId: s.id, studentId: { in: unmarked } } });
    return s;
  });

  const counts = marks.reduce<Record<string, number>>((acc, m) => ({ ...acc, [m.status]: (acc[m.status] ?? 0) + 1 }), {});
  await audit(user.id, "attendance.save", { type: "attendanceSession", id: session.id }, { classroomId, date: dayKey(date), counts });
  revalidatePath(`/classrooms/${classroomId}/attendance`);
  revalidatePath("/dashboard");
  return ok("attendance.saved");
}

export async function deleteAttendanceSession(classroomId: string, sessionId: string) {
  const user = await requireActiveUser();
  const access = await getClassroomAccess(user, classroomId);
  if (!access.canView || !access.canTakeAttendance) return;
  const session = await db.attendanceSession.findFirst({ where: { id: sessionId, classroomId }, select: { id: true, date: true } });
  if (!session) return;
  await db.attendanceSession.delete({ where: { id: session.id } });
  await audit(user.id, "attendance.delete", { type: "attendanceSession", id: session.id }, { classroomId, date: dayKey(session.date) });
  revalidatePath(`/classrooms/${classroomId}/attendance`);
  revalidatePath("/dashboard");
}
