import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCheck, ChevronDown, Clock, EyeOff, Lock, MessageSquare, Pencil, Trash2, Undo2, Users, X } from "lucide-react";
import type { AssignmentType, SubmissionStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { getI18n } from "@/i18n/server";
import type { TFunction } from "@/i18n/core";
import { cn, formatDate, fullName } from "@/lib/utils";
import { Attachments } from "@/components/attachments";
import { LinkButton } from "@/components/ui/button";
import { Alert, Avatar, Badge, Card, CardHeader, EmptyState, Tabs } from "@/components/ui/primitives";
import { ConfirmAction } from "@/components/ui/interactive";
import { CommentThread, type CommentItem } from "@/components/classroom/comments";
import { GradeForm, WorkForm } from "@/components/classroom/work-forms";
import { TypeIcon, WorkBadge, workLabel, workState } from "@/components/classroom/work-status";
import { authorSelect, classroomStudents, fileSelect, getClassroomContext } from "../../../_lib/context";
import { deleteAssignment, deleteSubmissionFile, returnAllGraded, unsubmitWork } from "../actions";

type Params = Promise<{ id: string; assignmentId: string }>;
type Me = { id: string; firstName: string; lastName: string; avatarFileId: string | null };

async function load(id: string, assignmentId: string) {
  const ctx = await getClassroomContext(id);
  const assignment = await db.assignment.findFirst({
    where: { id: assignmentId, classroomId: ctx.classroom.id },
    include: {
      author: { select: authorSelect },
      topic: { select: { name: true } },
      attachments: { select: fileSelect, orderBy: { createdAt: "asc" } },
      comments: { orderBy: { createdAt: "asc" }, include: { author: { select: authorSelect } } },
    },
  });
  if (!assignment || (ctx.access.isStudent && !assignment.published)) notFound();
  return { ...ctx, assignment };
}

export async function generateMetadata({ params }: { params: Params }) {
  const { id, assignmentId } = await params;
  const { assignment } = await load(id, assignmentId);
  return { title: assignment.title };
}

export default async function AssignmentPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id, assignmentId } = await params;
  const sp = await searchParams;
  const { user, classroom, access, assignment: a } = await load(id, assignmentId);
  const { t, locale } = await getI18n();
  const me: Me = { id: user.id, firstName: user.firstName, lastName: user.lastName, avatarFileId: user.avatarFileId };
  const writable = !classroom.archived;
  const base = `/classrooms/${classroom.id}/classwork`;
  const hasWork = a.type !== "MATERIAL";
  const showWorkPanel = hasWork && !access.isStudent && (access.canTeach || access.canViewGrades);
  const view = showWorkPanel && sp.view === "work" ? "work" : "instructions";

  const instructions = (
    <Card>
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start">
        <TypeIcon type={a.type} muted={!a.published} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{a.title}</h1>
            {!a.published && (
              <Badge className="gap-1">
                <EyeOff className="h-3 w-3" />
                {t("classwork.draft")}
              </Badge>
            )}
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {fullName(a.author)} · {formatDate(a.publishedAt ?? a.createdAt, locale)}
            {a.topic && ` · ${a.topic.name}`}
          </p>
          {hasWork && (
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm">
              <span className="font-medium text-slate-700 dark:text-slate-300">
                {a.maxPoints != null ? t("classwork.points", { n: a.maxPoints }) : t("classwork.ungraded")}
              </span>
              <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                <Clock className="h-4 w-4" />
                {a.dueAt ? t("classwork.dueOn", { date: formatDate(a.dueAt, locale, true) }) : t("classwork.noDue")}
              </span>
              {a.dueAt && !a.allowLate && (
                <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                  <Lock className="h-4 w-4" />
                  {t("classwork.noLate")}
                </span>
              )}
            </div>
          )}
        </div>
        {access.canTeach && writable && (
          <div className="flex shrink-0 gap-2">
            <LinkButton href={`${base}/${a.id}/edit`} variant="outline" size="sm">
              <Pencil className="h-4 w-4" />
              {t("common.edit")}
            </LinkButton>
            <ConfirmAction
              action={deleteAssignment.bind(null, a.id)}
              confirmText={`${t("classwork.confirmDelete")} ${t("common.cannotUndo")}`}
              label={t("common.delete")}
              icon={<Trash2 className="h-4 w-4" />}
              variant="outline"
              className="text-red-600 dark:text-red-400"
            />
          </div>
        )}
      </div>
      {(a.description || a.attachments.length > 0 || a.links.length > 0) && (
        <div className="space-y-4 border-t border-slate-100 p-5 dark:border-slate-800">
          {a.description && (
            <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-800 dark:text-slate-200">{a.description}</p>
          )}
          <Attachments files={a.attachments} links={a.links} />
        </div>
      )}
      <div className="border-t border-slate-100 p-5 dark:border-slate-800">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
          <Users className="h-4 w-4" />
          {a.comments.length > 0 ? t("classroom.comments.classCount", { n: a.comments.length }) : t("classroom.comments.class")}
        </h2>
        <CommentThread
          comments={a.comments}
          target={`assignment:${a.id}`}
          me={me}
          canModerate={access.canTeach}
          canPost={writable && a.published}
          t={t}
          locale={locale}
          placeholder={t("classroom.comments.addClass")}
        />
      </div>
    </Card>
  );

  if (access.isStudent) {
    return (
      <div>
        <BackLink href={base} label={t("classroom.tabs.classwork")} />
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-w-0">{instructions}</div>
          {hasWork && (
            <StudentSide
              assignment={a}
              me={me}
              writable={writable}
              t={t}
              locale={locale}
              maxMb={Math.round(env.maxUploadBytes / 1024 / 1024)}
            />
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <BackLink href={base} label={t("classroom.tabs.classwork")} />
      {showWorkPanel && (
        <Tabs
          active={view}
          tabs={[
            { key: "instructions", label: t("classwork.instructions"), href: `${base}/${a.id}` },
            { key: "work", label: t("classwork.studentWork"), href: `${base}/${a.id}?view=work` },
          ]}
        />
      )}
      {view === "work" ? (
        <StudentWorkPanel assignment={a} me={me} canTeach={access.canTeach} writable={writable} t={t} locale={locale} />
      ) : (
        instructions
      )}
    </div>
  );
}

function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="mb-4 inline-block text-sm text-slate-500 hover:text-brand-600">
      ← {label}
    </Link>
  );
}

