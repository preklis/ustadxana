import Link from "next/link";
import { notFound } from "next/navigation";
import type { AttendanceStatus } from "@prisma/client";
import { CalendarCheck2, Download, Trash2, Users } from "lucide-react";
import { db } from "@/lib/db";
import { requireActiveUser } from "@/lib/auth/session";
import { getClassroomAccess } from "@/lib/permissions";
import { getI18n } from "@/i18n/server";
import { cn, fullName } from "@/lib/utils";
import { Avatar, Badge, Card, CardHeader, EmptyState, StatCard, Table, td, th } from "@/components/ui/primitives";
import { buttonClass } from "@/components/ui/button";
import { ConfirmAction } from "@/components/ui/interactive";
import {
  ATTENDANCE_STATUSES,
  STATUS_STYLE,
  STATUS_TONE,
  bakuToday,
  dayKey,
  formatDay,
  parseDay,
  percentTone,
  rateOf,
} from "@/components/attendance/constants";
import { AttendanceForm } from "./attendance-form";
import { deleteAttendanceSession } from "./actions";

type Params = { params: Promise<{ id: string }>; searchParams: Promise<{ view?: string; date?: string }> };

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t("attendance.title") };
}

export default async function AttendancePage({ params, searchParams }: Params) {
  const { id } = await params;
  const sp = await searchParams;
  const user = await requireActiveUser();
  const access = await getClassroomAccess(user, id);
  if (!access.canView) notFound();
  const classroom = await db.classroom.findUnique({ where: { id }, select: { id: true, name: true } });
  if (!classroom) notFound();

  if (access.isStudent) return <StudentView classroomId={id} userId={user.id} />;

  const view = access.canTakeAttendance && sp.view !== "overview" ? "take" : "overview";
  const { t } = await getI18n();

  const tabs = [
    ...(access.canTakeAttendance ? [{ key: "take", label: t("attendance.take"), href: `/classrooms/${id}/attendance?view=take` }] : []),
    { key: "overview", label: t("attendance.overview"), href: `/classrooms/${id}/attendance?view=overview` },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-900">
          {tabs.map((tab) => (
            <Link
              key={tab.key}
              href={tab.href}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition",
                view === tab.key
                  ? "bg-brand-600 text-brand-fg shadow-sm"
                  : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800",
              )}
            >
              {tab.label}
            </Link>
          ))}
        </div>
        <a href={`/classrooms/${id}/attendance/export`} className={buttonClass("outline", "sm")}>
          <Download className="h-4 w-4" />
          {t("attendance.exportCsv")}
        </a>
      </div>
      {view === "take" ? <TakeView classroomId={id} dateParam={sp.date} /> : <OverviewView classroomId={id} canTake={access.canTakeAttendance} />}
    </div>
  );
}

async function loadStudents(classroomId: string) {
  const members = await db.classroomMember.findMany({
    where: { classroomId, role: "STUDENT" },
    select: { user: { select: { id: true, firstName: true, lastName: true, email: true, avatarFileId: true } } },
  });
  return members.map((m) => m.user).sort((a, b) => fullName(a).localeCompare(fullName(b)));
}

