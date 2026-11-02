"use client";

import { useActionState, useState } from "react";
import type { Permission, Role } from "@prisma/client";
import { KeyRound } from "lucide-react";
import { useI18n } from "@/i18n/client";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/interactive";
import { Field, FormMessage, Input, Select, SubmitButton } from "@/components/ui/form";
import { PermissionPicker } from "@/components/admin/permission-picker";
import { TempPasswordCard } from "@/components/admin/copy-button";
import { resetPasswordAction, updateUserAction } from "../actions";

export function EditUserForm({
  user,
  roles,
  allPermissions,
  grantable,
  roleDefaults,
  roleLocked,
}: {
  user: { id: string; firstName: string; lastName: string; title: string | null; role: Role; extraPermissions: Permission[] };
  roles: Role[];
  allPermissions: Permission[];
  grantable: Permission[];
  roleDefaults: Record<Role, Permission[]>;
  roleLocked: boolean;
}) {
  const { t } = useI18n();
  const [state, action] = useActionState(updateUserAction.bind(null, user.id), null);
  const [role, setRole] = useState<Role>(user.role);
  const [perms, setPerms] = useState<Permission[]>(user.extraPermissions);
  const roleOptions = roles.includes(user.role) ? roles : [user.role, ...roles];

  return (
    <form action={action} className="space-y-5">
      <FormMessage state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("admin.fields.firstName")} name="firstName" state={state} required>
          <Input id="firstName" name="firstName" defaultValue={user.firstName} required maxLength={60} />
        </Field>
        <Field label={t("admin.fields.lastName")} name="lastName" state={state} required>
          <Input id="lastName" name="lastName" defaultValue={user.lastName} required maxLength={60} />
        </Field>
        <Field label={t("admin.fields.role")} name="role" state={state} hint={roleLocked ? t("admin.users.roleLockedHint") : undefined}>
          <Select id="role" name="role" value={role} onChange={(e) => setRole(e.target.value as Role)} disabled={roleLocked}>
            {roleOptions.map((r) => (
              <option key={r} value={r} disabled={r !== user.role && !roles.includes(r)}>
                {t(`common.roles.${r}`)}
              </option>
            ))}
          </Select>
          {roleLocked && <input type="hidden" name="role" value={user.role} />}
        </Field>
        <Field label={t("admin.fields.title")} name="title" state={state} hint={t("admin.fields.titleHint")}>
          <Input id="title" name="title" defaultValue={user.title ?? ""} maxLength={80} placeholder={t("admin.fields.titlePh")} />
        </Field>
      </div>
      {role !== "STUDENT" && (
        <fieldset>
          <legend className="mb-1 text-sm font-medium text-slate-700 dark:text-slate-300">{t("admin.permissions.title")}</legend>
          <p className="mb-3 text-xs text-slate-500">{t("admin.permissions.hint")}</p>
          <PermissionPicker all={allPermissions} role={role} roleDefaults={roleDefaults} grantable={grantable} value={perms} onChange={setPerms} />
        </fieldset>
      )}
      <div className="flex justify-end border-t border-slate-100 pt-4 dark:border-slate-800">
        <SubmitButton pendingText={t("common.saving")}>{t("common.save")}</SubmitButton>
      </div>
    </form>
  );
}

export function ResetPasswordButton({ userId }: { userId: string }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [round, setRound] = useState(0);
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <KeyRound className="h-4 w-4" />
        {t("admin.users.resetPassword")}
      </Button>
      <Modal
        open={open}
        onClose={() => {
          setOpen(false);
          setRound((r) => r + 1);
        }}
        title={t("admin.users.resetPassword")}
        size="md"
      >
        <ResetPasswordBody key={round} userId={userId} close={() => { setOpen(false); setRound((r) => r + 1); }} />
      </Modal>
    </>
  );
}

function ResetPasswordBody({ userId, close }: { userId: string; close: () => void }) {
  const { t } = useI18n();
  const [state, action] = useActionState(resetPasswordAction.bind(null, userId), null);
  if (state?.ok && state.data?.tempPassword) {
    return (
      <div className="space-y-4">
        <FormMessage state={state} />
        <TempPasswordCard email={state.data.email} password={state.data.tempPassword} />
        <div className="flex justify-end">
          <Button onClick={close}>{t("common.close")}</Button>
        </div>
      </div>
    );
  }
  return (
    <form action={action} className="space-y-4">
      <FormMessage state={state} />
      <p className="text-sm text-slate-600 dark:text-slate-300">{t("admin.users.resetPasswordText")}</p>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={close}>
          {t("common.cancel")}
        </Button>
        <SubmitButton variant="danger">{t("admin.users.resetPasswordConfirm")}</SubmitButton>
      </div>
    </form>
  );
}
