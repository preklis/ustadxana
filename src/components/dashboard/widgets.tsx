import Link from "next/link";
import { ChevronRight, Megaphone, Pin } from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import { Card, CardHeader, CLASSROOM_COLORS } from "@/components/ui/primitives";

export type ClassroomCardData = {
  id: string;
  name: string;
  track: string | null;
  color: string;
  seasonName: string;
  meta?: React.ReactNode;
  footer?: React.ReactNode;
};

export function ClassroomCard({ c }: { c: ClassroomCardData }) {
  return (
    <Link
      href={`/classrooms/${c.id}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
    >
      <div className={cn("relative h-24 bg-gradient-to-br p-4 text-white", CLASSROOM_COLORS[c.color] ?? CLASSROOM_COLORS.blue)}>
        <div className="absolute -right-5 -top-5 h-20 w-20 rounded-full bg-white/10" />
        <p className="relative truncate text-lg font-semibold leading-tight group-hover:underline">{c.name}</p>
        <p className="relative mt-0.5 truncate text-sm text-white/85">{[c.track, c.seasonName].filter(Boolean).join(" · ")}</p>
      </div>
      <div className="flex flex-1 items-center justify-between gap-2 px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
        <div className="min-w-0 truncate">{c.meta}</div>
        {c.footer ?? <ChevronRight className="h-4 w-4 shrink-0 text-slate-400 transition group-hover:translate-x-0.5" />}
      </div>
    </Link>
  );
}

export function Section({
  title,
  description,
  action,
  empty,
  isEmpty,
  children,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  empty: React.ReactNode;
  isEmpty: boolean;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("flex flex-col", className)}>
      <CardHeader title={title} description={description} action={action} />
      {isEmpty ? (
        <div className="flex flex-1 items-center justify-center px-5 py-10 text-center text-sm text-slate-500">{empty}</div>
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">{children}</ul>
      )}
    </Card>
  );
}

export function Row({
  href,
  icon,
  title,
  subtitle,
  right,
}: {
  href?: string;
  icon?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  right?: React.ReactNode;
}) {
  const inner = (
    <>
      {icon && <span className="shrink-0">{icon}</span>}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-slate-900 dark:text-slate-100">{title}</span>
        {subtitle && <span className="mt-0.5 block truncate text-xs text-slate-500">{subtitle}</span>}
      </span>
      {right && <span className="shrink-0 text-right">{right}</span>}
    </>
  );
  return (
    <li>
      {href ? (
        <Link href={href} className="flex items-center gap-3 px-5 py-3 transition hover:bg-slate-50 dark:hover:bg-slate-800/50">
          {inner}
        </Link>
      ) : (
        <div className="flex items-center gap-3 px-5 py-3">{inner}</div>
      )}
    </li>
  );
}

export function IconBubble({ children, tone = "brand" }: { children: React.ReactNode; tone?: "brand" | "green" | "amber" | "red" | "violet" | "slate" }) {
  const map = {
    brand: "bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-300",
    green: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-300",
    amber: "bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-300",
    red: "bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-300",
    violet: "bg-violet-50 text-violet-600 dark:bg-violet-950 dark:text-violet-300",
    slate: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  };
  return <span className={cn("flex h-9 w-9 items-center justify-center rounded-lg", map[tone])}>{children}</span>;
}

export type AnnouncementItem = {
  id: string;
  title: string | null;
  body: string;
  pinned: boolean;
  createdAt: Date;
  classroom: { id: string; name: string } | null;
};

export function AnnouncementRows({ items, locale, campWide }: { items: AnnouncementItem[]; locale: string; campWide: string }) {
  return (
    <>
      {items.map((a) => (
        <Row
          key={a.id}
          href={a.classroom ? `/classrooms/${a.classroom.id}` : `/announcements#a-${a.id}`}
          icon={<IconBubble tone={a.pinned ? "amber" : "violet"}>{a.pinned ? <Pin className="h-4 w-4" /> : <Megaphone className="h-4 w-4" />}</IconBubble>}
          title={a.title ?? (a.body.length > 90 ? `${a.body.slice(0, 90)}…` : a.body)}
          subtitle={`${a.classroom?.name ?? campWide} · ${formatDate(a.createdAt, locale)}`}
        />
      ))}
    </>
  );
}

export function dueLabel(d: Date, locale: string) {
  const diff = d.getTime() - Date.now();
  const rtf = new Intl.RelativeTimeFormat(locale === "az" ? "az" : "en", { numeric: "auto" });
  const hours = diff / 3_600_000;
  if (Math.abs(hours) < 24) return rtf.format(Math.round(hours), "hour");
  return rtf.format(Math.round(hours / 24), "day");
}
