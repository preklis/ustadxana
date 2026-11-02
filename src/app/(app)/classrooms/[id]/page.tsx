import Link from "next/link";
import { CalendarClock, Megaphone, Pin } from "lucide-react";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { getI18n } from "@/i18n/server";
import { formatDate, fullName } from "@/lib/utils";
import { Attachments } from "@/components/attachments";
import { Avatar, Badge, Card, EmptyState, Pagination } from "@/components/ui/primitives";
import { CommentThread } from "@/components/classroom/comments";
import { PostComposer, PostMenu } from "@/components/classroom/post-forms";
import { TypeIcon } from "@/components/classroom/work-status";
import { authorSelect, fileSelect, getClassroomContext } from "../_lib/context";

const PAGE_SIZE = 25;

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [{ classroom }, { t }] = await Promise.all([getClassroomContext(id), getI18n()]);
  return { title: `${t("classroom.tabs.stream")} · ${classroom.name}` };
}

export default async function StreamPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const { user, classroom, access } = await getClassroomContext(id);
  const { t, locale } = await getI18n();
  const now = new Date();
  const page = Math.max(1, Number(typeof sp.page === "string" ? sp.page : 1) || 1);
  const maxMb = Math.round(env.maxUploadBytes / 1024 / 1024);

  const [posts, total, upcoming] = await Promise.all([
    db.announcement.findMany({
      where: { classroomId: classroom.id },
      orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        author: { select: authorSelect },
        attachments: { select: fileSelect, orderBy: { createdAt: "asc" } },
        comments: { orderBy: { createdAt: "asc" }, include: { author: { select: authorSelect } } },
      },
    }),
    db.announcement.count({ where: { classroomId: classroom.id } }),
    db.assignment.findMany({
      where: {
        classroomId: classroom.id,
        published: true,
        type: { not: "MATERIAL" },
        dueAt: { gte: now },
        ...(access.isStudent
          ? { submissions: { none: { studentId: user.id, status: { in: ["SUBMITTED", "RETURNED"] } } } }
          : {}),
      },
      orderBy: { dueAt: "asc" },
      take: 5,
      select: { id: true, title: true, dueAt: true, type: true },
    }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const me = { id: user.id, firstName: user.firstName, lastName: user.lastName, avatarFileId: user.avatarFileId };
  const writable = !classroom.archived;

  return (
    <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
      <aside className="space-y-4">
        <Card className="p-4">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
            <CalendarClock className="h-4 w-4 text-brand-600" />
            {t("classroom.stream.upcoming")}
          </h2>
          {upcoming.length === 0 ? (
            <p className="text-sm text-slate-500">{t("classroom.stream.noUpcoming")}</p>
          ) : (
            <ul className="space-y-3">
              {upcoming.map((a) => (
                <li key={a.id}>
                  <Link href={`/classrooms/${classroom.id}/classwork/${a.id}`} className="group flex items-start gap-2.5">
                    <TypeIcon type={a.type} size="sm" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-800 group-hover:text-brand-600 dark:text-slate-200">{a.title}</p>
                      <p className="text-xs text-slate-500">{t("classwork.dueOn", { date: formatDate(a.dueAt, locale, true) })}</p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <Link href={`/classrooms/${classroom.id}/classwork`} className="mt-4 inline-block text-sm font-medium text-brand-600 hover:underline">
            {t("classroom.stream.viewAll")}
          </Link>
        </Card>
        {classroom.description && (
          <Card className="p-4">
            <h2 className="mb-2 text-sm font-semibold text-slate-900 dark:text-slate-100">{t("classroom.about")}</h2>
            <p className="whitespace-pre-wrap break-words text-sm text-slate-600 dark:text-slate-400">{classroom.description}</p>
          </Card>
        )}
      </aside>

      <div className="min-w-0 space-y-4">
        {access.canTeach && writable && <PostComposer classroomId={classroom.id} me={me} maxMb={maxMb} />}

        {posts.length === 0 ? (
          <EmptyState
            icon={<Megaphone className="h-10 w-10" />}
            title={t("classroom.stream.emptyTitle")}
            description={access.canTeach ? t("classroom.stream.emptyTeacher") : t("classroom.stream.emptyStudent")}
          />
        ) : (
          posts.map((p) => {
            const canEdit = access.canTeach && (p.authorId === user.id || access.canManage) && writable;
            return (
              <Card key={p.id} className={p.pinned ? "border-brand-200 dark:border-brand-900" : undefined}>
                <div className="flex items-start gap-3 px-5 pt-4">
                  <Avatar user={p.author} size={40} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-slate-900 dark:text-slate-100">{fullName(p.author)}</p>
                    <p className="text-xs text-slate-500">{formatDate(p.createdAt, locale, true)}</p>
                  </div>
                  {p.pinned && (
                    <Badge tone="blue" className="gap-1">
                      <Pin className="h-3 w-3" />
                      {t("classroom.stream.pinned")}
                    </Badge>
                  )}
                  {(canEdit || (access.canTeach && writable)) && (
                    <PostMenu
                      post={{ id: p.id, body: p.body, pinned: p.pinned, attachments: p.attachments }}
                      canEdit={canEdit}
                      canPin={access.canTeach && writable}
                      maxMb={maxMb}
                    />
                  )}
                </div>
                <div className="space-y-4 px-5 pb-4 pt-3">
                  {p.title && <h3 className="font-semibold text-slate-900 dark:text-white">{p.title}</h3>}
                  <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-800 dark:text-slate-200">{p.body}</p>
                  <Attachments files={p.attachments} />
                </div>
                <div className="border-t border-slate-100 px-5 py-3 dark:border-slate-800">
                  {p.comments.length > 0 && (
                    <p className="mb-3 text-xs font-medium text-slate-500">
                      {t("classroom.comments.classCount", { n: p.comments.length })}
                    </p>
                  )}
                  <CommentThread
                    comments={p.comments}
                    target={`announcement:${p.id}`}
                    me={me}
                    canModerate={access.canTeach}
                    canPost={writable}
                    t={t}
                    locale={locale}
                    placeholder={t("classroom.comments.addClass")}
                  />
                </div>
              </Card>
            );
          })
        )}

        <Pagination
          page={page}
          totalPages={totalPages}
          hrefFor={(n) => `/classrooms/${classroom.id}?page=${n}`}
          prevLabel={t("common.prev")}
          nextLabel={t("common.next")}
        />
      </div>
    </div>
  );
}
