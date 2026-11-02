import "server-only";
import { Prisma, type Permission, type Role, type User } from "@prisma/client";
import { ALL_PERMISSIONS, can, ROLE_DEFAULTS } from "@/lib/permissions";

export const PAGE_SIZE = 25;

type Actor = Pick<User, "id" | "role" | "extraPermissions">;

export function grantablePermissions(actor: Actor): Permission[] {
  return ALL_PERMISSIONS.filter((p) => can(actor, p));
}

// perms the actor cant grant keep their old state (no escalation, no silent revoke)
export function resolveExtraPermissions(actor: Actor, role: Role, submitted: string[], previous: Permission[] = []): Permission[] {
  if (role === "STUDENT") return []; // students never hold global permissions
  const grantable = new Set(grantablePermissions(actor));
  const wanted = new Set(submitted.filter((p): p is Permission => (ALL_PERMISSIONS as string[]).includes(p)));
  const defaults = new Set(ROLE_DEFAULTS[role]);
  const out: Permission[] = [];
  for (const p of ALL_PERMISSIONS) {
    if (defaults.has(p)) continue;
    const on = grantable.has(p) ? wanted.has(p) : previous.includes(p);
    if (on) out.push(p);
  }
  return out;
}

export function isUniqueViolation(e: unknown) {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
}

export function pageFrom(v: string | undefined) {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : 1;
}

export function qs(params: Record<string, string | number | undefined | null>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "") sp.set(k, String(v));
  const s = sp.toString();
  return s ? `?${s}` : "";
}

// yyyy-mm-dd as baku midnight
export function fromDateInput(v: string | null | undefined): Date | null {
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const d = new Date(`${v}T00:00:00+04:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function toDateInput(d: Date | null | undefined) {
  if (!d) return "";
  return new Date(d.getTime() + 4 * 60 * 60 * 1000).toISOString().slice(0, 10);
}
