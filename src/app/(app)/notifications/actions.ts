"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireActiveUser } from "@/lib/auth/session";

function safeLink(link: string | null) {
  return link && link.startsWith("/") && !link.startsWith("//") ? link : null;
}

export async function openNotification(id: string) {
  const user = await requireActiveUser();
  const n = await db.notification.findFirst({ where: { id, userId: user.id }, select: { id: true, link: true, readAt: true } });
  if (!n) return;
  if (!n.readAt) await db.notification.update({ where: { id: n.id }, data: { readAt: new Date() } });
  revalidatePath("/", "layout");
  const link = safeLink(n.link);
  if (link) redirect(link);
}

export async function markAllRead() {
  const user = await requireActiveUser();
  await db.notification.updateMany({ where: { userId: user.id, readAt: null }, data: { readAt: new Date() } });
  revalidatePath("/", "layout");
}

export async function deleteRead() {
  const user = await requireActiveUser();
  await db.notification.deleteMany({ where: { userId: user.id, readAt: { not: null } } });
  revalidatePath("/", "layout");
}

export async function deleteNotification(id: string) {
  const user = await requireActiveUser();
  await db.notification.deleteMany({ where: { id, userId: user.id } });
  revalidatePath("/", "layout");
}
