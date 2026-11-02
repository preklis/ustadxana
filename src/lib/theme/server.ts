import "server-only";
import { unstable_cache } from "next/cache";
import { cookies } from "next/headers";
import type { ThemePack } from "@prisma/client";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { DEFAULT_THEME, normalizeTheme, SLOTS, type Slot, type ThemeConfig } from "./config";
import { BUILTIN_PACKS, DEFAULT_PACK_SLUG, syncBuiltinPacks } from "./builtin-packs";
import { resolveAssets } from "./sanitize";

export const THEME_TAG = "theme";
export const PREVIEW_COOKIE = "bc_theme_preview";

export type ThemeRecord = {
  theme: ThemeConfig;
  css: string; // pack css + custom css, asset urls resolved
  slots: Record<Slot, string>; // sanitized html, asset urls resolved
  pack: { id: string | null; slug: string; name: string; version: string };
  version: string;
  updatedAt: string | null;
  updatedById: string | null;
};

type PackLike = Pick<ThemePack, "slug" | "name" | "version" | "css" | "defaults" | "custom"> & { id: string | null; updatedAt: Date | null };

export function composeRecord(pack: PackLike, extra: { version?: string; updatedAt?: Date | null; updatedById?: string | null } = {}): ThemeRecord {
  const theme = normalizeTheme(pack.custom ?? pack.defaults);
  const assets = (s: string, kind: "css" | "html") => (pack.id ? resolveAssets(s, pack.id, kind) : s);
  const css = [pack.css, theme.customCss].filter((s) => s.trim()).join("\n\n/* custom css */\n");
  return {
    theme,
    css: assets(css, "css"),
    slots: Object.fromEntries(SLOTS.map((k) => [k, assets(theme.slots[k] ?? "", "html")])) as Record<Slot, string>,
    pack: { id: pack.id, slug: pack.slug, name: pack.name, version: pack.version },
    version: extra.version ?? String(pack.updatedAt?.getTime() ?? "default"),
    updatedAt: extra.updatedAt?.toISOString() ?? null,
    updatedById: extra.updatedById ?? null,
  };
}

const FALLBACK: PackLike = { ...BUILTIN_PACKS[0], id: null, custom: null, defaults: DEFAULT_THEME, updatedAt: null };

async function loadActive(): Promise<ThemeRecord> {
  const setting = await db.setting.findUnique({ where: { key: "theme" } });
  const packId = (setting?.value as { packId?: string } | null)?.packId;
  let pack = packId ? await db.themePack.findUnique({ where: { id: packId } }) : null;
  if (!pack) {
    pack = await db.themePack.findUnique({ where: { slug: DEFAULT_PACK_SLUG } });
    if (!pack) {
      await syncBuiltinPacks(db);
      pack = await db.themePack.findUnique({ where: { slug: DEFAULT_PACK_SLUG } });
    }
  }
  if (!pack) return composeRecord(FALLBACK);
  // whichever changed last (switching packs or editing the pack) bumps the version
  const stamps = [setting?.updatedAt, pack.updatedAt].filter(Boolean) as Date[];
  const latest = new Date(Math.max(...stamps.map((d) => d.getTime())));
  return composeRecord(pack, { version: String(latest.getTime()), updatedAt: pack.updatedAt, updatedById: pack.createdById });
}

// read on every page (root layout), so cached until an admin changes something
export const getThemeRecord = unstable_cache(
  async (): Promise<ThemeRecord> => {
    try {
      return await loadActive();
    } catch (e) {
      // never take the whole site down because of the theme
      console.error("[theme] load failed", e);
      return composeRecord(FALLBACK);
    }
  },
  ["site-theme-v2"],
  { tags: [THEME_TAG] },
);

export async function getTheme() {
  return (await getThemeRecord()).theme;
}

export async function getPackRecord(id: string): Promise<ThemeRecord | null> {
  const pack = await db.themePack.findUnique({ where: { id } });
  return pack ? composeRecord(pack, { version: `preview-${pack.updatedAt.getTime()}` }) : null;
}

// admins can try a pack on themselves before activating it (cookie set from the themes page)
export async function getRenderedTheme(): Promise<ThemeRecord & { previewing: boolean }> {
  const jar = await cookies();
  const previewId = jar.get(PREVIEW_COOKIE)?.value;
  if (previewId) {
    const user = await getCurrentUser();
    if (user && user.status === "ACTIVE" && can(user, "MANAGE_APPEARANCE")) {
      const rec = await getPackRecord(previewId);
      if (rec) return { ...rec, previewing: true };
    }
  }
  return { ...(await getThemeRecord()), previewing: false };
}
