"use client";

import type { Permission, Role } from "@prisma/client";
import { Lock } from "lucide-react";
import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/utils";

// perms the actor cant grant are shown read-only, server keeps them as is
export function PermissionPicker({
  all,
  role,
  roleDefaults,
  grantable,
  value,
  onChange,
}: {
  all: Permission[];
  role: Role;
  roleDefaults: Record<Role, Permission[]>;
  grantable: Permission[];
  value: Permission[];
  onChange: (next: Permission[]) => void;
}) {
  const { t } = useI18n();
  const defaults = new Set(role === "SUPERADMIN" ? all : roleDefaults[role]);
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {all.map((p) => {
        const isDefault = defaults.has(p);
        const canGrant = grantable.includes(p);
        const checked = isDefault || value.includes(p);
        const disabled = isDefault || !canGrant;
        return (
          <label
            key={p}
            className={cn(
              "flex items-start gap-2 rounded-lg border px-3 py-2 text-sm transition",
              checked ? "border-brand-200 bg-brand-50/60 dark:border-brand-900 dark:bg-brand-950/30" : "border-slate-200 dark:border-slate-700",
              disabled ? "cursor-not-allowed opacity-80" : "cursor-pointer hover:border-brand-300",
            )}
          >
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
              checked={checked}
              disabled={disabled}
              onChange={(e) => onChange(e.target.checked ? [...value, p] : value.filter((x) => x !== p))}
            />
            {/* disabled inputs are not submitted; mirror granted extras so the server sees them */}
            {!isDefault && canGrant && checked && <input type="hidden" name="permissions" value={p} />}
            <span className="min-w-0">
              <span className="block text-slate-800 dark:text-slate-200">{t(`common.permissions.${p}`)}</span>
              {isDefault ? (
                <span className="text-xs text-slate-500">{t("admin.permissions.fromRole")}</span>
              ) : !canGrant ? (
                <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                  <Lock className="h-3 w-3" />
                  {t("admin.permissions.notGrantable")}
                </span>
              ) : null}
            </span>
          </label>
        );
      })}
    </div>
  );
}
