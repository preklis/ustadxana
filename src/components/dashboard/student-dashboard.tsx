import Link from "next/link";
import { CalendarCheck2, CheckCircle2, Clock, School, Star } from "lucide-react";
import { db } from "@/lib/db";
import type { SessionUser } from "@/lib/auth/session";
import { getI18n } from "@/i18n/server";
import { formatDate, fullName } from "@/lib/utils";
import { Badge, EmptyState, StatCard } from "@/components/ui/primitives";
import { aggregateRate, percentTone } from "@/components/attendance/stats";
import { AnnouncementRows, ClassroomCard, dueLabel, IconBubble, Row, Section } from "./widgets";

const WEEK = 7 * 24 * 60 * 60 * 1000;

export async function StudentDashboard({ user }: { user: SessionUser }) {
  const { t, locale } = await getI18n();
  const now = new Date();

  const memberships = await db.classroomMember.findMany({
    where: { userId: user.id, role: "STUDENT", classroom: { archived: false } },
    include: {
      classroom: {
        select: {
          id: true,
          name: true,
          track: true,
          color: true,
          season: { select: { name: true } },
          members: { where: { role: "MENTOR" }, select: { user: { select: { firstName: true, lastName: true, email: true } } }, take: 2 },
        },
      },
    },
    orderBy: { joinedAt: "asc" },
  });
  const classroomIds = memberships.map((m) => m.classroomId);
  // archived classrooms still count for grades/attendance, just not deadlines
  const allIds = (await db.classroomMember.findMany({ where: { userId: user.id, role: "STUDENT" }, select: { classroomId: true } })).map((m) => m.classroomId);

  const [deadlines, graded, rate, announcements, certCount] = await Promise.all([
    db.assignment.findMany({
      where: {
        classroomId: { in: classroomIds },
        published: true,
        type: { not: "MATERIAL" },
        dueAt: { gte: now, lte: new Date(now.getTime() + WEEK) },
        submissions: { none: { studentId: user.id, status: { in: ["SUBMITTED", "RETURNED"] } } },
      },
      orderBy: { dueAt: "asc" },
      take: 8,
      select: { id: true, title: true, dueAt: true, classroomId: true, classroom: { select: { name: true } } },
    }),
    db.submission.findMany({
      where: { studentId: user.id, status: "RETURNED", assignment: { classroomId: { in: allIds } } },
      orderBy: { returnedAt: "desc" },
      take: 5,
      select: {
        id: true,
        grade: true,
        returnedAt: true,
        assignment: { select: { id: true, title: true, maxPoints: true, classroomId: true, classroom: { select: { name: true } } } },
      },
    }),
    aggregateRate({ studentId: user.id, session: { classroomId: { in: allIds } } }),
    db.announcement.findMany({
      where: {
        OR: [{ classroomId: null, audience: { in: ["EVERYONE", "STUDENTS"] } }, { classroomId: { in: classroomIds } }],
      },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, title: true, body: true, pinned: true, createdAt: true, classroom: { select: { id: true, name: true } } },
    }),
    db.certificate.count({ where: { holderId: user.id, revokedAt: null } }),
  ]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label={t("dashboard.student.classrooms")} value={memberships.length} icon={<School className="h-5 w-5" />} />
        <StatCard label={t("dashboard.student.dueThisWeek")} value={deadlines.length} icon={<Clock className="h-5 w-5" />} href="/todo" />
        <StatCard
          label={t("dashboard.student.attendance")}
          value={rate.percent === null ? "—" : `${rate.percent}%`}
          icon={<CalendarCheck2 className="h-5 w-5" />}
          hint={rate.total ? t("dashboard.student.attendanceHint", { attended: rate.attended, total: rate.total }) : t("dashboard.student.noAttendance")}
        />
        <StatCard label={t("dashboard.student.certificates")} value={certCount} icon={<Star className="h-5 w-5" />} href="/certificates" />
      </div>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-slate-900 dark:text-white">{t("dashboard.myClassrooms")}</h2>
        {memberships.length ? (
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
                  meta: m.classroom.members.length
                    ? t("dashboard.mentors", { names: m.classroom.members.map((x) => fullName(x.user)).join(", ") })
                    : undefined,
                }}
              />
            ))}
          </div>
        ) : (
          <EmptyState icon={<School className="h-8 w-8" />} title={t("dashboard.student.noClassrooms")} description={t("dashboard.student.noClassroomsText")} />
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section
          title={t("dashboard.upcoming")}
          description={t("dashboard.upcomingHint")}
          action={<Link href="/todo" className="text-sm font-medium text-brand-600 hover:underline">{t("dashboard.viewAll")}</Link>}
          isEmpty={!deadlines.length}
          empty={
            <span className="flex flex-col items-center gap-2">
              <CheckCircle2 className="h-8 w-8 text-emerald-500" />
              {t("dashboard.student.allCaughtUp")}
            </span>
          }
        >
          {deadlines.map((a) => {
            const soon = a.dueAt!.getTime() - now.getTime() < 24 * 3_600_000;
            return (
              <Row
                key={a.id}
                href={`/classrooms/${a.classroomId}/classwork/${a.id}`}
                icon={<IconBubble tone={soon ? "red" : "amber"}><Clock className="h-4 w-4" /></IconBubble>}
                title={a.title}
                subtitle={`${a.classroom.name} · ${formatDate(a.dueAt, locale, true)}`}
                right={<Badge tone={soon ? "red" : "yellow"}>{dueLabel(a.dueAt!, locale)}</Badge>}
              />
            );
          })}
        </Section>

        <Section title={t("dashboard.student.recentlyGraded")} isEmpty={!graded.length} empty={t("dashboard.student.noGrades")}>
          {graded.map((s) => {
            const max = s.assignment.maxPoints;
            const pct = s.grade !== null && max ? Math.round((s.grade / max) * 100) : null;
            return (
              <Row
                key={s.id}
                href={`/classrooms/${s.assignment.classroomId}/classwork/${s.assignment.id}`}
                icon={<IconBubble tone="green"><Star className="h-4 w-4" /></IconBubble>}
                title={s.assignment.title}
                subtitle={`${s.assignment.classroom.name} · ${formatDate(s.returnedAt, locale)}`}
                right={
                  s.grade !== null ? (
                    <Badge tone={percentTone(pct)}>
                      {s.grade}
                      {max ? ` / ${max}` : ""}
                    </Badge>
                  ) : (
                    <Badge>{t("dashboard.student.returned")}</Badge>
                  )
                }
              />
            );
          })}
        </Section>
      </div>

      <Section
        title={t("dashboard.latestAnnouncements")}
        action={<Link href="/announcements" className="text-sm font-medium text-brand-600 hover:underline">{t("dashboard.viewAll")}</Link>}
        isEmpty={!announcements.length}
        empty={t("dashboard.noAnnouncements")}
      >
        <AnnouncementRows items={announcements} locale={locale} campWide={t("dashboard.campWide")} />
      </Section>
    </div>
  );
}
