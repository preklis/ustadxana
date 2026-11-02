// site-wide theme config. every theme pack ships one (ThemePack.defaults) and admins customize it
// from /admin/appearance (ThemePack.custom).
// shared by server + client, so no db imports here.
import { z } from "zod";

export const STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;
type Scale = Record<(typeof STEPS)[number], string>;

const HEX = /^#[0-9a-fA-F]{6}$/;
const LOGO_DATA_URL = /^data:image\/(png|jpeg|webp|svg\+xml);base64,[A-Za-z0-9+/=]+$/;
export const MAX_LOGO_BYTES = 256 * 1024;

export const FONTS = ["geist", "noto", "system"] as const;
export const MODES = ["dark", "light", "system"] as const;
export const PATTERNS = ["dots", "grid", "none"] as const;
export const RADII = [0, 0.5, 1, 1.5] as const;
export const LOGIN_LAYOUTS = ["split", "split-reverse", "centered"] as const;
export const CONTENT_WIDTHS = ["normal", "wide", "full"] as const;

// pieces of the ui a theme can switch off
export const PARTS = [
  "loginHero",
  "loginTerminal",
  "loginCommand",
  "loginVersion",
  "loginOrg",
  "loginSubtitle",
  "loginFooter",
  "sidebarTagline",
  "themeToggle",
  "localeSwitcher",
  "pageAnimations",
  "applyBanner",
] as const;
export type Part = (typeof PARTS)[number];

// named spots where a theme can drop its own (sanitized) html
export const SLOTS = ["loginHero", "loginAboveForm", "loginBelowForm", "appBanner", "dashboardTop", "sidebarFooter", "appFooter"] as const;
export type Slot = (typeof SLOTS)[number];

export const MAX_CSS = 200_000;
export const MAX_SLOT_HTML = 20_000;

const text = (max: number) => z.string().trim().max(max);

export const themeSchema = z.object({
  identity: z.object({
    siteName: text(40).min(1),
    accentWord: text(12),
    tagline: text(40),
    orgName: text(80),
    hashtag: text(40),
    logoText: text(3).min(1),
    logo: z
      .string()
      .max(Math.ceil((MAX_LOGO_BYTES * 4) / 3) + 64)
      .regex(LOGO_DATA_URL)
      .nullable(),
    uppercase: z.boolean(),
  }),
  colors: z.object({
    accent: z.string().regex(HEX),
    neutral: z.string(), // preset key or "#rrggbb" for a custom tint
  }),
  mode: z.object({
    default: z.enum(MODES),
    allowToggle: z.boolean(),
  }),
  font: z.enum(FONTS),
  radius: z.number().refine((n) => (RADII as readonly number[]).includes(n)),
  background: z.object({
    pattern: z.enum(PATTERNS),
    glow: z.boolean(),
  }),
  login: z.object({
    command: text(60),
    versionPill: text(40),
    terminalPath: text(60),
  }),
  layout: z.object({
    login: z.enum(LOGIN_LAYOUTS),
    content: z.enum(CONTENT_WIDTHS),
  }),
  parts: z.object(Object.fromEntries(PARTS.map((p) => [p, z.boolean()])) as Record<Part, z.ZodBoolean>),
  slots: z.object(Object.fromEntries(SLOTS.map((k) => [k, z.string().max(MAX_SLOT_HTML)])) as Record<Slot, z.ZodString>),
  // "admin.users.title" -> "Members". keys are the same ones the code uses with t()
  messages: z.object({
    az: z.record(z.string().max(200), z.string().max(2000)),
    en: z.record(z.string().max(200), z.string().max(2000)),
  }),
  customCss: z.string().max(MAX_CSS),
});

export type ThemeConfig = z.infer<typeof themeSchema>;

