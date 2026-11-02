import Link from "next/link";
import { notFound } from "next/navigation";
import { Ban, GraduationCap, History, PlayCircle, ShieldAlert, Trash2 } from "lucide-react";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";
import { ALL_PERMISSIONS, assignableRoles, can, canEditUser, permissionsOf, ROLE_DEFAULTS } from "@/lib/permissions";
import { formatDate, fullName } from "@/lib/utils";
import { getI18n } from "@/i18n/server";
import {
  Alert,
  Avatar,
  Badge,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  PageHeader,
  ROLE_TONE,
  STATUS_TONE,
} from "@/components/ui/primitives";
import { ActionButton } from "@/components/admin/action-button";
import { ProfileDetails } from "@/components/admin/profile-details";
import { AuditMeta } from "@/components/admin/audit-meta";
import { grantablePermissions } from "../../_lib/shared";
import { deleteUserAction, removeMembershipAction, setUserSuspendedAction } from "../actions";
import { EditUserForm, ResetPasswordButton } from "./user-forms";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { t } = await getI18n();
  const { id } = await params;
  const u = await db.user.findUnique({ where: { id }, select: { firstName: true, lastName: true, email: true } });
  return { title: u ? fullName(u) : t("admin.users.title") };
}

export default async function AdminUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requirePermission("MANAGE_USERS");
  const { t, locale } = await getI18n();
  const { id } = await params;

  const user = await db.user.findUnique({
    where: { id },
    omit: { passwordHash: true },
    include: {
      profile: true,
      approvedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
      memberships: {
        include: { classroom: { select: { id: true, name: true, archived: true, season: { select: { name: true, isActive: true } } } } },
        orderBy: { joinedAt: "desc" },
      },
      _count: { select: { assignments: true } },
    },
  });
  if (!user) notFound();

  const editable = canEditUser(actor, user);
  const isSelf = actor.id === user.id;
  const manageClassrooms = can(actor, "MANAGE_CLASSROOMS");
  const audits = await db.auditLog.findMany({
    where: { targetType: "user", targetId: user.id },
    orderBy: { createdAt: "desc" },
    take: 20,
    include: { actor: { select: { id: true, firstName: true, lastName: true, email: true } } },
  });

  const effective = [...permissionsOf(user)];
  const roleLocked = user.status === "PROFILE_INCOMPLETE" || user.status === "PENDING_APPROVAL";
  const canDelete = editable && actor.role === "SUPERADMIN";

  return (
    <div className="space-y-6">
      <PageHeader title={fullName(user)} back={{ href: "/admin/users", label: t("admin.users.title") }} />

      <Card>
        <CardBody className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <Avatar user={user} size={64} />
            <div className="min-w-0">
              <p className="truncate text-lg font-semibold text-slate-900 dark:text-white">{fullName(user)}</p>
              <p className="truncate text-sm text-slate-500">{user.email}</p>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <Badge tone={ROLE_TONE[user.role]}>{t(`common.roles.${user.role}`)}</Badge>
                <Badge tone={STATUS_TONE[user.status]}>{t(`common.userStatus.${user.status}`)}</Badge>
                {user.title && <Badge>{user.title}</Badge>}
                {user.mustChangePassword && <Badge tone="yellow">{t("admin.users.mustChangePassword")}</Badge>}
              </div>
            </div>
          </div>
          {editable && (
            <div className="flex flex-wrap gap-2">
              <ResetPasswordButton userId={user.id} />
              {user.status === "SUSPENDED" ? (
                <ActionButton
                  action={setUserSuspendedAction.bind(null, user.id, false)}
                  label={t("admin.users.reactivate")}
                  icon={<PlayCircle className="h-4 w-4" />}
                  variant="outline"
                  confirmText={t("admin.users.reactivateConfirm")}
                />
              ) : (
                user.status === "ACTIVE" && (
                  <ActionButton
                    action={setUserSuspendedAction.bind(null, user.id, true)}
                    label={t("admin.users.suspend")}
                    icon={<Ban className="h-4 w-4" />}
                    variant="outline"
                    confirmText={t("admin.users.suspendConfirm")}
                  />
                )
              )}
              {canDelete && (
                <ActionButton
                  action={deleteUserAction.bind(null, user.id)}
                  label={t("common.delete")}
                  icon={<Trash2 className="h-4 w-4" />}
                  variant="danger"
                  confirmText={`${t("admin.users.deleteConfirm")} ${t("common.cannotUndo")}`}
                />
              )}
            </div>
          )}
        </CardBody>
        <div className="grid gap-4 border-t border-slate-100 px-5 py-4 text-sm sm:grid-cols-2 lg:grid-cols-4 dark:border-slate-800">
          <Meta label={t("admin.users.createdAt")} value={formatDate(user.createdAt, locale, true)} />
          <Meta label={t("admin.users.lastLogin")} value={user.lastLoginAt ? formatDate(user.lastLoginAt, locale, true) : t("admin.users.never")} />
          <Meta
            label={t("admin.users.approvedAt")}
            value={user.approvedAt ? `${formatDate(user.approvedAt, locale)}${user.approvedBy ? ` · ${fullName(user.approvedBy)}` : ""}` : "—"}
          />
          <Meta label={t("admin.users.language")} value={user.locale.toUpperCase()} />
        </div>
      </Card>

      {!editable && (
        <Alert tone="yellow" title={t("admin.users.readOnly")}>
          {isSelf ? (
            <>
              {t("admin.users.readOnlySelf")}{" "}
              <Link href="/profile" className="font-medium underline">
                {t("admin.users.goToProfile")}
              </Link>
            </>
          ) : (
            t("admin.users.readOnlyText")
          )}
        </Alert>
      )}
      {user.status === "REJECTED" && user.rejectionReason && (
        <Alert tone="red" title={t("admin.approvals.rejectionReason")}>
          <p className="whitespace-pre-wrap">{user.rejectionReason}</p>
        </Alert>
      )}
      {(user.status === "PENDING_APPROVAL" || user.status === "PROFILE_INCOMPLETE") && can(actor, "APPROVE_STUDENTS") && (
        <Alert tone="blue">
          {t("admin.users.pendingHint")}{" "}
          <Link href="/admin/approvals" className="font-medium underline">
            {t("admin.approvals.title")}
          </Link>
        </Alert>
      )}

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          {editable ? (
            <Card>
              <CardHeader title={t("admin.users.editTitle")} />
              <CardBody>
                <EditUserForm
                  user={{
                    id: user.id,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    title: user.title,
                    role: user.role,
                    extraPermissions: user.extraPermissions,
                  }}
                  roles={assignableRoles(actor)}
                  allPermissions={ALL_PERMISSIONS}
                  grantable={grantablePermissions(actor)}
                  roleDefaults={ROLE_DEFAULTS}
                  roleLocked={roleLocked}
                />
              </CardBody>
            </Card>
          ) : (
            <Card>
              <CardHeader title={t("admin.permissions.effective")} />
              <CardBody>
                {effective.length ? (
                  <div className="flex flex-wrap gap-1.5">
                    {effective.map((p) => (
                      <Badge key={p} tone="blue">
                        {t(`common.permissions.${p}`)}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">{t("admin.permissions.none")}</p>
                )}
              </CardBody>
            </Card>
          )}

          {user.role === "STUDENT" && (
            <Card>
              <CardHeader title={t("admin.profile.title")} />
              <CardBody>
                {user.profile ? (
                  <ProfileDetails profile={user.profile} />
                ) : (
                  <EmptyState icon={<GraduationCap className="h-8 w-8" />} title={t("admin.profile.none")} />
                )}
              </CardBody>
            </Card>
          )}
          {user.role !== "STUDENT" && user.profile && (
            <Card>
              <CardHeader title={t("admin.profile.title")} />
              <CardBody>
                <ProfileDetails profile={user.profile} />
              </CardBody>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title={t("admin.users.memberships")} description={t("admin.users.membershipsCount", { n: user.memberships.length })} />
            {user.memberships.length === 0 ? (
              <CardBody>
                <p className="text-sm text-slate-500">{t("admin.users.noMemberships")}</p>
              </CardBody>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {user.memberships.map((m) => (
                  <li key={m.classroomId} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      {manageClassrooms ? (
                        <Link href={`/admin/classrooms/${m.classroomId}`} className="block truncate text-sm font-medium text-slate-900 hover:text-brand-600 dark:text-slate-100">
                          {m.classroom.name}
                        </Link>
                      ) : (
                        <span className="block truncate text-sm font-medium text-slate-900 dark:text-slate-100">{m.classroom.name}</span>
                      )}
                      <span className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                        <Badge tone={m.role === "MENTOR" ? "green" : m.role === "STAFF" ? "orange" : "gray"}>{t(`common.classroomRoles.${m.role}`)}</Badge>
                        {m.classroom.season.name}
                        {m.classroom.archived && <Badge tone="yellow">{t("admin.classrooms.archived")}</Badge>}
                      </span>
                    </div>
                    {editable && manageClassrooms && (
                      <ActionButton
                        action={removeMembershipAction.bind(null, user.id, m.classroomId)}
                        label={t("common.remove")}
                        confirmText={t("admin.users.removeMembershipConfirm", { classroom: m.classroom.name })}
                      />
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {canDelete && user._count.assignments > 0 && (
            <Alert tone="yellow" title={t("admin.users.cannotDeleteTitle")}>
              <span className="inline-flex items-start gap-1.5">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                {t("admin.users.cannotDeleteText", { n: user._count.assignments })}
              </span>
            </Alert>
          )}

          <Card>
            <CardHeader title={t("admin.users.activity")} />
            {audits.length === 0 ? (
              <CardBody>
                <EmptyState icon={<History className="h-8 w-8" />} title={t("admin.audit.empty")} />
              </CardBody>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {audits.map((a) => (
                  <li key={a.id} className="px-5 py-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-300">{a.action}</code>
                      <span className="shrink-0 text-xs text-slate-500">{formatDate(a.createdAt, locale, true)}</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">{a.actor ? fullName(a.actor) : t("admin.audit.system")}</p>
                    <AuditMeta meta={a.meta} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-0.5 truncate text-slate-800 dark:text-slate-200">{value}</p>
    </div>
  );
}
