"use client";

import Link from "next/link";
import { Field, FormMessage, Input, SubmitButton } from "@/components/ui/form";
import { useFormAction } from "@/components/ui/use-form-action";
import { useI18n } from "@/i18n/client";
import { loginAction } from "../actions";

export function LoginForm({ next }: { next: string }) {
  const { t } = useI18n();
  const { state, pending, onSubmit } = useFormAction(loginAction);
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <FormMessage state={state} />
      <Field label={t("common.email")} name="email" state={state}>
        <Input id="email" name="email" type="email" autoComplete="email" required autoFocus />
      </Field>
      <Field
        label={
          <span className="flex justify-between">
            {t("auth.password")}
            <Link href="/forgot-password" className="text-xs font-medium text-brand-600 hover:underline">
              {t("auth.login.forgot")}
            </Link>
          </span>
        }
        name="password"
        state={state}
      >
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </Field>
      <SubmitButton className="w-full" size="lg" pending={pending} pendingText={t("auth.login.signingIn")}>
        {t("auth.login.submit")}
      </SubmitButton>
    </form>
  );
}
