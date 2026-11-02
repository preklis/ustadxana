"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { fail, ok, str, type ActionState } from "@/lib/action";
import { normalizeEmail } from "@/lib/utils";
import { issueOtp, verifyOtp } from "@/lib/auth/otp";
import { getCurrentUser } from "@/lib/auth/session";
import { sendApplicationReceivedEmail, sendApplyCodeEmail } from "@/lib/mail";
import { audit } from "@/lib/audit";
import { getLocale } from "@/i18n/server";
import { clearApplyAccess, grantApplyAccess, verifiedApplyEmail } from "@/lib/applications/server";
import { applicantName, isFormLive, OTHER_PREFIX, parseQuestions, validateAnswers, type Answer } from "@/lib/applications/questions";

async function liveForm(formId: string) {
  const form = await db.applicationForm.findUnique({ where: { id: formId } });
  return form && isFormLive(form) ? form : null;
}

export async function sendApplyCodeAction(formId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const form = await liveForm(formId);
  if (!form) return fail("applications.apply.closed");
  const email = normalizeEmail(str(fd, "email"));
  if (!z.string().email().safeParse(email).success) return fail("auth.errors.invalidEmail", { email: "auth.errors.invalidEmail" });
  if (form.kind === "STUDENT" && env.allowedEmailDomains.length && !env.allowedEmailDomains.includes(email.split("@")[1])) {
    return fail("auth.errors.domainNotAllowed", { email: "auth.errors.domainNotAllowed" });
  }
  const res = await issueOtp(email, "APPLY");
  if (!res.ok) return fail(res.reason === "cooldown" ? "auth.errors.otpCooldown" : "auth.errors.otpRateLimited");
  try {
    await sendApplyCodeEmail(email, res.code, form.title);
  } catch (e) {
    console.error("[mail] apply code failed", e);
    await db.otpCode.deleteMany({ where: { email, purpose: "APPLY", consumedAt: null } });
    return fail("auth.errors.emailFailed");
  }
  return ok("applications.apply.resent", { email });
}

export async function verifyApplyCodeAction(formId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const form = await liveForm(formId);
  if (!form) return fail("applications.apply.closed");
  const email = normalizeEmail(str(fd, "email"));
  const code = str(fd, "code");
  if (!/^\d{6}$/.test(code)) return fail("auth.errors.invalidCode", { code: "auth.errors.invalidCode" });
  const v = await verifyOtp(email, "APPLY", code);
  if (v !== "ok") return fail(`auth.errors.otp_${v}`, { code: `auth.errors.otp_${v}` });
  await grantApplyAccess(formId, email);
  redirect(`/apply/${form.slug}`);
}

export async function leaveApplyAction(slug: string) {
  await clearApplyAccess();
  redirect(`/apply/${slug}`);
}

// signed in users already proved their email, everyone else needs the cookie from the code step
async function applicantEmail(formId: string) {
  const user = await getCurrentUser();
  if (user && user.status !== "SUSPENDED") return user.email;
  return verifiedApplyEmail(formId);
}

export async function submitApplicationAction(formId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const form = await liveForm(formId);
  if (!form) return fail("applications.apply.closed");
  const email = await applicantEmail(formId);
  if (!email) return fail("applications.apply.errors.expired");

  const questions = parseQuestions(form.questions);
  const raw: Record<string, Answer | undefined> = {};
  for (const q of questions) {
    const key = `q_${q.id}`;
    const otherText = str(fd, `${key}_other`);
    const values = fd.getAll(key).map((v) => (typeof v === "string" ? v : ""));
    const mapped = values.map((v) => (v === "__other" ? (otherText ? `${OTHER_PREFIX}${otherText}` : "") : v));
    raw[q.id] = q.type === "multi" ? mapped : mapped[0];
  }
  const { answers, errors } = validateAnswers(questions, raw);
  if (Object.keys(errors).length) return fail("applications.apply.fixErrors", errors);

  const existing = await db.application.findUnique({ where: { formId_email: { formId, email } }, select: { id: true } });
  if (existing && !form.allowEdit) return fail("applications.apply.alreadyLocked");

  const data = { answers: answers as Prisma.InputJsonValue, name: applicantName(questions, answers), locale: await getLocale() };
  if (existing) {
    await db.application.update({ where: { id: existing.id }, data });
    return ok("applications.apply.updated");
  }
  try {
    const app = await db.application.create({ data: { formId, email, ...data } });
    await audit(null, "application.submit", { type: "application", id: app.id }, { form: form.title, email });
  } catch (e) {
    // double click: the first submit already created it
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return ok("applications.apply.updated");
    throw e;
  }
  sendApplicationReceivedEmail(email, form.title, `${env.appUrl}/apply/${form.slug}`, form.allowEdit).catch((e) =>
    console.error("[mail] application receipt failed", e),
  );
  return ok("applications.apply.submitted", { email });
}
