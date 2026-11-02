import "server-only";
import path from "node:path";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { strToU8, unzipSync, zipSync, type Zippable } from "fflate";
import type { ThemePack } from "@prisma/client";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { MAX_CSS, normalizeTheme, type ThemeConfig } from "./config";
import { checkCss, cleanConfig } from "./sanitize";

/*
  pack zip layout (see THEMES.md):
    theme.json        required  { name, slug?, version?, author?, description?, settings?: Partial<ThemeConfig> }
    style.css         optional
    screenshot.png    optional  (or .jpg / .webp)
    slots/<name>.html optional  html for a slot, same as settings.slots.<name>
    assets/**         optional  images and fonts, referenced as "assets/..." from css/html
*/

export const MAX_ZIP_BYTES = 10 * 1024 * 1024;
const MAX_UNZIPPED = 40 * 1024 * 1024;
const MAX_FILES = 300;

export const ASSET_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
};

export class PackError extends Error {
  constructor(
    public key: string,
    public detail?: string,
  ) {
    super(detail ? `${key}: ${detail}` : key);
  }
}

export function packDir(packId: string) {
  return path.join(path.resolve(env.uploadDir), "themes", packId);
}

// only "assets/..." and the screenshot are ever served, and never outside the pack folder
export async function readPackFile(packId: string, rel: string) {
  if (!/^[a-z0-9]+$/i.test(packId)) return null;
  const clean = path.posix.normalize(rel).replace(/^\/+/, "");
  if (clean.startsWith("..") || !(clean.startsWith("assets/") || /^screenshot\.(png|jpe?g|webp)$/.test(clean))) return null;
  const type = ASSET_TYPES[path.extname(clean).toLowerCase()];
  if (!type) return null;
  const dir = packDir(packId);
  const abs = path.join(dir, clean);
  if (!abs.startsWith(dir + path.sep)) return null;
  try {
    return { data: await readFile(abs), type };
  } catch {
    return null;
  }
}

function slugify(s: string) {
  return (
    s
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/[\s_]+/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 50) || "theme"
  );
}

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export async function installPack(zip: Uint8Array, actorId: string) {
  if (zip.byteLength > MAX_ZIP_BYTES) throw new PackError("admin.appearance.packs.errors.tooLarge");

  let files: Record<string, Uint8Array>;
  try {
    let total = 0;
    let count = 0;
    files = unzipSync(zip, {
      filter: (f) => {
        count++;
        total += f.originalSize;
        if (count > MAX_FILES || total > MAX_UNZIPPED) throw new PackError("admin.appearance.packs.errors.tooLarge");
        return !f.name.endsWith("/");
      },
    });
  } catch (e) {
    if (e instanceof PackError) throw e;
    throw new PackError("admin.appearance.packs.errors.notZip");
  }

  // zips made by "compress folder" put everything under one top folder, strip it
  let names = Object.keys(files).filter((n) => !n.startsWith("__MACOSX/") && !n.split("/").pop()!.startsWith("."));
  const manifestPath = names.find((n) => n === "theme.json") ?? names.find((n) => /^[^/]+\/theme\.json$/.test(n));
  if (!manifestPath) throw new PackError("admin.appearance.packs.errors.noManifest");
  const prefix = manifestPath.slice(0, -"theme.json".length);
  names = names.filter((n) => n.startsWith(prefix));
  const get = (rel: string) => files[prefix + rel];
  const text = (rel: string) => (get(rel) ? new TextDecoder().decode(get(rel)) : "");

  let manifest: Record<string, unknown>;
  try {
    manifest = JSON.parse(text("theme.json"));
    if (!manifest || typeof manifest !== "object") throw new Error();
  } catch {
    throw new PackError("admin.appearance.packs.errors.badManifest");
  }
  const name = str(manifest.name, 60);
  if (!name) throw new PackError("admin.appearance.packs.errors.badManifest", "name");
  const slug = slugify(str(manifest.slug, 50) || name);

  const css = text("style.css");
  if (css.length > MAX_CSS) throw new PackError("admin.appearance.packs.errors.cssTooLarge");
  const cssCheck = checkCss(css);
  if (!cssCheck.ok) throw new PackError("admin.appearance.packs.errors.unsafeCss", cssCheck.reason);

  // settings + slot files
  const settings = (manifest.settings && typeof manifest.settings === "object" ? manifest.settings : {}) as Record<string, unknown>;
  const slotFiles: Record<string, string> = {};
  for (const n of names) {
    const m = n.slice(prefix.length).match(/^slots\/([A-Za-z]+)\.html$/);
    if (m) slotFiles[m[1]] = text(`slots/${m[1]}.html`);
  }
  const merged = { ...settings, slots: { ...((settings.slots as object) ?? {}), ...slotFiles } };
  const defaults = cleanConfig(normalizeTheme(merged));
  const customCheck = checkCss(defaults.customCss);
  if (!customCheck.ok) throw new PackError("admin.appearance.packs.errors.unsafeCss", customCheck.reason);

  // assets
  const assets: [string, Uint8Array][] = [];
  let screenshot: string | null = null;
  for (const n of names) {
    const rel = n.slice(prefix.length);
    const clean = path.posix.normalize(rel);
    if (clean.startsWith("..") || path.posix.isAbsolute(clean)) throw new PackError("admin.appearance.packs.errors.badPath", rel);
    const ext = path.posix.extname(clean).toLowerCase();
    if (clean.startsWith("assets/")) {
      if (!ASSET_TYPES[ext]) throw new PackError("admin.appearance.packs.errors.badAsset", rel);
      if (ext === ".svg" && /<script|on\w+\s*=|javascript:/i.test(new TextDecoder().decode(files[n]))) {
        throw new PackError("admin.appearance.packs.errors.badAsset", rel);
      }
      assets.push([clean, files[n]]);
    } else if (/^screenshot\.(png|jpe?g|webp)$/.test(clean)) {
      screenshot = clean;
      assets.push([clean, files[n]]);
    }
  }

  const existing = await db.themePack.findUnique({ where: { slug } });
  if (existing?.builtIn) throw new PackError("admin.appearance.packs.errors.builtInSlug", slug);

  const data = {
    name,
    version: str(manifest.version, 20) || "1.0.0",
    author: str(manifest.author, 80) || null,
    description: str(manifest.description, 300) || null,
    css,
    defaults,
    screenshot,
    createdById: actorId,
  };
  // same slug again = update, like uploading a newer version of a wordpress theme. customizations stay
  const pack = existing
    ? await db.themePack.update({ where: { id: existing.id }, data })
    : await db.themePack.create({ data: { slug, ...data } });

  const dir = packDir(pack.id);
  await rm(dir, { recursive: true, force: true });
  for (const [rel, bytes] of assets) {
    const abs = path.join(dir, rel);
    if (!abs.startsWith(dir + path.sep)) continue;
    await mkdir(path.dirname(abs), { recursive: true });
    await writeFile(abs, bytes);
  }
  return { pack, updated: !!existing };
}

