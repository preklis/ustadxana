import Link from "next/link";
import { getI18n } from "@/i18n/server";
import { ResetFlow } from "./reset-flow";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t("auth.reset.title") };
}

export default async function ForgotPasswordPage() {
  const { t } = await getI18n();
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">{t("auth.reset.title")}</h1>
      <p className="mt-1 text-sm text-slate-500">{t("auth.reset.subtitle")}</p>
      <div className="mt-8">
        <ResetFlow />
      </div>
      <p className="mt-8 text-center text-sm">
        <Link href="/login" className="font-semibold text-brand-600 hover:underline">
          ← {t("auth.login.submit")}
        </Link>
      </p>
    </div>
  );
}
