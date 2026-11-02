import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { MessageSquare, Megaphone, Pin, PinOff, Trash2 } from "lucide-react";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { requireActiveUser } from "@/lib/auth/session";
import { can, isTeam } from "@/lib/permissions";
import { getActiveSeason } from "@/lib/season";
import { getI18n } from "@/i18n/server";
import { cn, formatDate, fullName } from "@/lib/utils";
import { Attachments } from "@/components/attachments";
import { Avatar, Badge, Card, EmptyState, PageHeader, Pagination } from "@/components/ui/primitives";
import { ConfirmAction } from "@/components/ui/interactive";
import { CommentForm, EditAnnouncementButton, NewAnnouncementButton } from "./announcement-forms";
import { deleteAnnouncement, deleteComment, togglePin } from "./actions";

const PER_PAGE = 25;
const AUDIENCE_TONE = { EVERYONE: "blue", STUDENTS: "green", TEAM: "purple" } as const;

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t("announcements.title") };
}

export default async function AnnouncementsPage({ searchParams }: { searchParams: Promise<{ season?: string; page?: string }> }) {
  const user = await requireActiveUser();
  const { t, locale } = await getI18n();
  const sp = await searchParams;
  const canPost = can(user, "POST_ANNOUNCEMENTS");
  const team = isTeam(user);
  const season = await getActiveSeason();
  const showAll = sp.season === "all" || !season;

  const where: Prisma.AnnouncementWhereInput = {
    classroomId: null,
    audience: { in: team ? ["EVERYONE", "STUDENTS", "TEAM"] : ["EVERYONE", "STUDENTS"] },
    ...(showAll ? {} : { OR: [{ seasonId: season!.id }, { seasonId: null }] }),
  };
  const total = await db.announcement.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
  const page = Math.min(totalPages, Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1));
  const items = await db.announcement.findMany({
    where,
    orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
    skip: (page - 1) * PER_PAGE,
    take: PER_PAGE,
    include: {
      author: { select: { id: true, firstName: true, lastName: true, email: true, avatarFileId: true, role: true, title: true } },
      season: { select: { name: true } },
      attachments: { select: { id: true, originalName: true, mimeType: true, size: true }, orderBy: { createdAt: "asc" } },
      comments: {
        orderBy: { createdAt: "asc" },
        include: { author: { select: { id: true, firstName: true, lastName: true, email: true, avatarFileId: true, role: true } } },
      },
    },
  });
  const maxMb = Math.round(env.maxUploadBytes / 1024 / 1024);
  const href = (p: number, s = sp.season) => {
    const u = new URLSearchParams();
    if (s) u.set("season", s);
    if (p > 1) u.set("page", String(p));
    const q = u.toString();
    return `/announcements${q ? `?${q}` : ""}`;
  };

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={t("announcements.title")} description={t("announcements.subtitle")} actions={canPost ? <NewAnnouncementButton maxMb={maxMb} /> : undefined} />

      {season && (
        <div className="mb-5 inline-flex rounded-lg border border-slate-200 bg-white p-1 text-sm dark:border-slate-800 dark:bg-slate-900">
          {[
            { key: undefined, label: season.name },
            { key: "all", label: t("announcements.allSeasons") },
          ].map((f) => (
            <Link
              key={f.key ?? "current"}
              href={href(1, f.key)}
              className={cn(
                "rounded-md px-3 py-1.5 font-medium transition",
                (f.key === "all") === showAll
                  ? "bg-brand-600 text-brand-fg"
                  : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800",
              )}
            >
              {f.label}
            </Link>
          ))}
        </div>
      )}

      {items.length === 0 ? (
        <EmptyState icon={<Megaphone className="h-8 w-8" />} title={t("announcements.empty")} description={canPost ? t("announcements.emptyPoster") : t("announcements.emptyText")} />
      ) : (
        <div className="space-y-4">
          {items.map((a) => (
            <Card key={a.id} id={`a-${a.id}`} className={cn("scroll-mt-24 overflow-hidden", a.pinned && "border-brand-300 ring-1 ring-brand-200 dark:border-brand-800 dark:ring-brand-900")}>
              <div className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar user={a.author} size={40} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{fullName(a.author)}</p>
                      <p className="truncate text-xs text-slate-500">
                        {a.author.title ?? t(`common.roles.${a.author.role}`)} · {formatDate(a.createdAt, locale, true)}
                        {a.updatedAt.getTime() - a.createdAt.getTime() > 60_000 && ` · ${t("announcements.edited")}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                    {a.pinned && (
                      <Badge tone="blue" className="gap-1">
                        <Pin className="h-3 w-3" />
                        {t("announcements.pinned")}
                      </Badge>
                    )}
                    {team && <Badge tone={AUDIENCE_TONE[a.audience]}>{t(`announcements.audiences.${a.audience}`)}</Badge>}
                  </div>
                </div>

                {a.title && <h2 className="mt-4 text-lg font-semibold text-slate-900 dark:text-white">{a.title}</h2>}
                <div className={cn("whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-700 dark:text-slate-300", a.title ? "mt-1.5" : "mt-4")}>{a.body}</div>
                {a.attachments.length > 0 && (
                  <div className="mt-4">
                    <Attachments files={a.attachments} />
                  </div>
                )}
                {showAll && a.season && <p className="mt-3 text-xs text-slate-400">{a.season.name}</p>}

                {canPost && (
                  <div className="mt-4 flex flex-wrap gap-1 border-t border-slate-100 pt-3 dark:border-slate-800">
                    <EditAnnouncementButton
                      maxMb={maxMb}
                      existing={{
                        id: a.id,
                        title: a.title,
                        body: a.body,
                        audience: a.audience,
                        pinned: a.pinned,
                        files: a.attachments.map((f) => ({ id: f.id, originalName: f.originalName, size: f.size })),
                      }}
                    />
                    <ConfirmAction
                      action={togglePin.bind(null, a.id)}
                      skipConfirm
                      label={a.pinned ? t("announcements.unpin") : t("announcements.pin")}
                      icon={a.pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                    />
                    <ConfirmAction
                      action={deleteAnnouncement.bind(null, a.id)}
                      label={t("common.delete")}
                      confirmText={t("announcements.deleteConfirm")}
                      icon={<Trash2 className="h-4 w-4" />}
                      className="text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
                    />
                  </div>
                )}
              </div>

              <details className="group border-t border-slate-100 bg-slate-50/60 dark:border-slate-800 dark:bg-slate-900/60" open={a.comments.length > 0 && a.comments.length <= 3}>
                <summary className="flex cursor-pointer list-none items-center gap-2 px-5 py-3 text-sm font-medium text-slate-600 hover:text-brand-600 dark:text-slate-400">
                  <MessageSquare className="h-4 w-4" />
                  {a.comments.length ? t("announcements.commentsCount", { n: a.comments.length }) : t("announcements.addComment")}
                </summary>
                <div className="space-y-3 px-5 pb-4">
                  {a.comments.map((c) => (
                    <div key={c.id} className="group/c flex items-start gap-2.5">
                      <Avatar user={c.author} size={30} />
                      <div className="min-w-0 flex-1 rounded-lg bg-white px-3 py-2 shadow-sm dark:bg-slate-800">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-xs font-semibold text-slate-900 dark:text-white">
                            {fullName(c.author)}
                            <span className="ml-2 font-normal text-slate-400">{formatDate(c.createdAt, locale, true)}</span>
                          </p>
                          {(c.authorId === user.id || canPost) && (
                            <ConfirmAction
                              action={deleteComment.bind(null, c.id)}
                              label={<span className="sr-only">{t("common.delete")}</span>}
                              icon={<Trash2 className="h-3.5 w-3.5" />}
                              size="icon"
                              className="h-6 w-6 text-slate-400 hover:text-red-600"
                            />
                          )}
                        </div>
                        <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-slate-700 dark:text-slate-300">{c.body}</p>
                      </div>
                    </div>
                  ))}
                  <CommentForm announcementId={a.id} />
                </div>
              </details>
            </Card>
          ))}
        </div>
      )}

      <Pagination page={page} totalPages={totalPages} hrefFor={(p) => href(p)} prevLabel={t("common.prev")} nextLabel={t("common.next")} />
    </div>
  );
}
