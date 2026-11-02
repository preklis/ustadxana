"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ApplicationStatus, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { fail, ok, optStr, str, type ActionState } from "@/lib/action";
import { requirePermission } from "@/lib/auth/session";
import { canOpenApplications } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import { sendDecisionEmail } from "@/lib/mail";
import { pendingDecisionsWhere, recalcScore } from "@/lib/applications/server";
import { applicantName, checkQuestions, questionsSchema, STATUSES } from "@/lib/applications/questions";
import { fromDateInput, isUniqueViolation } from "../_lib/shared";

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,58})[a-z0-9]$/;

function revalidate(formId?: string) {
  revalidatePath("/admin/applications");
  if (formId) revalidatePath(`/admin/applications/${formId}`);
  revalidatePath("/", "layout"); // the banner
}

export async function saveFormAction(id: string | null, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await requirePermission("MANAGE_APPLICATIONS");
  const title = str(fd, "title");
  const slug = str(fd, "slug").toLowerCase();
  const kind = str(fd, "kind") === "TEAM" ? "TEAM" : "STUDENT";
  const fieldErrors: Record<string, string> = {};
  if (title.length < 3 || title.length > 140) fieldErrors.title = "common.required";
  if (!SLUG_RE.test(slug)) fieldErrors.slug = "applications.builder.errors.slug";

  let questions;
  try {
    const parsed = questionsSchema.safeParse(JSON.parse(str(fd, "questions") || "[]"));
    if (!parsed.success) return fail("common.invalidInput");
    questions = parsed.data.map((q) => ({ ...q, options: q.options.map((o) => o.trim()).filter(Boolean) }));
  } catch {
    return fail("common.invalidInput");
  }
  const qErrors = checkQuestions(questions);
  if (Object.keys(qErrors).length) return fail(qErrors._ ?? "common.invalidInput", { ...fieldErrors, ...qErrors });
  if (Object.keys(fieldErrors).length) return fail("common.invalidInput", fieldErrors);

  const seasonId = optStr(fd, "seasonId");
  if (seasonId && !(await db.season.findUnique({ where: { id: seasonId }, select: { id: true } }))) return fail("common.invalidInput");
  const closesDay = fromDateInput(str(fd, "closesAt"));
  const data = {
    title,
    slug,
    kind: kind as "STUDENT" | "TEAM",
    description: optStr(fd, "description")?.slice(0, 5000) ?? null,
    confirmation: optStr(fd, "confirmation")?.slice(0, 2000) ?? null,
    seasonId,
    // end of the chosen day, baku time
    closesAt: closesDay ? new Date(closesDay.getTime() + 24 * 3600 * 1000 - 1000) : null,
    allowEdit: fd.get("allowEdit") === "on",
    questions: questions as Prisma.InputJsonValue,
  };

  let formId = id;
  try {
    if (id) {
      const res = await db.applicationForm.updateMany({ where: { id }, data });
      if (!res.count) return fail("common.genericError");
      // names come from the mapped questions, keep the list in sync if the mapping changed
      const apps = await db.application.findMany({ where: { formId: id }, select: { id: true, answers: true, name: true } });
      for (const a of apps) {
        const name = applicantName(questions, a.answers as Record<string, string>);
        if (name !== a.name) await db.application.update({ where: { id: a.id }, data: { name } });
      }
      await audit(actor.id, "applicationForm.update", { type: "applicationForm", id }, { title });
    } else {
      const created = await db.applicationForm.create({ data: { ...data, createdById: actor.id } });
      formId = created.id;
      await audit(actor.id, "applicationForm.create", { type: "applicationForm", id: created.id }, { title });
    }
  } catch (e) {
    if (isUniqueViolation(e)) return fail("common.invalidInput", { slug: "applications.builder.errors.slugTaken" });
    throw e;
  }
  revalidate(formId ?? undefined);
  if (!id) redirect(`/admin/applications/${formId}?created=1`);
  return ok("applications.builder.saved");
}

// the project lead decides when the public can apply
export async function setFormOpenAction(id: string, open: boolean): Promise<ActionState> {
  const actor = await requirePermission("REVIEW_APPLICATIONS");
  if (!canOpenApplications(actor)) return fail("applications.forms.onlyLead");
  const form = await db.applicationForm.findUnique({ where: { id }, select: { closesAt: true, title: true } });
  if (!form) return fail("common.genericError");
  const expired = form.closesAt && form.closesAt <= new Date();
  await db.applicationForm.update({
    where: { id },
    data: open
      ? { isOpen: true, openedAt: new Date(), openedById: actor.id, ...(expired ? { closesAt: null } : {}) }
      : { isOpen: false },
  });
  await audit(actor.id, open ? "applicationForm.open" : "applicationForm.close", { type: "applicationForm", id }, { title: form.title });
  revalidate(id);
  return ok();
}

