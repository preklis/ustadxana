"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { fail, ok, optStr, str, zodFieldErrors, type ActionState } from "@/lib/action";
import { requirePermission } from "@/lib/auth/session";
import { audit } from "@/lib/audit";
import { fromDateInput, isUniqueViolation } from "../_lib/shared";

const seasonSchema = z.object({
  name: z.string().min(2).max(80),
  number: z.number().int().min(1).max(1000).nullable(),
  description: z.string().max(2000).nullable(),
  startDate: z.date().nullable(),
  endDate: z.date().nullable(),
});

function revalidate() {
  revalidatePath("/admin/seasons");
  revalidatePath("/admin/classrooms");
  revalidatePath("/", "layout");
}

export async function saveSeasonAction(id: string | null, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await requirePermission("MANAGE_SEASONS");
  const numberRaw = str(fd, "number");
  const number = numberRaw === "" ? null : Number(numberRaw);
  if (number !== null && !Number.isInteger(number)) return fail("common.invalidInput", { number: "admin.seasons.invalidNumber" });
  const parsed = seasonSchema.safeParse({
    name: str(fd, "name"),
    number,
    description: optStr(fd, "description"),
    startDate: fromDateInput(str(fd, "startDate")),
    endDate: fromDateInput(str(fd, "endDate")),
  });
  if (!parsed.success) return fail("common.invalidInput", zodFieldErrors(parsed.error.issues));
  const d = parsed.data;
  if (d.startDate && d.endDate && d.endDate < d.startDate) {
    return fail("common.invalidInput", { endDate: "admin.seasons.endBeforeStart" });
  }
  try {
    if (id) {
      const res = await db.season.updateMany({ where: { id }, data: d });
      if (!res.count) return fail("common.genericError");
      await audit(actor.id, "season.update", { type: "season", id }, { name: d.name, number: d.number });
    } else {
      const created = await db.season.create({ data: { ...d, createdById: actor.id } });
      await audit(actor.id, "season.create", { type: "season", id: created.id }, { name: d.name, number: d.number });
    }
  } catch (e) {
    if (isUniqueViolation(e)) return fail("common.invalidInput", { number: "admin.seasons.numberTaken" });
    throw e;
  }
  revalidate();
  return ok(id ? "common.saved" : "admin.seasons.created");
}

// only one active season at a time
export async function setActiveSeasonAction(id: string): Promise<ActionState> {
  const actor = await requirePermission("MANAGE_SEASONS");
  const season = await db.season.findUnique({ where: { id }, select: { id: true } });
  if (!season) return fail("common.genericError");
  await db.$transaction([
    db.season.updateMany({ where: { isActive: true, id: { not: id } }, data: { isActive: false } }),
    db.season.update({ where: { id }, data: { isActive: true } }),
  ]);
  await audit(actor.id, "season.activate", { type: "season", id });
  revalidate();
  return ok();
}

export async function setRegistrationOpenAction(id: string, open: boolean): Promise<ActionState> {
  const actor = await requirePermission("MANAGE_SEASONS");
  const res = await db.season.updateMany({ where: { id }, data: { registrationOpen: open } });
  if (!res.count) return fail("common.genericError");
  await audit(actor.id, open ? "season.registrationOpen" : "season.registrationClose", { type: "season", id });
  revalidate();
  return ok();
}

export async function deleteSeasonAction(id: string): Promise<ActionState> {
  const actor = await requirePermission("MANAGE_SEASONS");
  const season = await db.season.findUnique({ where: { id }, select: { id: true, name: true, _count: { select: { classrooms: true, certificates: true } } } });
  if (!season) return fail("common.genericError");
  if (season._count.classrooms > 0) return fail("admin.seasons.hasClassrooms");
  if (season._count.certificates > 0) return fail("admin.seasons.hasCertificates");
  await db.season.delete({ where: { id } });
  await audit(actor.id, "season.delete", { type: "season", id }, { name: season.name });
  revalidate();
  return ok();
}
