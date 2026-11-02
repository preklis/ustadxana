import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { getI18n } from "@/i18n/server";
import { Alert } from "@/components/ui/primitives";
import { RegisterFlow } from "./register-flow";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t("auth.register.title") };
}

export default async function RegisterPage() {
  if (await getCurrentUser()) redirect("/dashboard");
  const { t } = await getI18n();
  const season = await db.season.findFirst({ where: { registrationOpen: true }, orderBy: { createdAt: "desc" } });
  // with registration closed, people accepted through an application form can still sign up
  const acceptedOnly = !season && (await db.application.count({ where: { status: "ACCEPTED", userId: null, form: { kind: "STUDENT" } } })) > 0;
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">{t("auth.register.title")}</h1>
      <p className="mt-1 text-sm text-slate-500">
        {season ? t("auth.register.subtitle", { season: season.name }) : t("auth.register.subtitleGeneric")}
      </p>
      <div className="mt-8">
        {season ? (
          <RegisterFlow />
        ) : acceptedOnly ? (
          <>
            <Alert tone="blue" className="mb-6">
              {t("applications.register.acceptedOnly")}
            </Alert>
            <RegisterFlow />
          </>
        ) : (
          <Alert tone="yellow" title={t("auth.errors.registrationClosed")}>
            {t("auth.register.closedHint")}
          </Alert>
        )}
      </div>
      <p className="mt-8 text-center text-sm text-slate-500">
        {t("auth.register.haveAccount")}{" "}
        <Link href="/login" className="font-semibold text-brand-600 hover:underline">
          {t("auth.login.submit")}
        </Link>
      </p>
    </div>
  );
}
