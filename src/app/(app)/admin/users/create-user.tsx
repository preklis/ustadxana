"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import type { ClassroomRole, Permission, Role } from "@prisma/client";
import { UserPlus } from "lucide-react";
import { useI18n } from "@/i18n/client";
import { ModalTrigger } from "@/components/ui/interactive";
import { Button, buttonClass } from "@/components/ui/button";
import { Field, FormMessage, Input, Select, SubmitButton } from "@/components/ui/form";
import { PermissionPicker } from "@/components/admin/permission-picker";
import { TempPasswordCard } from "@/components/admin/copy-button";
import { createUserAction } from "./actions";

export type ClassroomOption = { id: string; name: string; track: string | null; seasonName: string };

type Props = {
  roles: Role[];
  allPermissions: Permission[];
  grantable: Permission[];
  roleDefaults: Record<Role, Permission[]>;
  classrooms: ClassroomOption[] | null;
};

export function CreateUserButton(props: Props) {
  const { t } = useI18n();
  return (
    <ModalTrigger label={t("admin.users.create")} title={t("admin.users.createTitle")} icon={<UserPlus className="h-4 w-4" />} modalSize="lg">
      {(close) => <CreateUserFlow {...props} close={close} />}
    </ModalTrigger>
  );
}

function CreateUserFlow(props: Props & { close: () => void }) {
  const [round, setRound] = useState(0);
  return <CreateUserForm key={round} {...props} again={() => setRound((r) => r + 1)} />;
}

function defaultClassroomRole(role: Role): ClassroomRole {
  if (role === "MENTOR") return "MENTOR";
  if (role === "STUDENT") return "STUDENT";
  return "STAFF";
}

function CreateUserForm({ roles, allPermissions, grantable, roleDefaults, classrooms, close, again }: Props & { close: () => void; again: () => void }) {
  const { t } = useI18n();
  const [state, action] = useActionState(createUserAction, null);
  const initialRole: Role = roles.includes("MENTOR") ? "MENTOR" : roles[0];
  const [role, setRole] = useState<Role>(initialRole);
  const [perms, setPerms] = useState<Permission[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [classroomRole, setClassroomRole] = useState<ClassroomRole>(defaultClassroomRole(initialRole));

  if (state?.ok && state.data?.tempPassword) {
    return (
      <div className="space-y-4">
        <FormMessage state={state} />
        <TempPasswordCard email={state.data.email} password={state.data.tempPassword} />
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="ghost" onClick={close}>
            {t("common.close")}
          </Button>
          <Button variant="outline" onClick={again}>
            {t("admin.users.createAnother")}
          </Button>
          <Link href={`/admin/users/${state.data.userId}`} className={buttonClass("primary")} onClick={close}>
            {t("admin.users.openProfile")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-5">
      <FormMessage state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("common.email")} name="email" state={state} required className="sm:col-span-2">
          <Input id="email" name="email" type="email" autoComplete="off" required placeholder="nizami@example.com" />
        </Field>
        <Field label={t("admin.fields.firstName")} name="firstName" state={state} required>
          <Input id="firstName" name="firstName" required maxLength={60} />
        </Field>
        <Field label={t("admin.fields.lastName")} name="lastName" state={state} required>
          <Input id="lastName" name="lastName" required maxLength={60} />
        </Field>
        <Field label={t("admin.fields.role")} name="role" state={state} required>
          <Select
            id="role"
            name="role"
            value={role}
            onChange={(e) => {
              const r = e.target.value as Role;
              setRole(r);
              setClassroomRole(defaultClassroomRole(r));
            }}
          >
            {roles.map((r) => (
              <option key={r} value={r}>
                {t(`common.roles.${r}`)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("admin.fields.title")} name="title" state={state} hint={t("admin.fields.titleHint")}>
          <Input id="title" name="title" maxLength={80} placeholder={t("admin.fields.titlePh")} />
        </Field>
      </div>

      {role !== "STUDENT" && (
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">{t("admin.permissions.title")}</legend>
          <PermissionPicker all={allPermissions} role={role} roleDefaults={roleDefaults} grantable={grantable} value={perms} onChange={setPerms} />
        </fieldset>
      )}

      {classrooms && classrooms.length > 0 && (
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">
            {t("admin.users.addToClassrooms")} <span className="font-normal text-slate-400">({t("common.optional")})</span>
          </legend>
          <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2 dark:border-slate-700">
            {classrooms.map((c) => (
              <label key={c.id} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-800">
                <input
                  type="checkbox"
                  name="classroomIds"
                  value={c.id}
                  checked={selected.includes(c.id)}
                  onChange={(e) => setSelected(e.target.checked ? [...selected, c.id] : selected.filter((x) => x !== c.id))}
                  className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                />
                <span className="min-w-0 flex-1 truncate text-slate-800 dark:text-slate-200">{c.name}</span>
                <span className="shrink-0 text-xs text-slate-400">{c.seasonName}</span>
              </label>
            ))}
          </div>
          {selected.length > 0 && role !== "STUDENT" && (
            <div className="mt-3 max-w-xs">
              <Field label={t("admin.fields.classroomRole")}>
                <Select name="classroomRole" value={classroomRole} onChange={(e) => setClassroomRole(e.target.value as ClassroomRole)}>
                  <option value="MENTOR">{t("common.classroomRoles.MENTOR")}</option>
                  <option value="STAFF">{t("common.classroomRoles.STAFF")}</option>
                </Select>
              </Field>
            </div>
          )}
        </fieldset>
      )}
      {role === "STUDENT" && <input type="hidden" name="classroomRole" value="STUDENT" />}

      <p className="text-xs text-slate-500">{t("admin.users.createHint")}</p>
      <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
        <Button variant="ghost" onClick={close}>
          {t("common.cancel")}
        </Button>
        <SubmitButton pendingText={t("common.saving")}>{t("admin.users.createSubmit")}</SubmitButton>
      </div>
    </form>
  );
}
