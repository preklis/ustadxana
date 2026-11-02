"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Download, ImageUp, Loader2, Monitor, Moon, RotateCcw, Search, Sun, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n/client";
import { Button, buttonClass } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/primitives";
import { Field, FormMessage, Input, Textarea } from "@/components/ui/form";
import { useFormAction } from "@/components/ui/use-form-action";
import { Logo, Tagline, Wordmark } from "@/components/logo";
import { useBrandPreview } from "@/components/theme-provider";
import {
  ACCENT_PRESETS,
  CONTENT_WIDTHS,
  FONTS,
  LOGIN_LAYOUTS,
  MAX_CSS,
  PARTS,
  SLOTS,
  MAX_LOGO_BYTES,
  MODES,
  NEUTRAL_PRESETS,
  PATTERNS,
  RADII,
  STEPS,
  accentScale,
  brandOf,
  neutralScale,
  themeVars,
  type ThemeConfig,
} from "@/lib/theme/config";
import { saveThemeAction } from "./actions";

type Section = keyof Pick<ThemeConfig, "identity" | "colors" | "mode" | "background" | "login" | "layout" | "parts" | "slots">;
export type TextEntry = { key: string; az: string; en: string };
const PANELS = ["design", "layout", "html", "texts", "css"] as const;
type Panel = (typeof PANELS)[number];

