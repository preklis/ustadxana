"use client";

import { useActionState, useEffect, useState } from "react";
import { CheckCircle2, MailCheck, PencilLine, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n/client";
import { Button } from "@/components/ui/button";
import { Field, FormMessage, Input, Select, SubmitButton, Textarea } from "@/components/ui/form";
import { useFormAction } from "@/components/ui/use-form-action";
import type { ActionState } from "@/lib/action";
import { answerText, isOther, OTHER_PREFIX, type Answer, type Answers, type Question } from "@/lib/applications/questions";
import { leaveApplyAction, sendApplyCodeAction, submitApplicationAction, verifyApplyCodeAction } from "../actions";

/* ---------- email + code ---------- */

export function ApplyEmailStep({ formId }: { formId: string }) {
  const { t } = useI18n();
  const [email, setEmail] = useState<string | null>(null);
  const [sendState, send, sending] = useActionState(sendApplyCodeAction.bind(null, formId), null);
  const [verifyState, verify, verifying] = useActionState(verifyApplyCodeAction.bind(null, formId), null);
  const [resendState, resend, resending] = useActionState(sendApplyCodeAction.bind(null, formId), null);

  useEffect(() => {
    if (sendState?.ok && sendState.data?.email) setEmail(sendState.data.email);
  }, [sendState]);

  if (!email) {
    return (
      <form action={send} className="max-w-md space-y-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">{t("applications.apply.emailTitle")}</h2>
          <p className="mt-1 text-sm text-slate-500">{t("applications.apply.emailText")}</p>
        </div>
        <FormMessage state={sendState?.ok ? null : sendState} />
        <Field label={t("common.email")} name="email" state={sendState}>
          <Input id="email" name="email" type="email" autoComplete="email" required autoFocus />
        </Field>
        <SubmitButton size="lg" pending={sending}>
          {t("applications.apply.sendCode")}
        </SubmitButton>
      </form>
    );
  }

  return (
    <div className="max-w-md space-y-4">
      <div className="flex items-start gap-3 rounded-lg bg-brand-50 p-3 text-sm text-brand-900 dark:bg-brand-950/50 dark:text-brand-100">
        <MailCheck className="mt-0.5 h-5 w-5 shrink-0" />
        <div>
          {t("applications.apply.codeSentTo", { email })}{" "}
          <button type="button" className="font-semibold underline" onClick={() => setEmail(null)}>
            {t("applications.apply.changeEmail")}
          </button>
        </div>
      </div>
      <form action={verify} className="space-y-4">
        <FormMessage state={verifyState} />
        <input type="hidden" name="email" value={email} />
        <Field label={t("applications.apply.code")} name="code" state={verifyState}>
          <Input
            id="code"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            pattern="\d{6}"
            required
            autoFocus
            className="text-center text-xl tracking-[0.5em]"
          />
        </Field>
        <SubmitButton size="lg" className="w-full" pending={verifying}>
          {t("applications.apply.verify")}
        </SubmitButton>
      </form>
      <form action={resend} className="text-center text-sm">
        <input type="hidden" name="email" value={email} />
        <Button type="submit" variant="ghost" size="sm" disabled={resending}>
          {t("applications.apply.resend")}
        </Button>
        {resendState && <p className={resendState.ok ? "text-emerald-600" : "text-red-600"}>{t(resendState.ok ? "applications.apply.resent" : resendState.error ?? "")}</p>}
      </form>
    </div>
  );
}

/* ---------- the form ---------- */

export function ApplyForm({
  formId,
  slug,
  email,
  signedIn,
  questions,
  initial,
  submittedAt,
  allowEdit,
  confirmation,
}: {
  formId: string;
  slug: string;
  email: string;
  signedIn: boolean;
  questions: Question[];
  initial: Answers | null;
  submittedAt: string | null;
  allowEdit: boolean;
  confirmation: string | null;
}) {
  const { t } = useI18n();
  const [mode, setMode] = useState<"view" | "edit" | "done">(initial ? "view" : "edit");
  const submit = useFormAction(submitApplicationAction.bind(null, formId), { onOk: () => setMode("done") });
  const state = submit.state;

  const who = (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-4 text-sm dark:border-slate-800">
      <span className="inline-flex items-center gap-2 text-slate-600 dark:text-slate-300">
        <UserRound className="h-4 w-4" />
        {t("applications.apply.applyingAs", { email })}
      </span>
      {!signedIn && (
        <form action={leaveApplyAction.bind(null, slug)}>
          <button type="submit" className="font-medium text-slate-500 hover:text-brand-600">
            {t("applications.apply.notYou")}
          </button>
        </form>
      )}
    </div>
  );

  if (mode === "done") {
    return (
      <div className="py-6 text-center">
        <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
        <h2 className="mt-4 text-xl font-bold text-slate-900 dark:text-white">
          {state?.message === "applications.apply.updated" ? t("applications.apply.updated") : t("applications.apply.submitted")}
        </h2>
        <p className="mx-auto mt-2 max-w-md whitespace-pre-wrap text-sm text-slate-500">{confirmation || t("applications.apply.submittedText", { email })}</p>
        {allowEdit && (
          <Button variant="outline" className="mt-6" onClick={() => window.location.reload()}>
            <PencilLine className="h-4 w-4" />
            {t("applications.apply.editAgain")}
          </Button>
        )}
      </div>
    );
  }

  if (mode === "view" && initial) {
    return (
      <div>
        {who}
        <div className="mb-6 rounded-lg bg-emerald-50 p-4 text-sm text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
          {t(allowEdit ? "applications.apply.already" : "applications.apply.alreadyLocked", { date: submittedAt ?? "" })}
        </div>
        <dl className="space-y-4">
          {questions
            .filter((q) => q.type !== "section")
            .map((q) => (
              <div key={q.id}>
                <dt className="text-sm font-medium text-slate-500">{q.label}</dt>
                <dd className="mt-0.5 whitespace-pre-wrap text-slate-900 dark:text-slate-100">{answerText(initial[q.id], t("applications.apply.other")) || "—"}</dd>
              </div>
            ))}
        </dl>
        {allowEdit && (
          <Button className="mt-6" onClick={() => setMode("edit")}>
            <PencilLine className="h-4 w-4" />
            {t("applications.apply.editAgain")}
          </Button>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={submit.onSubmit} noValidate>
      {who}
      <QuestionList questions={questions} initial={initial ?? {}} state={state} />
      <div className="mt-8 space-y-3 border-t border-slate-100 pt-6 dark:border-slate-800">
        <FormMessage state={state?.ok ? null : state} />
        <SubmitButton size="lg" pending={submit.pending}>
          {initial ? t("applications.apply.update") : t("applications.apply.submit")}
        </SubmitButton>
      </div>
    </form>
  );
}

export function QuestionList({ questions, initial, state }: { questions: Question[]; initial: Answers; state?: ActionState }) {
  return (
    <div className="space-y-7">
      {questions.map((q) => (
        <QuestionField key={q.id} q={q} value={initial[q.id]} error={state?.fieldErrors?.[q.id]} />
      ))}
    </div>
  );
}

function QuestionField({ q, value, error }: { q: Question; value?: Answer; error?: string }) {
  const { t } = useI18n();
  const name = `q_${q.id}`;

  if (q.type === "section") {
    return (
      <div className="border-t border-slate-200 pt-6 first:border-0 first:pt-0 dark:border-slate-800">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white">{q.label}</h3>
        {q.help && <p className="mt-1 whitespace-pre-wrap text-sm text-slate-500">{q.help}</p>}
      </div>
    );
  }

  return (
    <fieldset className="bc-question" data-type={q.type}>
      <legend className="text-sm font-semibold text-slate-900 dark:text-slate-100">
        {q.label}
        {q.required && (
          <span className="ml-0.5 text-red-500" title={t("applications.apply.required")}>
            *
          </span>
        )}
      </legend>
      {q.help && <p className="mt-1 whitespace-pre-wrap text-sm text-slate-500">{q.help}</p>}
      <div className="mt-2.5">
        <Control q={q} name={name} value={value} invalid={!!error} />
      </div>
      {error && <p className="mt-1.5 text-xs font-medium text-red-600">{t(error)}</p>}
    </fieldset>
  );
}

function Control({ q, name, value, invalid }: { q: Question; name: string; value?: Answer; invalid: boolean }) {
  const { t } = useI18n();
  const str = typeof value === "string" ? value : "";
  const list = Array.isArray(value) ? value : value ? [value] : [];
  const bad = invalid ? "border-red-400 dark:border-red-700" : "";

  switch (q.type) {
    case "long":
      return <Textarea name={name} rows={5} defaultValue={str} maxLength={5000} className={bad} aria-invalid={invalid} />;
    case "number":
      return <Input name={name} type="number" inputMode="decimal" min={q.min} max={q.max} defaultValue={str} className={cn("max-w-xs", bad)} />;
    case "phone":
      return <Input name={name} type="tel" autoComplete="tel" placeholder="+994 50 123 45 67" defaultValue={str} className={cn("max-w-xs", bad)} />;
    case "url":
      return <Input name={name} type="url" placeholder="https://" defaultValue={str} className={bad} />;
    case "date":
      return <Input name={name} type="date" defaultValue={str} className={cn("max-w-xs", bad)} />;
    case "dropdown":
      return (
        <Select name={name} defaultValue={str} className={cn("max-w-md", bad)}>
          <option value="">{t("applications.apply.choose")}</option>
          {q.options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </Select>
      );
    case "scale": {
      const steps: number[] = [];
      for (let i = q.min ?? 1; i <= (q.max ?? 5); i++) steps.push(i);
      return (
        <div className="flex flex-wrap items-center gap-3">
          {q.minLabel && <span className="text-xs text-slate-500">{q.minLabel}</span>}
          <div className="flex flex-wrap gap-1.5">
            {steps.map((n) => (
              <label key={n} className="cursor-pointer">
                <input type="radio" name={name} value={String(n)} defaultChecked={str === String(n)} className="peer sr-only" />
                <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 text-sm font-semibold text-slate-700 transition peer-checked:border-brand-600 peer-checked:bg-brand-600 peer-checked:text-brand-fg peer-focus-visible:ring-2 peer-focus-visible:ring-brand-500/40 hover:border-brand-400 dark:border-slate-700 dark:text-slate-200">
                  {n}
                </span>
              </label>
            ))}
          </div>
          {q.maxLabel && <span className="text-xs text-slate-500">{q.maxLabel}</span>}
        </div>
      );
    }
    case "single":
    case "multi":
      return <Choices q={q} name={name} selected={list} />;
    default:
      return <Input name={name} defaultValue={str} maxLength={300} className={bad} />;
  }
}

function Choices({ q, name, selected }: { q: Question; name: string; selected: string[] }) {
  const { t } = useI18n();
  const otherValue = selected.find(isOther);
  const [otherOn, setOtherOn] = useState(!!otherValue);
  const type = q.type === "multi" ? "checkbox" : "radio";
  const box =
    q.type === "multi"
      ? "h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
      : "h-4 w-4 border-slate-300 text-brand-600 focus:ring-brand-500";
  return (
    <div className="space-y-2">
      {q.options.map((o) => (
        <label key={o} className="flex cursor-pointer items-start gap-2.5 text-sm text-slate-700 dark:text-slate-200">
          <input
            type={type}
            name={name}
            value={o}
            defaultChecked={selected.includes(o)}
            className={cn(box, "mt-0.5")}
            onChange={type === "radio" ? () => setOtherOn(false) : undefined}
          />
          <span>{o}</span>
        </label>
      ))}
      {q.other && (
        <div className="flex flex-wrap items-center gap-2.5 text-sm text-slate-700 dark:text-slate-200">
          <label className="flex cursor-pointer items-center gap-2.5">
            <input
              type={type}
              name={name}
              value="__other"
              defaultChecked={!!otherValue}
              className={box}
              onChange={(e) => setOtherOn(e.currentTarget.checked)}
            />
            <span>{t("applications.apply.other")}:</span>
          </label>
          <Input
            name={`${name}_other`}
            defaultValue={otherValue ? otherValue.slice(OTHER_PREFIX.length) : ""}
            placeholder={t("applications.apply.otherPh")}
            className="h-9 max-w-xs flex-1"
            maxLength={300}
            disabled={!otherOn}
          />
        </div>
      )}
    </div>
  );
}