type AssignmentLite = {
  id: string;
  classroomId: string;
  type: AssignmentType;
  dueAt: Date | null;
  allowLate: boolean;
  maxPoints: number | null;
};

async function StudentSide({
  assignment: a,
  me,
  writable,
  t,
  locale,
  maxMb,
}: {
  assignment: AssignmentLite;
  me: Me;
  writable: boolean;
  t: TFunction;
  locale: string;
  maxMb: number;
}) {
  const sub = await db.submission.findUnique({
    where: { assignmentId_studentId: { assignmentId: a.id, studentId: me.id } },
    include: {
      files: { select: fileSelect, orderBy: { createdAt: "asc" } },
      comments: { orderBy: { createdAt: "asc" }, include: { author: { select: authorSelect } } },
    },
  });
  const now = new Date();
  const state = workState(a.dueAt, sub, now);
  const pastDue = !!a.dueAt && now > a.dueAt;
  const closed = pastDue && !a.allowLate;
  const editable = (!sub || sub.status === "DRAFT") && writable;
  const isQuestion = a.type === "QUESTION";
  const canUnsubmit = sub?.status === "SUBMITTED" && sub.grade == null && !closed && writable;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title={isQuestion ? t("classwork.work.yourAnswer") : t("classwork.work.yourWork")}
          action={<WorkBadge state={state} label={workLabel(t, state, sub?.grade, a.maxPoints)} />}
        />
        <div className="space-y-4 p-5">
          {sub?.status === "RETURNED" && (
            <div className="rounded-lg bg-violet-50 p-4 dark:bg-violet-950/40">
              {sub.grade != null && a.maxPoints != null && (
                <p className="text-3xl font-bold text-violet-700 dark:text-violet-300">
                  {sub.grade}
                  <span className="text-lg font-medium text-violet-400"> / {a.maxPoints}</span>
                </p>
              )}
              <p className="mt-1 text-xs text-violet-600 dark:text-violet-400">
                {t("classwork.work.returnedOn", { date: formatDate(sub.returnedAt, locale, true) })}
              </p>
              {sub.feedback && (
                <div className="mt-3 border-t border-violet-200 pt-3 dark:border-violet-900">
                  <p className="text-xs font-semibold uppercase tracking-wide text-violet-600 dark:text-violet-400">
                    {t("classwork.grading.feedback")}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-800 dark:text-slate-200">{sub.feedback}</p>
                </div>
              )}
            </div>
          )}

          {sub?.submittedAt && sub.status !== "DRAFT" && (
            <p className="flex flex-wrap items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
              {t("classwork.work.turnedInAt", { date: formatDate(sub.submittedAt, locale, true) })}
              {sub.isLate && <Badge tone="orange">{t("classwork.late")}</Badge>}
            </p>
          )}

          {editable && closed && <Alert tone="red">{t("classwork.work.closed")}</Alert>}
          {editable && !closed && pastDue && <Alert tone="yellow">{t("classwork.work.lateWarning")}</Alert>}

          {editable && !closed ? (
            <>
              {sub && sub.files.length > 0 && (
                <Attachments
                  files={sub.files}
                  renderExtra={(f) => (
                    <ConfirmAction
                      action={deleteSubmissionFile.bind(null, f.id)}
                      label={<span className="sr-only">{t("common.remove")}</span>}
                      icon={<X className="h-4 w-4" />}
                      size="icon"
                      className="h-8 w-8 text-slate-400 hover:text-red-600"
                    />
                  )}
                />
              )}
              <WorkForm
                assignmentId={a.id}
                isQuestion={isQuestion}
                text={sub?.text ?? ""}
                links={sub?.links ?? []}
                maxMb={maxMb}
              />
            </>
          ) : (
            <SubmittedWork text={sub?.text} files={sub?.files ?? []} links={sub?.links ?? []} t={t} />
          )}

          {canUnsubmit && (
            <ConfirmAction
              action={unsubmitWork.bind(null, a.id)}
              confirmText={t("classwork.work.confirmUnsubmit")}
              label={t("classwork.work.unsubmit")}
              icon={<Undo2 className="h-4 w-4" />}
              variant="outline"
              size="md"
              className="w-full"
            />
          )}
        </div>
      </Card>

      <Card>
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              {t("classroom.comments.private")}
            </span>
          }
          description={t("classroom.comments.privateHint")}
        />
        <div className="p-5">
          <CommentThread
            comments={sub?.comments ?? []}
            target={`private:${a.id}:${me.id}`}
            me={me}
            canModerate={false}
            canPost={writable}
            t={t}
            locale={locale}
            placeholder={t("classroom.comments.addPrivate")}
          />
        </div>
      </Card>
    </div>
  );
}

