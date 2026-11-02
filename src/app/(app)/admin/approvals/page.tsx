import Link from "next/link";
import type { Prisma, UserStatus } from "@prisma/client";
import { ClipboardCheck, RotateCcw, Search, UserX } from "lucide-react";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";
import { getActiveSeason } from "@/lib/season";
import { formatDate, fullName } from "@/lib/utils";
import { getI18n } from "@/i18n/server";
import { Avatar, Badge, Card, EmptyState, PageHeader, Pagination, Table, Tabs, td, th } from "@/components/ui/primitives";
import { Input } from "@/components/ui/form";
import { buttonClass } from "@/components/ui/button";
import { ActionButton } from "@/components/admin/action-button";
import { ProfileDetails } from "@/components/admin/profile-details";
import { PAGE_SIZE, pageFrom, qs } from "../_lib/shared";
import { ApprovalsBoard } from "./approvals-board";
import { reopenApplicationAction } from "./actions";

const TABS = { pending: "PENDING_APPROVAL", rejected: "REJECTED", incomplete: "PROFILE_INCOMPLETE" } as const satisfies Record<string, UserStatus>;
type TabKey = keyof typeof TABS;

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t("admin.approvals.title") };
}

export default async function ApprovalsPage({ searchParams }: { searchParams: Promise<{ tab?: string; q?: string; page?: string }> }) {
  await requirePermission("APPROVE_STUDENTS");
  const { t, locale } = await getI18n();
  const sp = await searchParams;
  const tab: TabKey = sp.tab && sp.tab in TABS ? (sp.tab as TabKey) : "pending";
  const q = (sp.q ?? "").trim().slice(0, 100);
  const page = pageFrom(sp.page);

  const base = (status: UserStatus): Prisma.UserWhereInput => ({ role: "STUDENT", status });
  const terms = q.split(/\s+/).filter(Boolean).slice(0, 4);
  const where: Prisma.UserWhereInput = {
    ...base(TABS[tab]),
    ...(terms.length
      ? {
          AND: terms.map((term) => ({
            OR: [
              { email: { contains: term, mode: "insensitive" as const } },
              { firstName: { contains: term, mode: "insensitive" as const } },
              { lastName: { contains: term, mode: "insensitive" as const } },
              { profile: { preferredTrack: { contains: term, mode: "insensitive" as const } } },
              { profile: { university: { contains: term, mode: "insensitive" as const } } },
            ],
          })),
        }
      : {}),
  };

  const [pendingCount, rejectedCount, incompleteCount, total] = await Promise.all([
    db.user.count({ where: base("PENDING_APPROVAL") }),
    db.user.count({ where: base("REJECTED") }),
    db.user.count({ where: base("PROFILE_INCOMPLETE") }),
    db.user.count({ where }),
  ]);
  const users = await db.user.findMany({
    where,
    orderBy: tab === "pending" ? [{ updatedAt: "asc" }] : [{ updatedAt: "desc" }],
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      avatarFileId: true,
      createdAt: true,
      updatedAt: true,
      rejectionReason: true,
      profile: tab === "incomplete" ? false : true,
    },
  });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const season = await getActiveSeason();
  const classrooms =
    tab === "pending" && season
      ? await db.classroom.findMany({
          where: { seasonId: season.id, archived: false },
          orderBy: { name: "asc" },
          select: { id: true, name: true, track: true },
        })
      : [];

  const tabLabel = (label: string, n: number) => (
    <span className="inline-flex items-center gap-2">
      {label}
      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">{n}</span>
    </span>
  );
  const hrefFor = (p: number) => `/admin/approvals${qs({ tab: tab === "pending" ? undefined : tab, q, page: p > 1 ? p : undefined })}`;

  return (
    <div>
      <PageHeader title={t("admin.approvals.title")} description={t("admin.approvals.description")} />
      <Tabs
        active={tab}
        tabs={[
          { key: "pending", label: tabLabel(t("admin.approvals.tabs.pending"), pendingCount), href: "/admin/approvals" },
          { key: "rejected", label: tabLabel(t("admin.approvals.tabs.rejected"), rejectedCount), href: "/admin/approvals?tab=rejected" },
          { key: "incomplete", label: tabLabel(t("admin.approvals.tabs.incomplete"), incompleteCount), href: "/admin/approvals?tab=incomplete" },
        ]}
      />

      <form method="get" className="mb-4 flex gap-2">
        {tab !== "pending" && <input type="hidden" name="tab" value={tab} />}
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input name="q" defaultValue={q} placeholder={t("admin.approvals.searchPh")} className="pl-9" aria-label={t("common.search")} />
        </div>
        <button type="submit" className={buttonClass("secondary")}>
          {t("common.search")}
        </button>
        {q && (
          <Link href={tab === "pending" ? "/admin/approvals" : `/admin/approvals?tab=${tab}`} className={buttonClass("ghost")}>
            {t("admin.clearFilters")}
          </Link>
        )}
      </form>

      {users.length === 0 ? (
        <EmptyState
          icon={tab === "rejected" ? <UserX className="h-10 w-10" /> : <ClipboardCheck className="h-10 w-10" />}
          title={q ? t("common.noResults") : t(`admin.approvals.empty.${tab}`)}
        />
      ) : tab === "pending" ? (
        <ApprovalsBoard
          applications={users.map((u) => ({
            id: u.id,
            firstName: u.firstName,
            lastName: u.lastName,
            email: u.email,
            avatarFileId: u.avatarFileId,
            createdAt: u.createdAt,
            profile: u.profile ?? null,
          }))}
          classrooms={classrooms}
        />
      ) : tab === "rejected" ? (
        <div className="space-y-3">
          {users.map((u) => (
            <Card key={u.id}>
              <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                  <Avatar user={u} size={40} />
                  <div className="min-w-0">
                    <Link href={`/admin/users/${u.id}`} className="font-semibold text-slate-900 hover:text-brand-600 dark:text-white">
                      {fullName(u)}
                    </Link>
                    <p className="truncate text-sm text-slate-500">{u.email}</p>
                    {u.rejectionReason && (
                      <p className="mt-2 whitespace-pre-wrap rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-950/40 dark:text-red-200">
                        <span className="font-medium">{t("admin.approvals.rejectionReason")}:</span> {u.rejectionReason}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-slate-400">{formatDate(u.updatedAt, locale, true)}</p>
                  </div>
                </div>
                <ActionButton
                  action={reopenApplicationAction.bind(null, u.id)}
                  label={t("admin.approvals.reopen")}
                  icon={<RotateCcw className="h-4 w-4" />}
                  variant="outline"
                  confirmText={t("admin.approvals.reopenConfirm")}
                />
              </div>
              {"profile" in u && u.profile && (
                <details className="group border-t border-slate-100 dark:border-slate-800">
                  <summary className="cursor-pointer list-none px-4 py-2.5 text-sm font-medium text-brand-600 hover:text-brand-700 [&::-webkit-details-marker]:hidden">
                    <span className="mr-1 inline-block transition group-open:rotate-90">▸</span>
                    {t("admin.approvals.showProfile")}
                  </summary>
                  <div className="px-4 pb-4">
                    <ProfileDetails profile={u.profile} email={u.email} />
                  </div>
                </details>
              )}
            </Card>
          ))}
        </div>
      ) : (
        <Card className="overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-3 text-sm text-slate-500 dark:border-slate-800">{t("admin.approvals.incompleteHint")}</div>
          <Table>
            <thead>
              <tr>
                <th className={th}>{t("common.name")}</th>
                <th className={th}>{t("common.email")}</th>
                <th className={th}>{t("admin.approvals.registeredAt")}</th>
                <th className={th}>{t("common.status")}</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td className={td}>
                    <Link href={`/admin/users/${u.id}`} className="flex items-center gap-3 font-medium text-slate-900 hover:text-brand-600 dark:text-slate-100">
                      <Avatar user={u} size={30} />
                      {fullName(u)}
                    </Link>
                  </td>
                  <td className={`${td} text-slate-600 dark:text-slate-400`}>
                    <a href={`mailto:${u.email}`} className="hover:text-brand-600">
                      {u.email}
                    </a>
                  </td>
                  <td className={`${td} whitespace-nowrap text-slate-500`}>{formatDate(u.createdAt, locale, true)}</td>
                  <td className={td}>
                    <Badge>{t("common.userStatus.PROFILE_INCOMPLETE")}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}
      <Pagination page={page} totalPages={totalPages} hrefFor={hrefFor} prevLabel={t("common.prev")} nextLabel={t("common.next")} />
    </div>
  );
}
