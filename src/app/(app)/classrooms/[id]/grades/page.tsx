import Link from "next/link";
import { notFound } from "next/navigation";
import { Download, Table2 } from "lucide-react";
import { getI18n } from "@/i18n/server";
import { cn, formatDate, fullName } from "@/lib/utils";
import { buttonClass } from "@/components/ui/button";
import { Avatar, Card, EmptyState, td, th } from "@/components/ui/primitives";
import { getClassroomContext } from "../../_lib/context";
import { fmtNum, loadGradebook, type GradebookCell } from "./gradebook";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [{ classroom }, { t }] = await Promise.all([getClassroomContext(id), getI18n()]);
  return { title: `${t("classroom.tabs.grades")} · ${classroom.name}` };
}

export default async function GradesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { classroom, access } = await getClassroomContext(id);
  if (!access.canViewGrades) notFound();
  const { t, locale } = await getI18n();
  const { assignments, rows, cell, columnAverage } = await loadGradebook(classroom.id);
  const base = `/classrooms/${classroom.id}`;

  if (rows.length === 0 || assignments.length === 0) {
    return (
      <EmptyState
        icon={<Table2 className="h-10 w-10" />}
        title={t("classwork.gradebook.emptyTitle")}
        description={rows.length === 0 ? t("classwork.grading.noStudents") : t("classwork.gradebook.noItems")}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-500">{t("classwork.gradebook.hint")}</p>
        <a href={`${base}/grades/export`} className={buttonClass("outline")} download>
          <Download className="h-4 w-4" />
          {t("classwork.gradebook.export")}
        </a>
      </div>

      <Card className="overflow-hidden">
        <div className="max-h-[70vh] overflow-auto">
          <table className="w-full border-separate border-spacing-0 text-left text-sm">
            <thead>
              <tr>
                <th className={cn(th, "sticky left-0 top-0 z-30 min-w-[200px] border-b border-r border-slate-200 dark:border-slate-800")}>
                  {t("classwork.gradebook.student")}
                </th>
                <th className={cn(th, "sticky top-0 z-20 border-b border-slate-200 text-center dark:border-slate-800")}>
                  {t("classwork.gradebook.average")}
                </th>
                {assignments.map((a) => (
                  <th
                    key={a.id}
                    className={cn(th, "sticky top-0 z-20 min-w-[130px] max-w-[170px] border-b border-slate-200 align-bottom normal-case tracking-normal dark:border-slate-800")}
                  >
                    <span className="block text-[11px] font-normal text-slate-400">
                      {a.dueAt ? formatDate(a.dueAt, locale) : t("classwork.noDue")}
                    </span>
                    <Link
                      href={`${base}/classwork/${a.id}?view=work`}
                      className="line-clamp-2 text-sm font-semibold text-slate-700 hover:text-brand-600 dark:text-slate-200"
                      title={a.title}
                    >
                      {a.title}
                    </Link>
                    <span className="block text-[11px] font-normal text-slate-400">
                      {a.maxPoints != null ? t("classwork.gradebook.outOf", { n: a.maxPoints }) : t("classwork.ungraded")}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="bg-slate-50/70 dark:bg-slate-800/30">
                <td className={cn(td, "sticky left-0 z-10 border-r bg-slate-50 font-medium dark:bg-slate-900")}>
                  {t("classwork.gradebook.classAverage")}
                </td>
                <td className={cn(td, "text-center")} />
                {assignments.map((a) => {
                  const avg = columnAverage(a.id);
                  return (
                    <td key={a.id} className={cn(td, "font-medium tabular-nums text-slate-700 dark:text-slate-300")}>
                      {avg != null ? fmtNum(avg) : "—"}
                    </td>
                  );
                })}
              </tr>
              {rows.map(({ student, average }) => (
                <tr key={student.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className={cn(td, "sticky left-0 z-10 border-r bg-white dark:bg-slate-900")}>
                    <div className="flex items-center gap-2.5">
                      <Avatar user={student} size={28} />
                      <span className="truncate font-medium text-slate-900 dark:text-slate-100">{fullName(student)}</span>
                    </div>
                  </td>
                  <td className={cn(td, "text-center font-semibold tabular-nums")}>{average != null ? `${fmtNum(average)}%` : "—"}</td>
                  {assignments.map((a) => (
                    <td key={a.id} className={cn(td, "tabular-nums")}>
                      <Cell c={cell(student.id, a.id)} max={a.maxPoints} t={t} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-500">
        <span>
          <span className="font-semibold text-slate-900 dark:text-white">85</span> — {t("classwork.gradebook.legendReturned")}
        </span>
        <span>
          <span className="italic">85</span> — {t("classwork.grading.draftGrade")}
        </span>
      </div>
    </div>
  );
}

function Cell({ c, max, t }: { c: GradebookCell; max: number | null; t: (k: string) => string }) {
  if (c.grade != null) {
    return (
      <span className={c.returned ? "font-semibold text-slate-900 dark:text-white" : "italic text-slate-500"}>
        {c.grade}
        <span className="text-xs font-normal text-slate-400">/{max}</span>
      </span>
    );
  }
  const map: Record<string, string> = {
    MISSING: "text-red-600 dark:text-red-400",
    TURNED_IN: "text-emerald-600 dark:text-emerald-400",
    TURNED_IN_LATE: "text-orange-600 dark:text-orange-400",
    RETURNED: "text-violet-600 dark:text-violet-400",
  };
  if (c.state === "ASSIGNED") return <span className="text-slate-300 dark:text-slate-600">—</span>;
  return <span className={cn("text-xs font-medium", map[c.state])}>{t(`classwork.status.${c.state}`)}</span>;
}
