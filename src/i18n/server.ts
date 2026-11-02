import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { createT, DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, type Locale } from "./core";
import { MESSAGES } from "./messages";
import { getRenderedTheme } from "@/lib/theme/server";

export const getLocale = cache(async (): Promise<Locale> => {
  const jar = await cookies();
  const v = jar.get(LOCALE_COOKIE)?.value;
  return isLocale(v) ? v : DEFAULT_LOCALE;
});

export const getI18n = cache(async () => {
  const [locale, { theme }] = await Promise.all([getLocale(), getRenderedTheme()]);
  const siteName = theme.identity.siteName;
  const overrides = theme.messages[locale];
  return { locale, siteName, overrides, t: createT(MESSAGES[locale], MESSAGES.en, siteName, overrides), messages: MESSAGES[locale] };
});
