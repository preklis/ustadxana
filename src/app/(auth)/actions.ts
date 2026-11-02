"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { fail, ok, str, type ActionState } from "@/lib/action";
import { normalizeEmail } from "@/lib/utils";
import { hashPassword, passwordIssue, verifyPassword } from "@/lib/auth/password";
import { issueOtp, verifyOtp } from "@/lib/auth/otp";
import { createSession, destroyAllSessions, destroySession, getCurrentUser, requireUser } from "@/lib/auth/session";
import { sendOtpEmail } from "@/lib/mail";
import { audit, notify } from "@/lib/audit";
import { getLocale } from "@/i18n/server";
import { acceptedStudentApplication } from "@/lib/applications/server";
import { isLocale, LOCALE_COOKIE } from "@/i18n/core";

const emailSchema = z.string().email();

function safeNext(next: string) {
  return next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
}

export async function loginAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const email = normalizeEmail(str(fd, "email"));
  const password = str(fd, "password");
  if (!email || !password) return fail("auth.errors.missingCredentials");

  const user = await db.user.findUnique({ where: { email } });
  // always run bcrypt so timing doesnt leak which emails exist
  const valid = await verifyPassword(password, user?.passwordHash ?? "$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinv");
  if (!user || !valid) return fail("auth.errors.invalidCredentials");
  if (user.status === "SUSPENDED") return fail("auth.errors.suspended");

  await createSession(user.id);
  if (user.locale && isLocale(user.locale)) {
    (await cookies()).set(LOCALE_COOKIE, user.locale, { path: "/", maxAge: 60 * 60 * 24 * 365 });
  }
  redirect(safeNext(str(fd, "next") || "/dashboard"));
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}

async function registrationOpen() {
  const season = await db.season.findFirst({ where: { registrationOpen: true }, select: { id: true } });
  return !!season;
}

export async function startRegistration(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const email = normalizeEmail(str(fd, "email"));
  if (!emailSchema.safeParse(email).success) return fail("auth.errors.invalidEmail", { email: "auth.errors.invalidEmail" });
  // people accepted through an application form can always register with the email they applied with
  const accepted = await acceptedStudentApplication(email);
  if (!accepted && env.allowedEmailDomains.length && !env.allowedEmailDomains.includes(email.split("@")[1])) {
    return fail("auth.errors.domainNotAllowed", { email: "auth.errors.domainNotAllowed" });
  }
  if (!accepted && !(await registrationOpen())) {
    const acceptedOnly = await db.application.count({ where: { status: "ACCEPTED", userId: null, form: { kind: "STUDENT" } } });
    return fail(acceptedOnly ? "applications.register.notAccepted" : "auth.errors.registrationClosed");
  }
  const existing = await db.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) return fail("auth.errors.emailTaken", { email: "auth.errors.emailTaken" });

  const res = await issueOtp(email, "REGISTER");
  if (!res.ok) return fail(res.reason === "cooldown" ? "auth.errors.otpCooldown" : "auth.errors.otpRateLimited");
  if (!(await deliverOtp(email, "REGISTER", res.code))) return fail("auth.errors.emailFailed");
  return ok("auth.register.codeSent", { email });
}

// if the mail doesn't go out, drop the code so the cooldown doesn't lock the user out
async function deliverOtp(email: string, purpose: "REGISTER" | "RESET_PASSWORD", code: string) {
  try {
    await sendOtpEmail(email, code, purpose === "REGISTER" ? "register" : "reset");
    return true;
  } catch (e) {
    console.error("[mail] otp failed", e);
    await db.otpCode.deleteMany({ where: { email, purpose, consumedAt: null } });
    return false;
  }
}

