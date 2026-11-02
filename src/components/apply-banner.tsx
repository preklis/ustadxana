import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getLiveForms } from "@/lib/applications/server";
import { getRenderedTheme } from "@/lib/theme/server";
import { getI18n } from "@/i18n/server";
import { formatDate } from "@/lib/utils";

// strip on top of the sign-in pages (and the app for students) while the project lead has a form open
export async function ApplyBanner({ audience = "public" }: { audience?: "public" | "student" }) {
  const [{ theme }, forms, { t, locale }] = await Promise.all([getRenderedTheme(), getLiveForms(), getI18n()]);
  if (!theme.parts.applyBanner) return null;
  // signed in students only care about student forms
  const list = audience === "student" ? forms.filter((f) => f.kind === "STUDENT") : forms;
  if (!list.length) return null;
  const first = list[0];
  const href = list.length === 1 ? `/apply/${first.slug}` : "/apply";

  return (
    <div className="bc-apply-banner relative z-10 bg-brand-600 text-brand-fg">
      <Link href={href} className="group mx-auto flex max-w-[1400px] flex-wrap items-center justify-center gap-x-3 gap-y-1 px-4 py-2.5 text-sm">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-current" />
        </span>
        <span className="font-semibold">{t("applications.apply.banner", { title: first.title })}</span>
        {list.length === 1 && first.closesAt && <span className="opacity-80">· {t("applications.apply.until", { date: formatDate(first.closesAt, locale) })}</span>}
        <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-0.5 font-semibold transition group-hover:bg-white/25">
          {t("applications.apply.bannerCta")}
          <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
        </span>
      </Link>
    </div>
  );
}
