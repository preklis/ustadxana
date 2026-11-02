import { Bell, BellOff, CheckCheck, ChevronRight, Trash2, X } from "lucide-react";
import { db } from "@/lib/db";
import { requireActiveUser } from "@/lib/auth/session";
import { getI18n } from "@/i18n/server";
import { cn, formatDate } from "@/lib/utils";
import { Card, EmptyState, PageHeader, Pagination } from "@/components/ui/primitives";
import { ConfirmAction } from "@/components/ui/interactive";
import { buttonClass } from "@/components/ui/button";
import Link from "next/link";
import { deleteNotification, deleteRead, markAllRead, openNotification } from "./actions";

const PER_PAGE = 25;

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t("notifications.title") };
}

function relative(d: Date, locale: string) {
  const diff = (d.getTime() - Date.now()) / 1000;
  const rtf = new Intl.RelativeTimeFormat(locale === "az" ? "az" : "en", { numeric: "auto" });
  const abs = Math.abs(diff);
  if (abs < 60) return rtf.format(Math.round(diff), "second");
  if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), "hour");
  if (abs < 7 * 86400) return rtf.format(Math.round(diff / 86400), "day");
  return formatDate(d, locale, true);
}

export default async function NotificationsPage({ searchParams }: { searchParams: Promise<{ page?: string; filter?: string }> }) {
  const user = await requireActiveUser();
  const { t, locale } = await getI18n();
  const sp = await searchParams;
  const unreadOnly = sp.filter === "unread";
  const where = { userId: user.id, ...(unreadOnly ? { readAt: null } : {}) };

  const [total, unread, readCount] = await Promise.all([
    db.notification.count({ where }),
    db.notification.count({ where: { userId: user.id, readAt: null } }),
    db.notification.count({ where: { userId: user.id, readAt: { not: null } } }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
  const page = Math.min(totalPages, Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1));
  const items = await db.notification.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * PER_PAGE,
    take: PER_PAGE,
  });
  const qs = (p: number, f = sp.filter) => {
    const u = new URLSearchParams();
    if (f) u.set("filter", f);
    if (p > 1) u.set("page", String(p));
    const s = u.toString();
    return `/notifications${s ? `?${s}` : ""}`;
  };

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={t("notifications.title")}
        description={unread ? t("notifications.unreadCount", { n: unread }) : t("notifications.allCaughtUp")}
        actions={
          <>
            {unread > 0 && (
              <form action={markAllRead}>
                <button type="submit" className={buttonClass("outline", "sm")}>
                  <CheckCheck className="h-4 w-4" />
                  {t("notifications.markAllRead")}
                </button>
              </form>
            )}
            {readCount > 0 && (
              <ConfirmAction
                action={deleteRead}
                label={t("notifications.deleteRead")}
                confirmText={t("notifications.deleteReadConfirm")}
                icon={<Trash2 className="h-4 w-4" />}
                variant="ghost"
              />
            )}
          </>
        }
      />

      <div className="mb-4 inline-flex rounded-lg border border-slate-200 bg-white p-1 text-sm dark:border-slate-800 dark:bg-slate-900">
        {[
          { key: undefined, label: t("common.all") },
          { key: "unread", label: t("notifications.unread") },
        ].map((f) => (
          <Link
            key={f.key ?? "all"}
            href={qs(1, f.key)}
            className={cn(
              "rounded-md px-3 py-1.5 font-medium transition",
              sp.filter === f.key || (!sp.filter && !f.key)
                ? "bg-brand-600 text-brand-fg"
                : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800",
            )}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={unreadOnly ? <Bell className="h-8 w-8" /> : <BellOff className="h-8 w-8" />}
          title={unreadOnly ? t("notifications.noUnread") : t("notifications.empty")}
          description={t("notifications.emptyText")}
        />
      ) : (
        <Card className="divide-y divide-slate-100 overflow-hidden dark:divide-slate-800">
          {items.map((n) => {
            const isUnread = !n.readAt;
            return (
              <div key={n.id} className={cn("group flex items-start gap-1 transition", isUnread ? "bg-brand-50/60 dark:bg-brand-950/30" : "hover:bg-slate-50 dark:hover:bg-slate-800/40")}>
                <form action={openNotification.bind(null, n.id)} className="min-w-0 flex-1">
                  <button type="submit" className="flex w-full items-start gap-3 px-4 py-3.5 text-left sm:px-5">
                    <span
                      className={cn(
                        "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                        isUnread ? "bg-brand-600 text-brand-fg" : "bg-slate-100 text-slate-500 dark:bg-slate-800",
                      )}
                    >
                      <Bell className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={cn("block text-sm", isUnread ? "font-semibold text-slate-900 dark:text-white" : "font-medium text-slate-700 dark:text-slate-300")}>
                        {t(n.title)}
                      </span>
                      {n.body && <span className="mt-0.5 block whitespace-pre-line break-words text-sm text-slate-600 dark:text-slate-400">{t(n.body)}</span>}
                      <span className="mt-1 block text-xs text-slate-400" title={formatDate(n.createdAt, locale, true)}>
                        {relative(n.createdAt, locale)}
                      </span>
                    </span>
                    {isUnread && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-brand-600" aria-label={t("notifications.unread")} />}
                    {n.link && <ChevronRight className="mt-2 h-4 w-4 shrink-0 text-slate-400" />}
                  </button>
                </form>
                <div className="py-3 pr-2 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100">
                  <ConfirmAction
                    action={deleteNotification.bind(null, n.id)}
                    label={<span className="sr-only">{t("common.delete")}</span>}
                    icon={<X className="h-4 w-4" />}
                    size="icon"
                    skipConfirm
                    className="h-8 w-8 text-slate-400 hover:text-red-600"
                  />
                </div>
              </div>
            );
          })}
        </Card>
      )}

      <Pagination page={page} totalPages={totalPages} hrefFor={(p) => qs(p)} prevLabel={t("common.prev")} nextLabel={t("common.next")} />
    </div>
  );
}
