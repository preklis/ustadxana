import "server-only";
import { db } from "@/lib/db";
import { workState, type WorkState } from "@/components/classroom/work-status";
import { classroomStudents } from "../../_lib/context";

export type GradebookCell = { grade: number | null; returned: boolean; state: WorkState };

export async function loadGradebook(classroomId: string) {
  const [students, assignments] = await Promise.all([
    classroomStudents(classroomId),
    db.assignment.findMany({
      where: { classroomId, published: true, type: { in: ["ASSIGNMENT", "QUESTION"] } },
      orderBy: [{ dueAt: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
      select: { id: true, title: true, type: true, maxPoints: true, dueAt: true },
    }),
  ]);
  const subs = assignments.length
    ? await db.submission.findMany({
        where: { assignmentId: { in: assignments.map((a) => a.id) } },
        select: { assignmentId: true, studentId: true, status: true, isLate: true, grade: true },
      })
    : [];

  const now = new Date();
  const subMap = new Map(subs.map((s) => [`${s.studentId}:${s.assignmentId}`, s]));
  const cells = new Map<string, GradebookCell>();
  const colSums = new Map<string, { sum: number; n: number }>();

  const rows = students.map((st) => {
    let pct = 0;
    let pctN = 0;
    for (const a of assignments) {
      const sub = subMap.get(`${st.id}:${a.id}`);
      const grade = a.maxPoints != null ? (sub?.grade ?? null) : null;
      cells.set(`${st.id}:${a.id}`, { grade, returned: sub?.status === "RETURNED", state: workState(a.dueAt, sub, now) });
      if (grade != null && a.maxPoints) {
        pct += (grade / a.maxPoints) * 100;
        pctN += 1;
        const c = colSums.get(a.id) ?? { sum: 0, n: 0 };
        c.sum += grade;
        c.n += 1;
        colSums.set(a.id, c);
      }
    }
    return { student: st, average: pctN ? pct / pctN : null };
  });

  const columnAverage = (assignmentId: string) => {
    const c = colSums.get(assignmentId);
    return c && c.n ? c.sum / c.n : null;
  };
  const cell = (studentId: string, assignmentId: string) => cells.get(`${studentId}:${assignmentId}`)!;

  return { assignments, rows, cell, columnAverage };
}

export function fmtNum(n: number | null, digits = 1) {
  if (n == null) return "";
  return Number.isInteger(n) ? String(n) : n.toFixed(digits);
}
