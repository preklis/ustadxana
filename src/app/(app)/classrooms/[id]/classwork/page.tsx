import Link from "next/link";
import { ClipboardList, EyeOff, Plus } from "lucide-react";
import { db } from "@/lib/db";
import { getI18n } from "@/i18n/server";
import { formatDate } from "@/lib/utils";
import { LinkButton } from "@/components/ui/button";
import { Badge, Card, EmptyState } from "@/components/ui/primitives";
import { TopicManager } from "@/components/classroom/topic-manager";
import { TypeIcon, WorkBadge, workLabel, workState } from "@/components/classroom/work-status";
import { getClassroomContext } from "../../_lib/context";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [{ classroom }, { t }] = await Promise.all([getClassroomContext(id), getI18n()]);
  return { title: `${t("classroom.tabs.classwork")} · ${classroom.name}` };
}

export default async function ClassworkPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, classroom, access } = await getClassroomContext(id);
  const { t, locale } = await getI18n();
  const now = new Date();
  const student = access.isStudent;

  const [topics, assignments, studentCount] = await Promise.all([
    db.topic.findMany({
      where: { classroomId: classroom.id },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
      select: { id: true, name: true },
    }),
    db.assignment.findMany({
      where: { classroomId: classroom.id, ...(student ? { published: true } : {}) },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        type: true,
        topicId: true,
        dueAt: true,
        maxPoints: true,
        published: true,
        createdAt: true,
        submissions: student
          ? { where: { studentId: user.id }, select: { status: true, isLate: true, grade: true } }
          : false,
        _count: student ? false : { select: { submissions: { where: { status: { in: ["SUBMITTED", "RETURNED"] } } } } },
      },
    }),
    student ? Promise.resolve(0) : db.classroomMember.count({ where: { classroomId: classroom.id, role: "STUDENT" } }),
  ]);

  const groups = [
    { key: "none", name: null as string | null, items: assignments.filter((a) => !a.topicId) },
    ...topics.map((tp) => ({ key: tp.id, name: tp.name, items: assignments.filter((a) => a.topicId === tp.id) })),
  ].filter((g) => g.items.length > 0 || (!student && g.name !== null));

  const base = `/classrooms/${classroom.id}/classwork`;
  const writable = access.canTeach && !classroom.archived;

  return (
    <div className="space-y-6">
      {writable && (
        <div className="flex flex-wrap items-center gap-2">
          <LinkButton href={`${base}/new`}>
            <Plus className="h-4 w-4" />
            {t("classwork.create")}
          </LinkButton>
          <TopicManager classroomId={classroom.id} topics={topics} />
        </div>
      )}

      {assignments.length === 0 && groups.length === 0 ? (
        <EmptyState
          icon={<ClipboardList className="h-10 w-10" />}
          title={t("classwork.emptyTitle")}
          description={writable ? t("classwork.emptyTeacher") : t("classwork.emptyStudent")}
          action={
            writable ? (
              <LinkButton href={`${base}/new`} variant="outline">
                <Plus className="h-4 w-4" />
                {t("classwork.create")}
              </LinkButton>
            ) : undefined
          }
        />
      ) : (
        groups.map((g) => (
          <section key={g.key}>
            {g.name !== null && (
              <div className="mb-2 flex items-center justify-between gap-3 border-b-2 border-brand-600/70 pb-2">
                <h2 className="text-lg font-semibold text-brand-700 dark:text-brand-400">{g.name}</h2>
                {writable && (
                  <Link href={`${base}/new?topic=${g.key}`} className="text-sm text-slate-500 hover:text-brand-600">
                    + {t("common.add")}
                  </Link>
                )}
              </div>
            )}
            {g.items.length === 0 ? (
              <p className="px-1 py-3 text-sm text-slate-500">{t("classwork.topicEmpty")}</p>
            ) : (
              <Card className="divide-y divide-slate-100 dark:divide-slate-800">
                {g.items.map((a) => {
                  const sub = a.submissions?.[0];
                  const state = a.type !== "MATERIAL" && student ? workState(a.dueAt, sub, now) : null;
                  return (
                    <Link
                      key={a.id}
                      href={`${base}/${a.id}`}
                      className="flex items-center gap-3 px-4 py-3 transition hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    >
                      <TypeIcon type={a.type} muted={!a.published} />
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-2 font-medium text-slate-900 dark:text-slate-100">
                          <span className="truncate">{a.title}</span>
                          {!a.published && (
                            <Badge className="shrink-0 gap-1">
                              <EyeOff className="h-3 w-3" />
                              {t("classwork.draft")}
                            </Badge>
                          )}
                        </p>
                        <p className="text-xs text-slate-500">
                          {a.type === "MATERIAL"
                            ? t("classwork.postedOn", { date: formatDate(a.createdAt, locale) })
                            : a.dueAt
                              ? t("classwork.dueOn", { date: formatDate(a.dueAt, locale, true) })
                              : t("classwork.noDue")}
                        </p>
                      </div>
                      {state && (
                        <WorkBadge state={state} label={workLabel(t, state, sub?.grade, a.maxPoints)} className="shrink-0" />
                      )}
                      {!student && a.type !== "MATERIAL" && a.published && (
                        <div className="hidden shrink-0 text-right sm:block">
                          <p className="text-lg font-semibold leading-tight text-slate-900 dark:text-white">
                            {a._count?.submissions ?? 0}
                            <span className="text-sm font-normal text-slate-400"> / {studentCount}</span>
                          </p>
                          <p className="text-xs text-slate-500">{t("classwork.turnedInCount")}</p>
                        </div>
                      )}
                    </Link>
                  );
                })}
              </Card>
            )}
          </section>
        ))
      )}
    </div>
  );
}
