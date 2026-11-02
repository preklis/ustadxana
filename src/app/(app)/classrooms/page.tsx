import Link from "next/link";
import { Archive, Clock, MapPin, School, Settings2, Users } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireActiveUser } from "@/lib/auth/session";
import { can, visibleClassroomsWhere } from "@/lib/permissions";
import { getActiveSeason } from "@/lib/season";
import { getI18n } from "@/i18n/server";
import { cn, fullName } from "@/lib/utils";
import { LinkButton } from "@/components/ui/button";
import { Avatar, CLASSROOM_COLORS, EmptyState, PageHeader } from "@/components/ui/primitives";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t("classroom.list.title") };
}

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function ClassroomsPage({ searchParams }: { searchParams: SP }) {
  const user = await requireActiveUser();
  const { t } = await getI18n();
  const sp = await searchParams;
  const showArchived = sp.archived === "1";
  const seasonParam = typeof sp.season === "string" ? sp.season : undefined;

  const visible = visibleClassroomsWhere(user) as Prisma.ClassroomWhereInput;
  const [seasons, active] = await Promise.all([
    db.season.findMany({
      where: { classrooms: { some: visible } },
      orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
      select: { id: true, name: true, isActive: true },
    }),
    getActiveSeason(),
  ]);

  const allSeasons = seasonParam === "all";
  const seasonId = allSeasons
    ? null
    : (seasons.find((s) => s.id === seasonParam)?.id ??
      seasons.find((s) => s.id === active?.id)?.id ??
      seasons[0]?.id ??
      null);

  const where: Prisma.ClassroomWhereInput = {
    AND: [visible, seasonId ? { seasonId } : {}, showArchived ? {} : { archived: false }],
  };
  const [classrooms, archivedCount] = await Promise.all([
    db.classroom.findMany({
      where,
      orderBy: [{ archived: "asc" }, { name: "asc" }],
      include: {
        season: { select: { name: true } },
        members: {
          where: { role: "MENTOR" },
          select: { user: { select: { id: true, firstName: true, lastName: true, avatarFileId: true } } },
          orderBy: { joinedAt: "asc" },
        },
        _count: { select: { members: { where: { role: "STUDENT" } } } },
      },
    }),
    showArchived
      ? Promise.resolve(0)
      : db.classroom.count({ where: { AND: [visible, seasonId ? { seasonId } : {}, { archived: true }] } }),
  ]);

  const href = (p: { season?: string | null; archived?: boolean }) => {
    const q = new URLSearchParams();
    const s = p.season === undefined ? (allSeasons ? "all" : seasonId) : p.season;
    if (s) q.set("season", s);
    if (p.archived ?? showArchived) q.set("archived", "1");
    const qs = q.toString();
    return qs ? `/classrooms?${qs}` : "/classrooms";
  };

  const canManage = can(user, "MANAGE_CLASSROOMS");

  return (
    <div>
      <PageHeader
        title={t("classroom.list.title")}
        description={user.role === "STUDENT" ? t("classroom.list.subtitleStudent") : t("classroom.list.subtitleTeam")}
        actions={
          canManage ? (
            <LinkButton href="/admin/classrooms" variant="outline">
              <Settings2 className="h-4 w-4" />
              {t("classroom.list.manage")}
            </LinkButton>
          ) : undefined
        }
      />

      {(seasons.length > 1 || archivedCount > 0 || showArchived) && (
        <div className="mb-6 flex flex-wrap items-center gap-2">
          {seasons.length > 1 && (
            <>
              {seasons.map((s) => (
                <Chip key={s.id} href={href({ season: s.id })} active={!allSeasons && s.id === seasonId}>
                  {s.name}
                  {s.isActive && <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />}
                </Chip>
              ))}
              <Chip href={href({ season: "all" })} active={allSeasons}>
                {t("classroom.list.allSeasons")}
              </Chip>
            </>
          )}
          {(archivedCount > 0 || showArchived) && (
            <Link
              href={href({ archived: !showArchived })}
              className="ml-auto inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-brand-600"
            >
              <Archive className="h-4 w-4" />
              {showArchived ? t("classroom.list.hideArchived") : t("classroom.list.showArchived", { n: archivedCount })}
            </Link>
          )}
        </div>
      )}

      {classrooms.length === 0 ? (
        <EmptyState
          icon={<School className="h-10 w-10" />}
          title={t("classroom.list.emptyTitle")}
          description={user.role === "STUDENT" ? t("classroom.list.emptyStudent") : t("classroom.list.emptyTeam")}
          action={
            canManage ? (
              <LinkButton href="/admin/classrooms" variant="outline">
                {t("classroom.list.manage")}
              </LinkButton>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {classrooms.map((c) => {
            const mentors = c.members.map((m) => m.user);
            return (
              <Link
                key={c.id}
                href={`/classrooms/${c.id}`}
                className={cn(
                  "group flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-900",
                  c.archived && "opacity-75",
                )}
              >
                <div
                  className={cn(
                    "relative h-28 overflow-hidden bg-gradient-to-br p-4 text-white",
                    CLASSROOM_COLORS[c.color] ?? CLASSROOM_COLORS.blue,
                  )}
                >
                  <div className="pointer-events-none absolute -bottom-10 -right-8 h-32 w-32 rounded-full bg-white/10" />
                  <div className="pointer-events-none absolute -right-2 -top-12 h-24 w-24 rounded-full bg-white/10" />
                  <h2 className="relative line-clamp-2 pr-16 text-lg font-semibold leading-snug group-hover:underline">{c.name}</h2>
                  {c.track && <p className="relative mt-0.5 truncate text-sm text-white/85">{c.track}</p>}
                  {c.archived && (
                    <span className="absolute right-3 top-3 rounded-full bg-black/25 px-2 py-0.5 text-xs font-medium">
                      {t("classroom.archived")}
                    </span>
                  )}
                </div>
                <div className="flex flex-1 flex-col gap-3 p-4">
                  {mentors.length > 0 ? (
                    <div className="flex items-center gap-2">
                      <div className="flex -space-x-2">
                        {mentors.slice(0, 4).map((m) => (
                          <Avatar key={m.id} user={m} size={28} className="ring-2 ring-white dark:ring-slate-900" />
                        ))}
                      </div>
                      <p className="min-w-0 truncate text-sm text-slate-600 dark:text-slate-400">
                        {mentors.slice(0, 2).map(fullName).join(", ")}
                        {mentors.length > 2 && ` +${mentors.length - 2}`}
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400">{t("classroom.noMentors")}</p>
                  )}
                  <div className="space-y-1 text-xs text-slate-500">
                    {c.room && (
                      <p className="flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{c.room}</span>
                      </p>
                    )}
                    {c.schedule && (
                      <p className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{c.schedule}</span>
                      </p>
                    )}
                  </div>
                  <div className="mt-auto flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500 dark:border-slate-800">
                    <span className="flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5" />
                      {t("classroom.studentCount", { n: c._count.members })}
                    </span>
                    {allSeasons && <span className="truncate">{c.season.name}</span>}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Chip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center rounded-full border px-3 py-1 text-sm font-medium transition-colors",
        active
          ? "border-brand-600 bg-brand-600 text-brand-fg"
          : "border-slate-300 bg-white text-slate-700 hover:border-brand-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300",
      )}
    >
      {children}
    </Link>
  );
}
