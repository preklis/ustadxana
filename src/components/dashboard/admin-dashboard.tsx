import Link from "next/link";
import { CalendarCheck2, FileCheck2, GraduationCap, Megaphone, School, UserCheck, UserPlus, Users } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import type { SessionUser } from "@/lib/auth/session";
import { can, visibleClassroomsWhere } from "@/lib/permissions";
import { getActiveSeason } from "@/lib/season";
import { getI18n } from "@/i18n/server";
import { formatDate, fullName } from "@/lib/utils";
import { Avatar, Badge, StatCard, STATUS_TONE } from "@/components/ui/primitives";
import { aggregateRate } from "@/components/attendance/stats";
import { IconBubble, Row, Section } from "./widgets";
import { TeamDashboard } from "./team-dashboard";

const WEEK = 7 * 24 * 60 * 60 * 1000;

export async function AdminDashboard({ user }: { user: SessionUser }) {
  const { t, locale } = await getI18n();
  const season = await getActiveSeason();
  const weekAgo = new Date(Date.now() - WEEK);
  const canApprove = can(user, "APPROVE_STUDENTS");
  const canSeeUsers = canApprove || can(user, "MANAGE_USERS");
  const classroomScope: Prisma.ClassroomWhereInput = visibleClassroomsWhere(user);
  const seasonClassrooms: Prisma.ClassroomWhereInput = { ...classroomScope, archived: false, ...(season ? { seasonId: season.id } : {}) };

  const [activeStudents, pending, classrooms, mentors, submissionsWeek, attendance, registrations, recentSubs, recentAnns] = await Promise.all([
    db.user.count({ where: { role: "STUDENT", status: "ACTIVE" } }),
    canApprove ? db.user.count({ where: { role: "STUDENT", status: "PENDING_APPROVAL" } }) : Promise.resolve(null),
    db.classroom.count({ where: seasonClassrooms }),
    db.user.count({ where: { role: "MENTOR", status: "ACTIVE" } }),
    db.submission.count({ where: { submittedAt: { gte: weekAgo }, status: { in: ["SUBMITTED", "RETURNED"] }, assignment: { classroom: classroomScope } } }),
    aggregateRate({ session: { classroom: seasonClassrooms } }),
    canSeeUsers
      ? db.user.findMany({
          where: { role: "STUDENT" },
          orderBy: { createdAt: "desc" },
          take: 6,
          select: { id: true, firstName: true, lastName: true, email: true, avatarFileId: true, status: true, createdAt: true },
        })
      : Promise.resolve([]),
    db.submission.findMany({
      where: { submittedAt: { not: null }, status: { in: ["SUBMITTED", "RETURNED"] }, assignment: { classroom: classroomScope } },
      orderBy: { submittedAt: "desc" },
      take: 8,
      select: {
        id: true,
        submittedAt: true,
        isLate: true,
        student: { select: { id: true, firstName: true, lastName: true, email: true, avatarFileId: true } },
        assignment: { select: { id: true, title: true, classroomId: true, classroom: { select: { name: true } } } },
      },
    }),
    db.announcement.findMany({
      where: { OR: [{ classroomId: null }, { classroom: classroomScope }] },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        title: true,
        body: true,
        createdAt: true,
        classroom: { select: { id: true, name: true } },
        author: { select: { firstName: true, lastName: true, email: true } },
      },
    }),
  ]);

  type Activity = { key: string; at: Date; node: React.ReactNode };
  const activity: Activity[] = [
    ...recentSubs.map((s) => ({
      key: `s-${s.id}`,
      at: s.submittedAt!,
      node: (
        <Row
          key={`s-${s.id}`}
          href={`/classrooms/${s.assignment.classroomId}/classwork/${s.assignment.id}`}
          icon={<Avatar user={s.student} size={34} />}
          title={t("dashboard.admin.turnedIn", { name: fullName(s.student), title: s.assignment.title })}
          subtitle={`${s.assignment.classroom.name} · ${formatDate(s.submittedAt, locale, true)}`}
          right={s.isLate ? <Badge tone="orange">{t("dashboard.admin.late")}</Badge> : undefined}
        />
      ),
    })),
    ...recentAnns.map((a) => ({
      key: `a-${a.id}`,
      at: a.createdAt,
      node: (
        <Row
          key={`a-${a.id}`}
          href={a.classroom ? `/classrooms/${a.classroom.id}` : `/announcements#a-${a.id}`}
          icon={<IconBubble tone="violet"><Megaphone className="h-4 w-4" /></IconBubble>}
          title={t("dashboard.admin.posted", { name: fullName(a.author), title: a.title ?? (a.body.length > 60 ? `${a.body.slice(0, 60)}…` : a.body) })}
          subtitle={`${a.classroom?.name ?? t("dashboard.campWide")} · ${formatDate(a.createdAt, locale, true)}`}
        />
      ),
    })),
  ]
    .sort((x, y) => y.at.getTime() - x.at.getTime())
    .slice(0, 8);

  return (
    <div className="space-y-6">
      {season && <p className="-mt-2 text-sm text-slate-500">{t("dashboard.admin.seasonLine", { season: season.name })}</p>}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-3">
        <StatCard label={t("dashboard.admin.activeStudents")} value={activeStudents} icon={<Users className="h-5 w-5" />} href={can(user, "MANAGE_USERS") ? "/admin/users" : undefined} />
        {pending !== null && (
          <StatCard
            label={t("dashboard.admin.pendingApprovals")}
            value={pending}
            icon={<UserCheck className="h-5 w-5" />}
            href="/admin/approvals"
            hint={pending ? t("dashboard.admin.pendingHint") : t("dashboard.admin.noPending")}
          />
        )}
        <StatCard label={t("dashboard.admin.classrooms")} value={classrooms} icon={<School className="h-5 w-5" />} href="/classrooms" />
        <StatCard label={t("dashboard.admin.mentors")} value={mentors} icon={<GraduationCap className="h-5 w-5" />} />
        <StatCard label={t("dashboard.admin.submissionsWeek")} value={submissionsWeek} icon={<FileCheck2 className="h-5 w-5" />} />
        <StatCard
          label={t("dashboard.admin.avgAttendance")}
          value={attendance.percent === null ? "—" : `${attendance.percent}%`}
          icon={<CalendarCheck2 className="h-5 w-5" />}
          hint={attendance.total ? t("dashboard.admin.attendanceHint", { n: attendance.total }) : t("dashboard.admin.noAttendance")}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {canSeeUsers && (
          <Section
            title={t("dashboard.admin.recentRegistrations")}
            action={
              canApprove ? (
                <Link href="/admin/approvals" className="text-sm font-medium text-brand-600 hover:underline">
                  {t("dashboard.viewAll")}
                </Link>
              ) : undefined
            }
            isEmpty={!registrations.length}
            empty={t("dashboard.admin.noRegistrations")}
          >
            {registrations.map((u) => (
              <Row
                key={u.id}
                href={u.status === "PENDING_APPROVAL" && canApprove ? "/admin/approvals" : can(user, "MANAGE_USERS") ? `/admin/users?q=${encodeURIComponent(u.email)}` : undefined}
                icon={<Avatar user={u} size={34} />}
                title={fullName(u)}
                subtitle={`${u.email} · ${formatDate(u.createdAt, locale)}`}
                right={<Badge tone={STATUS_TONE[u.status]}>{t(`common.userStatus.${u.status}`)}</Badge>}
              />
            ))}
          </Section>
        )}

        <Section
          title={t("dashboard.admin.recentActivity")}
          action={
            can(user, "VIEW_AUDIT_LOG") ? (
              <Link href="/admin/audit" className="text-sm font-medium text-brand-600 hover:underline">
                {t("dashboard.admin.auditLog")}
              </Link>
            ) : undefined
          }
          isEmpty={!activity.length}
          empty={
            <span className="flex flex-col items-center gap-2">
              <UserPlus className="h-8 w-8 text-slate-400" />
              {t("dashboard.admin.noActivity")}
            </span>
          }
          className={canSeeUsers ? "" : "lg:col-span-2"}
        >
          {activity.map((a) => a.node)}
        </Section>
      </div>

      <TeamDashboard user={user} compact />
    </div>
  );
}
