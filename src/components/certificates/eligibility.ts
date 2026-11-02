import "server-only";
import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { fullName } from "@/lib/utils";
import { attendanceByStudent, gradeAverageByStudent } from "@/components/attendance/stats";

export type Thresholds = { participation: number; distinctionAttendance: number; distinctionGrade: number };

export const DEFAULT_THRESHOLDS: Thresholds = { participation: 70, distinctionAttendance: 90, distinctionGrade: 85 };

function pct(v: unknown, fallback: number) {
  const n = typeof v === "number" ? v : Number.parseInt(String(v ?? ""), 10);
  return Number.isFinite(n) ? Math.min(100, Math.max(0, Math.round(n))) : fallback;
}

export function parseThresholds(raw: { p?: unknown; da?: unknown; dg?: unknown }): Thresholds {
  return {
    participation: pct(raw.p, DEFAULT_THRESHOLDS.participation),
    distinctionAttendance: pct(raw.da, DEFAULT_THRESHOLDS.distinctionAttendance),
    distinctionGrade: pct(raw.dg, DEFAULT_THRESHOLDS.distinctionGrade),
  };
}

export type StudentEligibility = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  avatarFileId: string | null;
  attendance: number | null;
  sessionsRecorded: number;
  grade: number | null;
  gradedCount: number;
  gradableTotal: number;
  participation: boolean;
  distinction: boolean;
};

export async function classroomEligibility(classroomId: string, th: Thresholds): Promise<StudentEligibility[]> {
  const members = await db.classroomMember.findMany({
    where: { classroomId, role: "STUDENT" },
    select: { user: { select: { id: true, firstName: true, lastName: true, email: true, avatarFileId: true } } },
  });
  const students = members.map((m) => m.user);
  const ids = students.map((s) => s.id);
  const [att, grades] = await Promise.all([
    attendanceByStudent({ session: { classroomId }, studentId: { in: ids } }),
    gradeAverageByStudent(classroomId, ids),
  ]);
  return students
    .map((s) => {
      const a = att.get(s.id);
      const g = grades.get(s.id);
      const attendance = a?.percent ?? null;
      const grade = g?.percent ?? null;
      return {
        ...s,
        attendance,
        sessionsRecorded: a?.total ?? 0,
        grade,
        gradedCount: g?.counted ?? 0,
        gradableTotal: g?.total ?? 0,
        participation: attendance !== null && attendance >= th.participation,
        distinction: attendance !== null && grade !== null && attendance >= th.distinctionAttendance && grade >= th.distinctionGrade,
      };
    })
    .sort((x, y) => fullName(x).localeCompare(fullName(y)));
}

// no look-alikes (I O 0 1), 32 symbols so no modulo bias
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateCertificateCode(length = 10) {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) out += ALPHABET[bytes[i] & 31];
  return out;
}