export const DEFAULT_THEME: ThemeConfig = {
  identity: {
    siteName: "Ustadxana",
    accentWord: "",
    tagline: "Təlim platforması",
    orgName: "",
    hashtag: "",
    logoText: ">_",
    logo: null,
    uppercase: true,
  },
  colors: { accent: "#0d9488", neutral: "zinc" },
  mode: { default: "dark", allowToggle: true },
  font: "geist",
  radius: 1,
  background: { pattern: "dots", glow: true },
  login: {
    command: "./ustadxana --start",
    versionPill: "v1.0",
    terminalPath: "~/ustadxana",
  },
  layout: { login: "split", content: "normal" },
  parts: Object.fromEntries(PARTS.map((p) => [p, true])) as Record<Part, boolean>,
  slots: Object.fromEntries(SLOTS.map((k) => [k, ""])) as Record<Slot, string>,
  messages: { az: {}, en: {} },
  customCss: "",
};

// fills gaps from older saved versions / partial theme.json files. a broken section falls back
// to its default instead of throwing the whole theme away
export function normalizeTheme(raw: unknown, base: ThemeConfig = DEFAULT_THEME): ThemeConfig {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const out = { ...base } as Record<string, unknown>;
  const shape = themeSchema.shape as Record<string, z.ZodTypeAny>;
  for (const key of Object.keys(shape)) {
    const baseVal = (base as Record<string, unknown>)[key];
    const val = r[key];
    if (val === undefined) continue;
    const candidate =
      baseVal && typeof baseVal === "object" && !Array.isArray(baseVal) && val && typeof val === "object"
        ? key === "messages"
          ? { az: { ...(val as { az?: object }).az }, en: { ...(val as { en?: object }).en } }
          : { ...baseVal, ...val }
        : val;
    const parsed = shape[key].safeParse(candidate);
    if (parsed.success) out[key] = parsed.data;
  }
  return out as ThemeConfig;
}

/* ---------- palettes ---------- */

const scale = (hexes: string[]): Scale => Object.fromEntries(STEPS.map((s, i) => [s, hexes[i]])) as Scale;

// hand tuned scale for the blue preset, used as is when that exact color is picked
const BLUE_SCALE = scale(["#eef3ff", "#dce6ff", "#bfd1ff", "#92b1ff", "#5e88ff", "#2f6bff", "#1f55f0", "#1a44d6", "#1c3aad", "#1d3688", "#152152"]);

export const ACCENT_PRESETS = [
  { key: "blue", hex: "#2f6bff" },
  { key: "emerald", hex: "#10b981" },
  { key: "teal", hex: "#0d9488" },
  { key: "violet", hex: "#7c3aed" },
  { key: "rose", hex: "#e11d48" },
  { key: "orange", hex: "#f97316" },
  { key: "amber", hex: "#f59e0b" },
] as const;

export const NEUTRAL_PRESETS: Record<string, Scale> = {
  navy: scale(["#f5f7fc", "#ebeff8", "#d9dfee", "#b7c1da", "#8592b3", "#5f6b8c", "#465172", "#2e3856", "#1a2240", "#0f1529", "#080c19"]),
  slate: scale(["#f8fafc", "#f1f5f9", "#e2e8f0", "#cbd5e1", "#94a3b8", "#64748b", "#475569", "#334155", "#1e293b", "#0f172a", "#020617"]),
  zinc: scale(["#fafafa", "#f4f4f5", "#e4e4e7", "#d4d4d8", "#a1a1aa", "#71717a", "#52525b", "#3f3f46", "#27272a", "#18181b", "#09090b"]),
  neutral: scale(["#fafafa", "#f5f5f5", "#e5e5e5", "#d4d4d4", "#a3a3a3", "#737373", "#525252", "#404040", "#262626", "#171717", "#0a0a0a"]),
  stone: scale(["#fafaf9", "#f5f5f4", "#e7e5e4", "#d6d3d1", "#a8a29e", "#78716c", "#57534e", "#44403c", "#292524", "#1c1917", "#0c0a09"]),
};

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex([r, g, b]: number[]) {
  return `#${[r, g, b].map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0")).join("")}`;
}

function rgbToHsl([r, g, b]: number[]): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l * 100];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h *= 60;
  return [h, s * 100, l * 100];
}

function hslToHex(h: number, s: number, l: number) {
  s /= 100;
  l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return rgbToHex([f(0) * 255, f(8) * 255, f(4) * 255]);
}