export async function deleteFormAction(id: string): Promise<ActionState> {
  const actor = await requirePermission("MANAGE_APPLICATIONS");
  const form = await db.applicationForm.findUnique({ where: { id }, select: { isOpen: true, title: true } });
  if (!form) return fail("common.genericError");
  if (form.isOpen) return fail("applications.forms.deleteOpen");
  await db.applicationForm.delete({ where: { id } });
  await audit(actor.id, "applicationForm.delete", { type: "applicationForm", id }, { title: form.title });
  revalidate();
  redirect("/admin/applications");
}

const reviewSchema = z.object({ score: z.coerce.number().int().min(1).max(10), comment: z.string().max(3000).nullable() });

export async function saveReviewAction(applicationId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await requirePermission("REVIEW_APPLICATIONS");
  const parsed = reviewSchema.safeParse({ score: str(fd, "score"), comment: optStr(fd, "comment") });
  if (!parsed.success) return fail("common.invalidInput", { score: "common.required" });
  const app = await db.application.findUnique({ where: { id: applicationId }, select: { formId: true } });
  if (!app) return fail("common.genericError");
  await db.applicationReview.upsert({
    where: { applicationId_reviewerId: { applicationId, reviewerId: actor.id } },
    create: { applicationId, reviewerId: actor.id, ...parsed.data },
    update: parsed.data,
  });
  await recalcScore(applicationId);
  revalidatePath(`/admin/applications/${app.formId}`, "layout");
  return ok("applications.detail.reviewSaved");
}

export async function deleteReviewAction(applicationId: string): Promise<ActionState> {
  const actor = await requirePermission("REVIEW_APPLICATIONS");
  const app = await db.application.findUnique({ where: { id: applicationId }, select: { formId: true } });
  if (!app) return fail("common.genericError");
  await db.applicationReview.deleteMany({ where: { applicationId, reviewerId: actor.id } });
  await recalcScore(applicationId);
  revalidatePath(`/admin/applications/${app.formId}`, "layout");
  return ok();
}

export async function setApplicationStatusAction(applicationId: string, status: string): Promise<ActionState> {
  const actor = await requirePermission("REVIEW_APPLICATIONS");
  if (!(STATUSES as readonly string[]).includes(status)) return fail("common.invalidInput");
  const app = await db.application.findUnique({ where: { id: applicationId }, select: { formId: true, status: true, email: true } });
  if (!app) return fail("common.genericError");
  if (app.status === status) return ok();
  await db.application.update({
    where: { id: applicationId },
    data: { status: status as ApplicationStatus, decidedById: actor.id, decidedAt: new Date() },
  });
  await audit(actor.id, "application.status", { type: "application", id: applicationId }, { from: app.status, to: status, email: app.email });
  revalidatePath(`/admin/applications/${app.formId}`, "layout");
  return ok("applications.detail.statusSaved");
}

export async function deleteApplicationAction(applicationId: string): Promise<ActionState> {
  const actor = await requirePermission("MANAGE_APPLICATIONS");
  const app = await db.application.findUnique({ where: { id: applicationId }, select: { formId: true, email: true } });
  if (!app) return fail("common.genericError");
  await db.application.delete({ where: { id: applicationId } });
  await audit(actor.id, "application.delete", { type: "application", id: applicationId }, { email: app.email });
  revalidatePath(`/admin/applications/${app.formId}`, "layout");
  redirect(`/admin/applications/${app.formId}`);
}

// emails everyone whose decision changed since they were last told. capped per click so one
// slow smtp run doesn't time out the request
export async function sendDecisionsAction(formId: string): Promise<ActionState> {
  const actor = await requirePermission("MANAGE_APPLICATIONS");
  const form = await db.applicationForm.findUnique({ where: { id: formId }, select: { title: true, kind: true } });
  if (!form) return fail("common.genericError");
  const apps = await db.application.findMany({ where: pendingDecisionsWhere(formId), take: 150, orderBy: { submittedAt: "asc" } });
  let sent = 0;
  let failed = 0;
  for (const a of apps) {
    try {
      await sendDecisionEmail(a.email, { status: a.status as "ACCEPTED" | "WAITLISTED" | "REJECTED", kind: form.kind, formTitle: form.title, name: a.name.split(" ")[0] ?? "" });
      await db.application.update({ where: { id: a.id }, data: { notifiedStatus: a.status, notifiedAt: new Date() } });
      sent++;
    } catch (e) {
      console.error("[mail] decision failed", a.email, e);
      failed++;
    }
  }
  await audit(actor.id, "applicationForm.emailDecisions", { type: "applicationForm", id: formId }, { sent, failed });
  revalidate(formId);
  const data = { n: String(sent), failed: String(failed) };
  return failed ? { ok: false, error: "applications.responses.sentSome", data } : ok("applications.responses.sentN", data);
}
