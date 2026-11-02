"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Field, FormMessage, Input, SubmitButton } from "@/components/ui/form";
import { useI18n } from "@/i18n/client";
import { changePasswordAction } from "@/app/(auth)/actions";

export function ChangePasswordForm({ redirectTo }: { redirectTo?: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const [state, action] = useActionState(changePasswordAction, null);
  useEffect(() => {
    if (state?.ok && redirectTo) router.push(redirectTo);
  }, [state, redirectTo, router]);
  return (
    <form action={action} className="space-y-4">
      <FormMessage state={state} />
      <Field label={t("auth.currentPassword")} name="current" state={state}>
        <Input id="current" name="current" type="password" autoComplete="current-password" required />
      </Field>
      <Field label={t("auth.newPassword")} name="password" state={state} hint={t("auth.passwordHint")}>
        <Input id="password" name="password" type="password" autoComplete="new-password" required />
      </Field>
      <Field label={t("auth.confirmPassword")} name="confirm" state={state}>
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required />
      </Field>
      <SubmitButton>{t("auth.changePassword.submit")}</SubmitButton>
    </form>
  );
}