export async function removePackFiles(packId: string) {
  await rm(packDir(packId), { recursive: true, force: true });
}

async function listFiles(dir: string, base = ""): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(path.join(dir, base), { withFileTypes: true });
  } catch {
    return [];
  }
  const out: string[] = [];
  for (const e of entries) {
    const rel = base ? `${base}/${e.name}` : e.name;
    if (e.isDirectory()) out.push(...(await listFiles(dir, rel)));
    else out.push(rel);
  }
  return out;
}

const README = `# Ustadxana theme pack

Edit the files and zip the folder, then upload it in Administration > Appearance > Themes.
Full reference: THEMES.md in the project repository.

- theme.json   name, version, author, description and "settings" (colors, parts, layout, texts...)
- style.css    any css. Hook classes: .bc-login-hero, .bc-login-card, .bc-sidebar, .bc-card, .bc-btn-primary ...
- slots/*.html html blocks: ${["loginHero", "loginAboveForm", "loginBelowForm", "appBanner", "dashboardTop", "sidebarFooter", "appFooter"].join(", ")}
- assets/      images and fonts, use them as url("assets/bg.jpg") or <img src="assets/logo.svg">
- screenshot.png  shown in the theme list (1200x800 works well)
`;

// downloads a pack as a zip; with config it exports the current customization instead of the shipped defaults
export async function buildPackZip(pack: ThemePack, config?: ThemeConfig) {
  const settings = config ?? normalizeTheme(pack.defaults);
  const { slots, ...rest } = settings;
  const out: Zippable = {
    "theme.json": strToU8(
      JSON.stringify(
        {
          name: pack.name,
          slug: pack.slug,
          version: pack.version,
          author: pack.author ?? undefined,
          description: pack.description ?? undefined,
          settings: rest,
        },
        null,
        2,
      ),
    ),
    "style.css": strToU8(pack.css || "/* your css here */\n"),
    "README.md": strToU8(README),
  };
  for (const [k, html] of Object.entries(slots)) if (html.trim()) out[`slots/${k}.html`] = strToU8(html);
  const dir = packDir(pack.id);
  for (const rel of await listFiles(dir)) out[rel] = new Uint8Array(await readFile(path.join(dir, rel)));
  return zipSync(out, { level: 6 });
}
