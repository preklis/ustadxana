"use client";

import { cn } from "@/lib/utils";
import { useBrand } from "@/components/theme-provider";
import type { Slot } from "@/lib/theme/config";

// html block from the active theme. sanitized on upload/save (lib/theme/sanitize), so no scripts
export function ThemeSlot({ name, className }: { name: Slot; className?: string }) {
  const html = useBrand().slots[name];
  if (!html?.trim()) return null;
  return <div className={cn(`bc-slot bc-slot-${name}`, className)} dangerouslySetInnerHTML={{ __html: html }} />;
}
