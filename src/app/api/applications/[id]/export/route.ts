import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { answerText, parseQuestions, type Answers } from "@/lib/applications/questions";
import { fullName } from "@/lib/utils";
import { getI18n } from "@/i18n/server";

// excel friendly csv: utf-8 bom, and cells that look like formulas get a leading quote
function cell(v: unknown) {
  let s = v === null || v === undefined ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.status !== "ACTIVE" || !can(user, "REVIEW_APPLICATIONS")) return new Response("Forbidden", { status: 403 });
  const { id } = await params;
  const form = await db.applicationForm.findUnique({ where: { id } });
  if (!form) return new Response("Not found", { status: 404 });
  const { t } = await getI18n();
  const questions = parseQuestions(form.questions).filter((q) => q.type !== "section");
  const apps = await db.application.findMany({
    where: { formId: id },
    orderBy: { submittedAt: "asc" },
    include: { reviews: { include: { reviewer: { select: { firstName: true, lastName: true, email: true } } } } },
  });

  const other = t("applications.detail.other");
  const header = [
    t("applications.responses.submitted"),
    t("common.email"),
    t("common.name"),
    t("applications.responses.status"),
    t("applications.responses.score"),
    t("applications.responses.reviews"),
    ...questions.map((q) => q.label),
    t("applications.detail.comment"),
  ];
  const rows = apps.map((a) => {
    const ans = a.answers as Answers;
    return [
      a.submittedAt.toISOString().replace("T", " ").slice(0, 16),
      a.email,
      a.name,
      t(`applications.statuses.${a.status}`),
      a.avgScore ?? "",
      a.reviewCount,
      ...questions.map((q) => answerText(ans[q.id], other)),
      a.reviews.map((r) => `${fullName(r.reviewer)}: ${r.score}${r.comment ? ` - ${r.comment}` : ""}`).join(" | "),
    ];
  });
  const csv = "﻿" + [header, ...rows].map((r) => r.map(cell).join(",")).join("\r\n");
  const name = `${form.slug}-${new Date().toISOString().slice(0, 10)}.csv`;
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "no-store",
    },
  });
}
