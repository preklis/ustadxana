import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { getClassroomAccess } from "@/lib/permissions";
import { getI18n } from "@/i18n/server";
import { audit } from "@/lib/audit";
import { fullName } from "@/lib/utils";
import { fmtNum, loadGradebook } from "../gradebook";

function csvCell(v: string | number | null | undefined) {
  const s = v == null ? "" : String(v);
  // guard against formula injection, quote every cell
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user || user.status !== "ACTIVE") return new NextResponse("Unauthorized", { status: 401 });
  const classroom = await db.classroom.findUnique({ where: { id }, select: { id: true, name: true } });
  if (!classroom) return new NextResponse("Not found", { status: 404 });
  const access = await getClassroomAccess(user, classroom.id);
  if (!access.canViewGrades) return new NextResponse("Forbidden", { status: 403 });

  const { t } = await getI18n();
  const { assignments, rows, cell, columnAverage } = await loadGradebook(classroom.id);

  const header = [
    t("classwork.gradebook.student"),
    t("common.email"),
    ...assignments.map((a) => (a.maxPoints != null ? `${a.title} (${a.maxPoints})` : a.title)),
    `${t("classwork.gradebook.average")} %`,
  ];
  const lines = [header.map(csvCell).join(",")];
  for (const { student, average } of rows) {
    lines.push(
      [
        fullName(student),
        student.email,
        ...assignments.map((a) => {
          const c = cell(student.id, a.id);
          return c.grade != null ? c.grade : c.state === "MISSING" ? t("classwork.status.MISSING") : "";
        }),
        fmtNum(average),
      ]
        .map(csvCell)
        .join(","),
    );
  }
  lines.push(
    [t("classwork.gradebook.classAverage"), "", ...assignments.map((a) => fmtNum(columnAverage(a.id))), ""].map(csvCell).join(","),
  );

  await audit(user.id, "grades.export", { type: "Classroom", id: classroom.id });

  const filename = `${classroom.name} - ${t("classroom.tabs.grades")}.csv`;
  const asciiName = filename.replace(/[^\x20-\x7e]/g, "_").replace(/"/g, "");
  return new NextResponse(`﻿${lines.join("\r\n")}\r\n`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Cache-Control": "no-store",
    },
  });
}
