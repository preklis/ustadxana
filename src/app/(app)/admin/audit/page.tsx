import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { ScrollText, Search } from "lucide-react";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { formatDate, fullName } from "@/lib/utils";
import { getI18n } from "@/i18n/server";
import { Avatar, Card, EmptyState, PageHeader, Pagination, Table, td, th } from "@/components/ui/primitives";
import { Input, Select } from "@/components/ui/form";
import { buttonClass } from "@/components/ui/button";
import { AuditMeta } from "@/components/admin/audit-meta";
import { PAGE_SIZE, pageFrom, qs } from "../_lib/shared";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t("admin.audit.title") };
}

type SP = { action?: string; actor?: string; page?: string };

export default async function AuditPage({ searchParams }: { searchParams: Promise<SP> }) {
  const viewer = await requirePermission("VIEW_AUDIT_LOG");
  const { t, locale } = await getI18n();
  const sp = await searchParams;
  const action = (sp.action ?? "").trim().slice(0, 60);
  const actorQ = (sp.actor ?? "").trim().slice(0, 100);
  const page = pageFrom(sp.page);

  const actorTerms = actorQ.split(/\s+/).filter(Boolean).slice(0, 4);
  const where: Prisma.AuditLogWhereInput = {
    ...(action ? { action: { startsWith: action } } : {}),
    ...(actorTerms.length
      ? {
          AND: actorTerms.map((term) => ({
            actor: {
              OR: [
                { email: { contains: term, mode: "insensitive" as const } },
                { firstName: { contains: term, mode: "insensitive" as const } },
                { lastName: { contains: term, mode: "insensitive" as const } },
              ],
            },
          })),
        }
      : {}),
  };

  const [total, rows, actionRows] = await Promise.all([
    db.auditLog.count({ where }),
    db.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { actor: { select: { id: true, firstName: true, lastName: true, email: true, avatarFileId: true } } },
    }),
    db.auditLog.findMany({ distinct: ["action"], select: { action: true }, orderBy: { action: "asc" } }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const actions = actionRows.map((r) => r.action);
  const prefixes = [...new Set(actions.map((a) => (a.includes(".") ? `${a.split(".")[0]}.` : a)))];

  const idsOf = (type: string) => [...new Set(rows.filter((r) => r.targetType === type && r.targetId).map((r) => r.targetId!))];
  const [users, classrooms, seasons] = await Promise.all([
    db.user.findMany({ where: { id: { in: idsOf("user") } }, select: { id: true, firstName: true, lastName: true, email: true } }),
    db.classroom.findMany({ where: { id: { in: idsOf("classroom") } }, select: { id: true, name: true } }),
    db.season.findMany({ where: { id: { in: idsOf("season") } }, select: { id: true, name: true } }),
  ]);
  const targetName = new Map<string, string>([
    ...users.map((u) => [`user:${u.id}`, fullName(u)] as const),
    ...classrooms.map((c) => [`classroom:${c.id}`, c.name] as const),
    ...seasons.map((s) => [`season:${s.id}`, s.name] as const),
  ]);
  const targetHref = (type: string | null, id: string | null): string | null => {
    if (!type || !id || !targetName.has(`${type}:${id}`)) return null;
    if (type === "user" && can(viewer, "MANAGE_USERS")) return `/admin/users/${id}`;
    if (type === "classroom" && can(viewer, "MANAGE_CLASSROOMS")) return `/admin/classrooms/${id}`;
    if (type === "season" && can(viewer, "MANAGE_SEASONS")) return "/admin/seasons";
    return null;
  };

  const filtered = !!(action || actorQ);
  const hrefFor = (p: number) => `/admin/audit${qs({ action, actor: actorQ, page: p > 1 ? p : undefined })}`;

  return (
    <div>
      <PageHeader title={t("admin.audit.title")} description={t("admin.audit.description", { n: total })} />

      <form method="get" className="mb-4 grid gap-2 sm:grid-cols-[16rem_1fr_auto]">
        <Select name="action" defaultValue={action} aria-label={t("admin.audit.action")}>
          <option value="">{t("admin.audit.allActions")}</option>
          <optgroup label={t("admin.audit.modules")}>
            {prefixes.map((p) => (
              <option key={`p-${p}`} value={p}>
                {p}*
              </option>
            ))}
          </optgroup>
          <optgroup label={t("admin.audit.actions")}>
            {actions.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </optgroup>
        </Select>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input name="actor" defaultValue={actorQ} placeholder={t("admin.audit.actorPh")} className="pl-9" aria-label={t("admin.audit.actor")} />
        </div>
        <div className="flex gap-2">
          <button type="submit" className={buttonClass("secondary", "md", "flex-1")}>
            {t("common.search")}
          </button>
          {filtered && (
            <Link href="/admin/audit" className={buttonClass("ghost")}>
              {t("admin.clearFilters")}
            </Link>
          )}
        </div>
      </form>

      {rows.length === 0 ? (
        <EmptyState icon={<ScrollText className="h-10 w-10" />} title={filtered ? t("common.noResults") : t("admin.audit.empty")} />
      ) : (
        <Card className="overflow-hidden">
          <Table>
            <thead>
              <tr>
                <th className={th}>{t("admin.audit.time")}</th>
                <th className={th}>{t("admin.audit.actor")}</th>
                <th className={th}>{t("admin.audit.action")}</th>
                <th className={th}>{t("admin.audit.target")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const name = r.targetType && r.targetId ? targetName.get(`${r.targetType}:${r.targetId}`) : undefined;
                const href = targetHref(r.targetType, r.targetId);
                return (
                  <tr key={r.id} className="align-top">
                    <td className={`${td} whitespace-nowrap align-top text-slate-500`}>{formatDate(r.createdAt, locale, true)}</td>
                    <td className={`${td} align-top`}>
                      {r.actor ? (
                        <span className="flex items-center gap-2">
                          <Avatar user={r.actor} size={26} />
                          <span className="min-w-0">
                            <span className="block truncate font-medium text-slate-800 dark:text-slate-200">{fullName(r.actor)}</span>
                            <span className="block truncate text-xs text-slate-500">{r.actor.email}</span>
                          </span>
                        </span>
                      ) : (
                        <span className="text-slate-400">{t("admin.audit.system")}</span>
                      )}
                    </td>
                    <td className={`${td} align-top`}>
                      <Link
                        href={`/admin/audit${qs({ action: r.action, actor: actorQ })}`}
                        className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-700 hover:bg-brand-50 hover:text-brand-700 dark:bg-slate-800 dark:text-slate-300"
                      >
                        {r.action}
                      </Link>
                    </td>
                    <td className={`${td} max-w-md align-top`}>
                      {r.targetType ? (
                        <span className="text-sm">
                          <span className="text-xs uppercase tracking-wide text-slate-400">{r.targetType}</span>{" "}
                          {href ? (
                            <Link href={href} className="font-medium text-brand-600 hover:underline">
                              {name}
                            </Link>
                          ) : (
                            <span className="text-slate-700 dark:text-slate-300">{name ?? <code className="text-xs text-slate-400">{r.targetId}</code>}</span>
                          )}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                      <AuditMeta meta={r.meta} label={t("admin.audit.meta")} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </Card>
      )}
      <Pagination page={page} totalPages={totalPages} hrefFor={hrefFor} prevLabel={t("common.prev")} nextLabel={t("common.next")} />
    </div>
  );
}
