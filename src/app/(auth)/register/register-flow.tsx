"use client";

import { useActionState, useEffect, useState } from "react";
import { MailCheck } from "lucide-react";
import { Field, FormMessage, Input, SubmitButton } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { useFormAction } from "@/components/ui/use-form-action";
import { useI18n } from "@/i18n/client";
import { completeRegistration, startRegistration } from "../actions";

export function RegisterFlow() {
  const { t } = useI18n();
  const [email, setEmail] = useState<string | null>(null);
  const [sendState, sendAction] = useActionState(startRegistration, null);
  const done = useFormAction(completeRegistration);
  const doneState = done.state;

  useEffect(() => {
    if (sendState?.ok && sendState.data?.email) setEmail(sendState.data.email);
  }, [sendState]);

  if (!email) {
    return (
      <form action={sendAction} className="space-y-4">
        <FormMessage state={sendState} />
        <Field label={t("common.email")} name="email" state={sendState} hint={t("auth.register.emailHint")}>
          <Input id="email" name="email" type="email" autoComplete="email" required autoFocus />
        </Field>
        <SubmitButton className="w-full" size="lg">
          {t("auth.register.sendCode")}
        </SubmitButton>
      </form>
    );
  }

  return (
    <form onSubmit={done.onSubmit} className="space-y-4">
      <div className="flex items-start gap-3 rounded-lg bg-brand-50 p-3 text-sm text-brand-900 dark:bg-brand-950/50 dark:text-brand-100">
        <MailCheck className="mt-0.5 h-5 w-5 shrink-0" />
        <div>
          {t("auth.register.codeSentTo", { email })}{" "}
          <button type="button" className="font-semibold underline" onClick={() => setEmail(null)}>
            {t("auth.register.changeEmail")}
          </button>
        </div>
      </div>
      <FormMessage state={doneState} />
      <input type="hidden" name="email" value={email} />
      <Field label={t("auth.code")} name="code" state={doneState}>
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
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("auth.firstName")} name="firstName" state={doneState}>
          <Input id="firstName" name="firstName" autoComplete="given-name" required />
        </Field>
        <Field label={t("auth.lastName")} name="lastName" state={doneState}>
          <Input id="lastName" name="lastName" autoComplete="family-name" required />
        </Field>
      </div>
      <Field label={t("auth.password")} name="password" state={doneState} hint={t("auth.passwordHint")}>
        <Input id="password" name="password" type="password" autoComplete="new-password" required />
      </Field>
      <Field label={t("auth.confirmPassword")} name="confirm" state={doneState}>
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required />
      </Field>
      <SubmitButton className="w-full" size="lg" pending={done.pending}>
        {t("auth.register.create")}
      </SubmitButton>
      <ResendCode email={email} />
    </form>
  );
}

function ResendCode({ email }: { email: string }) {
  const { t } = useI18n();
  const [state, action] = useActionState(startRegistration, null);
  return (
    <div className="text-center text-sm">
      <form action={action}>
        <input type="hidden" name="email" value={email} />
        <Button type="submit" variant="ghost" size="sm">
          {t("auth.resendCode")}
        </Button>
      </form>
      {state && (
        <p className={state.ok ? "text-emerald-600" : "text-red-600"}>{t(state.ok ? "auth.register.codeSent" : state.error ?? "")}</p>
      )}
    </div>
  );
}
