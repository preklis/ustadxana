import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { getClassroomAccess } from "@/lib/permissions";
import { getI18n } from "@/i18n/server";
import { fullName } from "@/lib/utils";
import { dayKey, rateOf } from "@/components/attendance/constants";

function csvCell(v: string | number | null | undefined) {
  const s = v === null || v === undefined ? "" : String(v);
  // guard against spreadsheet formula injection
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\n\r;]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user || user.status !== "ACTIVE") return new NextResponse("Unauthorized", { status: 401 });
  const access = await getClassroomAccess(user, id);
  if (!access.canView || access.isStudent) return new NextResponse("Forbidden", { status: 403 });

  const classroom = await db.classroom.findUnique({ where: { id }, select: { name: true } });
  if (!classroom) return new NextResponse("Not found", { status: 404 });

  const { t } = await getI18n();
  const [members, sessions] = await Promise.all([
    db.classroomMember.findMany({
      where: { classroomId: id, role: "STUDENT" },
      select: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
    }),
    db.attendanceSession.findMany({
      where: { classroomId: id },
      orderBy: { date: "asc" },
      select: { id: true, date: true, records: { select: { studentId: true, status: true, note: true } } },
    }),
  ]);
  const students = members.map((m) => m.user).sort((a, b) => fullName(a).localeCompare(fullName(b)));
  const cell = new Map<string, (typeof sessions)[number]["records"][number]>();
  for (const s of sessions) for (const r of s.records) cell.set(`${r.studentId}:${s.id}`, r);

  const header = [t("attendance.student"), t("common.email"), ...sessions.map((s) => dayKey(s.date)), t("attendance.attended"), t("attendance.recorded"), "%"];
  const lines = [header.map(csvCell).join(",")];
  for (const st of students) {
    const recs = sessions.map((s) => cell.get(`${st.id}:${s.id}`));
    const rate = rateOf(recs.filter((r) => !!r).map((r) => r!.status));
    lines.push(
      [
        fullName(st),
        st.email,
        ...recs.map((r) => (r ? t(`attendance.status.${r.status}`) + (r.note ? ` (${r.note})` : "") : "")),
        rate.attended,
        rate.total,
        rate.percent ?? "",
      ]
        .map(csvCell)
        .join(","),
    );
  }

  const safeName = classroom.name.replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "") || "classroom";
  const filename = `${t("attendance.title")}-${safeName}.csv`;
  return new NextResponse("﻿" + lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="attendance.csv"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Cache-Control": "no-store",
    },
  });
}
