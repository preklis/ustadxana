import Link from "next/link";
import { cn, initials } from "@/lib/utils";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "bc-card rounded-2xl border border-slate-200/80 bg-white shadow-[0_12px_32px_-18px_rgba(15,21,41,0.18)] dark:border-slate-800/80 dark:bg-slate-900/80 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ title, description, action, className }: { title: React.ReactNode; description?: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("bc-card-header flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 dark:border-slate-800", className)}>
      <div className="min-w-0">
        <h3 className="font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
        {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function CardBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-5", className)} {...props} />;
}

export function PageHeader({ title, description, actions, back }: { title: React.ReactNode; description?: React.ReactNode; actions?: React.ReactNode; back?: { href: string; label: string } }) {
  return (
    <div className="bc-page-header mb-6">
      {back && (
        <Link href={back.href} className="mb-2 inline-block text-sm text-slate-500 hover:text-brand-600">
          ← {back.label}
        </Link>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="bc-page-title text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl dark:text-white">{title}</h1>
          {description && <p className="bc-page-description mt-1 text-sm text-slate-500">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  );
}

type Tone = "gray" | "blue" | "green" | "yellow" | "red" | "purple" | "orange";
const tones: Record<Tone, string> = {
  gray: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  blue: "bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300",
  green: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  yellow: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  red: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300",
  purple: "bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
  orange: "bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
};

export function Badge({ tone = "gray", className, children }: { tone?: Tone; className?: string; children: React.ReactNode }) {
  return <span className={cn(`bc-badge bc-badge-${tone} inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium`, tones[tone], className)}>{children}</span>;
}

export const ROLE_TONE: Record<string, Tone> = {
  SUPERADMIN: "purple",
  ADMIN: "blue",
  STAFF: "orange",
  MENTOR: "green",
  APPLICANT_CHECKER: "yellow",
  STUDENT: "gray",
};

export const STATUS_TONE: Record<string, Tone> = {
  ACTIVE: "green",
  PENDING_APPROVAL: "yellow",
  PROFILE_INCOMPLETE: "gray",
  REJECTED: "red",
  SUSPENDED: "red",
};

const AVATAR_COLORS = ["bg-brand-500", "bg-emerald-500", "bg-amber-500", "bg-rose-500", "bg-violet-500", "bg-cyan-500", "bg-orange-500"];

export function Avatar({
  user,
  size = 36,
  className,
}: {
  user: { id: string; firstName: string; lastName: string; email?: string; avatarFileId?: string | null };
  size?: number;
  className?: string;
}) {
  const color = AVATAR_COLORS[user.id.charCodeAt(user.id.length - 1) % AVATAR_COLORS.length];
  const style = { width: size, height: size, fontSize: Math.max(10, size * 0.38) };
  if (user.avatarFileId)
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={`/api/files/${user.avatarFileId}`} alt="" style={style} className={cn("shrink-0 rounded-full object-cover", className)} />;
  return (
    <span style={style} className={cn("inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white", color, className)}>
      {initials(user)}
    </span>
  );
}

export function EmptyState({ icon, title, description, action }: { icon?: React.ReactNode; title: React.ReactNode; description?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 px-6 py-12 text-center dark:border-slate-700">
      {icon && <div className="mb-3 text-slate-400">{icon}</div>}
      <p className="font-medium text-slate-700 dark:text-slate-300">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Alert({ tone = "blue", title, children, className }: { tone?: "blue" | "yellow" | "red" | "green"; title?: React.ReactNode; children?: React.ReactNode; className?: string }) {
  const map = {
    blue: "border-brand-200 bg-brand-50 text-brand-900 dark:border-brand-900 dark:bg-brand-950/50 dark:text-brand-100",
    yellow: "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-100",
    red: "border-red-200 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950/50 dark:text-red-100",
    green: "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-100",
  };
  return (
    <div className={cn("rounded-lg border px-4 py-3 text-sm", map[tone], className)}>
      {title && <p className="font-semibold">{title}</p>}
      {children && <div className={cn(title && "mt-1")}>{children}</div>}
    </div>
  );
}

export function Tabs({ tabs, active }: { tabs: { key: string; label: React.ReactNode; href: string }[]; active: string }) {
  return (
    <div className="mb-6 flex gap-1 overflow-x-auto border-b border-slate-200 dark:border-slate-800">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          className={cn(
            "-mb-px whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
            tab.key === active
              ? "border-brand-600 text-brand-700 dark:text-brand-400"
              : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800 dark:hover:text-slate-200",
          )}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}

export function Table({ className, ...props }: React.HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="overflow-x-auto">
      <table className={cn("w-full text-left text-sm", className)} {...props} />
    </div>
  );
}
export const th = "px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 bg-slate-50 dark:bg-slate-800/50";
export const td = "px-4 py-3 border-t border-slate-100 dark:border-slate-800 align-middle";

export function StatCard({ label, value, icon, hint, href }: { label: React.ReactNode; value: React.ReactNode; icon?: React.ReactNode; hint?: React.ReactNode; href?: string }) {
  const inner = (
    <Card className={cn("p-5", href && "transition hover:border-brand-300 hover:shadow")}>
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        {icon && <span className="text-brand-500">{icon}</span>}
      </div>
      <p className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </Card>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

export function Pagination({ page, totalPages, hrefFor, prevLabel, nextLabel }: { page: number; totalPages: number; hrefFor: (p: number) => string; prevLabel: string; nextLabel: string }) {
  if (totalPages <= 1) return null;
  return (
    <div className="mt-4 flex items-center justify-between text-sm">
      {page > 1 ? <Link className="text-brand-600 hover:underline" href={hrefFor(page - 1)}>← {prevLabel}</Link> : <span />}
      <span className="text-slate-500">{page} / {totalPages}</span>
      {page < totalPages ? <Link className="text-brand-600 hover:underline" href={hrefFor(page + 1)}>{nextLabel} →</Link> : <span />}
    </div>
  );
}

export const CLASSROOM_COLORS: Record<string, string> = {
  blue: "from-slate-950 via-brand-900 to-brand-500",
  green: "from-emerald-600 to-emerald-400",
  purple: "from-violet-600 to-violet-400",
  orange: "from-orange-600 to-amber-400",
  red: "from-rose-600 to-rose-400",
  teal: "from-teal-600 to-cyan-400",
  slate: "from-slate-700 to-slate-500",
};