async function TakeView({ classroomId, dateParam }: { classroomId: string; dateParam?: string }) {
  const { t, locale } = await getI18n();
  const today = bakuToday();
  const parsed = parseDay(dateParam);
  const date = parsed && dayKey(parsed) <= today ? dayKey(parsed) : today;
  const [students, session] = await Promise.all([
    loadStudents(classroomId),
    db.attendanceSession.findUnique({
      where: { classroomId_date: { classroomId, date: new Date(`${date}T00:00:00.000Z`) } },
      include: { records: true, takenBy: { select: { firstName: true, lastName: true, email: true } } },
    }),
  ]);

  if (!students.length)
    return <EmptyState icon={<Users className="h-8 w-8" />} title={t("attendance.noStudents")} description={t("attendance.noStudentsText")} />;

  const byStudent = new Map(session?.records.map((r) => [r.studentId, r]) ?? []);
  return (
    <Card>
      <CardHeader
        title={formatDay(new Date(`${date}T00:00:00.000Z`), locale, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        description={
          session
            ? t("attendance.lastSavedBy", { name: session.takenBy ? fullName(session.takenBy) : "—" })
            : t("attendance.notTakenYet")
        }
        action={
          session ? (
            <ConfirmAction
              action={deleteAttendanceSession.bind(null, classroomId, session.id)}
              label={t("attendance.deleteSession")}
              confirmText={t("attendance.deleteSessionConfirm")}
              icon={<Trash2 className="h-4 w-4" />}
              className="text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
            />
          ) : undefined
        }
      />
      <div className="p-5">
        <AttendanceForm
          key={date}
          classroomId={classroomId}
          date={date}
          maxDate={today}
          title={session?.title ?? ""}
          isExisting={!!session}
          students={students.map((s) => ({
            ...s,
            status: byStudent.get(s.id)?.status ?? null,
            note: byStudent.get(s.id)?.note ?? null,
          }))}
        />
      </div>
    </Card>
  );
}

async function OverviewView({ classroomId, canTake }: { classroomId: string; canTake: boolean }) {
  const { t, locale } = await getI18n();
  const [students, sessions] = await Promise.all([
    loadStudents(classroomId),
    db.attendanceSession.findMany({
      where: { classroomId },
      orderBy: { date: "asc" },
      select: { id: true, date: true, title: true, records: { select: { studentId: true, status: true, note: true } } },
    }),
  ]);

  if (!sessions.length)
    return (
      <EmptyState
        icon={<CalendarCheck2 className="h-8 w-8" />}
        title={t("attendance.noSessions")}
        description={t("attendance.noSessionsText")}
        action={
          canTake ? (
            <Link href={`/classrooms/${classroomId}/attendance?view=take`} className={buttonClass("primary", "sm")}>
              {t("attendance.takeToday")}
            </Link>
          ) : undefined
        }
      />
    );

  const cell = new Map<string, { status: AttendanceStatus; note: string | null }>();
  for (const s of sessions) for (const r of s.records) cell.set(`${r.studentId}:${s.id}`, { status: r.status, note: r.note });

  const allStatuses = sessions.flatMap((s) => s.records.map((r) => r.status));
  const overall = rateOf(allStatuses);
  const rows = students.map((st) => {
    const statuses = sessions.map((s) => cell.get(`${st.id}:${s.id}`)?.status).filter((x): x is AttendanceStatus => !!x);
    return { st, rate: rateOf(statuses) };
  });
  const atRisk = rows.filter((r) => r.rate.percent !== null && r.rate.percent < 65).length;

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label={t("attendance.sessions")} value={sessions.length} />
        <StatCard label={t("attendance.averageRate")} value={overall.percent === null ? "—" : `${overall.percent}%`} hint={t("attendance.ruleHint")} />
        <StatCard label={t("attendance.atRisk")} value={atRisk} hint={t("attendance.atRiskHint")} />
      </div>

      <Card>
        <CardHeader
          title={t("attendance.matrix")}
          action={
            <div className="hidden flex-wrap gap-1.5 sm:flex">
              {ATTENDANCE_STATUSES.map((s) => (
                <span key={s} className={cn("rounded px-1.5 py-0.5 text-[11px] font-semibold", STATUS_STYLE[s])}>
                  {t(`attendance.short.${s}`)} · {t(`attendance.status.${s}`)}
                </span>
              ))}
            </div>
          }
        />
        <Table>
          <thead>
            <tr>
              <th className={cn(th, "sticky left-0 z-10 min-w-[200px]")}>{t("attendance.student")}</th>
              <th className={cn(th, "text-center")}>%</th>
              {sessions.map((s) => (
                <th key={s.id} className={cn(th, "px-1.5 text-center")} title={s.title ?? undefined}>
                  {canTake ? (
                    <Link href={`/classrooms/${classroomId}/attendance?view=take&date=${dayKey(s.date)}`} className="hover:text-brand-600">
                      {formatDay(s.date, locale, { day: "numeric", month: "short" })}
                    </Link>
                  ) : (
                    formatDay(s.date, locale, { day: "numeric", month: "short" })
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ st, rate }) => (
              <tr key={st.id}>
                <td className={cn(td, "sticky left-0 z-10 bg-white dark:bg-slate-900")}>
                  <div className="flex items-center gap-2">
                    <Avatar user={st} size={28} />
                    <span className="truncate font-medium">{fullName(st)}</span>
                  </div>
                </td>
                <td className={cn(td, "text-center")}>
                  <Badge tone={percentTone(rate.percent)}>{rate.percent === null ? "—" : `${rate.percent}%`}</Badge>
                </td>
                {sessions.map((s) => {
                  const c = cell.get(`${st.id}:${s.id}`);
                  return (
                    <td key={s.id} className={cn(td, "px-1.5 text-center")}>
                      {c ? (
                        <span
                          title={`${t(`attendance.status.${c.status}`)}${c.note ? ` — ${c.note}` : ""}`}
                          className={cn(
                            "inline-flex h-7 w-7 items-center justify-center rounded-md text-xs font-bold",
                            STATUS_STYLE[c.status],
                            c.note && "ring-1 ring-inset ring-current",
                          )}
                        >
                          {t(`attendance.short.${c.status}`)}
                        </span>
                      ) : (
                        <span className="text-slate-300 dark:text-slate-600">·</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}

async function StudentView({ classroomId, userId }: { classroomId: string; userId: string }) {
  const { t, locale } = await getI18n();
  const records = await db.attendanceRecord.findMany({
    where: { studentId: userId, session: { classroomId } },
    select: { id: true, status: true, note: true, session: { select: { date: true, title: true } } },
    orderBy: { session: { date: "desc" } },
  });
  const rate = rateOf(records.map((r) => r.status));
  const counts = Object.fromEntries(ATTENDANCE_STATUSES.map((s) => [s, records.filter((r) => r.status === s).length]));

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label={t("attendance.myRate")} value={rate.percent === null ? "—" : `${rate.percent}%`} hint={t("attendance.ruleHint")} />
        {ATTENDANCE_STATUSES.map((s) => (
          <StatCard key={s} label={t(`attendance.status.${s}`)} value={counts[s]} />
        ))}
      </div>
      {records.length ? (
        <Card>
          <CardHeader title={t("attendance.myRecords")} />
          <Table>
            <thead>
              <tr>
                <th className={th}>{t("common.date")}</th>
                <th className={th}>{t("common.status")}</th>
                <th className={th}>{t("attendance.note")}</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id}>
                  <td className={td}>
                    <p className="font-medium">{formatDay(r.session.date, locale, { weekday: "short", day: "numeric", month: "short", year: "numeric" })}</p>
                    {r.session.title && <p className="text-xs text-slate-500">{r.session.title}</p>}
                  </td>
                  <td className={td}>
                    <Badge tone={STATUS_TONE[r.status]}>{t(`attendance.status.${r.status}`)}</Badge>
                  </td>
                  <td className={cn(td, "text-slate-600 dark:text-slate-400")}>{r.note ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      ) : (
        <EmptyState icon={<CalendarCheck2 className="h-8 w-8" />} title={t("attendance.noRecords")} description={t("attendance.noRecordsText")} />
      )}
    </div>
  );
}