// keeps the picked color as 500 and walks lightness up/down from it
export function accentScale(hex: string): Scale {
  if (hex.toLowerCase() === "#2f6bff") return BLUE_SCALE;
  const [h, s, l] = rgbToHsl(hexToRgb(hex));
  const up: Record<number, number> = { 50: 0.94, 100: 0.87, 200: 0.74, 300: 0.55, 400: 0.3 };
  const down: Record<number, number> = { 600: 0.12, 700: 0.25, 800: 0.38, 900: 0.5, 950: 0.66 };
  return Object.fromEntries(
    STEPS.map((step) => {
      if (step === 500) return [step, hex.toLowerCase()];
      if (step < 500) return [step, hslToHex(h, Math.min(100, s * (1 - up[step] * 0.15)), l + (97.5 - l) * up[step])];
      return [step, hslToHex(h, s, l * (1 - down[step]))];
    }),
  ) as Scale;
}

// low saturation grays leaning toward the given hue
export function tintedNeutral(hex: string): Scale {
  const [h] = rgbToHsl(hexToRgb(hex));
  const L = [97.5, 94.5, 89, 79, 62, 46, 36, 26, 17, 11, 6.5];
  const S = [30, 28, 25, 22, 16, 16, 20, 28, 40, 45, 52];
  return scale(L.map((l, i) => hslToHex(h, S[i], l)));
}

export function neutralScale(neutral: string): Scale {
  if (HEX.test(neutral)) return tintedNeutral(neutral);
  return NEUTRAL_PRESETS[neutral] ?? NEUTRAL_PRESETS.navy;
}

function luminance(hex: string) {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

const channels = (hex: string) => hexToRgb(hex).join(" ");

const FONT_VARS: Record<(typeof FONTS)[number], string> = {
  geist: "var(--font-geist-sans)",
  noto: "var(--font-noto)",
  system: '"Segoe UI", system-ui, -apple-system, Roboto, sans-serif',
};

// every css custom property the theme controls. used for the <style> tag and the live preview
export function themeVars(theme: ThemeConfig): Record<string, string> {
  const brand = accentScale(theme.colors.accent);
  const gray = neutralScale(theme.colors.neutral);
  const vars: Record<string, string> = {};
  for (const s of STEPS) {
    vars[`--brand-${s}`] = channels(brand[s]);
    vars[`--slate-${s}`] = channels(gray[s]);
  }
  // white text on light accents (amber, lime...) is unreadable
  vars["--brand-fg"] = luminance(brand[500]) > 0.45 ? channels(gray[950]) : "255 255 255";
  vars["--font-body"] = FONT_VARS[theme.font];
  vars["--radius-scale"] = String(theme.radius);
  return vars;
}

export function themeCss(theme: ThemeConfig) {
  const body = Object.entries(themeVars(theme))
    .map(([k, v]) => `${k}:${v}`)
    .join(";");
  return `:root{${body}}`;
}

export function themeColorMeta(theme: ThemeConfig) {
  return neutralScale(theme.colors.neutral)[950];
}

// what client components need (logo, names, mode rules, parts, slots)
export type Brand = ThemeConfig["identity"] &
  Pick<ThemeConfig, "login" | "mode" | "parts" | "layout"> & { slots: Record<Slot, string> };
export const brandOf = (t: ThemeConfig, slots?: Record<Slot, string>): Brand => ({
  ...t.identity,
  login: t.login,
  mode: t.mode,
  parts: t.parts,
  layout: t.layout,
  slots: slots ?? t.slots,
});

export const THEME_STORAGE_KEY = "bc_theme";

// runs in <head> before paint so there is no light/dark flash
export function modeScript(mode: ThemeConfig["mode"]) {
  return `try{var d=${JSON.stringify(mode.default)},a=${mode.allowToggle ? "true" : "false"},s=null;try{s=localStorage.getItem('${THEME_STORAGE_KEY}')}catch(e){}var m=a&&(s==='light'||s==='dark')?s:d;if(m==='system')m=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';document.documentElement.classList.toggle('dark',m==='dark')}catch(e){}`;
}
