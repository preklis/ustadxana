import Link from "next/link";
import { Archive, ArchiveRestore, CalendarDays, MapPin, School, Trash2, Users } from "lucide-react";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { getActiveSeason } from "@/lib/season";
import { cn, fullName } from "@/lib/utils";
import { getI18n } from "@/i18n/server";
import { Badge, Card, CLASSROOM_COLORS, EmptyState, PageHeader, Tabs } from "@/components/ui/primitives";
import { LinkButton } from "@/components/ui/button";
import { ActionButton } from "@/components/admin/action-button";
import { ClassroomFormButton } from "./classroom-form";
import { deleteClassroomAction, setClassroomArchivedAction } from "./actions";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t("admin.classrooms.title") };
}

export default async function AdminClassroomsPage({ searchParams }: { searchParams: Promise<{ season?: string }> }) {
  const actor = await requirePermission("MANAGE_CLASSROOMS");
  const { t } = await getI18n();
  const sp = await searchParams;

  const seasons = await db.season.findMany({ orderBy: [{ isActive: "desc" }, { createdAt: "desc" }], select: { id: true, name: true, isActive: true } });
  const active = await getActiveSeason();
  const season = seasons.find((s) => s.id === sp.season) ?? seasons.find((s) => s.id === active?.id) ?? seasons[0];

  if (!season) {
    return (
      <div>
        <PageHeader title={t("admin.classrooms.title")} />
        <EmptyState
          icon={<CalendarDays className="h-10 w-10" />}
          title={t("admin.classrooms.noSeasons")}
          description={t("admin.classrooms.noSeasonsText")}
          action={can(actor, "MANAGE_SEASONS") ? <LinkButton href="/admin/seasons">{t("admin.seasons.title")}</LinkButton> : undefined}
        />
      </div>
    );
  }

  const [classrooms, counts, trackRows] = await Promise.all([
    db.classroom.findMany({
      where: { seasonId: season.id },
      orderBy: [{ archived: "asc" }, { name: "asc" }],
      include: {
        members: {
          where: { role: "MENTOR" },
          select: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
        },
      },
    }),
    db.classroomMember.groupBy({
      by: ["classroomId", "role"],
      where: { classroom: { seasonId: season.id } },
      _count: { _all: true },
    }),
    db.classroom.findMany({ where: { track: { not: null } }, distinct: ["track"], select: { track: true } }),
  ]);
  const countOf = (id: string, role: "MENTOR" | "STAFF" | "STUDENT") =>
    counts.find((c) => c.classroomId === id && c.role === role)?._count._all ?? 0;
  const tracks = trackRows.map((r) => r.track!).filter(Boolean);
  const seasonOptions = seasons.map((s) => ({ id: s.id, name: s.name }));

  return (
    <div>
      <PageHeader
        title={t("admin.classrooms.title")}
        description={t("admin.classrooms.description")}
        actions={<ClassroomFormButton seasons={seasonOptions} defaultSeasonId={season.id} tracks={tracks} />}
      />
      <Tabs
        active={season.id}
        tabs={seasons.map((s) => ({
          key: s.id,
          href: `/admin/classrooms?season=${s.id}`,
          label: (
            <span className="inline-flex items-center gap-1.5">
              {s.name}
              {s.isActive && <span className="h-2 w-2 rounded-full bg-emerald-500" aria-label={t("admin.seasons.active")} />}
            </span>
          ),
        }))}
      />

      {classrooms.length === 0 ? (
        <EmptyState
          icon={<School className="h-10 w-10" />}
          title={t("admin.classrooms.empty")}
          description={t("admin.classrooms.emptyText")}
          action={<ClassroomFormButton seasons={seasonOptions} defaultSeasonId={season.id} tracks={tracks} />}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {classrooms.map((c) => {
            const mentors = c.members.map((m) => m.user);
            return (
              <Card key={c.id} className={cn("flex flex-col overflow-hidden", c.archived && "opacity-75")}>
                <Link href={`/admin/classrooms/${c.id}`} className={cn("block bg-gradient-to-br px-5 py-4 text-white", CLASSROOM_COLORS[c.color] ?? CLASSROOM_COLORS.blue)}>
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-lg font-semibold leading-tight">{c.name}</h3>
                    {c.archived && <span className="shrink-0 rounded-full bg-black/25 px-2 py-0.5 text-xs font-medium">{t("admin.classrooms.archived")}</span>}
                  </div>
                  {c.track && <p className="mt-0.5 text-sm text-white/80">{c.track}</p>}
                </Link>
                <div className="flex-1 space-y-3 px-5 py-4 text-sm">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{t("admin.members.mentors")}</p>
                    <p className="mt-0.5 text-slate-800 dark:text-slate-200">
                      {mentors.length ? mentors.map((m) => fullName(m)).join(", ") : <span className="text-amber-600">{t("admin.classrooms.noMentors")}</span>}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <Badge tone="gray">
                      <Users className="mr-1 h-3 w-3" />
                      {t("admin.classrooms.studentsCount", { n: countOf(c.id, "STUDENT") })}
                    </Badge>
                    <Badge tone="green">{t("admin.classrooms.mentorsCount", { n: countOf(c.id, "MENTOR") })}</Badge>
                    <Badge tone="orange">{t("admin.classrooms.staffCount", { n: countOf(c.id, "STAFF") })}</Badge>
                  </div>
                  {(c.room || c.schedule) && (
                    <div className="space-y-1 text-slate-500">
                      {c.room && (
                        <p className="flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5" />
                          {c.room}
                        </p>
                      )}
                      {c.schedule && (
                        <p className="flex items-center gap-1.5">
                          <CalendarDays className="h-3.5 w-3.5" />
                          {c.schedule}
                        </p>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 px-5 py-3 dark:border-slate-800">
                  <LinkButton href={`/admin/classrooms/${c.id}`} size="sm">
                    <Users className="h-4 w-4" />
                    {t("admin.classrooms.manageMembers")}
                  </LinkButton>
                  <ClassroomFormButton
                    classroom={{ id: c.id, seasonId: c.seasonId, name: c.name, track: c.track, description: c.description, room: c.room, schedule: c.schedule, color: c.color }}
                    seasons={seasonOptions}
                    tracks={tracks}
                    variant="ghost"
                  />
                  <ActionButton
                    action={setClassroomArchivedAction.bind(null, c.id, !c.archived)}
                    label={c.archived ? t("admin.classrooms.unarchive") : t("admin.classrooms.archive")}
                    icon={c.archived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
                    confirmText={c.archived ? undefined : t("admin.classrooms.archiveConfirm")}
                    skipConfirm={c.archived}
                  />
                  <ActionButton
                    action={deleteClassroomAction.bind(null, c.id, undefined)}
                    label={t("common.delete")}
                    icon={<Trash2 className="h-4 w-4" />}
                    className="text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
                    confirmText={`${t("admin.classrooms.deleteConfirm", { name: c.name })} ${t("common.cannotUndo")}`}
                  />
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
