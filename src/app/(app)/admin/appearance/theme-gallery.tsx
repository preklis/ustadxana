"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Check, Download, Eye, FileArchive, Loader2, Paintbrush, Trash2, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n/client";
import { Button, buttonClass } from "@/components/ui/button";
import { Badge, Card } from "@/components/ui/primitives";
import { FormMessage } from "@/components/ui/form";
import { useFormAction } from "@/components/ui/use-form-action";
import { accentScale, neutralScale } from "@/lib/theme/config";
import type { ActionState } from "@/lib/action";
import { activatePackAction, deletePackAction, previewPackAction, uploadPackAction } from "./actions";

export type PackCard = {
  id: string;
  slug: string;
  name: string;
  version: string;
  author: string | null;
  description: string | null;
  builtIn: boolean;
  customized: boolean;
  active: boolean;
  screenshot: string | null;
  updatedAt: string;
  preview: { accent: string; neutral: string; mode: string; radius: number; login: string; terminal: boolean };
};

export function ThemeGallery({ packs, starterUrl }: { packs: PackCard[]; starterUrl: string | null }) {
  const { t } = useI18n();
  const [result, setResult] = useState<ActionState>(null);
  const active = packs.find((p) => p.active);
  const rest = packs.filter((p) => !p.active);

  return (
    <div className="space-y-8">
      <UploadPanel starterUrl={starterUrl} />
      <FormMessage state={result} />

      {active && (
        <section>
          <p className="mb-3 font-mono text-[11px] lowercase text-slate-400">{"// "}{t("admin.appearance.packs.activeTitle")}</p>
          <PackTile pack={active} onResult={setResult} wide />
        </section>
      )}

      <section>
        <p className="mb-3 font-mono text-[11px] lowercase text-slate-400">
          {"// "}
          {t("admin.appearance.packs.installed", { count: packs.length })}
        </p>
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {rest.map((p) => (
            <PackTile key={p.id} pack={p} onResult={setResult} />
          ))}
        </div>
      </section>
    </div>
  );
}

function UploadPanel({ starterUrl }: { starterUrl: string | null }) {
  const { t } = useI18n();
  const fileRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [fileName, setFileName] = useState("");
  const [drag, setDrag] = useState(false);
  const { state, pending, onSubmit } = useFormAction(uploadPackAction, { onOk: () => setFileName("") });

  const pick = (files: FileList | null) => {
    if (!files?.[0] || !fileRef.current) return;
    const dt = new DataTransfer();
    dt.items.add(files[0]);
    fileRef.current.files = dt.files;
    setFileName(files[0].name);
  };

  return (
    <Card className="overflow-hidden">
      <form ref={formRef} onSubmit={onSubmit} className="grid gap-5 p-5 md:grid-cols-[1fr_auto] md:items-center">
        <label
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            pick(e.dataTransfer.files);
          }}
          className={cn(
            "flex cursor-pointer items-center gap-4 rounded-xl border-2 border-dashed p-4 transition",
            drag ? "border-brand-500 bg-brand-50 dark:bg-brand-500/10" : "border-slate-200 hover:border-slate-300 dark:border-slate-700",
          )}
        >
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">
            <FileArchive className="h-6 w-6" />
          </span>
          <span className="min-w-0">
            <span className="block font-semibold">{fileName || t("admin.appearance.packs.uploadTitle")}</span>
            <span className="block text-sm text-slate-500">{t("admin.appearance.packs.uploadHint")}</span>
          </span>
          <input ref={fileRef} type="file" name="pack" accept=".zip,application/zip" className="hidden" onChange={(e) => pick(e.target.files)} />
        </label>
        <div className="flex flex-wrap gap-2">
          {starterUrl && (
            <a href={starterUrl} className={buttonClass("ghost", "md")}>
              <Download className="h-4 w-4" />
              {t("admin.appearance.packs.starter")}
            </a>
          )}
          <Button type="submit" disabled={!fileName || pending}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {t("admin.appearance.packs.install")}
          </Button>
        </div>
      </form>
      {state && (
        <div className="border-t border-slate-100 px-5 py-3 dark:border-slate-800">
          <FormMessage state={state} />
          {state.ok && state.data?.name && <p className="mt-1 text-sm text-slate-500">{state.data.name}</p>}
          {!state.ok && state.data?.detail && <p className="mt-1 font-mono text-xs text-red-500">{state.data.detail}</p>}
        </div>
      )}
    </Card>
  );
}

