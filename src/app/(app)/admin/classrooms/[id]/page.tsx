import Link from "next/link";
import { notFound } from "next/navigation";
import type { ClassroomRole } from "@prisma/client";
import { Archive, ArchiveRestore, ExternalLink, Trash2, Wand2 } from "lucide-react";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { cn, formatDate, fullName } from "@/lib/utils";
import { getI18n } from "@/i18n/server";
import { Alert, Avatar, Badge, Card, CardHeader, CLASSROOM_COLORS, PageHeader } from "@/components/ui/primitives";
import { LinkButton } from "@/components/ui/button";
import { ActionButton } from "@/components/admin/action-button";
import { ClassroomFormButton } from "../classroom-form";
import { addMatchingStudentsAction, deleteClassroomAction, removeMemberAction, setClassroomArchivedAction } from "../actions";
import { AddMembersButton } from "./add-members";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { t } = await getI18n();
  const { id } = await params;
  const c = await db.classroom.findUnique({ where: { id }, select: { name: true } });
  return { title: c?.name ?? t("admin.classrooms.title") };
}

export default async function AdminClassroomDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requirePermission("MANAGE_CLASSROOMS");
  const { t, locale } = await getI18n();
  const { id } = await params;

  const classroom = await db.classroom.findUnique({
    where: { id },
    include: {
      season: { select: { id: true, name: true } },
      members: {
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true, avatarFileId: true, title: true, role: true, status: true, profile: { select: { preferredTrack: true } } } },
        },
        orderBy: [{ user: { firstName: "asc" } }, { user: { lastName: "asc" } }],
      },
    },
  });
  if (!classroom) notFound();

  const [seasons, trackRows] = await Promise.all([
    db.season.findMany({ orderBy: [{ isActive: "desc" }, { createdAt: "desc" }], select: { id: true, name: true } }),
    db.classroom.findMany({ where: { track: { not: null } }, distinct: ["track"], select: { track: true } }),
  ]);
  const tracks = trackRows.map((r) => r.track!).filter(Boolean);
  const matchTrack = (classroom.track || classroom.name).trim();
  const canSeeUsers = can(actor, "MANAGE_USERS");

  const sections: { role: ClassroomRole; title: string; empty: string }[] = [
    { role: "MENTOR", title: t("admin.members.mentors"), empty: t("admin.members.emptyMentors") },
    { role: "STAFF", title: t("admin.members.staff"), empty: t("admin.members.emptyStaff") },
    { role: "STUDENT", title: t("admin.members.students"), empty: t("admin.members.emptyStudents") },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title={classroom.name} back={{ href: `/admin/classrooms?season=${classroom.season.id}`, label: t("admin.classrooms.title") }} />

      <Card className="overflow-hidden">
        <div className={cn("bg-gradient-to-br px-6 py-6 text-white", CLASSROOM_COLORS[classroom.color] ?? CLASSROOM_COLORS.blue)}>
          <div className="flex flex-wrap items-center gap-2 text-sm text-white/80">
            <span>{classroom.season.name}</span>
            {classroom.track && <span>· {classroom.track}</span>}
            {classroom.archived && <span className="rounded-full bg-black/25 px-2 py-0.5 text-xs font-medium text-white">{t("admin.classrooms.archived")}</span>}
          </div>
          <h2 className="mt-1 text-2xl font-bold">{classroom.name}</h2>
          {classroom.description && <p className="mt-2 max-w-2xl whitespace-pre-wrap text-sm text-white/90">{classroom.description}</p>}
          {(classroom.room || classroom.schedule) && (
            <p className="mt-2 text-sm text-white/80">{[classroom.room, classroom.schedule].filter(Boolean).join(" · ")}</p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 px-5 py-3">
          <AddMembersButton classroomId={classroom.id} />
          <ActionButton
            action={addMatchingStudentsAction.bind(null, classroom.id)}
            label={t("admin.members.addMatching", { track: matchTrack })}
            icon={<Wand2 className="h-4 w-4" />}
            variant="outline"
            confirmText={t("admin.members.addMatchingConfirm", { track: matchTrack })}
          />
          <span className="flex-1" />
          <LinkButton href={`/classrooms/${classroom.id}`} variant="ghost" size="sm">
            <ExternalLink className="h-4 w-4" />
            {t("admin.classrooms.open")}
          </LinkButton>
          <ClassroomFormButton
            classroom={{
              id: classroom.id,
              seasonId: classroom.seasonId,
              name: classroom.name,
              track: classroom.track,
              description: classroom.description,
              room: classroom.room,
              schedule: classroom.schedule,
              color: classroom.color,
            }}
            seasons={seasons}
            tracks={tracks}
          />
          <ActionButton
            action={setClassroomArchivedAction.bind(null, classroom.id, !classroom.archived)}
            label={classroom.archived ? t("admin.classrooms.unarchive") : t("admin.classrooms.archive")}
            icon={classroom.archived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
            variant="outline"
            confirmText={classroom.archived ? undefined : t("admin.classrooms.archiveConfirm")}
            skipConfirm={classroom.archived}
          />
          <ActionButton
            action={deleteClassroomAction.bind(null, classroom.id, "/admin/classrooms")}
            label={t("common.delete")}
            icon={<Trash2 className="h-4 w-4" />}
            variant="danger"
            confirmText={`${t("admin.classrooms.deleteConfirm", { name: classroom.name })} ${t("common.cannotUndo")}`}
          />
        </div>
      </Card>

      {classroom.archived && <Alert tone="yellow">{t("admin.classrooms.archivedHint")}</Alert>}

      <div className="grid gap-6 lg:grid-cols-2">
        {sections.map((s) => {
          const members = classroom.members.filter((m) => m.role === s.role);
          return (
            <Card key={s.role} className={s.role === "STUDENT" ? "lg:col-span-2" : undefined}>
              <CardHeader title={`${s.title} (${members.length})`} />
              {members.length === 0 ? (
                <p className="px-5 py-6 text-center text-sm text-slate-500">{s.empty}</p>
              ) : (
                <ul className={cn("divide-y divide-slate-100 dark:divide-slate-800", s.role === "STUDENT" && "sm:grid sm:grid-cols-2 sm:divide-y-0 xl:grid-cols-3")}>
                  {members.map((m) => (
                    <li
                      key={m.userId}
                      className={cn("flex items-center gap-3 px-5 py-3", s.role === "STUDENT" && "sm:border-b sm:border-slate-100 sm:dark:border-slate-800")}
                    >
                      <Avatar user={m.user} size={34} />
                      <div className="min-w-0 flex-1">
                        {canSeeUsers ? (
                          <Link href={`/admin/users/${m.userId}`} className="block truncate text-sm font-medium text-slate-900 hover:text-brand-600 dark:text-slate-100">
                            {fullName(m.user)}
                          </Link>
                        ) : (
                          <span className="block truncate text-sm font-medium text-slate-900 dark:text-slate-100">{fullName(m.user)}</span>
                        )}
                        <span className="block truncate text-xs text-slate-500">
                          {m.user.title || m.user.email}
                          {m.user.status !== "ACTIVE" && (
                            <Badge tone="red" className="ml-1.5">
                              {t(`common.userStatus.${m.user.status}`)}
                            </Badge>
                          )}
                        </span>
                        <span className="block text-[11px] text-slate-400">{t("admin.members.joined", { date: formatDate(m.joinedAt, locale) })}</span>
                      </div>
                      <ActionButton
                        action={removeMemberAction.bind(null, classroom.id, m.userId)}
                        label={t("common.remove")}
                        confirmText={t("admin.members.removeConfirm", { name: fullName(m.user) })}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
