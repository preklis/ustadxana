import "server-only";
import { cache } from "react";
import type { ApplicationStatus, Prisma } from "@prisma/client";
import { cookies } from "next/headers";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";
import { env } from "@/lib/env";

// forms the public can apply to right now
export const getLiveForms = cache(async () => {
  const now = new Date();
  return db.applicationForm.findMany({
    where: { isOpen: true, OR: [{ closesAt: null }, { closesAt: { gt: now } }] },
    orderBy: { openedAt: "desc" },
    select: { id: true, slug: true, title: true, description: true, kind: true, closesAt: true, season: { select: { name: true } } },
  });
});

// after the email code is checked the applicant gets a signed cookie for that form,
// so they have time to fill in a long form without the code running out
export const APPLY_COOKIE = "bc_apply";
const APPLY_HOURS = 3;

function secret() {
  return process.env.APP_SECRET || createHash("sha256").update(`apply:${process.env.DATABASE_URL ?? ""}`).digest("hex");
}

function sign(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export async function grantApplyAccess(formId: string, email: string) {
  const exp = Date.now() + APPLY_HOURS * 3600 * 1000;
  const payload = Buffer.from(JSON.stringify({ f: formId, e: email, x: exp })).toString("base64url");
  (await cookies()).set(APPLY_COOKIE, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.cookieSecure,
    path: "/apply",
    expires: new Date(exp),
  });
}

// email the visitor proved they own for this form, or null
export async function verifiedApplyEmail(formId: string): Promise<string | null> {
  const raw = (await cookies()).get(APPLY_COOKIE)?.value;
  if (!raw) return null;
  const [payload, mac] = raw.split(".");
  if (!payload || !mac) return null;
  const want = Buffer.from(sign(payload));
  const got = Buffer.from(mac);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  try {
    const d = JSON.parse(Buffer.from(payload, "base64url").toString()) as { f: string; e: string; x: number };
    if (d.f !== formId || d.x < Date.now()) return null;
    return d.e;
  } catch {
    return null;
  }
}

export async function clearApplyAccess() {
  (await cookies()).delete({ name: APPLY_COOKIE, path: "/apply" });
}

export async function recalcScore(applicationId: string) {
  const agg = await db.applicationReview.aggregate({ where: { applicationId }, _avg: { score: true }, _count: true });
  await db.application.update({
    where: { id: applicationId },
    data: { avgScore: agg._avg.score === null ? null : Math.round(agg._avg.score * 10) / 10, reviewCount: agg._count },
  });
}

// the newest accepted student application for this email, if any
export async function acceptedStudentApplication(email: string) {
  return db.application.findFirst({
    where: { email, status: "ACCEPTED", form: { kind: "STUDENT" } },
    orderBy: { decidedAt: "desc" },
    include: { form: { select: { questions: true, title: true } } },
  });
}

const DECIDED: ApplicationStatus[] = ["ACCEPTED", "WAITLISTED", "REJECTED"];

// decided applications whose result the applicant hasn't been emailed about yet
export function pendingDecisionsWhere(formId: string): Prisma.ApplicationWhereInput {
  return {
    formId,
    status: { in: DECIDED },
    OR: [{ notifiedStatus: null }, ...DECIDED.map((s) => ({ status: s, notifiedStatus: { not: s } }))],
  };
}
