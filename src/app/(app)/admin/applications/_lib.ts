import "server-only";
import type { Prisma } from "@prisma/client";
import { STATUSES } from "@/lib/applications/questions";
import { qs } from "../_lib/shared";

// the responses table and the detail page's previous/next share the same filters
export type ListParams = { status?: string; q?: string; sort?: string };

export function cleanParams(p: ListParams): ListParams {
  return {
    status: p.status && (STATUSES as readonly string[]).includes(p.status) ? p.status : undefined,
    q: p.q?.trim().slice(0, 100) || undefined,
    sort: p.sort === "score" || p.sort === "unscored" ? p.sort : undefined,
  };
}

export function listWhere(formId: string, p: ListParams, userId: string): Prisma.ApplicationWhereInput {
  return {
    formId,
    ...(p.status ? { status: p.status as Prisma.EnumApplicationStatusFilter["equals"] } : {}),
    ...(p.q ? { OR: [{ name: { contains: p.q, mode: "insensitive" } }, { email: { contains: p.q, mode: "insensitive" } }] } : {}),
    ...(p.sort === "unscored" ? { reviews: { none: { reviewerId: userId } } } : {}),
  };
}

export function listOrder(p: ListParams): Prisma.ApplicationOrderByWithRelationInput[] {
  if (p.sort === "score") return [{ avgScore: { sort: "desc", nulls: "last" } }, { submittedAt: "asc" }, { id: "asc" }];
  if (p.sort === "unscored") return [{ submittedAt: "asc" }, { id: "asc" }];
  return [{ submittedAt: "desc" }, { id: "asc" }];
}

export function listQs(p: ListParams, extra: Record<string, string | number | undefined> = {}) {
  return qs({ status: p.status, q: p.q, sort: p.sort, ...extra });
}
