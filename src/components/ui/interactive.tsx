"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { Loader2, Paperclip, X } from "lucide-react";
import { cn, formatBytes } from "@/lib/utils";
import { useI18n } from "@/i18n/client";
import { Button } from "./button";

export function Modal({
  open,
  onClose,
  title,
  children,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);
  if (!open || !mounted) return null;
  const width = { sm: "max-w-sm", md: "max-w-lg", lg: "max-w-2xl", xl: "max-w-4xl" }[size];
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 backdrop-blur-sm sm:items-center" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        className={cn("w-full rounded-xl bg-white shadow-xl dark:bg-slate-900", width)}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{title}</h2>
          <button onClick={onClose} className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

export function ModalTrigger({
  label,
  title,
  variant = "primary",
  size = "md",
  modalSize,
  children,
  icon,
}: {
  label: React.ReactNode;
  title: React.ReactNode;
  variant?: React.ComponentProps<typeof Button>["variant"];
  size?: React.ComponentProps<typeof Button>["size"];
  modalSize?: "sm" | "md" | "lg" | "xl";
  icon?: React.ReactNode;
  children: (close: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant={variant} size={size} onClick={() => setOpen(true)}>
        {icon}
        {label}
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title={title} size={modalSize}>
        {children(() => setOpen(false))}
      </Modal>
    </>
  );
}

export function ConfirmAction({
  action,
  label,
  confirmText,
  variant = "ghost",
  size = "sm",
  className,
  icon,
  skipConfirm,
}: {
  action: () => Promise<unknown>;
  label: React.ReactNode;
  confirmText?: string;
  variant?: React.ComponentProps<typeof Button>["variant"];
  size?: React.ComponentProps<typeof Button>["size"];
  className?: string;
  icon?: React.ReactNode;
  skipConfirm?: boolean;
}) {
  const { t } = useI18n();
  const [pending, start] = useTransition();
  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      disabled={pending}
      onClick={() => {
        if (!skipConfirm && !window.confirm(confirmText ?? t("common.areYouSure"))) return;
        start(async () => {
          await action();
        });
      }}
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      {label}
    </Button>
  );
}

export function FileInput({ name = "files", multiple = true, accept, maxMb }: { name?: string; multiple?: boolean; accept?: string; maxMb?: number }) {
  const { t } = useI18n();
  const ref = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [drag, setDrag] = useState(false);

  function sync(list: FileList | null) {
    if (!list || !ref.current) return;
    const dt = new DataTransfer();
    const merged = multiple ? [...files, ...Array.from(list)] : Array.from(list).slice(0, 1);
    merged.forEach((f) => dt.items.add(f));
    ref.current.files = dt.files;
    setFiles(merged);
  }
  function removeAt(i: number) {
    if (!ref.current) return;
    const next = files.filter((_, idx) => idx !== i);
    const dt = new DataTransfer();
    next.forEach((f) => dt.items.add(f));
    ref.current.files = dt.files;
    setFiles(next);
  }

  return (
    <div>
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          sync(e.dataTransfer.files);
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed px-4 py-5 text-center text-sm transition",
          drag ? "border-brand-500 bg-brand-50 dark:bg-brand-950/30" : "border-slate-300 hover:border-brand-400 dark:border-slate-700",
        )}
      >
        <Paperclip className="h-5 w-5 text-slate-400" />
        <span className="text-slate-600 dark:text-slate-300">{t("common.dropFiles")}</span>
        {maxMb && <span className="text-xs text-slate-400">{t("common.maxFileSize", { mb: maxMb })}</span>}
        <input
          ref={ref}
          type="file"
          name={name}
          multiple={multiple}
          accept={accept}
          className="sr-only"
          onChange={(e) => {
            // input already has the new files, merge with the previous ones
            const chosen = e.target.files;
            if (!chosen) return;
            const dt = new DataTransfer();
            const merged = multiple ? [...files, ...Array.from(chosen)] : Array.from(chosen).slice(0, 1);
            merged.forEach((f) => dt.items.add(f));
            e.target.files = dt.files;
            setFiles(merged);
          }}
        />
      </label>
      {files.length > 0 && (
        <ul className="mt-2 space-y-1">
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`} className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-1.5 text-sm dark:bg-slate-800">
              <span className="truncate">{f.name} <span className="text-xs text-slate-400">({formatBytes(f.size)})</span></span>
              <button type="button" onClick={() => removeAt(i)} className="ml-2 text-slate-400 hover:text-red-600">
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
