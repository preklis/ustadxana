"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n/client";
import { Button } from "@/components/ui/button";
import { FormMessage, SubmitButton, Textarea } from "@/components/ui/form";
import { useFormAction } from "@/components/ui/use-form-action";
import { STATUSES, STATUS_TONES } from "@/lib/applications/questions";
import { deleteReviewAction, saveReviewAction, setApplicationStatusAction } from "./actions";

export function ReviewForm({ applicationId, mine }: { applicationId: string; mine: { score: number; comment: string | null } | null }) {
  const { t } = useI18n();
  const [score, setScore] = useState<number | null>(mine?.score ?? null);
  const save = useFormAction(saveReviewAction.bind(null, applicationId));
  const [removing, startRemove] = useTransition();

  return (
    <form onSubmit={save.onSubmit} className="space-y-3">
      <input type="hidden" name="score" value={score ?? ""} />
      <div>
        <div className="mb-1.5 flex items-baseline justify-between">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{t("applications.detail.score")}</span>
          <span className="text-xs text-slate-400">{t("applications.detail.scoreHint")}</span>
        </div>
        <div className="grid grid-cols-10 gap-1">
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setScore(n)}
              className={cn(
                "h-9 rounded-md border text-sm font-semibold transition",
                score === n
                  ? "border-brand-600 bg-brand-600 text-brand-fg"
                  : "border-slate-200 text-slate-600 hover:border-brand-400 dark:border-slate-700 dark:text-slate-300",
              )}
            >
              {n}
            </button>
          ))}
        </div>
        {save.state?.fieldErrors?.score && <p className="mt-1 text-xs font-medium text-red-600">{t(save.state.fieldErrors.score)}</p>}
      </div>
      <Textarea name="comment" rows={4} maxLength={3000} defaultValue={mine?.comment ?? ""} placeholder={t("applications.detail.commentPh")} aria-label={t("applications.detail.comment")} />
      <FormMessage state={save.state} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SubmitButton size="sm" pending={save.pending} disabled={score === null}>
          {t("applications.detail.saveReview")}
        </SubmitButton>
        {mine && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={removing}
            className="text-slate-500"
            onClick={() =>
              startRemove(async () => {
                await deleteReviewAction(applicationId);
                setScore(null);
              })
            }
          >
            {removing && <Loader2 className="h-4 w-4 animate-spin" />}
            {t("applications.detail.removeReview")}
          </Button>
        )}
      </div>
    </form>
  );
}

const TONE_CLASSES: Record<string, string> = {
  gray: "border-slate-400 bg-slate-500 text-white",
  blue: "border-brand-600 bg-brand-600 text-brand-fg",
  yellow: "border-amber-500 bg-amber-500 text-white",
  green: "border-emerald-600 bg-emerald-600 text-white",
  red: "border-red-600 bg-red-600 text-white",
};

export function StatusPicker({ applicationId, status }: { applicationId: string; status: string }) {
  const { t } = useI18n();
  const [current, setCurrent] = useState(status);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            disabled={pending}
            onClick={() => {
              if (s === current) return;
              const prev = current;
              setCurrent(s);
              setError(null);
              start(async () => {
                const res = await setApplicationStatusAction(applicationId, s);
                if (res && !res.ok) {
                  setCurrent(prev);
                  setError(res.error ?? "common.genericError");
                }
              });
            }}
            className={cn(
              "rounded-full border px-3 py-1 text-sm font-medium transition disabled:opacity-60",
              s === current
                ? TONE_CLASSES[STATUS_TONES[s]]
                : "border-slate-200 text-slate-600 hover:border-slate-400 dark:border-slate-700 dark:text-slate-300",
            )}
          >
            {t(`applications.statuses.${s}`)}
          </button>
        ))}
      </div>
      {error && <p className="mt-1.5 text-xs font-medium text-red-600">{t(error)}</p>}
    </div>
  );
}