function PackTile({ pack, onResult, wide }: { pack: PackCard; onResult: (s: ActionState) => void; wide?: boolean }) {
  const { t } = useI18n();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<ActionState | void>) =>
    start(async () => {
      const res = await fn();
      if (res) onResult(res);
    });

  return (
    <Card className={cn("group overflow-hidden", wide && "md:grid md:grid-cols-[minmax(0,420px)_1fr]")}>
      <div className="relative aspect-[3/2] overflow-hidden border-b border-slate-100 bg-slate-100 dark:border-slate-800 dark:bg-slate-900 md:border-b-0">
        {pack.screenshot ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={pack.screenshot} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.02]" />
        ) : (
          <MiniMock p={pack.preview} />
        )}
        {pack.active && (
          <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-emerald-500 px-2.5 py-1 text-xs font-semibold text-white shadow">
            <Check className="h-3.5 w-3.5" />
            {t("admin.appearance.packs.active")}
          </span>
        )}
      </div>
      <div className="flex flex-col p-5">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-lg font-bold tracking-tight">{pack.name}</h3>
          <span className="font-mono text-xs text-slate-400">v{pack.version}</span>
          {pack.builtIn && <Badge>{t("admin.appearance.packs.builtIn")}</Badge>}
          {pack.customized && <Badge tone="blue">{t("admin.appearance.packs.customized")}</Badge>}
        </div>
        {pack.author && <p className="mt-0.5 text-xs text-slate-500">{t("admin.appearance.packs.by", { author: pack.author })}</p>}
        {pack.description && <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{pack.description}</p>}

        <div className="mt-auto flex flex-wrap gap-2 pt-5">
          {pack.active ? (
            <Link href="/admin/appearance?tab=customize" className={buttonClass("primary", "sm")}>
              <Paintbrush className="h-4 w-4" />
              {t("admin.appearance.packs.customize")}
            </Link>
          ) : (
            <>
              <Button size="sm" disabled={pending} onClick={() => run(() => activatePackAction(pack.id))}>
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                {t("admin.appearance.packs.activate")}
              </Button>
              <form action={previewPackAction.bind(null, pack.id)}>
                <Button type="submit" size="sm" variant="outline">
                  <Eye className="h-4 w-4" />
                  {t("admin.appearance.packs.preview")}
                </Button>
              </form>
            </>
          )}
          <a href={`/api/themes/${pack.id}/download${pack.customized ? "?current=1" : ""}`} className={buttonClass("ghost", "sm")} title={t("admin.appearance.packs.downloadHint")}>
            <Download className="h-4 w-4" />
            {t("admin.appearance.packs.download")}
          </a>
          {!pack.builtIn && !pack.active && (
            <Button
              size="sm"
              variant="ghost"
              className="text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
              disabled={pending}
              onClick={() => {
                if (window.confirm(t("admin.appearance.packs.deleteConfirm", { name: pack.name }))) run(() => deletePackAction(pack.id));
              }}
            >
              <Trash2 className="h-4 w-4" />
              {t("common.delete")}
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

// drawn from the pack colors when it has no screenshot.png
function MiniMock({ p }: { p: PackCard["preview"] }) {
  const b = accentScale(p.accent);
  const n = neutralScale(p.neutral);
  const dark = p.mode !== "light";
  const bg = dark ? n[950] : n[50];
  const panel = dark ? n[900] : "#ffffff";
  const line = dark ? n[800] : n[200];
  const r = (x: number) => `${x * p.radius}px`;
  return (
    <div className="flex h-full w-full" style={{ background: bg }}>
      {p.login !== "centered" ? (
        <div className="flex w-[46%] flex-col justify-end gap-1.5 p-4" style={{ background: n[950], order: p.login === "split-reverse" ? 2 : 0 }}>
          {p.terminal && <div className="mb-auto h-10 border" style={{ borderColor: n[700], background: n[900], borderRadius: r(6) }} />}
          <div className="h-2 w-1/2" style={{ background: n[400], borderRadius: r(2) }} />
          <div className="h-5 w-4/5" style={{ background: "#ffffff", borderRadius: r(3) }} />
          <div className="h-5 w-1/4" style={{ background: b[500], borderRadius: r(3) }} />
        </div>
      ) : null}
      <div className="flex flex-1 items-center justify-center p-5">
        <div className="w-full max-w-[170px] space-y-2 p-3" style={{ background: panel, border: `1px solid ${line}`, borderRadius: r(10) }}>
          <div className="h-2.5 w-1/2" style={{ background: dark ? n[200] : n[800], borderRadius: r(2) }} />
          <div className="h-5" style={{ background: bg, border: `1px solid ${line}`, borderRadius: r(5) }} />
          <div className="h-5" style={{ background: bg, border: `1px solid ${line}`, borderRadius: r(5) }} />
          <div className="h-5" style={{ background: b[500], borderRadius: r(5) }} />
        </div>
      </div>
    </div>
  );
}