function SubmittedWork({
  text,
  files,
  links,
  t,
}: {
  text?: string | null;
  files: { id: string; originalName: string; mimeType: string; size: number }[];
  links: string[];
  t: TFunction;
}) {
  if (!text && !files.length && !links.length) {
    return <p className="text-sm italic text-slate-500">{t("classwork.work.nothingAttached")}</p>;
  }
  return (
    <div className="space-y-3">
      {text && (
        <p className="whitespace-pre-wrap break-words rounded-lg bg-slate-50 p-3 text-sm text-slate-800 dark:bg-slate-800/60 dark:text-slate-200">
          {text}
        </p>
      )}
      <Attachments files={files} links={links} />
    </div>
  );
}

const STATE_ORDER = { TURNED_IN: 0, TURNED_IN_LATE: 0, GRADED: 1, RETURNED: 1, ASSIGNED: 2, MISSING: 2 } as const;

async function StudentWorkPanel({
  assignment: a,
  me,
  canTeach,
  writable,
  t,
  locale,
}: {
  assignment: AssignmentLite;
  me: Me;
  canTeach: boolean;
  writable: boolean;
  t: TFunction;
  locale: string;
}) {
  const [students, subs] = await Promise.all([
    classroomStudents(a.classroomId),
    db.submission.findMany({
      where: { assignmentId: a.id },
      include: {
        files: { select: fileSelect, orderBy: { createdAt: "asc" } },
        comments: { orderBy: { createdAt: "asc" }, include: { author: { select: authorSelect } } },
      },
    }),
  ]);
  if (students.length === 0) {
    return <EmptyState icon={<Users className="h-10 w-10" />} title={t("classwork.grading.noStudents")} />;
  }

  const now = new Date();
  const byStudent = new Map(subs.map((s) => [s.studentId, s]));
  const rows = students.map((s) => {
    const sub = byStudent.get(s.id) ?? null;
    return { student: s, sub, state: workState(a.dueAt, sub, now) };
  });
  rows.sort((x, y) => STATE_ORDER[x.state] - STATE_ORDER[y.state]);

  const turnedIn = rows.filter((r) => r.state === "TURNED_IN" || r.state === "TURNED_IN_LATE").length;
  const returned = rows.filter((r) => r.state === "GRADED" || r.state === "RETURNED").length;
  const assigned = rows.length - turnedIn - returned;
  const toReturn = subs.filter((s) => s.grade != null && s.status !== "RETURNED").length;

  return (
    <div className="space-y-4">
      <Card className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-6 sm:gap-10">
          <Stat value={turnedIn} label={t("classwork.grading.turnedIn")} />
          <Stat value={assigned} label={t("classwork.grading.assigned")} />
          <Stat value={returned} label={t("classwork.grading.returned")} />
        </div>
        {canTeach && toReturn > 0 && (
          <ConfirmAction
            action={returnAllGraded.bind(null, a.id)}
            confirmText={t("classwork.grading.confirmReturnAll", { n: toReturn })}
            label={t("classwork.grading.returnAll", { n: toReturn })}
            icon={<CheckCheck className="h-4 w-4" />}
            variant="primary"
            size="md"
          />
        )}
      </Card>

      <Card className="divide-y divide-slate-100 overflow-hidden dark:divide-slate-800">
        {rows.map(({ student, sub, state }) => (
          <details key={student.id} className="group">
            <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 transition hover:bg-slate-50 dark:hover:bg-slate-800/50 [&::-webkit-details-marker]:hidden">
              <Avatar user={student} size={36} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-slate-900 dark:text-slate-100">{fullName(student)}</p>
                <p className="truncate text-xs text-slate-500">
                  {sub?.submittedAt && sub.status !== "DRAFT"
                    ? t("classwork.work.turnedInAt", { date: formatDate(sub.submittedAt, locale, true) })
                    : student.email}
                </p>
              </div>
              <GradeSummary status={sub?.status} grade={sub?.grade ?? null} maxPoints={a.maxPoints} t={t} />
              <WorkBadge state={state} label={workLabel(t, state, sub?.grade, a.maxPoints)} className="hidden shrink-0 sm:inline-flex" />
              <ChevronDown className="h-4 w-4 shrink-0 text-slate-400 transition group-open:rotate-180" />
            </summary>
            <div className="grid gap-5 bg-slate-50/60 px-4 py-4 dark:bg-slate-950/30 lg:grid-cols-2">
              <div className="space-y-4">
                <div className="sm:hidden">
                  <WorkBadge state={state} label={workLabel(t, state, sub?.grade, a.maxPoints)} />
                </div>
                <div>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{t("classwork.grading.work")}</h3>
                  {sub && sub.status !== "DRAFT" ? (
                    <SubmittedWork text={sub.text} files={sub.files} links={sub.links} t={t} />
                  ) : (
                    <p className="text-sm italic text-slate-500">{t("classwork.grading.notTurnedIn")}</p>
                  )}
                </div>
                <div>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{t("classroom.comments.private")}</h3>
                  <CommentThread
                    comments={(sub?.comments ?? []) as CommentItem[]}
                    target={`private:${a.id}:${student.id}`}
                    me={me}
                    canModerate={canTeach}
                    canPost={canTeach && writable}
                    t={t}
                    locale={locale}
                    placeholder={t("classroom.comments.addPrivateTo", { name: student.firstName || fullName(student) })}
                  />
                </div>
              </div>
              {canTeach ? (
                <div className="h-fit rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
                  <GradeForm
                    assignmentId={a.id}
                    studentId={student.id}
                    maxPoints={a.maxPoints}
                    grade={sub?.grade ?? null}
                    feedback={sub?.feedback ?? ""}
                    returned={sub?.status === "RETURNED"}
                  />
                </div>
              ) : (
                sub?.feedback && (
                  <div>
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{t("classwork.grading.feedback")}</h3>
                    <p className="whitespace-pre-wrap text-sm">{sub.feedback}</p>
                  </div>
                )
              )}
            </div>
          </details>
        ))}
      </Card>
    </div>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <p className="text-3xl font-bold text-slate-900 dark:text-white">{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}

function GradeSummary({
  status,
  grade,
  maxPoints,
  t,
}: {
  status?: SubmissionStatus;
  grade: number | null;
  maxPoints: number | null;
  t: TFunction;
}) {
  if (maxPoints == null || grade == null) return null;
  const draft = status !== "RETURNED";
  return (
    <span
      title={draft ? t("classwork.grading.draftGrade") : undefined}
      className={cn("shrink-0 text-sm tabular-nums", draft ? "italic text-slate-500" : "font-semibold text-slate-900 dark:text-white")}
    >
      {grade}/{maxPoints}
    </span>
  );
}
