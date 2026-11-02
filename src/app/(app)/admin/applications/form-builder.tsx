"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Copy, Eye, GripVertical, Heading, Plus, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n/client";
import { Button, LinkButton } from "@/components/ui/button";
import { Checkbox, Field, FormMessage, Input, Select, SubmitButton, Textarea } from "@/components/ui/form";
import { Alert, Card, CardBody, CardHeader } from "@/components/ui/primitives";
import { useFormAction } from "@/components/ui/use-form-action";
import {
  blankQuestion,
  CHOICE_TYPES,
  newQuestionId,
  PROFILE_FIELDS,
  QUESTION_TYPES,
  type Question,
  type QuestionType,
} from "@/lib/applications/questions";
import { saveFormAction } from "./actions";

export type BuilderForm = {
  id: string;
  title: string;
  slug: string;
  description: string;
  kind: "STUDENT" | "TEAM";
  seasonId: string;
  closesAt: string;
  allowEdit: boolean;
  confirmation: string;
  questions: Question[];
};

const AZ: Record<string, string> = { ə: "e", ı: "i", ö: "o", ü: "u", ş: "s", ç: "c", ğ: "g", İ: "i" };

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[əıöüşçğİ]/g, (c) => AZ[c] ?? c)
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function FormBuilder({
  form,
  seasons,
  responseCount,
}: {
  form: BuilderForm;
  seasons: { id: string; name: string }[];
  responseCount: number;
}) {
  const { t } = useI18n();
  const isNew = !form.id;
  const [questions, setQuestions] = useState<Question[]>(form.questions);
  const [title, setTitle] = useState(form.title);
  const [slug, setSlug] = useState(form.slug);
  const [slugTouched, setSlugTouched] = useState(!isNew);
  const [kind, setKind] = useState(form.kind);
  const save = useFormAction(saveFormAction.bind(null, form.id || null));
  const state = save.state;
  const json = useMemo(() => JSON.stringify(questions), [questions]);

  const update = (i: number, patch: Partial<Question>) => setQuestions((qs) => qs.map((q, j) => (j === i ? { ...q, ...patch } : q)));
  const move = (i: number, d: -1 | 1) =>
    setQuestions((qs) => {
      const j = i + d;
      if (j < 0 || j >= qs.length) return qs;
      const next = [...qs];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  const remove = (i: number) => setQuestions((qs) => qs.filter((_, j) => j !== i));
  const duplicate = (i: number) =>
    setQuestions((qs) => {
      const next = [...qs];
      next.splice(i + 1, 0, { ...qs[i], id: newQuestionId(), field: null });
      return next;
    });
  const add = (type: QuestionType) => setQuestions((qs) => [...qs, blankQuestion(type)]);

  return (
    <form onSubmit={save.onSubmit} className="space-y-6">
      <input type="hidden" name="questions" value={json} />

      <Card>
        <CardHeader title={t("applications.builder.general")} />
        <CardBody className="grid gap-5 md:grid-cols-2">
          <Field label={t("applications.builder.formTitle")} name="title" state={state} required className="md:col-span-2">
            <Input
              id="title"
              name="title"
              value={title}
              maxLength={140}
              placeholder={t("applications.builder.formTitlePh")}
              onChange={(e) => {
                setTitle(e.target.value);
                if (!slugTouched) setSlug(slugify(e.target.value));
              }}
              required
            />
          </Field>
          <Field label={t("applications.builder.slug")} name="slug" state={state} hint={t("applications.builder.slugHint", { slug: slug || "…" })}>
            <Input
              id="slug"
              name="slug"
              value={slug}
              maxLength={60}
              className="font-mono"
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""));
              }}
              required
            />
          </Field>
          <Field label={t("applications.builder.kind")} name="kind" hint={t(`applications.kindHints.${kind}`)}>
            <Select id="kind" name="kind" value={kind} onChange={(e) => setKind(e.target.value as "STUDENT" | "TEAM")}>
              <option value="STUDENT">{t("applications.kinds.STUDENT")}</option>
              <option value="TEAM">{t("applications.kinds.TEAM")}</option>
            </Select>
          </Field>
          <Field label={t("applications.builder.descriptionLabel")} name="description" className="md:col-span-2">
            <Textarea id="description" name="description" rows={4} maxLength={5000} defaultValue={form.description} placeholder={t("applications.builder.descriptionPh")} />
          </Field>
          <Field label={t("applications.builder.season")} name="seasonId">
            <Select id="seasonId" name="seasonId" defaultValue={form.seasonId}>
              <option value="">{t("applications.builder.noSeason")}</option>
              {seasons.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("applications.builder.closesAt")} name="closesAt" hint={t("applications.builder.closesAtHint")}>
            <Input id="closesAt" name="closesAt" type="date" defaultValue={form.closesAt} className="max-w-xs" />
          </Field>
          <Field label={t("applications.builder.confirmation")} name="confirmation" className="md:col-span-2">
            <Textarea id="confirmation" name="confirmation" rows={2} maxLength={2000} defaultValue={form.confirmation} placeholder={t("applications.builder.confirmationPh")} />
          </Field>
          <Checkbox name="allowEdit" defaultChecked={form.allowEdit} label={t("applications.builder.allowEdit")} className="md:col-span-2" />
        </CardBody>
      </Card>

      <div>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">{t("applications.builder.questions")}</h2>
            <p className="max-w-2xl text-sm text-slate-500">{t("applications.builder.questionsHint")}</p>
          </div>
          {!isNew && (
            <LinkButton href={`/apply/${form.slug}?preview=1`} target="_blank" variant="outline" size="sm">
              <Eye className="h-4 w-4" />
              {t("applications.builder.preview")}
            </LinkButton>
          )}
        </div>
        {responseCount > 0 && (
          <Alert tone="yellow" className="mb-3">
            {t("applications.builder.editWarning")}
          </Alert>
        )}
        {state?.fieldErrors?._ && <p className="mb-3 text-sm font-medium text-red-600">{t(state.fieldErrors._)}</p>}

        <div className="space-y-3">
          {questions.map((q, i) => (
            <QuestionEditor
              key={q.id}
              q={q}
              index={i}
              total={questions.length}
              error={state?.fieldErrors?.[q.id]}
              usedFields={questions.filter((x) => x.id !== q.id && x.field).map((x) => x.field!)}
              onChange={(p) => update(i, p)}
              onMove={(d) => move(i, d)}
              onRemove={() => remove(i)}
              onDuplicate={() => duplicate(i)}
            />
          ))}
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => add("short")}>
            <Plus className="h-4 w-4" />
            {t("applications.builder.addQuestion")}
          </Button>
          <Button type="button" variant="ghost" onClick={() => add("section")}>
            <Heading className="h-4 w-4" />
            {t("applications.builder.addSection")}
          </Button>
        </div>
      </div>

      <div className="sticky bottom-4 z-10 flex flex-wrap items-center justify-end gap-3 rounded-2xl border border-slate-200 bg-white/90 p-3 shadow-lg backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
        <FormMessage state={state} className="mr-auto" />
        <SubmitButton pending={save.pending}>{isNew ? t("common.create") : t("common.save")}</SubmitButton>
      </div>
    </form>
  );
}

