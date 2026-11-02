import Link from "next/link";
import { BadgeCheck, CircleSlash, SearchX } from "lucide-react";
import { db } from "@/lib/db";
import { getI18n } from "@/i18n/server";
import { cn } from "@/lib/utils";
import { Logo, Wordmark } from "@/components/logo";
import { getTheme } from "@/lib/theme/server";
import { LocaleSwitcher } from "@/components/locale-switcher";

type Props = { params: Promise<{ code: string }> };

function normalize(code: string) {
  return code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 32);
}

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t("certificates.verify.title"), robots: { index: false, follow: false } };
}

export default async function VerifyPage({ params }: Props) {
  const { identity } = await getTheme();
  const { code: raw } = await params;
  const code = normalize(raw);
  const { t, locale } = await getI18n();
  const cert = code
    ? await db.certificate.findUnique({
        where: { code },
        select: { code: true, type: true, holderName: true, trackName: true, issuedAt: true, revokedAt: true, season: { select: { name: true } } },
      })
    : null;
  const state = !cert ? "notFound" : cert.revokedAt ? "revoked" : "valid";
  const tag = locale === "az" ? "az-Latn-AZ" : "en-GB";
  const fmt = (d: Date) => new Intl.DateTimeFormat(tag, { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Baku" }).format(d);

  const banner = {
    valid: {
      icon: BadgeCheck,
      cls: "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-200 dark:border-emerald-900",
      title: t("certificates.verify.valid"),
      text: t("certificates.verify.validText"),
    },
    revoked: {
      icon: CircleSlash,
      cls: "bg-red-50 text-red-800 border-red-200 dark:bg-red-950/50 dark:text-red-200 dark:border-red-900",
      title: t("certificates.verify.revoked"),
      text: t("certificates.verify.revokedText"),
    },
    notFound: {
      icon: SearchX,
      cls: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700",
      title: t("certificates.verify.notFound"),
      text: t("certificates.verify.notFoundText"),
    },
  }[state];
  const Icon = banner.icon;

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-brand-50 to-slate-50 dark:from-slate-900 dark:to-slate-950">
      <header className="mx-auto flex w-full max-w-3xl items-center justify-between px-4 py-5">
        <Link href="/" className="flex items-center gap-2.5">
          <Logo />
          <Wordmark className="text-lg text-slate-900 dark:text-white" />
        </Link>
        <LocaleSwitcher />
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-16">
        <p className="text-center text-sm font-semibold uppercase tracking-widest text-brand-700 dark:text-brand-400">{t("certificates.verify.heading")}</p>
        <div className={cn("mx-auto mt-4 flex max-w-xl items-start gap-3 rounded-xl border px-5 py-4", banner.cls)}>
          <Icon className="mt-0.5 h-6 w-6 shrink-0" />
          <div>
            <p className="font-semibold">{banner.title}</p>
            <p className="mt-0.5 text-sm opacity-90">{banner.text}</p>
          </div>
        </div>

        {cert && (
          <div className="relative mx-auto mt-8 max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900">
            <div className="h-2 bg-gradient-to-r from-brand-700 via-brand-500 to-amber-400" />
            {cert.revokedAt && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <span className="-rotate-12 rounded-lg border-4 border-red-500/40 px-6 py-2 text-4xl font-black uppercase tracking-widest text-red-500/40">
                  {t("certificates.revoked")}
                </span>
              </div>
            )}
            <div className="px-6 py-10 text-center sm:px-12">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">{cert.season.name}</p>
              <h1 className="mt-3 font-serif text-2xl font-bold text-slate-900 dark:text-white sm:text-3xl">{t(`certificates.titles.${cert.type}`)}</h1>
              <p className="mt-6 text-sm italic text-slate-500">{t("certificates.pdf.presentedTo")}</p>
              <p className="mt-2 break-words font-serif text-3xl font-bold text-brand-800 dark:text-brand-300 sm:text-4xl">{cert.holderName}</p>
              {cert.trackName && <p className="mt-4 text-slate-700 dark:text-slate-300">{cert.trackName}</p>}
              <dl className="mx-auto mt-8 grid max-w-md grid-cols-2 gap-4 border-t border-slate-100 pt-6 text-sm dark:border-slate-800">
                <div>
                  <dt className="text-xs uppercase tracking-wide text-slate-500">{t("certificates.issuedOn")}</dt>
                  <dd className="mt-1 font-medium text-slate-900 dark:text-white">{fmt(cert.issuedAt)}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-slate-500">{t("certificates.code")}</dt>
                  <dd className="mt-1 font-mono font-semibold tracking-wider text-slate-900 dark:text-white">{cert.code}</dd>
                </div>
                {cert.revokedAt && (
                  <div className="col-span-2">
                    <dt className="text-xs uppercase tracking-wide text-slate-500">{t("certificates.verify.revokedOn")}</dt>
                    <dd className="mt-1 font-medium text-red-600">{fmt(cert.revokedAt)}</dd>
                  </div>
                )}
              </dl>
            </div>
          </div>
        )}
      </main>

      <footer className="pb-6 text-center text-xs text-slate-500">{[identity.siteName, identity.orgName].filter(Boolean).join(" · ")}</footer>
    </div>
  );
}
