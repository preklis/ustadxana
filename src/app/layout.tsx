import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { I18nProvider } from "@/i18n/client";
import { getI18n } from "@/i18n/server";
import { ThemeProvider } from "@/components/theme-provider";
import { brandOf, modeScript, themeColorMeta, themeCss } from "@/lib/theme/config";
import { getRenderedTheme } from "@/lib/theme/server";
import { PreviewBanner } from "@/components/theme-preview-banner";
import "./globals.css";

// optional body font from the theme settings (same files the certificates use)
const noto = localFont({
  src: [
    { path: "../../assets/fonts/NotoSans_400Regular.ttf", weight: "400", style: "normal" },
    { path: "../../assets/fonts/NotoSans_700Bold.ttf", weight: "700", style: "normal" },
  ],
  variable: "--font-noto",
  display: "swap",
  preload: false,
});

export async function generateMetadata(): Promise<Metadata> {
  const { identity } = (await getRenderedTheme()).theme;
  const name = identity.siteName;
  return {
    title: { default: name, template: `%s · ${name}` },
    description: [name, identity.orgName].filter(Boolean).join(" · "),
    icons: identity.logo ? { icon: identity.logo } : undefined,
  };
}

export async function generateViewport(): Promise<Viewport> {
  return { themeColor: themeColorMeta((await getRenderedTheme()).theme) };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [{ locale, messages, overrides }, record] = await Promise.all([getI18n(), getRenderedTheme()]);
  const { theme, version, css, slots, pack, previewing } = record;
  return (
    <html
      lang={locale}
      className={`${GeistSans.variable} ${GeistMono.variable} ${noto.variable} dark`}
      data-theme={pack.slug}
      data-pattern={theme.background.pattern}
      data-content={theme.layout.content}
      data-motion={theme.parts.pageAnimations ? "on" : "off"}
      data-glow={theme.background.glow ? "on" : "off"}
      suppressHydrationWarning
    >
      <head>
        <style id="bc-theme" dangerouslySetInnerHTML={{ __html: themeCss(theme) }} />
        <script dangerouslySetInnerHTML={{ __html: modeScript(theme.mode) }} />
        {/* theme pack css + the admin custom css, checked on upload/save (lib/theme/sanitize) */}
        {css && <style id="bc-theme-pack" dangerouslySetInnerHTML={{ __html: css.replace(/<\/style/gi, "") }} />}
      </head>
      <body className="min-h-[100dvh] bg-slate-50 font-sans text-slate-900 antialiased dark:bg-slate-950 dark:text-slate-100">
        <ThemeProvider brand={brandOf(theme, slots)} version={version}>
          <I18nProvider locale={locale} messages={messages} siteName={theme.identity.siteName} overrides={overrides}>
            {children}
            {previewing && pack.id && <PreviewBanner packId={pack.id} name={pack.name} />}
          </I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