export async function completeRegistration(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const email = normalizeEmail(str(fd, "email"));
  const code = str(fd, "code");
  const password = str(fd, "password");
  const confirm = str(fd, "confirm");
  const firstName = str(fd, "firstName");
  const lastName = str(fd, "lastName");

  const fieldErrors: Record<string, string> = {};
  if (!/^\d{6}$/.test(code)) fieldErrors.code = "auth.errors.invalidCode";
  if (!firstName) fieldErrors.firstName = "common.required";
  if (!lastName) fieldErrors.lastName = "common.required";
  const issue = passwordIssue(password);
  if (issue) fieldErrors.password = `auth.errors.password_${issue}`;
  if (password !== confirm) fieldErrors.confirm = "auth.errors.passwordMismatch";
  if (Object.keys(fieldErrors).length) return fail("common.invalidInput", fieldErrors);

  if (await db.user.findUnique({ where: { email }, select: { id: true } })) return fail("auth.errors.emailTaken");

  const v = await verifyOtp(email, "REGISTER", code);
  if (v !== "ok") return fail(`auth.errors.otp_${v}`, { code: `auth.errors.otp_${v}` });

  const user = await db.user.create({
    data: {
      email,
      passwordHash: await hashPassword(password),
      role: "STUDENT",
      status: "PROFILE_INCOMPLETE",
      firstName,
      lastName,
      locale: await getLocale(),
    },
  });
  await audit(user.id, "auth.register", { type: "user", id: user.id });
  await db.application.updateMany({ where: { email, status: "ACCEPTED", form: { kind: "STUDENT" } }, data: { userId: user.id } });
  await createSession(user.id);
  redirect("/onboarding");
}

export async function startPasswordReset(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const email = normalizeEmail(str(fd, "email"));
  if (!emailSchema.safeParse(email).success) return fail("auth.errors.invalidEmail", { email: "auth.errors.invalidEmail" });
  const user = await db.user.findUnique({ where: { email }, select: { id: true, status: true } });
  // dont reveal whether the account exists
  if (user && user.status !== "SUSPENDED") {
    const res = await issueOtp(email, "RESET_PASSWORD");
    if (!res.ok) return fail(res.reason === "cooldown" ? "auth.errors.otpCooldown" : "auth.errors.otpRateLimited");
    if (!(await deliverOtp(email, "RESET_PASSWORD", res.code))) return fail("auth.errors.emailFailed");
  }
  return ok("auth.reset.codeSent", { email });
}

export async function completePasswordReset(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const email = normalizeEmail(str(fd, "email"));
  const code = str(fd, "code");
  const password = str(fd, "password");
  const confirm = str(fd, "confirm");
  const issue = passwordIssue(password);
  if (issue) return fail("common.invalidInput", { password: `auth.errors.password_${issue}` });
  if (password !== confirm) return fail("common.invalidInput", { confirm: "auth.errors.passwordMismatch" });

  const v = await verifyOtp(email, "RESET_PASSWORD", code);
  if (v !== "ok") return fail(`auth.errors.otp_${v}`, { code: `auth.errors.otp_${v}` });
  const user = await db.user.findUnique({ where: { email } });
  if (!user) return fail("auth.errors.otp_invalid");

  await db.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(password), mustChangePassword: false } });
  await destroyAllSessions(user.id);
  await audit(user.id, "auth.passwordReset", { type: "user", id: user.id });
  return ok("auth.reset.done");
}

export async function changePasswordAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  const current = str(fd, "current");
  const password = str(fd, "password");
  const confirm = str(fd, "confirm");
  const full = await db.user.findUniqueOrThrow({ where: { id: user.id } });
  if (!(await verifyPassword(current, full.passwordHash))) return fail("common.invalidInput", { current: "auth.errors.wrongPassword" });
  const issue = passwordIssue(password);
  if (issue) return fail("common.invalidInput", { password: `auth.errors.password_${issue}` });
  if (password !== confirm) return fail("common.invalidInput", { confirm: "auth.errors.passwordMismatch" });
  if (password === current) return fail("common.invalidInput", { password: "auth.errors.samePassword" });

  await db.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(password), mustChangePassword: false } });
  await audit(user.id, "auth.passwordChange", { type: "user", id: user.id });
  return ok("auth.changePassword.done");
}

