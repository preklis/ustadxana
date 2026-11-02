export const LOCALES = ["az", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "az";
export const LOCALE_COOKIE = "bc_locale";

export type Messages = Record<string, unknown>;
export type Vars = Record<string, string | number>;
export type TFunction = (key: string, vars?: Vars) => string;

export function isLocale(v: unknown): v is Locale {
  return typeof v === "string" && (LOCALES as readonly string[]).includes(v);
}

function lookup(messages: Messages, key: string): string | undefined {
  let cur: unknown = messages;
  for (const part of key.split(".")) {
    if (cur && typeof cur === "object" && part in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return typeof cur === "string" ? cur : undefined;
}

// falls back to english, then the key itself.
// the theme can override any text by key, and siteName swaps the default "Ustadxana"
// when an admin renamed the site
export function createT(messages: Messages, fallback?: Messages, siteName?: string, overrides?: Record<string, string>): TFunction {
  const rename = siteName && siteName !== "Ustadxana" ? siteName : null;
  return (key, vars) => {
    let s = overrides?.[key] || (lookup(messages, key) ?? (fallback ? lookup(fallback, key) : undefined) ?? key);
    if (rename && !key.startsWith("admin.appearance.")) s = s.replace(/Ustadxana/g, rename);
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
    return s;
  };
}
