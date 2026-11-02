"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireActiveUser } from "@/lib/auth/session";
import { audit } from "@/lib/audit";
import { fail, ok, str, zodFieldErrors, type ActionState } from "@/lib/action";
import { deleteFileObject, filesFrom, saveUploads, UploadError } from "@/lib/storage";

const AVATAR_MAX_BYTES = 5 * 1024 * 1024;
const AVATAR_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

export async function updateMyInfo(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireActiveUser();
  const firstName = str(fd, "firstName");
  const lastName = str(fd, "lastName");
  const fe: Record<string, string> = {};
  if (!firstName || firstName.length > 60) fe.firstName = "common.required";
  if (!lastName || lastName.length > 60) fe.lastName = "common.required";
  if (Object.keys(fe).length) return fail("common.invalidInput", fe);
  await db.user.update({ where: { id: user.id }, data: { firstName, lastName } });
  revalidatePath("/", "layout");
  return ok("profile.infoSaved");
}

export async function uploadAvatar(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireActiveUser();
  const file = filesFrom(fd, "avatar").find((f) => f.size > 0);
  if (!file) return fail("profile.avatar.choose");
  if (!AVATAR_TYPES.has(file.type)) return fail("profile.avatar.badType");
  if (file.size > AVATAR_MAX_BYTES) return fail("profile.avatar.tooLarge");

  let created;
  try {
    [created] = await saveUploads([file], user.id);
  } catch (e) {
    if (e instanceof UploadError) return fail(e.code === "tooLarge" ? "common.uploadTooLarge" : "common.uploadBlocked");
    throw e;
  }
  if (!created) return fail("profile.avatar.choose");

  const old = user.avatarFileId;
  await db.user.update({ where: { id: user.id }, data: { avatarFileId: created.id } });
  if (old) await deleteFileObject(old).catch(() => {});
  revalidatePath("/", "layout");
  return ok("profile.avatar.updated");
}

export async function removeAvatar() {
  const user = await requireActiveUser();
  if (!user.avatarFileId) return;
  const old = user.avatarFileId;
  await db.user.update({ where: { id: user.id }, data: { avatarFileId: null } });
  await deleteFileObject(old).catch(() => {});
  revalidatePath("/", "layout");
}

const optUrl = z
  .string()
  .max(200)
  .regex(/^https?:\/\/\S+$/i, "profile.errors.invalidUrl")
  .optional();

const studentSchema = z.object({
  phone: z.string().min(7, "profile.errors.invalidPhone").max(30, "profile.errors.invalidPhone"),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  gender: z.enum(["female", "male"]).optional(),
  university: z.string().min(2).max(120),
  faculty: z.string().min(2).max(120),
  courseYear: z.coerce.number().int().min(1).max(6),
  studentIdNumber: z.string().max(40).optional(),
  github: optUrl,
  linkedin: optUrl,
  portfolio: optUrl,
  bio: z.string().max(1000).optional(),
  priorExperience: z.string().max(2000).optional(),
  hasLaptop: z.string().optional(),
});

export async function updateStudentProfile(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireActiveUser();
  if (user.role !== "STUDENT") return fail("profile.errors.studentsOnly");

  const keys = Object.keys(studentSchema.shape);
  const raw = Object.fromEntries(keys.map((k) => [k, str(fd, k) || undefined]));
  const parsed = studentSchema.safeParse(raw);
  if (!parsed.success) return fail("common.invalidInput", zodFieldErrors(parsed.error.issues));
  const d = parsed.data;
  const birthDate = d.birthDate ? new Date(`${d.birthDate}T00:00:00.000Z`) : null;

  const existing = await db.studentProfile.findUnique({ where: { userId: user.id }, select: { id: true } });
  if (!existing) return fail("profile.errors.noProfile");

  await db.studentProfile.update({
    where: { userId: user.id },
    data: {
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
      bio: d.bio ?? null,
      priorExperience: d.priorExperience ?? null,
      hasLaptop: d.hasLaptop === "on",
    },
  });
  await audit(user.id, "profile.update", { type: "user", id: user.id });
  revalidatePath("/profile");
  return ok("profile.profileSaved");
}
