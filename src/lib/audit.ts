import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "./db";

export async function audit(
  actorId: string | null,
  action: string,
  target?: { type: string; id: string } | null,
  meta?: Prisma.InputJsonValue,
) {
  await db.auditLog
    .create({ data: { actorId, action, targetType: target?.type, targetId: target?.id, meta } })
    .catch((e) => console.error("[audit] failed", e));
}

export async function notify(userIds: string[], n: { title: string; body?: string; link?: string }) {
  const ids = [...new Set(userIds)];
  if (!ids.length) return;
  await db.notification
    .createMany({ data: ids.map((userId) => ({ userId, title: n.title, body: n.body, link: n.link })) })
    .catch((e) => console.error("[notify] failed", e));
}
