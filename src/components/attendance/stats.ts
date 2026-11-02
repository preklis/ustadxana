import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { isAttended, type Rate } from "./constants";

export * from "./constants";

function finish(r: Rate): Rate {
  return { ...r, percent: r.total ? Math.round((r.attended / r.total) * 100) : null };
}

export async function attendanceByStudent(where: Prisma.AttendanceRecordWhereInput) {
  const rows = await db.attendanceRecord.groupBy({ by: ["studentId", "status"], where, _count: { _all: true } });
  const map = new Map<string, Rate>();
  for (const r of rows) {
    const cur = map.get(r.studentId) ?? { attended: 0, total: 0, percent: null };
    cur.total += r._count._all;
    if (isAttended(r.status)) cur.attended += r._count._all;
    map.set(r.studentId, cur);
  }
  for (const [k, v] of map) map.set(k, finish(v));
  return map;
}

export async function aggregateRate(where: Prisma.AttendanceRecordWhereInput): Promise<Rate> {
  const rows = await db.attendanceRecord.groupBy({ by: ["status"], where, _count: { _all: true } });
  const r: Rate = { attended: 0, total: 0, percent: null };
  for (const row of rows) {
    r.total += row._count._all;
    if (isAttended(row.status)) r.attended += row._count._all;
  }
  return finish(r);
}

// past-due work counts even if missing (0%), returned work counts early, the rest is ignored
export async function gradeAverageByStudent(classroomId: string, studentIds: string[]) {
  const now = new Date();
  const assignments = await db.assignment.findMany({
    where: { classroomId, published: true, maxPoints: { gt: 0 }, type: { not: "MATERIAL" } },
    select: { id: true, maxPoints: true, dueAt: true },
  });
  const subs =
    assignments.length && studentIds.length
      ? await db.submission.findMany({
          where: {
            assignmentId: { in: assignments.map((a) => a.id) },
            studentId: { in: studentIds },
            status: "RETURNED",
            grade: { not: null },
          },
          select: { assignmentId: true, studentId: true, grade: true },
        })
      : [];
  const graded = new Map<string, Map<string, number>>();
  for (const s of subs) {
    const m = graded.get(s.studentId) ?? new Map<string, number>();
    m.set(s.assignmentId, s.grade ?? 0);
    graded.set(s.studentId, m);
  }
  const out = new Map<string, { percent: number | null; counted: number; total: number }>();
  for (const sid of studentIds) {
    const mine = graded.get(sid) ?? new Map<string, number>();
    let sum = 0;
    let counted = 0;
    for (const a of assignments) {
      const g = mine.get(a.id);
      const pastDue = a.dueAt !== null && a.dueAt < now;
      if (g === undefined && !pastDue) continue;
      counted++;
      sum += Math.min(1, Math.max(0, (g ?? 0) / (a.maxPoints ?? 1)));
    }
    out.set(sid, { percent: counted ? Math.round((sum / counted) * 100) : null, counted, total: assignments.length });
  }
  return out;
}
