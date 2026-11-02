"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { THEME_STORAGE_KEY, type Brand, type ThemeConfig } from "@/lib/theme/config";

type Ctx = { brand: Brand; setPreview: (b: Brand | null) => void };
const BrandContext = createContext<Ctx | null>(null);

export function useBrand() {
  const ctx = useContext(BrandContext);
  if (!ctx) throw new Error("useBrand outside ThemeProvider");
  return ctx.brand;
}

// used by the appearance editor to show unsaved changes in the shell
export function useBrandPreview() {
  return useContext(BrandContext)!.setPreview;
}

// same rules as the inline script in the root layout
export function applyMode(mode: ThemeConfig["mode"]) {
  let saved: string | null = null;
  try {
    saved = localStorage.getItem(THEME_STORAGE_KEY);
  } catch {}
  let m: string = mode.allowToggle && (saved === "light" || saved === "dark") ? saved : mode.default;
  if (m === "system") m = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  document.documentElement.classList.toggle("dark", m === "dark");
}

const POLL_MS = 30_000;

export function ThemeProvider({ brand, version, children }: { brand: Brand; version: string; children: React.ReactNode }) {
  const [preview, setPreviewState] = useState<Brand | null>(null);
  const router = useRouter();
  const setPreview = useCallback((b: Brand | null) => setPreviewState(b), []);

  // admin saved a new theme somewhere -> pull it in without a reload
  useEffect(() => {
    let stopped = false;
    async function check() {
      if (document.visibilityState !== "visible") return;
      try {
        const res = await fetch("/api/theme", { cache: "no-store" });
        if (!res.ok) return;
        const { version: latest } = (await res.json()) as { version: string };
        if (!stopped && latest !== version) router.refresh();
      } catch {}
    }
    const id = window.setInterval(check, POLL_MS);
    const onVisible = () => document.visibilityState === "visible" && check();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", check);
    return () => {
      stopped = true;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", check);
    };
  }, [version, router]);

  // mode rules may change with a new theme; also follow the os when on "system"
  const { default: def, allowToggle } = brand.mode;
  useEffect(() => {
    const mode = { default: def, allowToggle };
    applyMode(mode);
    if (def !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyMode(mode);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [def, allowToggle]);

  const value = useMemo(() => ({ brand: preview ?? brand, setPreview }), [preview, brand, setPreview]);
  return <BrandContext.Provider value={value}>{children}</BrandContext.Provider>;
}
