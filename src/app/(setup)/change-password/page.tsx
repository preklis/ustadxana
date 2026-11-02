import { requireUser } from "@/lib/auth/session";
import { getI18n } from "@/i18n/server";
import { Card, CardBody } from "@/components/ui/primitives";
import { ChangePasswordForm } from "@/components/change-password-form";

export default async function ChangePasswordPage() {
  const user = await requireUser();
  const { t } = await getI18n();
  return (
    <div className="mx-auto max-w-md">
      <h1 className="text-2xl font-bold tracking-tight">{t("auth.changePassword.title")}</h1>
      <p className="mt-1 text-sm text-slate-500">
        {user.mustChangePassword ? t("auth.changePassword.forced") : t("auth.changePassword.subtitle")}
      </p>
      <Card className="mt-6">
        <CardBody>
          <ChangePasswordForm redirectTo="/dashboard" />
        </CardBody>
      </Card>
    </div>
  );
}
