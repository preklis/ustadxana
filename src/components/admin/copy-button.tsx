"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { useI18n } from "@/i18n/client";
import { Button } from "@/components/ui/button";

export function CopyButton({ value, label, size = "sm" }: { value: string; label?: string; size?: "sm" | "md" }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="outline"
      size={size}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
        } catch {
          // no clipboard api on plain http (LAN)
          const ta = document.createElement("textarea");
          ta.value = value;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand("copy");
          ta.remove();
        }
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      }}
    >
      {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
      {copied ? t("admin.copied") : (label ?? t("admin.copy"))}
    </Button>
  );
}

export function TempPasswordCard({ email, password }: { email: string; password: string }) {
  const { t } = useI18n();
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/40">
      <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">{t("admin.tempPassword.title")}</p>
      <p className="mt-1 text-xs text-amber-800 dark:text-amber-200">{t("admin.tempPassword.hint")}</p>
      <dl className="mt-3 space-y-2 text-sm">
        <div className="flex items-center justify-between gap-3">
          <dt className="text-slate-500">{t("common.email")}</dt>
          <dd className="truncate font-medium text-slate-900 dark:text-white">{email}</dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-slate-500">{t("admin.tempPassword.label")}</dt>
          <dd className="flex items-center gap-2">
            <code className="rounded bg-white px-2 py-1 font-mono text-base tracking-wider text-slate-900 dark:bg-slate-900 dark:text-white">{password}</code>
            <CopyButton value={password} />
          </dd>
        </div>
      </dl>
      <div className="mt-3">
        <CopyButton value={`${email}\n${password}`} label={t("admin.tempPassword.copyBoth")} />
      </div>
    </div>
  );
}
