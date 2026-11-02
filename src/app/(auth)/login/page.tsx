import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getI18n } from "@/i18n/server";
import { LoginForm } from "./login-form";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t("auth.login.title") };
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; reset?: string }> }) {
  if (await getCurrentUser()) redirect("/dashboard");
  const { t } = await getI18n();
  const sp = await searchParams;
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">{t("auth.login.title")}</h1>
      <p className="mt-1 text-sm text-slate-500">{t("auth.login.subtitle")}</p>
      <div className="mt-8">
        <LoginForm next={sp.next ?? ""} />
      </div>
      <p className="mt-8 text-center text-sm text-slate-500">
        {t("auth.login.noAccount")}{" "}
        <Link href="/register" className="font-semibold text-brand-600 hover:underline">
          {t("auth.login.registerLink")}
        </Link>
      </p>
    </div>
  );
}
