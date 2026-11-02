"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { useI18n } from "@/i18n/client";
import { Button } from "@/components/ui/button";
import type { ActionState } from "@/lib/action";

export function ActionButton({
  action,
  label,
  confirmText,
  variant = "ghost",
  size = "sm",
  className,
  icon,
  skipConfirm,
}: {
  action: () => Promise<ActionState | void>;
  label?: React.ReactNode;
  confirmText?: string;
  variant?: React.ComponentProps<typeof Button>["variant"];
  size?: React.ComponentProps<typeof Button>["size"];
  className?: string;
  icon?: React.ReactNode;
  skipConfirm?: boolean;
}) {
  const { t } = useI18n();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="inline-flex flex-col items-start">
      <Button
        variant={variant}
        size={size}
        className={className}
        disabled={pending}
        aria-label={typeof label === "string" ? label : undefined}
        onClick={() => {
          if (!skipConfirm && !window.confirm(confirmText ?? t("common.areYouSure"))) return;
          setError(null);
          start(async () => {
            const res = await action();
            if (res && res.error) setError(res.error);
          });
        }}
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
        {label}
      </Button>
      {error && <span className="mt-1 max-w-xs text-xs font-medium text-red-600 dark:text-red-400">{t(error)}</span>}
    </span>
  );
}