const assetUrl = (text: string, packId: string, kind: "css" | "html") =>
  kind === "css"
    ? text.replace(/url\(\s*(['"]?)(?:\.\/)?assets\//gi, `url($1/api/theme-assets/${packId}/assets/`)
    : text.replace(/(\s(?:src|href|srcset)=)(['"])(?:\.\/)?assets\//gi, `$1$2/api/theme-assets/${packId}/assets/`);

export function AppearanceEditor({
  initial,
  packId,
  packName,
  packCss,
  packDefaults,
  customized,
  texts,
}: {
  initial: ThemeConfig;
  packId: string;
  packName: string;
  packCss: string;
  packDefaults: ThemeConfig;
  customized: boolean;
  texts: TextEntry[];
}) {
  const { t } = useI18n();
  const [theme, setTheme] = useState<ThemeConfig>(initial);
  const [saved, setSaved] = useState<ThemeConfig>(initial);
  const [notice, setNotice] = useState<string | null>(null);
  const [panel, setPanel] = useState<Panel>("design");
  const dirty = useMemo(() => JSON.stringify(theme) !== JSON.stringify(saved), [theme, saved]);
  const justSaved = useRef(false);
  const { state, pending, onSubmit } = useFormAction(saveThemeAction, {
    onOk: () => {
      justSaved.current = true;
      setSaved(theme);
    },
  });

  // new server value (e.g. another admin published) -> follow it when nothing is being edited
  useEffect(() => {
    // after a save the server copy wins (html blocks come back sanitized)
    const follow = justSaved.current;
    justSaved.current = false;
    setSaved(initial);
    setTheme((cur) => (follow || JSON.stringify(cur) === JSON.stringify(saved) ? initial : cur));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial]);

  useLivePreview(theme, saved, packId, packCss);

  function set<S extends Section>(section: S, patch: Partial<ThemeConfig[S]>) {
    setTheme((cur) => ({ ...cur, [section]: { ...cur[section], ...patch } }));
  }

  return (
    <form onSubmit={onSubmit} className="pb-28">
      <input type="hidden" name="theme" value={JSON.stringify(theme)} />
      <input type="hidden" name="packId" value={packId} />
      <p className="mb-4 text-sm text-slate-500">
        {t("admin.appearance.editingPack", { name: packName })}
        {customized && <span className="ml-2 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">{t("admin.appearance.packs.customized")}</span>}
      </p>
      <div className="sticky top-14 z-20 -mx-1 mb-6 overflow-x-auto px-1 py-1 lg:top-2">
        <div className="inline-flex gap-1 rounded-xl border border-slate-200 bg-white/90 p-1 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
          {PANELS.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setPanel(k)}
              className={cn(
                "whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition",
                panel === k ? "bg-brand-500 text-brand-fg" : "text-slate-500 hover:text-slate-900 dark:hover:text-white",
              )}
            >
              {t(`admin.appearance.panels.${k}`)}
            </button>
          ))}
        </div>
      </div>
      <div className="mb-4 space-y-2">
        <FormMessage state={state} />
        {notice && (
          <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{t(notice)}</div>
        )}
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">
          {panel === "design" && (
            <>
          <IdentitySection theme={theme} set={set} onError={setNotice} />
          <ColorsSection theme={theme} set={set} />
          <Card>
            <CardHeader title={t("admin.appearance.sections.mode")} />
            <CardBody className="space-y-5">
              <Field label={t("admin.appearance.mode.default")}>
                <Segmented
                  value={theme.mode.default}
                  options={MODES.map((m) => ({
                    value: m,
                    label: t(`admin.appearance.mode.${m}`),
                    icon: m === "dark" ? <Moon className="h-4 w-4" /> : m === "light" ? <Sun className="h-4 w-4" /> : <Monitor className="h-4 w-4" />,
                  }))}
                  onChange={(v) => set("mode", { default: v })}
                />
              </Field>
              <Switch
                checked={theme.mode.allowToggle}
                onChange={(v) => set("mode", { allowToggle: v })}
                label={t("admin.appearance.mode.allowToggle")}
                hint={t("admin.appearance.mode.allowToggleHint")}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title={t("admin.appearance.sections.typography")} />
            <CardBody className="space-y-5">
              <Field label={t("admin.appearance.typography.font")}>
                <div className="grid gap-2 sm:grid-cols-3">
                  {FONTS.map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setTheme((c) => ({ ...c, font: f }))}
                      className={cn(
                        "rounded-xl border p-3 text-left transition active:scale-[0.98]",
                        theme.font === f
                          ? "border-brand-500 bg-brand-50 dark:bg-brand-500/10"
                          : "border-slate-200 hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-600",
                      )}
                    >
                      <span
                        className="block text-2xl font-bold"
                        style={{ fontFamily: f === "geist" ? "var(--font-geist-sans)" : f === "noto" ? "var(--font-noto)" : "system-ui" }}
                      >
                        Aa Əə
                      </span>
                      <span className="mt-1 block text-xs text-slate-500">{t(`admin.appearance.typography.fonts.${f}`)}</span>
                    </button>
                  ))}
                </div>
              </Field>
              <Field label={t("admin.appearance.typography.radius")}>
                <div className="grid grid-cols-4 gap-2">
                  {RADII.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setTheme((c) => ({ ...c, radius: r }))}
                      className={cn(
                        "flex flex-col items-center gap-2 border p-3 text-xs transition active:scale-[0.98]",
                        theme.radius === r
                          ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-white"
                          : "border-slate-200 text-slate-500 hover:border-slate-300 dark:border-slate-700",
                      )}
                      style={{ borderRadius: `${0.75 * r}rem` }}
                    >
                      <span className="h-6 w-10 border-2 border-current" style={{ borderRadius: `${0.5 * r}rem` }} />
                      {t(`admin.appearance.typography.radii.r${String(r).replace(".", "_")}`)}
                    </button>
                  ))}
                </div>
              </Field>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title={t("admin.appearance.sections.background")} />
            <CardBody className="space-y-5">
              <Field label={t("admin.appearance.background.pattern")}>
                <Segmented
                  value={theme.background.pattern}
                  options={PATTERNS.map((p) => ({ value: p, label: t(`admin.appearance.background.patterns.${p}`) }))}
                  onChange={(v) => set("background", { pattern: v })}
                />
              </Field>
              <Switch checked={theme.background.glow} onChange={(v) => set("background", { glow: v })} label={t("admin.appearance.background.glow")} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title={t("admin.appearance.sections.login")} description={t("admin.appearance.login.hint")} />
            <CardBody className="grid gap-4 sm:grid-cols-2">
              <Field label={t("admin.appearance.login.command")} name="login.command">
                <Input value={theme.login.command} maxLength={60} onChange={(e) => set("login", { command: e.target.value })} className="font-mono" />
              </Field>
              <Field label={t("admin.appearance.login.versionPill")}>
                <Input value={theme.login.versionPill} maxLength={40} onChange={(e) => set("login", { versionPill: e.target.value })} className="font-mono" />
              </Field>
              <Field label={t("admin.appearance.login.terminalPath")} className="sm:col-span-2">
                <Input value={theme.login.terminalPath} maxLength={60} onChange={(e) => set("login", { terminalPath: e.target.value })} className="font-mono" />
              </Field>
            </CardBody>
          </Card>

            </>
          )}
          {panel === "layout" && <LayoutPanel theme={theme} set={set} />}
          {panel === "html" && <HtmlPanel theme={theme} set={set} />}
          {panel === "texts" && <TextsPanel theme={theme} texts={texts} onChange={(messages) => setTheme((c) => ({ ...c, messages }))} />}
          {panel === "css" && <CssPanel theme={theme} packCss={packCss} onChange={(customCss) => setTheme((c) => ({ ...c, customCss }))} state={state} />}

          <Tools packId={packId} customized={customized} onRestore={() => setTheme(packDefaults)} />
        </div>

        <Preview theme={theme} />
      </div>

      {/* publish bar */}
      <div
        className={cn(
          "fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/90 backdrop-blur transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] lg:left-64 dark:border-slate-800 dark:bg-slate-950/90",
          dirty || pending ? "translate-y-0" : "translate-y-full",
        )}
      >
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <p className="flex items-center gap-2 text-sm font-medium">
            <span className="h-2 w-2 animate-pulse rounded-full bg-amber-500" />
            {t("admin.appearance.unsaved")}
          </p>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setTheme(saved)} disabled={pending}>
              {t("admin.appearance.discard")}
            </Button>
            <Button type="submit" disabled={pending || !dirty}>
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              {pending ? t("admin.appearance.publishing") : t("admin.appearance.publish")}
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
}