const profileSchema = z.object({
  firstName: z.string().min(1).max(60),
  lastName: z.string().min(1).max(60),
  phone: z.string().min(7, "auth.errors.invalidPhone").max(30),
  birthDate: z.string().optional(),
  gender: z.string().max(20).optional(),
  university: z.string().min(2).max(120),
  faculty: z.string().min(2).max(120),
  courseYear: z.coerce.number().int().min(1).max(6),
  studentIdNumber: z.string().max(40).optional(),
  github: z.string().max(200).optional(),
  linkedin: z.string().max(200).optional(),
  portfolio: z.string().max(200).optional(),
  preferredTrack: z.string().max(120).optional(),
  priorExperience: z.string().max(2000).optional(),
  motivation: z.string().min(20, "auth.errors.motivationShort").max(3000),
  bio: z.string().max(1000).optional(),
  hasLaptop: z.string().optional(),
});

export async function submitProfile(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  if (user.role !== "STUDENT") redirect("/dashboard");
  if (user.status !== "PROFILE_INCOMPLETE" && user.status !== "REJECTED" && user.status !== "PENDING_APPROVAL") redirect("/dashboard");

  const raw = Object.fromEntries([...fd.entries()].filter(([, v]) => typeof v === "string").map(([k, v]) => [k, String(v).trim() || undefined]));
  const parsed = profileSchema.safeParse(raw);
  if (!parsed.success) {
    const fe: Record<string, string> = {};
    for (const i of parsed.error.issues) {
      const k = String(i.path[0]);
      fe[k] ??= i.message.includes(".") ? i.message : "common.required";
    }
    return fail("common.invalidInput", fe);
  }
  const d = parsed.data;
  const birthDate = d.birthDate ? new Date(d.birthDate) : null;
  const profile = {
    phone: d.phone,
    birthDate: birthDate && !Number.isNaN(birthDate.getTime()) ? birthDate : null,
    gender: d.gender ?? null,
    university: d.university,
    faculty: d.faculty,
    courseYear: d.courseYear,
    studentIdNumber: d.studentIdNumber ?? null,
    github: d.github ?? null,
    linkedin: d.linkedin ?? null,
    portfolio: d.portfolio ?? null,
    preferredTrack: d.preferredTrack ?? null,
    priorExperience: d.priorExperience ?? null,
    motivation: d.motivation,
    bio: d.bio ?? null,
    hasLaptop: d.hasLaptop === "on",
  };
  // already accepted through an application form: no second approval round
  const accepted = await acceptedStudentApplication(user.email);
  const autoApprove = !!accepted && user.status !== "REJECTED";
  // the person who accepted them may have been removed since
  const approverId = accepted?.decidedById
    ? ((await db.user.findUnique({ where: { id: accepted.decidedById }, select: { id: true } }))?.id ?? null)
    : null;
  await db.$transaction([
    db.studentProfile.upsert({ where: { userId: user.id }, create: { userId: user.id, ...profile }, update: profile }),
    db.user.update({
      where: { id: user.id },
      data: autoApprove
        ? { firstName: d.firstName, lastName: d.lastName, status: "ACTIVE", rejectionReason: null, approvedAt: new Date(), approvedById: approverId }
        : { firstName: d.firstName, lastName: d.lastName, status: "PENDING_APPROVAL", rejectionReason: null },
    }),
  ]);
  await audit(user.id, "student.profileSubmitted", { type: "user", id: user.id });
  if (autoApprove) {
    await audit(approverId, "student.approve", { type: "user", id: user.id }, { via: "application", applicationId: accepted.id });
    redirect("/dashboard");
  }

  const approvers = await db.user.findMany({
    where: {
      status: "ACTIVE",
      OR: [{ role: { in: ["SUPERADMIN", "ADMIN"] } }, { extraPermissions: { has: "APPROVE_STUDENTS" } }],
    },
    select: { id: true },
  });
  await notify(
    approvers.map((a) => a.id),
    { title: `${d.firstName} ${d.lastName}`, body: "auth.notify.newApplication", link: "/admin/approvals" },
  );
  redirect("/pending");
}

export async function setLocaleAction(locale: string) {
  if (!isLocale(locale)) return;
  (await cookies()).set(LOCALE_COOKIE, locale, { path: "/", maxAge: 60 * 60 * 24 * 365 });
  const user = await getCurrentUser();
  if (user) await db.user.update({ where: { id: user.id }, data: { locale } });
}
