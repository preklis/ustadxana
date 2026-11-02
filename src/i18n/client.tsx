"use client";

import { createContext, useContext, useMemo } from "react";
import { createT, type Locale, type Messages, type TFunction } from "./core";

const Ctx = createContext<{ locale: Locale; t: TFunction } | null>(null);

export function I18nProvider({
  locale,
  messages,
  siteName,
  overrides,
  children,
}: {
  locale: Locale;
  messages: Messages;
  siteName?: string;
  overrides?: Record<string, string>;
  children: React.ReactNode;
}) {
  const value = useMemo(() => ({ locale, t: createT(messages, undefined, siteName, overrides) }), [locale, messages, siteName, overrides]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useI18n outside I18nProvider");
  return v;
}
