"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Globe } from "lucide-react";
import { useI18n } from "@/i18n/client";
import { setLocaleAction } from "@/app/(auth)/actions";
import { cn } from "@/lib/utils";

export function LocaleSwitcher({ className }: { className?: string }) {
  const { locale } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <div className={cn("inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-0.5 text-xs dark:border-slate-700 dark:bg-slate-900", pending && "opacity-60", className)}>
      <Globe className="ml-1.5 h-3.5 w-3.5 text-slate-400" />
      {(["az", "en"] as const).map((l) => (
        <button
          key={l}
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              await setLocaleAction(l);
              router.refresh();
            })
          }
          className={cn(
            "rounded-md px-2 py-1 font-semibold uppercase",
            locale === l ? "bg-brand-600 text-brand-fg" : "text-slate-500 hover:text-slate-900 dark:hover:text-white",
          )}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
