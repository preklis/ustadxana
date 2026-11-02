import Link from "next/link";
import type { Prisma, Role, UserStatus } from "@prisma/client";
import { Search, Users } from "lucide-react";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";
import { ALL_PERMISSIONS, assignableRoles, can, ROLE_DEFAULTS, TEAM_ROLES } from "@/lib/permissions";
import { getActiveSeason } from "@/lib/season";
import { formatDate, fullName } from "@/lib/utils";
import { getI18n } from "@/i18n/server";
import { Avatar, Badge, Card, EmptyState, PageHeader, Pagination, ROLE_TONE, STATUS_TONE, Table, td, th } from "@/components/ui/primitives";
import { Input, Select } from "@/components/ui/form";
import { buttonClass } from "@/components/ui/button";
import { grantablePermissions, PAGE_SIZE, pageFrom, qs } from "../_lib/shared";
import { CreateUserButton, type ClassroomOption } from "./create-user";
import { ImportUsersButton } from "./import-users";

const ROLES: Role[] = ["SUPERADMIN", "ADMIN", "STAFF", "MENTOR", "APPLICANT_CHECKER", "STUDENT"];
const STATUSES: UserStatus[] = ["ACTIVE", "PENDING_APPROVAL", "PROFILE_INCOMPLETE", "REJECTED", "SUSPENDED"];

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t("admin.users.title") };
}

type SP = { q?: string; role?: string; status?: string; page?: string };

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<SP> }) {
  const actor = await requirePermission("MANAGE_USERS");
  const { t, locale } = await getI18n();
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().slice(0, 100);
  const role = ROLES.includes(sp.role as Role) ? (sp.role as Role) : undefined;
  const status = STATUSES.includes(sp.status as UserStatus) ? (sp.status as UserStatus) : undefined;
  const page = pageFrom(sp.page);

  const terms = q.split(/\s+/).filter(Boolean).slice(0, 4);
  const where: Prisma.UserWhereInput = {
    ...(role ? { role } : {}),
    ...(status ? { status } : {}),
    ...(terms.length
      ? {
          AND: terms.map((term) => ({
            OR: [
              { email: { contains: term, mode: "insensitive" as const } },
              { firstName: { contains: term, mode: "insensitive" as const } },
              { lastName: { contains: term, mode: "insensitive" as const } },
              { title: { contains: term, mode: "insensitive" as const } },
            ],
          })),
        }
      : {}),
  };

  const [total, users] = await Promise.all([
    db.user.count({ where }),
    db.user.findMany({
      where,
      orderBy: [{ createdAt: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        status: true,
        title: true,
        avatarFileId: true,
        lastLoginAt: true,
        createdAt: true,
      },
    }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  let classrooms: ClassroomOption[] | null = null;
  if (can(actor, "MANAGE_CLASSROOMS")) {
    const season = await getActiveSeason();
    const rows = await db.classroom.findMany({
      where: { archived: false, ...(season ? { seasonId: season.id } : {}) },
      orderBy: { name: "asc" },
      select: { id: true, name: true, track: true, season: { select: { name: true } } },
    });
    classrooms = rows.map((c) => ({ id: c.id, name: c.name, track: c.track, seasonName: c.season.name }));
  }

  const roles = assignableRoles(actor);
  const filtered = !!(q || role || status);
  const hrefFor = (p: number) => `/admin/users${qs({ q, role, status, page: p > 1 ? p : undefined })}`;

  return (
    <div>
      <PageHeader
        title={t("admin.users.title")}
        description={t("admin.users.description", { n: total })}
        actions={
          <>
            <ImportUsersButton roles={roles.filter((r) => TEAM_ROLES.includes(r))} />
            <CreateUserButton
              roles={roles}
              allPermissions={ALL_PERMISSIONS}
              grantable={grantablePermissions(actor)}
              roleDefaults={ROLE_DEFAULTS}
              classrooms={classrooms}
            />
          </>
        }
      />

      <form method="get" className="mb-4 grid gap-2 sm:grid-cols-[1fr_auto_auto_auto]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input name="q" defaultValue={q} placeholder={t("admin.users.searchPh")} className="pl-9" aria-label={t("common.search")} />
        </div>
        <Select name="role" defaultValue={role ?? ""} aria-label={t("admin.fields.role")}>
          <option value="">{t("admin.users.allRoles")}</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {t(`common.roles.${r}`)}
            </option>
          ))}
        </Select>
        <Select name="status" defaultValue={status ?? ""} aria-label={t("common.status")}>
          <option value="">{t("admin.users.allStatuses")}</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {t(`common.userStatus.${s}`)}
            </option>
          ))}
        </Select>
        <div className="flex gap-2">
          <button type="submit" className={buttonClass("secondary", "md", "flex-1")}>
            {t("common.search")}
          </button>
          {filtered && (
            <Link href="/admin/users" className={buttonClass("ghost")}>
              {t("admin.clearFilters")}
            </Link>
          )}
        </div>
      </form>

      {users.length === 0 ? (
        <EmptyState
          icon={<Users className="h-10 w-10" />}
          title={filtered ? t("common.noResults") : t("admin.users.empty")}
          description={filtered ? t("admin.users.emptyFiltered") : undefined}
        />
      ) : (
        <Card className="overflow-hidden">
          <Table>
            <thead>
              <tr>
                <th className={th}>{t("common.name")}</th>
                <th className={th}>{t("admin.fields.role")}</th>
                <th className={th}>{t("common.status")}</th>
                <th className={`${th} hidden lg:table-cell`}>{t("admin.fields.title")}</th>
                <th className={`${th} hidden md:table-cell`}>{t("admin.users.lastLogin")}</th>
                <th className={`${th} hidden xl:table-cell`}>{t("admin.users.createdAt")}</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                  <td className={td}>
                    <Link href={`/admin/users/${u.id}`} className="flex min-w-0 items-center gap-3">
                      <Avatar user={u} size={34} />
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-slate-900 hover:text-brand-600 dark:text-slate-100">
                          {fullName(u)}
                          {u.id === actor.id && <span className="ml-1.5 text-xs font-normal text-slate-400">({t("common.you")})</span>}
                        </span>
                        <span className="block truncate text-xs text-slate-500">{u.email}</span>
                      </span>
                    </Link>
                  </td>
                  <td className={td}>
                    <Badge tone={ROLE_TONE[u.role]}>{t(`common.roles.${u.role}`)}</Badge>
                  </td>
                  <td className={td}>
                    <Badge tone={STATUS_TONE[u.status]}>{t(`common.userStatus.${u.status}`)}</Badge>
                  </td>
                  <td className={`${td} hidden text-slate-600 dark:text-slate-400 lg:table-cell`}>{u.title || "—"}</td>
                  <td className={`${td} hidden whitespace-nowrap text-slate-500 md:table-cell`}>
                    {u.lastLoginAt ? formatDate(u.lastLoginAt, locale, true) : t("admin.users.never")}
                  </td>
                  <td className={`${td} hidden whitespace-nowrap text-slate-500 xl:table-cell`}>{formatDate(u.createdAt, locale)}</td>
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
