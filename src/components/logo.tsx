"use client";

import { cn } from "@/lib/utils";
import { useBrand } from "@/components/theme-provider";

export function Logo({ className, inverted }: { className?: string; inverted?: boolean }) {
  const brand = useBrand();
  if (brand.logo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={brand.logo} alt={brand.siteName} className={cn("inline-block h-9 w-9 shrink-0 rounded-xl object-contain", className)} />
    );
  }
  return (
    <span
      className={cn(
        "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl font-mono text-sm font-bold tracking-tighter",
        inverted ? "bg-white text-slate-950" : "bg-brand-500 text-brand-fg shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]",
        className,
      )}
    >
      {brand.logoText}
    </span>
  );
}

export function Wordmark({ className, accentClassName = "text-brand-500" }: { className?: string; accentClassName?: string }) {
  const brand = useBrand();
  return (
    <span className={cn("font-extrabold tracking-tight", brand.uppercase && "uppercase", className)}>
      {brand.siteName}
      {brand.accentWord && <span className={accentClassName}> {brand.accentWord}</span>}
    </span>
  );
}

export function Tagline({ className }: { className?: string }) {
  const brand = useBrand();
  if (!brand.tagline) return null;
  return <p className={className}>{brand.tagline}</p>;
}
