"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { Field, FormMessage, Input, SubmitButton } from "@/components/ui/form";
import { Alert } from "@/components/ui/primitives";
import { buttonClass } from "@/components/ui/button";
import { useFormAction } from "@/components/ui/use-form-action";
import { useI18n } from "@/i18n/client";
import { completePasswordReset, startPasswordReset } from "../actions";

export function ResetFlow() {
  const { t } = useI18n();
  const [email, setEmail] = useState<string | null>(null);
  const [s1, a1] = useActionState(startPasswordReset, null);
  const reset = useFormAction(completePasswordReset);
  const s2 = reset.state;

  useEffect(() => {
    if (s1?.ok && s1.data?.email) setEmail(s1.data.email);
  }, [s1]);

  if (s2?.ok) {
    return (
      <div className="space-y-4">
        <Alert tone="green" title={t("auth.reset.done")} />
        <Link href="/login" className={buttonClass("primary", "lg", "w-full")}>
          {t("auth.login.submit")}
        </Link>
      </div>
    );
  }

  if (!email) {
    return (
      <form action={a1} className="space-y-4">
        <FormMessage state={s1} />
        <Field label={t("common.email")} name="email" state={s1}>
          <Input id="email" name="email" type="email" required autoFocus />
        </Field>
        <SubmitButton className="w-full" size="lg">
          {t("auth.register.sendCode")}
        </SubmitButton>
      </form>
    );
  }

  return (
    <form onSubmit={reset.onSubmit} className="space-y-4">
      <Alert tone="blue">{t("auth.reset.codeSentTo", { email })}</Alert>
      <FormMessage state={s2} />
      <input type="hidden" name="email" value={email} />
      <Field label={t("auth.code")} name="code" state={s2}>
        <Input id="code" name="code" inputMode="numeric" maxLength={6} required autoFocus className="text-center text-xl tracking-[0.5em]" />
      </Field>
      <Field label={t("auth.newPassword")} name="password" state={s2} hint={t("auth.passwordHint")}>
        <Input id="password" name="password" type="password" autoComplete="new-password" required />
      </Field>
      <Field label={t("auth.confirmPassword")} name="confirm" state={s2}>
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required />
      </Field>
      <SubmitButton className="w-full" size="lg" pending={reset.pending}>
        {t("auth.reset.submit")}
      </SubmitButton>
    </form>
  );
}