/* ---------- live preview on the admin's own screen ---------- */

function useLivePreview(theme: ThemeConfig, saved: ThemeConfig, packId: string, packCss: string) {
  const setBrand = useBrandPreview();
  const applied = useRef<string[]>([]);
  const savedRef = useRef(saved);
  savedRef.current = saved;
  useEffect(() => {
    const root = document.documentElement;
    const vars = themeVars(theme);
    for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v);
    applied.current = Object.keys(vars);
    root.dataset.pattern = theme.background.pattern;
    root.dataset.glow = theme.background.glow ? "on" : "off";
    root.dataset.content = theme.layout.content;
    root.dataset.motion = theme.parts.pageAnimations ? "on" : "off";
    const slots = Object.fromEntries(SLOTS.map((k) => [k, assetUrl(theme.slots[k], packId, "html")])) as ThemeConfig["slots"];
    setBrand(brandOf(theme, slots));

    // swap the published pack css for the edited one while on this page
    const published = document.getElementById("bc-theme-pack") as HTMLStyleElement | null;
    if (published) published.media = "not all";
    let el = document.getElementById("bc-theme-preview-css") as HTMLStyleElement | null;
    if (!el) {
      el = document.createElement("style");
      el.id = "bc-theme-preview-css";
      document.head.appendChild(el);
    }
    el.textContent = assetUrl([packCss, theme.customCss].join("\n"), packId, "css").replace(/<\/style/gi, "");
  }, [theme, setBrand, packId, packCss]);

  // leaving the page drops the unsaved preview, the server <style> takes over again
  useEffect(() => {
    const root = document.documentElement;
    return () => {
      for (const k of applied.current) root.style.removeProperty(k);
      const bg = savedRef.current.background;
      root.dataset.pattern = bg.pattern;
      root.dataset.glow = bg.glow ? "on" : "off";
      root.dataset.content = savedRef.current.layout.content;
      root.dataset.motion = savedRef.current.parts.pageAnimations ? "on" : "off";
      document.getElementById("bc-theme-preview-css")?.remove();
      const published = document.getElementById("bc-theme-pack") as HTMLStyleElement | null;
      if (published) published.media = "all";
      setBrand(null);
    };
  }, [setBrand]);
}

/* ---------- sections ---------- */

type SetFn = <S extends Section>(section: S, patch: Partial<ThemeConfig[S]>) => void;

