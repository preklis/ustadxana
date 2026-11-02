import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createHash, randomBytes } from "node:crypto";
import type { Permission, User } from "@prisma/client";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { can } from "@/lib/permissions";

export const SESSION_COOKIE = "bc_session";
const SESSION_DAYS = 30;

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const h = await headers();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await db.session.create({
    data: {
      tokenHash: hashToken(token),
      userId,
      expiresAt,
      userAgent: h.get("user-agent")?.slice(0, 300) ?? null,
      ip: (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? null)?.slice(0, 64) ?? null,
    },
  });
  await db.user.update({ where: { id: userId }, data: { lastLoginAt: new Date() } });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.cookieSecure,
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  jar.delete(SESSION_COOKIE);
}

export async function destroyAllSessions(userId: string) {
  await db.session.deleteMany({ where: { userId } });
}

export type SessionUser = Omit<User, "passwordHash">;

export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await db.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: { omit: { passwordHash: true } } },
  });
  if (!session || session.expiresAt < new Date()) return null;
  if (session.user.status === "SUSPENDED") return null;
  // only touch every 10 min to keep writes down
  if (Date.now() - session.lastSeenAt.getTime() > 10 * 60 * 1000) {
    await db.session.update({ where: { id: session.id }, data: { lastSeenAt: new Date() } }).catch(() => {});
  }
  return session.user;
});

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireActiveUser() {
  const user = await requireUser();
  if (user.status === "PROFILE_INCOMPLETE") redirect("/onboarding");
  if (user.status === "PENDING_APPROVAL" || user.status === "REJECTED") redirect("/pending");
  if (user.mustChangePassword) redirect("/change-password");
  return user;
}

export async function requirePermission(perm: Permission) {
  const user = await requireActiveUser();
  if (!can(user, perm)) redirect("/dashboard?denied=1");
  return user;
}

export async function requireTeam() {
  const user = await requireActiveUser();
  if (user.role === "STUDENT") redirect("/dashboard?denied=1");
  return user;
}
