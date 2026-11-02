import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function fullName(u: { firstName: string; lastName: string; email?: string }) {
  const n = `${u.firstName} ${u.lastName}`.trim();
  return n || u.email || "—";
}

export function initials(u: { firstName: string; lastName: string; email?: string }) {
  const a = (u.firstName[0] ?? "") + (u.lastName[0] ?? "");
  return (a || u.email?.[0] || "?").toUpperCase();
}

const LOCALE_TAG: Record<string, string> = { az: "az-Latn-AZ", en: "en-GB" };

export function formatDate(d: Date | string | null | undefined, locale = "az", withTime = false) {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat(LOCALE_TAG[locale] ?? locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
    timeZone: "Asia/Baku",
  }).format(date);
}

export function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function toDateTimeLocal(d: Date | null | undefined) {
  if (!d) return "";
  const baku = new Date(d.getTime() + 4 * 60 * 60 * 1000);
  return baku.toISOString().slice(0, 16);
}

export function fromDateTimeLocal(v: string | null | undefined): Date | null {
  if (!v) return null;
  const d = new Date(`${v}:00+04:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function splitLinks(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(/[\n,\s]+/)
    .map((s) => s.trim())
    .filter((s) => /^https?:\/\//i.test(s))
    .slice(0, 20);
}
