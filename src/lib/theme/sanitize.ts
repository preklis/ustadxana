import "server-only";
import sanitizeHtml from "sanitize-html";
import { SLOTS, type Slot, type ThemeConfig } from "./config";

// theme css/html comes from uploaded zips, so treat it as untrusted:
// no scripts, no external requests except google fonts, no css tricks that run code.

export type CssCheck = { ok: true } | { ok: false; reason: string };

const ALLOWED_URL = [
  /^(\.\/)?assets\//i,
  /^\/api\/theme-assets\//i,
  /^data:image\/(png|jpeg|gif|webp|svg\+xml)[;,]/i,
  /^data:(font\/|application\/(x-)?font-)/i,
  /^https:\/\/fonts\.gstatic\.com\//i,
  /^#/, // svg fragment refs
];
const ALLOWED_IMPORT = /^https:\/\/fonts\.googleapis\.com\//i;

// undo css escapes (\75 rl, \:) so they cant hide anything from the checks below
function decodeEscapes(css: string) {
  return css
    .replace(/\\([0-9a-fA-F]{1,6})\s?/g, (_, hex) => {
      const n = parseInt(hex, 16);
      return n > 0 && n < 0x10ffff ? String.fromCodePoint(n) : "";
    })
    .replace(/\\(.)/g, "$1")
    .replace(/\/\*[\s\S]*?\*\//g, "");
}

export function checkCss(css: string): CssCheck {
  if (!css.trim()) return { ok: true };
  const d = decodeEscapes(css);
  const lower = d.toLowerCase();
  for (const bad of ["</style", "<script", "expression(", "javascript:", "vbscript:", "-moz-binding", "behavior:"]) {
    if (lower.replace(/\s+/g, "").includes(bad.replace(/\s+/g, ""))) return { ok: false, reason: bad };
  }
  for (const m of d.matchAll(/@import\s+(?:url\()?\s*['"]?([^'")\s;]+)/gi)) {
    if (!ALLOWED_IMPORT.test(m[1])) return { ok: false, reason: `@import ${m[1]}` };
  }
  for (const m of d.matchAll(/url\(\s*(['"]?)(.*?)\1\s*\)/gi)) {
    const target = m[2].trim();
    if (!ALLOWED_URL.some((re) => re.test(target))) return { ok: false, reason: `url(${target.slice(0, 80)})` };
  }
  // image-set("x.png") / src: "x" without url() are other ways to load things
  if (/image-set\(|-webkit-image-set\(/i.test(d) && /image-set\(\s*['"](?!(\.\/)?assets\/)/i.test(d)) {
    return { ok: false, reason: "image-set" };
  }
  return { ok: true };
}

const STYLE_BAD = /url\s*\(|expression|javascript:|@import|\\/i;

export function cleanHtml(html: string): string {
  if (!html.trim()) return "";
  const out = sanitizeHtml(html, {
    allowedTags: [
      ...sanitizeHtml.defaults.allowedTags,
      "img",
      "h1",
      "h2",
      "span",
      "figure",
      "figcaption",
      "picture",
      "source",
      "svg",
      "path",
      "circle",
      "rect",
      "g",
      "line",
      "polyline",
      "polygon",
    ],
    allowedAttributes: {
      "*": ["class", "style", "id", "title", "role", "aria-*", "data-*"],
      a: ["href", "target", "rel"],
      img: ["src", "srcset", "alt", "width", "height", "loading"],
      source: ["srcset", "type", "media"],
      svg: ["viewBox", "width", "height", "fill", "stroke", "stroke-width", "xmlns"],
      path: ["d", "fill", "stroke", "stroke-width", "stroke-linecap", "stroke-linejoin"],
      circle: ["cx", "cy", "r", "fill", "stroke"],
      rect: ["x", "y", "width", "height", "rx", "fill", "stroke"],
      g: ["fill", "stroke", "transform"],
      line: ["x1", "y1", "x2", "y2", "stroke"],
      polyline: ["points", "fill", "stroke"],
      polygon: ["points", "fill", "stroke"],
    },
    allowedSchemes: ["http", "https", "mailto", "tel"],
    allowedSchemesByTag: { img: ["http", "https", "data"], source: ["http", "https", "data"] },
    allowProtocolRelative: false,
    transformTags: {
      a: (tagName, attribs) => ({
        tagName,
        attribs: attribs.target === "_blank" ? { ...attribs, rel: "noopener noreferrer" } : attribs,
      }),
    },
    parser: { lowerCaseAttributeNames: false },
  });
  // drop inline styles that could load things or run code
  return out.replace(/\sstyle=("([^"]*)"|'([^']*)')/gi, (full, _q, a, b) => (STYLE_BAD.test(a ?? b ?? "") ? "" : full));
}

export function cleanSlots(slots: Partial<Record<Slot, string>>): Record<Slot, string> {
  return Object.fromEntries(SLOTS.map((k) => [k, cleanHtml(slots[k] ?? "")])) as Record<Slot, string>;
}

// "assets/x.png" inside a pack -> the public asset route of that pack
export function resolveAssets(text: string, packId: string, kind: "css" | "html") {
  const base = `/api/theme-assets/${packId}/assets/`;
  if (kind === "css") return text.replace(/url\(\s*(['"]?)(?:\.\/)?assets\//gi, `url($1${base}`);
  return text
    .replace(/(\s(?:src|href)=)(['"])(?:\.\/)?assets\//gi, `$1$2${base}`)
    .replace(/(\ssrcset=)(['"])(?:\.\/)?assets\//gi, `$1$2${base}`);
}

// everything a theme config can carry that ends up in the page, made safe
export function cleanConfig(theme: ThemeConfig): ThemeConfig {
  return { ...theme, slots: cleanSlots(theme.slots) };
}
