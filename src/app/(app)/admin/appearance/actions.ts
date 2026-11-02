"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { fail, ok, str, type ActionState } from "@/lib/action";
import { requirePermission } from "@/lib/auth/session";
import { audit } from "@/lib/audit";
import { normalizeTheme, themeSchema } from "@/lib/theme/config";
import { checkCss, cleanConfig } from "@/lib/theme/sanitize";
import { getThemeRecord, PREVIEW_COOKIE, THEME_TAG } from "@/lib/theme/server";
import { installPack, MAX_ZIP_BYTES, PackError, removePackFiles } from "@/lib/theme/packs";

function refresh() {
  revalidateTag(THEME_TAG);
  revalidatePath("/", "layout");
}

/* ---------- customize ---------- */

export async function saveThemeAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await requirePermission("MANAGE_APPEARANCE");
  const packId = str(fd, "packId");
  const pack = await db.themePack.findUnique({ where: { id: packId } });
  if (!pack) return fail("common.genericError");

  let raw: unknown;
  try {
    raw = JSON.parse(str(fd, "theme"));
  } catch {
    return fail("admin.appearance.invalid");
  }
  const parsed = themeSchema.safeParse(raw);
  if (!parsed.success) {
    const path = parsed.error.issues[0]?.path.join(".");
    console.warn("[theme] rejected", path);
    return fail(path?.startsWith("identity.logo") ? "admin.appearance.logoInvalid" : "admin.appearance.invalid");
  }
  const css = checkCss(parsed.data.customCss);
  if (!css.ok) return fail("admin.appearance.unsafeCss", { customCss: "admin.appearance.unsafeCss" });

  const theme = cleanConfig(normalizeTheme(parsed.data));
  const before = normalizeTheme(pack.custom ?? pack.defaults);
  await db.themePack.update({ where: { id: pack.id }, data: { custom: theme } });
  const changed = (Object.keys(theme) as (keyof typeof theme)[]).filter((k) => JSON.stringify(theme[k]) !== JSON.stringify(before[k]));
  await audit(actor.id, "appearance.update", { type: "themePack", id: pack.id }, { pack: pack.name, changed: changed.join(", ") || "-" });
  refresh();
  return ok("admin.appearance.saved");
}

/* ---------- theme packs ---------- */

export async function uploadPackAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await requirePermission("MANAGE_APPEARANCE");
  const file = fd.get("pack");
  if (!(file instanceof File) || file.size === 0) return fail("admin.appearance.packs.errors.noFile");
  if (file.size > MAX_ZIP_BYTES) return fail("admin.appearance.packs.errors.tooLarge");
  try {
    const { pack, updated } = await installPack(new Uint8Array(await file.arrayBuffer()), actor.id);
    await audit(actor.id, updated ? "appearance.packUpdate" : "appearance.packInstall", { type: "themePack", id: pack.id }, { name: pack.name, version: pack.version });
    refresh();
    return ok(updated ? "admin.appearance.packs.updatedOk" : "admin.appearance.packs.installedOk", { name: pack.name });
  } catch (e) {
    if (e instanceof PackError) return { ok: false, error: e.key, data: e.detail ? { detail: e.detail } : undefined };
    console.error("[theme] install failed", e);
    return fail("admin.appearance.packs.errors.notZip");
  }
}

export async function activatePackAction(packId: string): Promise<ActionState> {
  const actor = await requirePermission("MANAGE_APPEARANCE");
  const pack = await db.themePack.findUnique({ where: { id: packId }, select: { id: true, name: true } });
  if (!pack) return fail("common.genericError");
  await db.setting.upsert({
    where: { key: "theme" },
    create: { key: "theme", value: { packId: pack.id }, updatedById: actor.id },
    update: { value: { packId: pack.id }, updatedById: actor.id },
  });
  (await cookies()).delete(PREVIEW_COOKIE);
  await audit(actor.id, "appearance.activate", { type: "themePack", id: pack.id }, { name: pack.name });
  refresh();
  return ok("admin.appearance.packs.activated");
}

export async function deletePackAction(packId: string): Promise<ActionState> {
  const actor = await requirePermission("MANAGE_APPEARANCE");
  const pack = await db.themePack.findUnique({ where: { id: packId } });
  if (!pack) return fail("common.genericError");
  if (pack.builtIn) return fail("admin.appearance.packs.errors.cantDeleteBuiltIn");
  if ((await getThemeRecord()).pack.id === pack.id) return fail("admin.appearance.packs.errors.cantDeleteActive");
  await db.themePack.delete({ where: { id: pack.id } });
  await removePackFiles(pack.id);
  await audit(actor.id, "appearance.packDelete", { type: "themePack", id: pack.id }, { name: pack.name });
  refresh();
  return ok();
}

// try a pack on yourself only, the rest of the site keeps the active one
export async function previewPackAction(packId: string) {
  await requirePermission("MANAGE_APPEARANCE");
  const pack = await db.themePack.findUnique({ where: { id: packId }, select: { id: true } });
  if (!pack) return;
  (await cookies()).set(PREVIEW_COOKIE, pack.id, { path: "/", httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 2 });
  redirect("/dashboard");
}

export async function exitPreviewAction() {
  (await cookies()).delete(PREVIEW_COOKIE);
  revalidatePath("/", "layout");
}
