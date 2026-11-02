"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Award,
  Bell,
  CalendarDays,
  CheckCircle2,
  Home,
  LayoutGrid,
  ListTodo,
  LogOut,
  Megaphone,
  Menu,
  Moon,
  Palette,
  ScrollText,
  Sun,
  UserRound,
  Users,
  X,
  School,
  Inbox,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n/client";
import { Avatar, Badge, ROLE_TONE } from "@/components/ui/primitives";
import { Logo, Tagline, Wordmark } from "@/components/logo";
import { ThemeSlot } from "@/components/theme-slot";
import { useBrand } from "@/components/theme-provider";
import { THEME_STORAGE_KEY } from "@/lib/theme/config";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { logoutAction } from "@/app/(auth)/actions";

const ICONS = {
  home: Home,
  classrooms: School,
  todo: ListTodo,
  megaphone: Megaphone,
  award: Award,
  bell: Bell,
  check: CheckCircle2,
  users: Users,
  layout: LayoutGrid,
  palette: Palette,
  calendar: CalendarDays,
  scroll: ScrollText,
  inbox: Inbox,
} as const;

export type NavItem = { href: string; label: string; icon: keyof typeof ICONS; badge?: number };

type ShellUser = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  avatarFileId: string | null;
  isTeam: boolean;
};

export function AppShell({
  user,
  main,
  admin,
  banner,
  children,
}: {
  user: ShellUser;
  main: NavItem[];
  admin: NavItem[];
  banner?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const brand = useBrand();
  useEffect(() => setOpen(false), [pathname]);

  return (
    <div className="bc-app min-h-screen lg:pl-64">
      {banner}
      {/* Mobile top bar */}
      <header className="bc-topbar sticky top-0 z-30 flex h-14 items-center justify-between border-b border-slate-200 bg-white/90 px-4 backdrop-blur lg:hidden dark:border-slate-800 dark:bg-slate-900/90">
        <button onClick={() => setOpen(true)} className="rounded-md p-1.5 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">
          <Menu className="h-5 w-5" />
        </button>
        <Link href="/dashboard" className="flex items-center gap-2">
          <Logo className="h-7 w-7 text-xs" />
          <Wordmark />
        </Link>
        <Link href="/profile">
          <Avatar user={user} size={30} />
        </Link>
      </header>

      {open && <div className="fixed inset-0 z-40 bg-slate-900/50 lg:hidden" onClick={() => setOpen(false)} />}

      <aside
        className={cn(
          "bc-sidebar fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-slate-200 bg-white/95 backdrop-blur transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] dark:border-slate-800/80 dark:bg-slate-950/90",
          open ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
      >
        <div className="flex h-16 items-center justify-between px-5">
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <Logo />
            <div className="leading-none">
              <Wordmark className="text-[15px]" />
              {brand.parts.sidebarTagline && <Tagline className="bc-sidebar-tagline mt-1 font-mono text-[10px] text-slate-400" />}
            </div>
          </Link>
          <button onClick={() => setOpen(false)} className="rounded-md p-1 text-slate-400 lg:hidden">
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="bc-nav flex-1 space-y-6 overflow-y-auto px-3 py-4">
          <NavGroup items={main} pathname={pathname} />
          {admin.length > 0 && <NavGroup title="nav.admin" items={admin} pathname={pathname} />}
        </nav>

        <ThemeSlot name="sidebarFooter" className="px-4 pb-3" />
        <div className="bc-sidebar-footer border-t border-slate-200 p-3 dark:border-slate-800">
          <div className="mb-3 flex items-center justify-between px-1">
            {brand.parts.localeSwitcher ? <LocaleSwitcher /> : <span />}
            {brand.mode.allowToggle && brand.parts.themeToggle && <ThemeToggle />}
          </div>
          <UserMenu user={user} />
        </div>
      </aside>

      <main key={pathname} className="bc-main mx-auto max-w-6xl animate-fade-up px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <ThemeSlot name="appBanner" className="mb-6" />
        {children}
        <ThemeSlot name="appFooter" />
      </main>
    </div>
  );
}

function NavGroup({ title, items, pathname }: { title?: string; items: NavItem[]; pathname: string }) {
  const { t } = useI18n();
  return (
    <div>
      {title && <p className="bc-nav-title mb-2 px-3 font-mono text-[11px] lowercase text-slate-400">{"// "}{t(title)}</p>}
      <ul className="space-y-0.5">
        {items.map((item) => {
          const Icon = ICONS[item.icon];
          const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`));
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  "bc-nav-item relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors active:scale-[0.98]",
                  active
                    ? "bc-nav-item-active bg-brand-50 text-brand-700 before:absolute before:-left-3 before:top-1.5 before:h-[calc(100%-12px)] before:w-[3px] before:rounded-r before:bg-brand-500 dark:bg-brand-500/10 dark:text-white"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-white",
                )}
              >
                <Icon className="h-[18px] w-[18px]" />
                <span className="flex-1">{t(item.label)}</span>
                {item.badge ? (
                  <span className="rounded-full bg-brand-600 px-1.5 py-0.5 text-[10px] font-bold leading-none text-brand-fg">
                    {item.badge > 99 ? "99+" : item.badge}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function UserMenu({ user }: { user: ShellUser }) {
  const { t } = useI18n();
  return (
    <div className="flex items-center gap-3 rounded-lg p-2">
      <Link href="/profile" className="flex min-w-0 flex-1 items-center gap-3">
        <Avatar user={user} size={36} />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{`${user.firstName} ${user.lastName}`.trim() || user.email}</p>
          <Badge tone={ROLE_TONE[user.role]} className="mt-0.5">
            {t(`common.roles.${user.role}`)}
          </Badge>
        </div>
      </Link>
      <div className="flex flex-col">
        <Link href="/profile" title={t("nav.profile")} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800">
          <UserRound className="h-4 w-4" />
        </Link>
        <form action={logoutAction}>
          <button type="submit" title={t("nav.logout")} className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950">
            <LogOut className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
}

function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => setDark(document.documentElement.classList.contains("dark")), []);
  return (
    <button
      type="button"
      onClick={() => {
        const next = !dark;
        setDark(next);
        document.documentElement.classList.toggle("dark", next);
        try {
          localStorage.setItem(THEME_STORAGE_KEY, next ? "dark" : "light");
        } catch {}
      }}
      className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:text-slate-900 dark:border-slate-700 dark:hover:text-white"
    >
      {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}
