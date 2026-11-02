import type { AttendanceStatus } from "@prisma/client";

export const ATTENDANCE_STATUSES: AttendanceStatus[] = ["PRESENT", "LATE", "ABSENT", "EXCUSED"];

// statuses that count as attended (percentages + certificates)
export const ATTENDED_STATUSES: readonly AttendanceStatus[] = ["PRESENT", "LATE", "EXCUSED"];

export function isAttended(s: AttendanceStatus) {
  return ATTENDED_STATUSES.includes(s);
}

export function isAttendanceStatus(v: unknown): v is AttendanceStatus {
  return typeof v === "string" && (ATTENDANCE_STATUSES as string[]).includes(v);
}

export type Rate = { attended: number; total: number; percent: number | null };

export function rateOf(statuses: AttendanceStatus[]): Rate {
  const total = statuses.length;
  const attended = statuses.filter(isAttended).length;
  return { attended, total, percent: total ? Math.round((attended / total) * 100) : null };
}

export const STATUS_STYLE: Record<AttendanceStatus, string> = {
  PRESENT: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200",
  LATE: "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200",
  ABSENT: "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200",
  EXCUSED: "bg-sky-100 text-sky-800 dark:bg-sky-900/50 dark:text-sky-200",
};

export const STATUS_ACTIVE: Record<AttendanceStatus, string> = {
  PRESENT: "bg-emerald-600 text-white border-emerald-600",
  LATE: "bg-amber-500 text-white border-amber-500",
  ABSENT: "bg-red-600 text-white border-red-600",
  EXCUSED: "bg-sky-600 text-white border-sky-600",
};

export const STATUS_TONE: Record<AttendanceStatus, "green" | "yellow" | "red" | "blue"> = {
  PRESENT: "green",
  LATE: "yellow",
  ABSENT: "red",
  EXCUSED: "blue",
};

export function percentTone(p: number | null): "green" | "yellow" | "red" | "gray" {
  if (p === null) return "gray";
  if (p >= 85) return "green";
  if (p >= 65) return "yellow";
  return "red";
}

// baku is UTC+4, no DST
export function bakuToday() {
  return new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

// @db.Date columns are stored as UTC midnight
export function parseDay(v: string | null | undefined): Date | null {
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const d = new Date(`${v}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v ? null : d;
}

export function dayKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function formatDay(
  d: Date,
  locale: string,
  opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" },
) {
  const tag = locale === "az" ? "az-Latn-AZ" : locale === "en" ? "en-GB" : locale;
  return new Intl.DateTimeFormat(tag, { ...opts, timeZone: "UTC" }).format(d);
}
