import { LogOut } from "lucide-react";
import { Logo, Wordmark } from "@/components/logo";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { Button } from "@/components/ui/button";
import { getI18n } from "@/i18n/server";
import { logoutAction } from "../(auth)/actions";

export default async function SetupLayout({ children }: { children: React.ReactNode }) {
  const { t } = await getI18n();
  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4">
          <div className="flex items-center gap-2.5">
            <Logo className="h-8 w-8" />
            <Wordmark />
          </div>
          <div className="flex items-center gap-2">
            <LocaleSwitcher />
            <form action={logoutAction}>
              <Button type="submit" variant="ghost" size="sm">
                <LogOut className="h-4 w-4" />
                {t("nav.logout")}
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-10">{children}</main>
    </div>
  );
}
