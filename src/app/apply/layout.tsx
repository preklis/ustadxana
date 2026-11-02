import Link from "next/link";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { Logo, Wordmark } from "@/components/logo";
import { getRenderedTheme } from "@/lib/theme/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getI18n } from "@/i18n/server";

// public pages for applicants, no account needed
export default async function ApplyLayout({ children }: { children: React.ReactNode }) {
  const [{ t }, { theme }, user] = await Promise.all([getI18n(), getRenderedTheme(), getCurrentUser()]);
  return (
    <div className="bc-apply flex min-h-[100dvh] flex-col">
      <header className="bc-apply-header sticky top-0 z-20 border-b border-slate-200/70 bg-white/80 backdrop-blur dark:border-slate-800/70 dark:bg-slate-950/80">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between gap-3 px-4">
          <Link href="/apply" className="flex items-center gap-2">
            <Logo className="h-8 w-8" />
            <Wordmark />
          </Link>
          <div className="flex items-center gap-3 text-sm">
            {theme.parts.localeSwitcher && <LocaleSwitcher />}
            <Link href={user ? "/dashboard" : "/login"} className="font-medium text-slate-600 hover:text-brand-600 dark:text-slate-300">
              {user ? t("nav.dashboard") : t("auth.login.submit")}
            </Link>
          </div>
        </div>
      </header>
      <main className="bc-apply-main mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:py-12">{children}</main>
    </div>
  );
}