function QuestionEditor({
  q,
  index,
  total,
  error,
  usedFields,
  onChange,
  onMove,
  onRemove,
  onDuplicate,
}: {
  q: Question;
  index: number;
  total: number;
  error?: string;
  usedFields: string[];
  onChange: (p: Partial<Question>) => void;
  onMove: (d: -1 | 1) => void;
  onRemove: () => void;
  onDuplicate: () => void;
}) {
  const { t } = useI18n();
  const section = q.type === "section";
  const choice = CHOICE_TYPES.includes(q.type);

  function setType(type: QuestionType) {
    const patch: Partial<Question> = { type };
    if (CHOICE_TYPES.includes(type) && q.options.length === 0) patch.options = ["", ""];
    if (type === "scale") {
      patch.min = 1;
      patch.max = 5;
    } else if (type !== "number") {
      patch.min = undefined;
      patch.max = undefined;
    }
    if (type === "section") {
      patch.required = false;
      patch.field = null;
    }
    onChange(patch);
  }

  const iconBtn = "rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30 dark:hover:bg-slate-800 dark:hover:text-slate-200";

  return (
    <Card className={cn("overflow-hidden", error && "border-red-300 dark:border-red-800", section && "border-l-4 border-l-brand-500")}>
      <div className="flex items-start gap-3 p-4 sm:p-5">
        <GripVertical className="mt-2.5 hidden h-4 w-4 shrink-0 text-slate-300 sm:block" />
        <div className="min-w-0 flex-1 space-y-3">
          <div className="grid gap-3 sm:grid-cols-[1fr_220px]">
            <Input
              value={q.label}
              onChange={(e) => onChange({ label: e.target.value })}
              placeholder={section ? t("applications.builder.sectionLabelPh") : t("applications.builder.labelPh")}
              className={cn("font-medium", section && "text-base font-bold")}
              maxLength={300}
              aria-label={t("applications.builder.label")}
            />
            <Select value={q.type} onChange={(e) => setType(e.target.value as QuestionType)} aria-label={t("applications.builder.label")}>
              {QUESTION_TYPES.map((type) => (
                <option key={type} value={type}>
                  {t(`applications.builder.types.${type}`)}
                </option>
              ))}
            </Select>
          </div>
          <Input
            value={q.help}
            onChange={(e) => onChange({ help: e.target.value })}
            placeholder={t("applications.builder.helpPh")}
            className="text-sm"
            maxLength={1000}
            aria-label={t("applications.builder.help")}
          />

          {choice && (
            <div className="space-y-2">
              {q.options.map((o, oi) => (
                <div key={oi} className="flex items-center gap-2">
                  <span className={cn("h-4 w-4 shrink-0 border border-slate-300 dark:border-slate-600", q.type === "multi" ? "rounded" : "rounded-full")} />
                  <Input
                    value={o}
                    onChange={(e) => onChange({ options: q.options.map((x, j) => (j === oi ? e.target.value : x)) })}
                    placeholder={t("applications.builder.optionPh", { n: oi + 1 })}
                    className="h-9"
                    maxLength={200}
                  />
                  <button type="button" className={iconBtn} disabled={q.options.length <= 1} onClick={() => onChange({ options: q.options.filter((_, j) => j !== oi) })}>
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <div className="flex flex-wrap items-center gap-4 pl-6">
                <button
                  type="button"
                  className="text-sm font-medium text-brand-600 hover:underline disabled:opacity-40"
                  disabled={q.options.length >= 40}
                  onClick={() => onChange({ options: [...q.options, ""] })}
                >
                  + {t("applications.builder.addOption")}
                </button>
                {q.type !== "dropdown" && <Checkbox checked={q.other} onChange={(e) => onChange({ other: e.target.checked })} label={t("applications.builder.other")} />}
              </div>
            </div>
          )}

          {q.type === "scale" && (
            <div className="grid gap-3 sm:grid-cols-4">
              <Field label={t("applications.builder.min")}>
                <Select value={q.min ?? 1} onChange={(e) => onChange({ min: Number(e.target.value) })}>
                  {[0, 1].map((n) => (
                    <option key={n}>{n}</option>
                  ))}
                </Select>
              </Field>
              <Field label={t("applications.builder.max")}>
                <Select value={q.max ?? 5} onChange={(e) => onChange({ max: Number(e.target.value) })}>
                  {[2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                    <option key={n}>{n}</option>
                  ))}
                </Select>
              </Field>
              <Field label={t("applications.builder.minLabel")}>
                <Input value={q.minLabel} maxLength={60} onChange={(e) => onChange({ minLabel: e.target.value })} />
              </Field>
              <Field label={t("applications.builder.maxLabel")}>
                <Input value={q.maxLabel} maxLength={60} onChange={(e) => onChange({ maxLabel: e.target.value })} />
              </Field>
            </div>
          )}

          {q.type === "number" && (
            <Field label={t("applications.builder.numberRange")}>
              <div className="flex max-w-xs items-center gap-2">
                <Input
                  type="number"
                  value={q.min ?? ""}
                  placeholder={t("applications.builder.min")}
                  onChange={(e) => onChange({ min: e.target.value === "" ? undefined : Math.trunc(Number(e.target.value)) })}
                />
                <span className="text-slate-400">–</span>
                <Input
                  type="number"
                  value={q.max ?? ""}
                  placeholder={t("applications.builder.max")}
                  onChange={(e) => onChange({ max: e.target.value === "" ? undefined : Math.trunc(Number(e.target.value)) })}
                />
              </div>
            </Field>
          )}

          {error && <p className="text-sm font-medium text-red-600">{t(error)}</p>}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3 dark:border-slate-800">
            <div className="flex flex-wrap items-center gap-4">
              {!section && (
                <>
                  <Checkbox checked={q.required} onChange={(e) => onChange({ required: e.target.checked })} label={t("applications.builder.required")} />
                  <label className="flex items-center gap-2 whitespace-nowrap text-sm text-slate-600 dark:text-slate-300">
                    {t("applications.builder.field")}
                    <Select
                      value={q.field ?? ""}
                      onChange={(e) => onChange({ field: (e.target.value || null) as Question["field"] })}
                      className="h-8 w-auto py-0 text-xs"
                    >
                      <option value="">{t("applications.builder.noField")}</option>
                      {PROFILE_FIELDS.map((f) => (
                        <option key={f} value={f} disabled={usedFields.includes(f)}>
                          {t(`applications.builder.fields.${f}`)}
                        </option>
                      ))}
                    </Select>
                  </label>
                </>
              )}
            </div>
            <div className="flex items-center gap-0.5">
              <button type="button" className={iconBtn} disabled={index === 0} onClick={() => onMove(-1)} title={t("applications.builder.moveUp")}>
                <ArrowUp className="h-4 w-4" />
              </button>
              <button type="button" className={iconBtn} disabled={index === total - 1} onClick={() => onMove(1)} title={t("applications.builder.moveDown")}>
                <ArrowDown className="h-4 w-4" />
              </button>
              <button type="button" className={iconBtn} onClick={onDuplicate} title={t("applications.builder.duplicate")}>
                <Copy className="h-4 w-4" />
              </button>
              <button type="button" className={cn(iconBtn, "hover:text-red-600")} onClick={onRemove} title={t("applications.builder.remove")}>
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
