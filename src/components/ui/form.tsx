"use client";

import { forwardRef } from "react";
import { useFormStatus } from "react-dom";
import { Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n/client";
import type { ActionState } from "@/lib/action";
import { Button } from "./button";

export const inputClass =
  "bc-input block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100";

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...props },
  ref,
) {
  return <input ref={ref} className={cn(inputClass, "h-10", className)} {...props} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, rows = 4, ...props }, ref) {
    return <textarea ref={ref} rows={rows} className={cn(inputClass, "resize-y", className)} {...props} />;
  },
);

export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className, ...props },
  ref,
) {
  return <select ref={ref} className={cn(inputClass, "h-10 pr-8", className)} {...props} />;
});

export function Field({
  label,
  name,
  hint,
  state,
  required,
  children,
  className,
}: {
  label?: React.ReactNode;
  name?: string;
  hint?: React.ReactNode;
  state?: ActionState;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  const { t } = useI18n();
  const err = name ? state?.fieldErrors?.[name] : undefined;
  return (
    <div className={cn("space-y-1.5", className)}>
      {label && (
        <label htmlFor={name} className="block text-sm font-medium text-slate-700 dark:text-slate-300">
          {label}
          {required && <span className="ml-0.5 text-red-500">*</span>}
        </label>
      )}
      {children}
      {hint && !err && <p className="text-xs text-slate-500">{hint}</p>}
      {err && <p className="text-xs font-medium text-red-600">{t(err)}</p>}
    </div>
  );
}

export function SubmitButton({
  children,
  pendingText,
  variant,
  size,
  className,
  disabled,
  pending: pendingProp,
}: {
  children: React.ReactNode;
  pendingText?: string;
  variant?: React.ComponentProps<typeof Button>["variant"];
  size?: React.ComponentProps<typeof Button>["size"];
  className?: string;
  disabled?: boolean;
  // set this with useFormAction, useFormStatus cant see onSubmit submits
  pending?: boolean;
}) {
  const status = useFormStatus();
  const pending = pendingProp ?? status.pending;
  return (
    <Button type="submit" variant={variant} size={size} className={className} disabled={pending || disabled}>
      {pending && <Loader2 className="h-4 w-4 animate-spin" />}
      {pending && pendingText ? pendingText : children}
    </Button>
  );
}

export function FormMessage({ state, className }: { state: ActionState; className?: string }) {
  const { t } = useI18n();
  if (!state) return null;
  if (state.error)
    return (
      <div className={cn("flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300", className)}>
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
        <span>{t(state.error)}</span>
      </div>
    );
  if (state.ok && state.message)
    return (
      <div className={cn("flex items-start gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300", className)}>
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
        <span>{t(state.message)}</span>
      </div>
    );
  return null;
}

export function Checkbox({ label, className, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: React.ReactNode }) {
  return (
    <label className={cn("flex cursor-pointer items-center gap-2 text-sm text-slate-700 dark:text-slate-300", className)}>
      <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500" {...props} />
      <span>{label}</span>
    </label>
  );
}
