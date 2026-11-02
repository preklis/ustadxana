import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2, ListTodo, PartyPopper } from "lucide-react";
import { db } from "@/lib/db";
import { requireActiveUser } from "@/lib/auth/session";
import { getI18n } from "@/i18n/server";
import { cn, formatDate } from "@/lib/utils";
import { Card, CLASSROOM_COLORS, EmptyState, PageHeader, Tabs } from "@/components/ui/primitives";
import { TypeIcon, WorkBadge, workLabel, workState } from "@/components/classroom/work-status";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t("classwork.todo.title") };
}

type Tab = "assigned" | "missing" | "done";

export default async function TodoPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireActiveUser();
  if (user.role !== "STUDENT") redirect("/classrooms");
  const { t, locale } = await getI18n();
  const sp = await searchParams;
  const tab: Tab = sp.tab === "missing" || sp.tab === "done" ? sp.tab : "assigned";
  const now = new Date();

  const items = await db.assignment.findMany({
    where: {
      published: true,
      type: { in: ["ASSIGNMENT", "QUESTION"] },
      classroom: { archived: false, members: { some: { userId: user.id, role: "STUDENT" } } },
    },
    select: {
      id: true,
      title: true,
      type: true,
      dueAt: true,
      maxPoints: true,
      createdAt: true,
      classroom: { select: { id: true, name: true, color: true } },
      submissions: { where: { studentId: user.id }, select: { status: true, isLate: true, grade: true, submittedAt: true } },
    },
  });

  const rows = items.map((a) => {
    const sub = a.submissions[0] ?? null;
    return { a, sub, state: workState(a.dueAt, sub, now) };
  });
  const groups: Record<Tab, typeof rows> = {
    assigned: rows
      .filter((r) => r.state === "ASSIGNED")
      .sort((x, y) => (x.a.dueAt?.getTime() ?? Infinity) - (y.a.dueAt?.getTime() ?? Infinity) || y.a.createdAt.getTime() - x.a.createdAt.getTime()),
    missing: rows.filter((r) => r.state === "MISSING").sort((x, y) => y.a.dueAt!.getTime() - x.a.dueAt!.getTime()),
    done: rows
      .filter((r) => r.state !== "ASSIGNED" && r.state !== "MISSING")
      .sort((x, y) => (y.sub?.submittedAt?.getTime() ?? 0) - (x.sub?.submittedAt?.getTime() ?? 0)),
  };
  const list = groups[tab];

  const tabs = (["assigned", "missing", "done"] as Tab[]).map((k) => ({
    key: k,
    href: k === "assigned" ? "/todo" : `/todo?tab=${k}`,
    label: (
      <span className="flex items-center gap-2">
        {t(`classwork.todo.${k}`)}
        <span
          className={cn(
            "rounded-full px-1.5 py-0.5 text-[11px] font-semibold leading-none",
            k === "missing" && groups[k].length > 0
              ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
              : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
          )}
        >
          {groups[k].length}
        </span>
      </span>
    ),
  }));

  return (
    <div>
      <PageHeader title={t("classwork.todo.title")} description={t("classwork.todo.subtitle")} />
      <Tabs tabs={tabs} active={tab} />

      {list.length === 0 ? (
        <EmptyState
          icon={tab === "done" ? <ListTodo className="h-10 w-10" /> : tab === "missing" ? <CheckCircle2 className="h-10 w-10" /> : <PartyPopper className="h-10 w-10" />}
          title={t(`classwork.todo.empty.${tab}`)}
        />
      ) : (
        <Card className="divide-y divide-slate-100 dark:divide-slate-800">
          {list.map(({ a, sub, state }) => (
            <Link
              key={a.id}
              href={`/classrooms/${a.classroom.id}/classwork/${a.id}`}
              className="flex items-center gap-3 px-4 py-3 transition hover:bg-slate-50 dark:hover:bg-slate-800/50"
            >
              <TypeIcon type={a.type} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-slate-900 dark:text-slate-100">{a.title}</p>
                <p className="flex min-w-0 items-center gap-1.5 text-xs text-slate-500">
                  <span
                    className={cn("inline-block h-2 w-2 shrink-0 rounded-full bg-gradient-to-br", CLASSROOM_COLORS[a.classroom.color] ?? CLASSROOM_COLORS.blue)}
                  />
                  <span className="truncate">{a.classroom.name}</span>
                </p>
              </div>
              <div className="shrink-0 text-right">
                <WorkBadge state={state} label={workLabel(t, state, sub?.grade, a.maxPoints)} />
                <p className={cn("mt-1 text-xs", state === "MISSING" ? "text-red-600 dark:text-red-400" : "text-slate-500")}>
                  {tab === "done" && sub?.submittedAt
                    ? formatDate(sub.submittedAt, locale, true)
                    : a.dueAt
                      ? t("classwork.dueOn", { date: formatDate(a.dueAt, locale, true) })
                      : t("classwork.noDue")}
                </p>
              </div>
            </Link>
          ))}
        </Card>
      )}
    </div>
  );
}
