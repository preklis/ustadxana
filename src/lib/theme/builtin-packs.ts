// themes that ship with the app. seeded into ThemePack (builtIn = true), can't be deleted.
// also good examples for people writing their own packs (see THEMES.md)
import type { PrismaClient } from "@prisma/client";
import { DEFAULT_THEME, normalizeTheme, type ThemeConfig } from "./config";

export type BuiltinPack = {
  slug: string;
  name: string;
  version: string;
  author: string;
  description: string;
  css: string;
  defaults: ThemeConfig;
};

const off = { loginTerminal: false, loginCommand: false, loginVersion: false };

export const BUILTIN_PACKS: BuiltinPack[] = [
  {
    slug: "ustadxana",
    name: "Ustadxana",
    version: "1.0.0",
    author: "Ustadxana",
    description: "Default look: dark zinc, teal accent and a small terminal on the sign-in page.",
    css: "",
    defaults: DEFAULT_THEME,
  },
  {
    slug: "clean",
    name: "Clean",
    version: "1.0.0",
    author: "Ustadxana",
    description: "Light and calm. No terminal, flat colored login panel, quiet cards.",
    defaults: normalizeTheme({
      identity: { ...DEFAULT_THEME.identity, uppercase: false },
      colors: { accent: "#2563eb", neutral: "slate" },
      mode: { default: "light", allowToggle: true },
      radius: 0.5,
      background: { pattern: "none", glow: false },
      layout: { login: "split-reverse", content: "normal" },
      parts: { ...DEFAULT_THEME.parts, ...off, loginFooter: false },
    }),
    css: `/* Clean: flat accent login panel, no shadows */
.bc-login-hero {
  background: rgb(var(--brand-600));
  border: 0;
}
.bc-login-hero .bc-hero-bg { display: none; }
.bc-login-title { font-weight: 800; letter-spacing: -0.03em; }
.bc-login-title .bc-accent { color: rgb(255 255 255 / 0.65); }
.bc-login-subtitle { color: rgb(255 255 255 / 0.8); }
.bc-card { box-shadow: none; }
.bc-sidebar { background: rgb(var(--slate-50)); }
.dark .bc-sidebar { background: rgb(var(--slate-900)); }
`,
  },
  {
    slug: "campus",
    name: "Campus",
    version: "1.0.0",
    author: "Ustadxana",
    description: "Centered sign-in card, warm stone grays, emerald accent and soft rounded corners.",
    defaults: normalizeTheme({
      identity: { ...DEFAULT_THEME.identity, uppercase: false, accentWord: "" },
      colors: { accent: "#059669", neutral: "stone" },
      mode: { default: "system", allowToggle: true },
      font: "noto",
      radius: 1.5,
      background: { pattern: "grid", glow: true },
      layout: { login: "centered", content: "wide" },
      parts: { ...DEFAULT_THEME.parts, ...off },
      slots: {
        ...DEFAULT_THEME.slots,
        appFooter: '<p class="campus-footer">Ustadxana</p>',
      },
      messages: {
        az: { "auth.login.subtitle": "Xoş gəlmisiniz! Hesabınıza daxil olun." },
        en: { "auth.login.subtitle": "Welcome back! Sign in to your account." },
      },
    }),
    css: `/* Campus: sign-in as a floating card */
.bc-login-card {
  padding: 2rem;
  border-radius: 1.75rem;
  background: rgb(255 255 255 / 0.85);
  border: 1px solid rgb(var(--slate-200));
  box-shadow: 0 30px 60px -30px rgb(var(--slate-900) / 0.35);
  backdrop-filter: blur(8px);
}
.dark .bc-login-card {
  background: rgb(var(--slate-900) / 0.8);
  border-color: rgb(var(--slate-800));
}
.bc-page-title { letter-spacing: -0.01em; }
.campus-footer {
  margin-top: 3rem;
  text-align: center;
  font-size: 12px;
  color: rgb(var(--slate-400));
}
`,
  },
];

export const DEFAULT_PACK_SLUG = "ustadxana";

// installs missing built-ins and refreshes them when the app ships a newer version.
// the admin's customizations (custom) are kept
export async function syncBuiltinPacks(db: PrismaClient) {
  for (const p of BUILTIN_PACKS) {
    const existing = await db.themePack.findUnique({ where: { slug: p.slug } });
    const data = { name: p.name, version: p.version, author: p.author, description: p.description, css: p.css, defaults: p.defaults, builtIn: true };
    if (!existing) await db.themePack.create({ data: { slug: p.slug, ...data } });
    else if (existing.version !== p.version || !existing.builtIn) await db.themePack.update({ where: { slug: p.slug }, data });
  }
  // packs that used to ship with the app become normal packs (can be deleted, kept if in use)
  await db.themePack.updateMany({ where: { builtIn: true, slug: { notIn: BUILTIN_PACKS.map((p) => p.slug) } }, data: { builtIn: false } });
}