function IdentitySection({ theme, set, onError }: { theme: ThemeConfig; set: SetFn; onError: (k: string | null) => void }) {
  const { t } = useI18n();
  const fileRef = useRef<HTMLInputElement>(null);
  const id = theme.identity;

  function onLogo(file: File | undefined) {
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp", "image/svg+xml"].includes(file.type)) return onError("admin.appearance.logoInvalid");
    if (file.size > MAX_LOGO_BYTES) return onError("admin.appearance.logoTooBig");
    onError(null);
    const reader = new FileReader();
    reader.onload = () => set("identity", { logo: String(reader.result) });
    reader.readAsDataURL(file);
  }

  return (
    <Card>
      <CardHeader title={t("admin.appearance.sections.identity")} />
      <CardBody className="space-y-5">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-900">
            <Logo className="h-14 w-14 text-lg" />
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{t("admin.appearance.identity.logo")}</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                <ImageUp className="h-4 w-4" />
                {t("admin.appearance.identity.upload")}
              </Button>
              {id.logo && (
                <Button variant="ghost" size="sm" onClick={() => set("identity", { logo: null })}>
                  <Trash2 className="h-4 w-4" />
                  {t("admin.appearance.identity.remove")}
                </Button>
              )}
            </div>
            <p className="text-xs text-slate-500">{t("admin.appearance.identity.logoHint")}</p>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              className="hidden"
              onChange={(e) => {
                onLogo(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("admin.appearance.identity.siteName")} required>
            <Input value={id.siteName} maxLength={40} onChange={(e) => set("identity", { siteName: e.target.value })} />
          </Field>
          <Field label={t("admin.appearance.identity.accentWord")} hint={t("admin.appearance.identity.accentWordHint")}>
            <Input value={id.accentWord} maxLength={12} onChange={(e) => set("identity", { accentWord: e.target.value })} />
          </Field>
          <Field label={t("admin.appearance.identity.tagline")}>
            <Input value={id.tagline} maxLength={40} onChange={(e) => set("identity", { tagline: e.target.value })} />
          </Field>
          <Field label={t("admin.appearance.identity.orgName")}>
            <Input value={id.orgName} maxLength={80} onChange={(e) => set("identity", { orgName: e.target.value })} />
          </Field>
          <Field label={t("admin.appearance.identity.hashtag")}>
            <Input value={id.hashtag} maxLength={40} onChange={(e) => set("identity", { hashtag: e.target.value })} />
          </Field>
          <Field label={t("admin.appearance.identity.logoText")} hint={t("admin.appearance.identity.logoTextHint")} required>
            <Input value={id.logoText} maxLength={3} onChange={(e) => set("identity", { logoText: e.target.value })} className="font-mono" />
          </Field>
        </div>
        <Switch checked={id.uppercase} onChange={(v) => set("identity", { uppercase: v })} label={t("admin.appearance.identity.uppercase")} />
      </CardBody>
    </Card>
  );
}

function ColorsSection({ theme, set }: { theme: ThemeConfig; set: SetFn }) {
  const { t } = useI18n();
  const accent = theme.colors.accent.toLowerCase();
  const isPresetAccent = ACCENT_PRESETS.some((p) => p.hex === accent);
  const neutral = theme.colors.neutral;
  const customNeutral = neutral.startsWith("#");
  const brand = accentScale(theme.colors.accent);
  const gray = neutralScale(neutral);

  return (
    <Card>
      <CardHeader title={t("admin.appearance.sections.colors")} />
      <CardBody className="space-y-6">
        <Field label={t("admin.appearance.colors.accent")} hint={t("admin.appearance.colors.accentHint")}>
          <div className="flex flex-wrap items-center gap-2">
            {ACCENT_PRESETS.map((p) => (
              <Swatch key={p.key} color={p.hex} active={accent === p.hex} title={t(`admin.appearance.colors.presets.${p.key}`)} onClick={() => set("colors", { accent: p.hex })} />
            ))}
            <ColorInput value={accent} active={!isPresetAccent} label={t("admin.appearance.colors.custom")} onChange={(hex) => set("colors", { accent: hex })} />
          </div>
        </Field>

        <Field label={t("admin.appearance.colors.neutral")} hint={t("admin.appearance.colors.neutralHint")}>
          <div className="flex flex-wrap items-center gap-2">
            {Object.entries(NEUTRAL_PRESETS).map(([key, s]) => (
              <button
                key={key}
                type="button"
                onClick={() => set("colors", { neutral: key })}
                className={cn(
                  "flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-sm transition active:scale-[0.98]",
                  neutral === key ? "border-brand-500 ring-2 ring-brand-500/20" : "border-slate-200 hover:border-slate-300 dark:border-slate-700",
                )}
              >
                <span className="flex overflow-hidden rounded-md border border-black/10">
                  {[200, 500, 900].map((st) => (
                    <span key={st} className="h-5 w-3" style={{ background: s[st as 200] }} />
                  ))}
                </span>
                {t(`admin.appearance.colors.neutrals.${key}`)}
              </button>
            ))}
            <ColorInput
              value={customNeutral ? neutral : "#3b4a7a"}
              active={customNeutral}
              label={t("admin.appearance.colors.neutrals.custom")}
              onChange={(hex) => set("colors", { neutral: hex })}
            />
          </div>
        </Field>

        <div>
          <p className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">{t("admin.appearance.colors.palette")}</p>
          <div className="space-y-1.5">
            {[brand, gray].map((s, i) => (
              <div key={i} className="grid grid-cols-11 overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
                {STEPS.map((st) => (
                  <span key={st} className="h-7" style={{ background: s[st] }} title={`${st} ${s[st]}`} />
                ))}
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-500">{t("admin.appearance.colors.contrastNote")}</p>
        </div>
      </CardBody>
    </Card>
  );
}

function Tools({ packId, customized, onRestore }: { packId: string; customized: boolean; onRestore: () => void }) {
  const { t } = useI18n();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          if (window.confirm(t("admin.appearance.restoreConfirm"))) onRestore();
        }}
      >
        <RotateCcw className="h-4 w-4" />
        {t("admin.appearance.restoreDefaults")}
      </Button>
      <a href={`/api/themes/${packId}/download${customized ? "?current=1" : ""}`} className={buttonClass("ghost", "sm")}>
        <Download className="h-4 w-4" />
        {t("admin.appearance.exportPack")}
      </a>
    </div>
  );
}

/* ---------- layout & parts ---------- */

function LayoutPanel({ theme, set }: { theme: ThemeConfig; set: SetFn }) {
  const { t } = useI18n();
  return (
    <>
      <Card>
        <CardHeader title={t("admin.appearance.sections.layout")} />
        <CardBody className="space-y-5">
          <Field label={t("admin.appearance.layout.login")}>
            <div className="grid grid-cols-3 gap-2">
              {LOGIN_LAYOUTS.map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => set("layout", { login: l })}
                  className={cn(
                    "rounded-xl border p-2 text-xs transition active:scale-[0.98]",
                    theme.layout.login === l ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-white" : "border-slate-200 text-slate-500 dark:border-slate-700",
                  )}
                >
                  <span className="mb-2 flex h-12 gap-1 overflow-hidden rounded-md border border-current/20 p-1">
                    {l !== "centered" && <span className={cn("w-1/2 rounded-sm bg-current opacity-30", l === "split-reverse" && "order-2")} />}
                    <span className="flex flex-1 items-center justify-center">
                      <span className="h-6 w-6 rounded-sm border border-current opacity-60" />
                    </span>
                  </span>
                  {t(`admin.appearance.layout.logins.${l}`)}
                </button>
              ))}
            </div>
          </Field>
          <Field label={t("admin.appearance.layout.content")}>
            <Segmented
              value={theme.layout.content}
              options={CONTENT_WIDTHS.map((w) => ({ value: w, label: t(`admin.appearance.layout.contents.${w}`) }))}
              onChange={(v) => set("layout", { content: v })}
            />
          </Field>
        </CardBody>
      </Card>
      <Card>
        <CardHeader title={t("admin.appearance.sections.parts")} description={t("admin.appearance.parts.hint")} />
        <CardBody className="divide-y divide-slate-100 py-0 dark:divide-slate-800">
          {PARTS.map((part) => (
            <div key={part} className="py-3.5">
              <Switch
                checked={theme.parts[part]}
                onChange={(v) => set("parts", { [part]: v } as Partial<ThemeConfig["parts"]>)}
                label={t(`admin.appearance.parts.${part}`)}
                hint={part.startsWith("login") && part !== "loginHero" && (!theme.parts.loginHero || theme.layout.login === "centered") ? t("admin.appearance.parts.needsHero") : undefined}
              />
            </div>
          ))}
        </CardBody>
      </Card>
    </>
  );
}

