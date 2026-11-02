import Link from "next/link";
import { CalendarCheck2, CalendarX2, CheckCircle2, ClipboardCheck, Clock, Inbox, School } from "lucide-react";
import { db } from "@/lib/db";
import type { SessionUser } from "@/lib/auth/session";
import { accessFrom } from "@/lib/permissions";
import { getI18n } from "@/i18n/server";
import { formatDate } from "@/lib/utils";
import { Badge, EmptyState, StatCard } from "@/components/ui/primitives";
import { bakuToday, parseDay } from "@/components/attendance/constants";
import { AnnouncementRows, ClassroomCard, dueLabel, IconBubble, Row, Section } from "./widgets";

const WEEK = 7 * 24 * 60 * 60 * 1000;

export async function TeamDashboard({ user, compact = false }: { user: SessionUser; compact?: boolean }) {
  const { t, locale } = await getI18n();
  const now = new Date();

  const memberships = await db.classroomMember.findMany({
    where: { userId: user.id, role: { in: ["MENTOR", "STAFF"] }, classroom: { archived: false } },
    include: {
      classroom: {
        select: {
          id: true,
          name: true,
          track: true,
          color: true,
          season: { select: { name: true } },
          _count: { select: { members: { where: { role: "STUDENT" } } } },
        },
      },
    },
    orderBy: { joinedAt: "asc" },
  });

  if (!memberships.length) {
    if (compact) return null;
    return <EmptyState icon={<School className="h-8 w-8" />} title={t("dashboard.team.noClassrooms")} description={t("dashboard.team.noClassroomsText")} />;
  }

  const ids = memberships.map((m) => m.classroomId);
  const access = new Map(memberships.map((m) => [m.classroomId, accessFrom(user, m.role)]));
  const reviewIds = ids.filter((id) => access.get(id)?.canTeach || access.get(id)?.canViewGrades);
  const studentsIn = new Map(memberships.map((m) => [m.classroomId, m.classroom._count.members]));
  const today = parseDay(bakuToday())!;

  const [reviewGroups, deadlines, todaySessions, announcements] = await Promise.all([
    reviewIds.length
      ? db.submission.groupBy({
          by: ["assignmentId"],
          where: { status: "SUBMITTED", assignment: { classroomId: { in: reviewIds } } },
          _count: { _all: true },
          _min: { submittedAt: true },
        })
      : Promise.resolve([]),
    db.assignment.findMany({
      where: { classroomId: { in: ids }, published: true, type: { not: "MATERIAL" }, dueAt: { gte: now, lte: new Date(now.getTime() + WEEK) } },
      orderBy: { dueAt: "asc" },
      take: 8,
      select: {
        id: true,
        title: true,
        dueAt: true,
        classroomId: true,
        classroom: { select: { name: true } },
        _count: { select: { submissions: { where: { status: { in: ["SUBMITTED", "RETURNED"] } } } } },
      },
    }),
    db.attendanceSession.findMany({
      where: { classroomId: { in: ids }, date: today },
      select: { classroomId: true, _count: { select: { records: true } } },
    }),
    compact
      ? Promise.resolve([])
      : db.announcement.findMany({
          where: { OR: [{ classroomId: null }, { classroomId: { in: ids } }] },
          orderBy: { createdAt: "desc" },
          take: 5,
          select: { id: true, title: true, body: true, pinned: true, createdAt: true, classroom: { select: { id: true, name: true } } },
        }),
  ]);

  const reviewAssignments = reviewGroups.length
    ? await db.assignment.findMany({
        where: { id: { in: reviewGroups.map((g) => g.assignmentId) } },
        select: { id: true, title: true, classroomId: true, classroom: { select: { name: true } } },
      })
    : [];
  const reviewById = new Map(reviewAssignments.map((a) => [a.id, a]));
  const toReview = reviewGroups
    .map((g) => ({ a: reviewById.get(g.assignmentId), count: g._count._all, oldest: g._min.submittedAt }))
    .filter((x): x is { a: NonNullable<typeof x.a>; count: number; oldest: Date | null } => !!x.a)
    .sort((x, y) => (x.oldest?.getTime() ?? 0) - (y.oldest?.getTime() ?? 0));
  const totalToReview = toReview.reduce((s, x) => s + x.count, 0);
  const sessionToday = new Map(todaySessions.map((s) => [s.classroomId, s._count.records]));

  return (
    <div className="space-y-6">
      {!compact && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
          <StatCard label={t("dashboard.team.classrooms")} value={memberships.length} icon={<School className="h-5 w-5" />} />
          <StatCard label={t("dashboard.team.toReview")} value={totalToReview} icon={<Inbox className="h-5 w-5" />} />
          <StatCard
            label={t("dashboard.team.attendanceToday")}
            value={`${memberships.filter((m) => sessionToday.has(m.classroomId)).length}/${memberships.length}`}
            icon={<CalendarCheck2 className="h-5 w-5" />}
            hint={t("dashboard.team.attendanceTodayHint")}
          />
        </div>
      )}

      <section>
        <h2 className="mb-3 text-lg font-semibold text-slate-900 dark:text-white">{t("dashboard.myClassrooms")}</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {memberships.map((m) => (
            <ClassroomCard
              key={m.classroomId}
              c={{
                id: m.classroom.id,
                name: m.classroom.name,
                track: m.classroom.track,
                color: m.classroom.color,
                seasonName: m.classroom.season.name,
                meta: (
                  <span className="flex items-center gap-2">
                    <Badge tone={m.role === "MENTOR" ? "green" : "orange"}>{t(`common.classroomRoles.${m.role}`)}</Badge>
                    {t("dashboard.studentsCount", { n: m.classroom._count.members })}
                  </span>
                ),
              }}
            />
          ))}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section
          title={t("dashboard.team.toReview")}
          description={t("dashboard.team.toReviewHint")}
          isEmpty={!toReview.length}
          empty={
            <span className="flex flex-col items-center gap-2">
              <CheckCircle2 className="h-8 w-8 text-emerald-500" />
              {t("dashboard.team.nothingToReview")}
            </span>
          }
        >
          {toReview.slice(0, 8).map(({ a, count, oldest }) => (
            <Row
              key={a.id}
              href={`/classrooms/${a.classroomId}/classwork/${a.id}`}
              icon={<IconBubble tone="brand"><ClipboardCheck className="h-4 w-4" /></IconBubble>}
              title={a.title}
              subtitle={`${a.classroom.name}${oldest ? ` · ${t("dashboard.team.oldest", { date: formatDate(oldest, locale) })}` : ""}`}
              right={<Badge tone="blue">{t("dashboard.team.submittedN", { n: count })}</Badge>}
            />
          ))}
        </Section>

        <Section title={t("dashboard.team.attendanceToday")} description={formatDate(today, locale)} isEmpty={false} empty={null}>
          {memberships.map((m) => {
            const marked = sessionToday.get(m.classroomId);
            const canTake = access.get(m.classroomId)?.canTakeAttendance;
            return (
              <Row
                key={m.classroomId}
                href={`/classrooms/${m.classroomId}/attendance${canTake ? "?view=take" : "?view=overview"}`}
                icon={
                  <IconBubble tone={marked !== undefined ? "green" : "slate"}>
                    {marked !== undefined ? <CalendarCheck2 className="h-4 w-4" /> : <CalendarX2 className="h-4 w-4" />}
                  </IconBubble>
                }
                title={m.classroom.name}
                subtitle={
                  marked !== undefined
                    ? t("dashboard.team.markedOf", { n: marked, total: studentsIn.get(m.classroomId) ?? 0 })
                    : t("dashboard.team.notTaken")
                }
                right={
                  marked !== undefined ? (
                    <Badge tone="green">{t("dashboard.team.taken")}</Badge>
                  ) : canTake ? (
                    <span className="text-xs font-medium text-brand-600">{t("dashboard.team.takeNow")}</span>
                  ) : (
                    <Badge>{t("dashboard.team.pending")}</Badge>
                  )
                }
              />
            );
          })}
        </Section>
      </div>

      <div className={compact ? "" : "grid gap-6 lg:grid-cols-2"}>
        <Section title={t("dashboard.upcoming")} description={t("dashboard.upcomingHint")} isEmpty={!deadlines.length} empty={t("dashboard.team.noDeadlines")}>
          {deadlines.map((a) => (
            <Row
              key={a.id}
              href={`/classrooms/${a.classroomId}/classwork/${a.id}`}
              icon={<IconBubble tone="amber"><Clock className="h-4 w-4" /></IconBubble>}
              title={a.title}
              subtitle={`${a.classroom.name} · ${formatDate(a.dueAt, locale, true)} · ${dueLabel(a.dueAt!, locale)}`}
              right={
                <Badge>
                  {t("dashboard.team.turnedIn", { n: a._count.submissions, total: studentsIn.get(a.classroomId) ?? 0 })}
                </Badge>
              }
            />
          ))}
        </Section>

        {!compact && (
          <Section
            title={t("dashboard.latestAnnouncements")}
            action={<Link href="/announcements" className="text-sm font-medium text-brand-600 hover:underline">{t("dashboard.viewAll")}</Link>}
            isEmpty={!announcements.length}
            empty={t("dashboard.noAnnouncements")}
          >
            <AnnouncementRows items={announcements} locale={locale} campWide={t("dashboard.campWide")} />
          </Section>
        )}
      </div>
    </div>
  );
}
