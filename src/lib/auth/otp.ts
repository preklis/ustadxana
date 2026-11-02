import "server-only";
import { createHash, randomInt } from "node:crypto";
import type { OtpPurpose } from "@prisma/client";
import { db } from "@/lib/db";

const OTP_TTL_MIN = 10;
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_SEC = 60;
const MAX_PER_HOUR = 5;

function hashCode(email: string, code: string) {
  return createHash("sha256").update(`${email}:${code}`).digest("hex");
}

export type IssueResult = { ok: true; code: string } | { ok: false; reason: "cooldown" | "rateLimited"; waitSec?: number };

export async function issueOtp(email: string, purpose: OtpPurpose): Promise<IssueResult> {
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recent = await db.otpCode.findMany({
    where: { email, purpose, createdAt: { gte: hourAgo } },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  if (recent.length >= MAX_PER_HOUR) return { ok: false, reason: "rateLimited" };
  if (recent[0]) {
    const since = (Date.now() - recent[0].createdAt.getTime()) / 1000;
    if (since < RESEND_COOLDOWN_SEC) return { ok: false, reason: "cooldown", waitSec: Math.ceil(RESEND_COOLDOWN_SEC - since) };
  }
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await db.otpCode.updateMany({ where: { email, purpose, consumedAt: null }, data: { consumedAt: new Date() } });
  await db.otpCode.create({
    data: { email, purpose, codeHash: hashCode(email, code), expiresAt: new Date(Date.now() + OTP_TTL_MIN * 60 * 1000) },
  });
  return { ok: true, code };
}

export type VerifyResult = "ok" | "invalid" | "expired" | "tooManyAttempts";

export async function verifyOtp(email: string, purpose: OtpPurpose, code: string): Promise<VerifyResult> {
  const otp = await db.otpCode.findFirst({
    where: { email, purpose, consumedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (!otp) return "invalid";
  if (otp.expiresAt < new Date()) return "expired";
  if (otp.attempts >= MAX_ATTEMPTS) return "tooManyAttempts";
  if (otp.codeHash !== hashCode(email, code.trim())) {
    await db.otpCode.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } });
    return otp.attempts + 1 >= MAX_ATTEMPTS ? "tooManyAttempts" : "invalid";
  }
  await db.otpCode.update({ where: { id: otp.id }, data: { consumedAt: new Date() } });
  return "ok";
}

export const OTP_TTL_MINUTES = OTP_TTL_MIN;
