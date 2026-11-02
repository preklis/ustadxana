import { LocaleSwitcher } from "@/components/locale-switcher";
import { Logo, Wordmark } from "@/components/logo";
import { ThemeSlot } from "@/components/theme-slot";
import { ApplyBanner } from "@/components/apply-banner";
import { getRenderedTheme } from "@/lib/theme/server";
import { cn } from "@/lib/utils";
import { getI18n } from "@/i18n/server";

// every block has a bc-* class so theme packs can restyle it, and most can be switched off in the theme
export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const [{ t }, { theme }] = await Promise.all([getI18n(), getRenderedTheme()]);
  const { identity, login, parts, layout } = theme;
  const orgShort = identity.tagline.split("·")[0].trim();
  const showHero = parts.loginHero && layout.login !== "centered";
  const reverse = layout.login === "split-reverse";

  return (
    <>
    <ApplyBanner />
    <div
      className={cn("bc-login grid min-h-[100dvh]", showHero && (reverse ? "lg:grid-cols-[1fr_1.1fr]" : "lg:grid-cols-[1.1fr_1fr]"))}
      data-layout={layout.login}
    >
      {showHero && (
        <aside
          className={cn(
            "bc-login-hero relative hidden overflow-hidden border-slate-800 bg-slate-950 p-10 text-white lg:flex lg:flex-col",
            reverse ? "order-2 border-l" : "border-r",
          )}
        >
          <div
            className="bc-hero-bg pointer-events-none absolute inset-0"
            style={{
              backgroundImage:
                "radial-gradient(circle at 100% 100%, rgb(var(--brand-500) / 0.35), transparent 45%), radial-gradient(rgb(var(--slate-300) / 0.09) 1px, transparent 1px)",
              backgroundSize: "100% 100%, 22px 22px",
            }}
          />

          <div className="bc-login-top relative flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Logo inverted className="h-11 w-11 rounded-full" />
              {parts.loginOrg && (
                <div className="bc-login-org leading-tight">
                  <p className="font-bold">{orgShort || identity.siteName}</p>
                  {identity.orgName && <p className="text-sm text-slate-400">{identity.orgName}</p>}
                </div>
              )}
            </div>
            {parts.loginVersion && login.versionPill && (
              <span className="bc-login-version rounded-full border border-slate-700 px-4 py-1.5 font-mono text-sm text-slate-300">{login.versionPill}</span>
            )}
          </div>

          {parts.loginTerminal && (
            <div className="bc-login-terminal relative mt-12 overflow-hidden rounded-2xl border border-slate-700/70 bg-slate-900/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur">
              <div className="flex items-center gap-2 border-b border-slate-800 px-4 py-3">
                <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
                <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
                <span className="h-3 w-3 rounded-full bg-[#28c840]" />
                <span className="ml-2 font-mono text-sm text-slate-400">{login.terminalPath}</span>
              </div>
              <div className="space-y-2 p-6 font-mono text-sm leading-relaxed text-slate-300">
                <p>
                  <span className="text-brand-400">$</span> {identity.siteName.toLowerCase().replace(/\s+/g, "-")} status
                </p>
                <p className="text-slate-500">{t("auth.hero.line1")}</p>
                <p className="text-slate-500">{t("auth.hero.line2")}</p>
                <p className="text-slate-500">{t("auth.hero.line3")}</p>
              </div>
            </div>
          )}

          <div className="bc-login-headline relative mt-auto pt-12">
            {parts.loginCommand && login.command && (
              <p className="bc-login-command font-mono text-lg text-slate-300">
                &gt; {login.command}
                <span className="ml-1 inline-block h-5 w-2.5 translate-y-0.5 animate-blink bg-brand-500" />
              </p>
            )}
            <h2
              className={cn(
                "bc-login-title mt-3 whitespace-nowrap font-black leading-[0.9] tracking-tighter",
                identity.uppercase && "uppercase",
                (identity.siteName + identity.accentWord).length > 14 ? "text-5xl xl:text-6xl 2xl:text-7xl" : "text-6xl xl:text-7xl 2xl:text-8xl",
              )}
            >
              {identity.siteName}
              {identity.accentWord && <span className="bc-accent text-brand-500"> {identity.accentWord}</span>}
            </h2>
            {parts.loginSubtitle && <p className="bc-login-subtitle mt-5 max-w-md text-slate-400">{t("auth.hero.subtitle")}</p>}
            <ThemeSlot name="loginHero" className="mt-6" />
            {parts.loginFooter && (
              <div className="bc-login-footer mt-8 flex items-center justify-between border-t border-slate-800 pt-4 font-mono text-sm text-slate-500">
                <span>{identity.tagline}</span>
                <span>{identity.hashtag}</span>
              </div>
            )}
          </div>
        </aside>
      )}

      <main className="bc-login-main flex flex-col">
        <div className={cn("flex items-center justify-between p-4", showHero && "lg:justify-end")}>
          <div className={cn("flex items-center gap-2", showHero && "lg:hidden")}>
            <Logo className="h-8 w-8" />
            <Wordmark />
          </div>
          {parts.localeSwitcher && <LocaleSwitcher />}
        </div>
        <div className="flex flex-1 items-center justify-center px-4 pb-16">
          <div className="bc-login-card w-full max-w-md animate-fade-up">
            <ThemeSlot name="loginAboveForm" className="mb-6" />
            {children}
            <ThemeSlot name="loginBelowForm" className="mt-6" />
          </div>
        </div>
      </main>
    </div>
    </>
  );
}
