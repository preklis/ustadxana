import Link from "next/link";
import { getI18n } from "@/i18n/server";
import { buttonClass } from "@/components/ui/button";

export default async function NotFound() {
  const { t } = await getI18n();
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <p className="text-6xl font-black text-brand-600">404</p>
      <h1 className="mt-4 text-2xl font-bold">{t("common.notFound")}</h1>
      <p className="mt-2 text-slate-500">{t("common.notFoundText")}</p>
      <Link href="/dashboard" className={buttonClass("primary", "md", "mt-6")}>
        {t("common.goHome")}
      </Link>
    </div>
  );
}