function HtmlPanel({ theme, set }: { theme: ThemeConfig; set: SetFn }) {
  const { t } = useI18n();
  return (
    <Card>
      <CardHeader title={t("admin.appearance.sections.html")} description={t("admin.appearance.html.hint")} />
      <CardBody className="space-y-5">
        {SLOTS.map((slot) => (
          <Field key={slot} label={t(`admin.appearance.html.slots.${slot}`)} hint={<code className="font-mono">.bc-slot-{slot}</code>}>
            <Textarea
              rows={theme.slots[slot] ? 5 : 2}
              value={theme.slots[slot]}
              spellCheck={false}
              placeholder={'<div class="my-banner">...</div>'}
              onChange={(e) => set("slots", { [slot]: e.target.value } as Partial<ThemeConfig["slots"]>)}
              className="font-mono text-xs"
            />
          </Field>
        ))}
      </CardBody>
    </Card>
  );
}

function TextsPanel({ theme, texts, onChange }: { theme: ThemeConfig; texts: TextEntry[]; onChange: (m: ThemeConfig["messages"]) => void }) {
  const { t } = useI18n();
  const [q, setQ] = useState("");
  const overridden = new Set([...Object.keys(theme.messages.az), ...Object.keys(theme.messages.en)]);
  const query = q.trim().toLowerCase();
  const rows = (query.length >= 2
    ? texts.filter((x) => x.key.toLowerCase().includes(query) || x.az.toLowerCase().includes(query) || x.en.toLowerCase().includes(query))
    : texts.filter((x) => overridden.has(x.key))
  ).slice(0, 60);

  const setText = (lang: "az" | "en", key: string, value: string) => {
    const next = { ...theme.messages[lang] };
    if (value.trim()) next[key] = value;
    else delete next[key];
    onChange({ ...theme.messages, [lang]: next });
  };

  return (
    <Card>
      <CardHeader title={t("admin.appearance.sections.texts")} description={t("admin.appearance.texts.hint")} />
      <CardBody className="space-y-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("admin.appearance.texts.search")} className="pl-9" />
        </div>
        <p className="text-xs text-slate-500">
          {query.length >= 2 ? t("admin.appearance.texts.results", { count: rows.length }) : t("admin.appearance.texts.overridden", { count: overridden.size })}
        </p>
        <div className="space-y-3">
          {rows.map((x) => (
            <div key={x.key} className={cn("rounded-xl border p-3", overridden.has(x.key) ? "border-brand-500/50 bg-brand-50/50 dark:bg-brand-500/5" : "border-slate-200 dark:border-slate-800")}>
              <p className="mb-2 font-mono text-[11px] text-slate-400">{x.key}</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {(["az", "en"] as const).map((lang) => (
                  <label key={lang} className="block">
                    <span className="mb-1 block text-[11px] font-semibold uppercase text-slate-400">{lang}</span>
                    <Input value={theme.messages[lang][x.key] ?? ""} placeholder={x[lang]} onChange={(e) => setText(lang, x.key, e.target.value)} />
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </CardBody>
    </Card>
  );
}

const HOOKS = [
  ".bc-login", ".bc-login-hero", ".bc-hero-bg", ".bc-login-terminal", ".bc-login-command", ".bc-login-title", ".bc-accent",
  ".bc-login-subtitle", ".bc-login-footer", ".bc-login-main", ".bc-login-card", ".bc-app", ".bc-sidebar", ".bc-topbar",
  ".bc-nav", ".bc-nav-item", ".bc-nav-item-active", ".bc-main", ".bc-page-title", ".bc-card", ".bc-card-header", ".bc-btn",
  ".bc-btn-primary", ".bc-input", ".bc-badge", ".bc-slot-*", "[data-theme]", ".dark",
];

function CssPanel({ theme, packCss, onChange, state }: { theme: ThemeConfig; packCss: string; onChange: (css: string) => void; state: ReturnType<typeof useFormAction>["state"] }) {
  const { t } = useI18n();
  return (
    <>
      <Card>
        <CardHeader title={t("admin.appearance.sections.css")} description={t("admin.appearance.css.hint")} />
        <CardBody className="space-y-3">
          <Field name="customCss" state={state} hint={`${theme.customCss.length.toLocaleString()} / ${MAX_CSS.toLocaleString()}`}>
            <Textarea
              rows={16}
              value={theme.customCss}
              spellCheck={false}
              maxLength={MAX_CSS}
              placeholder={".bc-login-hero {\n  background: url(\"assets/hero.jpg\") center / cover;\n}"}
              onChange={(e) => onChange(e.target.value)}
              className="font-mono text-xs leading-relaxed"
            />
          </Field>
          <div>
            <p className="mb-2 text-xs font-medium text-slate-500">{t("admin.appearance.css.hooks")}</p>
            <div className="flex flex-wrap gap-1.5">
              {HOOKS.map((h) => (
                <code key={h} className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  {h}
                </code>
              ))}
            </div>
          </div>
        </CardBody>
      </Card>
      {packCss.trim() && (
        <Card>
          <details>
            <summary className="cursor-pointer px-5 py-4 text-sm font-semibold">{t("admin.appearance.css.packCss")}</summary>
            <pre className="max-h-96 overflow-auto border-t border-slate-100 p-5 font-mono text-xs text-slate-600 dark:border-slate-800 dark:text-slate-400">{packCss}</pre>
          </details>
        </Card>
      )}
    </>
  );
}

function Preview({ theme }: { theme: ThemeConfig }) {
  const { t } = useI18n();
  return (
    <div className="space-y-3 lg:sticky lg:top-6">
      <div>
        <p className="font-mono text-[11px] lowercase text-slate-400">{"// "}{t("admin.appearance.preview.title")}</p>
        <p className="mt-1 text-xs text-slate-500">{t("admin.appearance.preview.hint")}</p>
      </div>

      {/* login hero */}
      <div className={cn(!theme.parts.loginHero || theme.layout.login === "centered" ? "hidden" : "block")}>
      <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 p-5 text-white">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(circle at 100% 100%, rgb(var(--brand-500) / 0.35), transparent 50%), radial-gradient(rgb(var(--slate-300) / 0.09) 1px, transparent 1px)",
            backgroundSize: "100% 100%, 16px 16px",
          }}
        />
        <div className="relative">
          <div className="flex items-center justify-between gap-2">
            <Logo inverted className="h-8 w-8 rounded-full text-xs" />
            {theme.parts.loginVersion && theme.login.versionPill && (
              <span className="truncate rounded-full border border-slate-700 px-2.5 py-0.5 font-mono text-[10px] text-slate-300">{theme.login.versionPill}</span>
            )}
          </div>
          <p className="mt-8 truncate font-mono text-xs text-slate-300">
            {theme.parts.loginCommand && theme.login.command && (
              <>
                &gt; {theme.login.command}
                <span className="ml-1 inline-block h-3 w-1.5 translate-y-0.5 animate-blink bg-brand-500" />
              </>
            )}
          </p>
          <Wordmark className="mt-1 block truncate text-3xl font-black leading-none tracking-tighter" />
          {theme.parts.loginFooter && (
            <div className="mt-4 flex justify-between border-t border-slate-800 pt-2 font-mono text-[10px] text-slate-500">
              <span className="truncate">{theme.identity.tagline}</span>
              <span className="truncate">{theme.identity.hashtag}</span>
            </div>
          )}
        </div>
      </div>

      </div>

      {/* app sample */}
      <Card className="overflow-hidden">
        <div className="flex items-center gap-2.5 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
          <Logo className="h-8 w-8 text-xs" />
          <div className="min-w-0 leading-none">
            <Wordmark className="block truncate text-sm" />
            {theme.parts.sidebarTagline && <Tagline className="mt-1 truncate font-mono text-[10px] text-slate-400" />}
          </div>
        </div>
        <div className="space-y-4 p-4">
          <div className="relative flex items-center gap-3 rounded-lg bg-brand-50 px-3 py-2 text-sm font-medium text-brand-700 dark:bg-brand-500/10 dark:text-white">
            <span className="absolute -left-4 top-1.5 h-[calc(100%-12px)] w-[3px] rounded-r bg-brand-500" />
            {t("admin.appearance.preview.nav")}
          </div>
          <div className="rounded-xl bg-gradient-to-br from-slate-950 via-brand-900 to-brand-500 p-4 text-white">
            <p className="font-bold">{t("admin.appearance.preview.sampleCard")}</p>
            <p className="text-xs text-white/70">{t("admin.appearance.preview.sampleText")}</p>
          </div>
          <Input placeholder={t("admin.appearance.preview.input")} readOnly />
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm">{t("admin.appearance.preview.button")}</Button>
            <Button size="sm" variant="secondary">
              {t("admin.appearance.preview.secondary")}
            </Button>
            <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
              {t("admin.appearance.preview.badge")}
            </span>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {t("admin.appearance.preview.body")}{" "}
            <a className="font-medium text-brand-600 underline dark:text-brand-400">{t("admin.appearance.preview.link")}</a>
          </p>
        </div>
      </Card>
    </div>
  );
}

/* ---------- small controls ---------- */

function Swatch({ color, active, title, onClick }: { color: string; active: boolean; title: string; onClick: () => void }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "flex h-9 w-9 items-center justify-center rounded-full border-2 transition active:scale-95",
        active ? "border-slate-900 dark:border-white" : "border-transparent hover:scale-105",
      )}
    >
      <span className="flex h-7 w-7 items-center justify-center rounded-full text-white" style={{ background: color }}>
        {active && <Check className="h-4 w-4 drop-shadow-[0_1px_1px_rgba(0,0,0,0.4)]" />}
      </span>
    </button>
  );
}

function ColorInput({ value, active, label, onChange }: { value: string; active: boolean; label: string; onChange: (hex: string) => void }) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  return (
    <div
      className={cn(
        "flex items-center gap-1.5 rounded-lg border py-1 pl-1 pr-2",
        active ? "border-brand-500 ring-2 ring-brand-500/20" : "border-slate-200 dark:border-slate-700",
      )}
    >
      <input
        type="color"
        value={value}
        aria-label={label}
        onChange={(e) => onChange(e.target.value)}
        className="h-7 w-7 cursor-pointer rounded-md border-0 bg-transparent p-0"
      />
      <input
        value={text}
        maxLength={7}
        spellCheck={false}
        aria-label={label}
        onChange={(e) => {
          const v = e.target.value.trim();
          setText(v);
          if (/^#[0-9a-fA-F]{6}$/.test(v)) onChange(v.toLowerCase());
        }}
        className="w-[4.5rem] bg-transparent font-mono text-xs uppercase text-slate-700 focus:outline-none dark:text-slate-300"
      />
    </div>
  );
}

function Segmented<V extends string>({
  value,
  options,
  onChange,
}: {
  value: V;
  options: { value: V; label: string; icon?: React.ReactNode }[];
  onChange: (v: V) => void;
}) {
  return (
    <div className="inline-flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800/70">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition",
            value === o.value
              ? "bg-white text-slate-900 shadow-sm dark:bg-slate-950 dark:text-white"
              : "text-slate-500 hover:text-slate-900 dark:hover:text-white",
          )}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Switch({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4">
      <span>
        <span className="block text-sm font-medium text-slate-700 dark:text-slate-300">{label}</span>
        {hint && <span className="mt-0.5 block text-xs text-slate-500">{hint}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative h-6 w-11 shrink-0 rounded-full transition-colors",
          checked ? "bg-brand-500" : "bg-slate-300 dark:bg-slate-700",
        )}
      >
        <span
          className={cn(
            "absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200",
            checked ? "translate-x-5" : "translate-x-0",
          )}
        />
      </button>
    </label>
  );
}
