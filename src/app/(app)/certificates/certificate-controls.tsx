"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/form";
import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/utils";
import type { IssueResult } from "./actions";

export function IssueButton({
  action,
  label,
  confirmText,
  disabled,
  variant = "primary",
  size = "sm",
  icon,
}: {
  action: () => Promise<IssueResult>;
  label: React.ReactNode;
  confirmText?: string;
  disabled?: boolean;
  variant?: React.ComponentProps<typeof Button>["variant"];
  size?: React.ComponentProps<typeof Button>["size"];
  icon?: React.ReactNode;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <Button
        variant={variant}
        size={size}
        disabled={disabled || pending}
        onClick={() => {
          if (confirmText && !window.confirm(confirmText)) return;
          setMsg(null);
          start(async () => {
            const res = await action();
            if ("error" in res) setMsg({ ok: false, text: t(res.error) });
            else setMsg({ ok: true, text: t("certificates.issueResult", { issued: res.issued, skipped: res.skipped }) });
            router.refresh();
          });
        }}
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
        {label}
      </Button>
      {msg && <span className={cn("text-xs", msg.ok ? "text-emerald-600" : "text-red-600")}>{msg.text}</span>}
    </span>
  );
}

export function CopyButton({ text, label }: { text: string; label: string }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          window.prompt(label, text);
        }
      }}
    >
      {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
      {copied ? t("certificates.copied") : label}
    </Button>
  );
}

type Opt = { id: string; label: string };

export function ManageFilters({
  seasons,
  classrooms,
  season,
  classroom,
  p,
  da,
  dg,
}: {
  seasons: Opt[];
  classrooms: Opt[];
  season: string;
  classroom: string;
  p: number;
  da: number;
  dg: number;
}) {
  const { t } = useI18n();
  const ref = useRef<HTMLFormElement>(null);
  const submit = () => ref.current?.requestSubmit();
  return (
    <form ref={ref} method="get" action="/certificates" className="grid gap-4 lg:grid-cols-[1fr_1fr_auto]">
      <input type="hidden" name="tab" value="manage" />
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-1.5">
          <span className="block text-sm font-medium text-slate-700 dark:text-slate-300">{t("certificates.season")}</span>
          <Select
            name="season"
            defaultValue={season}
            onChange={(e) => {
              const cls = e.currentTarget.form?.elements.namedItem("classroom") as HTMLSelectElement | null;
              if (cls) cls.value = "";
              submit();
            }}
          >
            {seasons.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </Select>
        </label>
        <label className="space-y-1.5">
          <span className="block text-sm font-medium text-slate-700 dark:text-slate-300">{t("certificates.classroom")}</span>
          <Select name="classroom" defaultValue={classroom} onChange={submit}>
            <option value="">{t("certificates.chooseClassroom")}</option>
            {classrooms.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </Select>
        </label>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <label className="space-y-1.5">
          <span className="block truncate text-sm font-medium text-slate-700 dark:text-slate-300" title={t("certificates.th.participation")}>
            {t("certificates.th.participationShort")}
          </span>
          <Input type="number" name="p" min={0} max={100} defaultValue={p} />
        </label>
        <label className="space-y-1.5">
          <span className="block truncate text-sm font-medium text-slate-700 dark:text-slate-300" title={t("certificates.th.distinctionAttendance")}>
            {t("certificates.th.distinctionAttendanceShort")}
          </span>
          <Input type="number" name="da" min={0} max={100} defaultValue={da} />
        </label>
        <label className="space-y-1.5">
          <span className="block truncate text-sm font-medium text-slate-700 dark:text-slate-300" title={t("certificates.th.distinctionGrade")}>
            {t("certificates.th.distinctionGradeShort")}
          </span>
          <Input type="number" name="dg" min={0} max={100} defaultValue={dg} />
        </label>
      </div>
      <div className="flex items-end">
        <Button type="submit" variant="outline" className="w-full lg:w-auto">
          {t("certificates.applyCriteria")}
        </Button>
      </div>
    </form>
  );
}
