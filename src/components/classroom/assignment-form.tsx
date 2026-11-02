"use client";

import { useState } from "react";
import type { AssignmentType } from "@prisma/client";
import { useI18n } from "@/i18n/client";
import { saveAssignment } from "@/app/(app)/classrooms/[id]/classwork/actions";
import { cn } from "@/lib/utils";
import { LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/primitives";
import { Checkbox, Field, FormMessage, Input, Select, Textarea } from "@/components/ui/form";
import { FileInput } from "@/components/ui/interactive";
import { useFormAction } from "./use-form-action";
import { PendingButton } from "./pending-button";
import { TypeIcon } from "./work-status";

export type AssignmentFormValues = {
  id: string;
  type: AssignmentType;
  title: string;
  description: string;
  topicId: string | null;
  links: string[];
  maxPoints: number | null;
  dueAt: string; // datetime-local value (Baku time)
  allowLate: boolean;
  published: boolean;
  attachments: { id: string; originalName: string }[];
};

const TYPES: AssignmentType[] = ["ASSIGNMENT", "QUESTION", "MATERIAL"];

export function AssignmentForm({
  classroomId,
  topics,
  initial,
  defaultType = "ASSIGNMENT",
  defaultTopicId,
  cancelHref,
  maxMb,
}: {
  classroomId: string;
  topics: { id: string; name: string }[];
  initial?: AssignmentFormValues;
  defaultType?: AssignmentType;
  defaultTopicId?: string | null;
  cancelHref: string;
  maxMb: number;
}) {
  const { t } = useI18n();
  const { state, pending, onSubmit } = useFormAction(saveAssignment);
  const [type, setType] = useState<AssignmentType>(initial?.type ?? defaultType);
  const [topicSel, setTopicSel] = useState<string>(initial?.topicId ?? defaultTopicId ?? "");
  const isMaterial = type === "MATERIAL";

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <input type="hidden" name="classroomId" value={classroomId} />
      {initial && <input type="hidden" name="assignmentId" value={initial.id} />}
      <input type="hidden" name="type" value={type} />
      <FormMessage state={state} />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <Card className="space-y-5 p-5">
          <fieldset>
            <legend className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">{t("classwork.form.type")}</legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {TYPES.map((ty) => (
                <button
                  key={ty}
                  type="button"
                  onClick={() => setType(ty)}
                  aria-pressed={type === ty}
                  className={cn(
                    "flex items-center gap-3 rounded-lg border p-3 text-left transition",
                    type === ty
                      ? "border-brand-500 bg-brand-50 ring-1 ring-brand-500 dark:bg-brand-950/40"
                      : "border-slate-200 hover:border-slate-300 dark:border-slate-700",
                  )}
                >
                  <TypeIcon type={ty} size="sm" muted={type !== ty} />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-slate-900 dark:text-slate-100">{t(`classwork.types.${ty}`)}</span>
                    <span className="block text-xs text-slate-500">{t(`classwork.typeHints.${ty}`)}</span>
                  </span>
                </button>
              ))}
            </div>
          </fieldset>

          <Field label={t("classwork.form.title")} name="title" state={state} required>
            <Input id="title" name="title" required maxLength={200} defaultValue={initial?.title} autoFocus={!initial} />
          </Field>

          <Field
            label={type === "QUESTION" ? t("classwork.form.question") : t("classwork.form.description")}
            name="description"
            state={state}
          >
            <Textarea id="description" name="description" rows={7} maxLength={10000} defaultValue={initial?.description} />
          </Field>

          <Field label={t("common.links")} name="links" hint={t("common.linksHint")} state={state}>
            <Textarea id="links" name="links" rows={2} defaultValue={initial?.links.join("\n")} placeholder="https://" />
          </Field>

          {initial && initial.attachments.length > 0 && (
            <Field label={t("common.files")}>
              <ul className="space-y-1.5">
                {initial.attachments.map((f) => (
                  <li key={f.id} className="flex items-center justify-between gap-3 rounded-md bg-slate-50 px-3 py-2 text-sm dark:bg-slate-800">
                    <span className="truncate">{f.originalName}</span>
                    <Checkbox name="removeFile" value={f.id} label={t("common.remove")} className="shrink-0 text-xs" />
                  </li>
                ))}
              </ul>
            </Field>
          )}
          <Field label={initial?.attachments.length ? undefined : t("common.attachFiles")}>
            <FileInput maxMb={maxMb} />
          </Field>
        </Card>

        <Card className="h-fit space-y-5 p-5">
          <Field label={t("classwork.form.topic")} name="topicId" state={state}>
            <Select id="topicId" name="topicId" value={topicSel} onChange={(e) => setTopicSel(e.target.value)}>
              <option value="">{t("classwork.noTopic")}</option>
              {topics.map((tp) => (
                <option key={tp.id} value={tp.id}>
                  {tp.name}
                </option>
              ))}
              <option value="__new">+ {t("classwork.topics.new")}</option>
            </Select>
          </Field>
          {topicSel === "__new" && (
            <Field label={t("classwork.topics.name")} name="newTopic" state={state} required>
              <Input id="newTopic" name="newTopic" required maxLength={80} placeholder={t("classwork.topics.namePlaceholder")} />
            </Field>
          )}

          {!isMaterial && (
            <>
              <Field label={t("classwork.form.points")} name="maxPoints" state={state} hint={t("classwork.form.pointsHint")}>
                <Input
                  id="maxPoints"
                  name="maxPoints"
                  type="number"
                  min={1}
                  max={1000}
                  step={1}
                  inputMode="numeric"
                  defaultValue={initial ? (initial.maxPoints ?? "") : 100}
                  placeholder={t("classwork.ungraded")}
                />
              </Field>
              <Field label={t("classwork.form.due")} name="dueAt" state={state} hint={t("classwork.form.dueHint")}>
                <Input id="dueAt" name="dueAt" type="datetime-local" defaultValue={initial?.dueAt} />
              </Field>
              <Checkbox name="allowLate" defaultChecked={initial?.allowLate ?? true} label={t("classwork.form.allowLate")} />
            </>
          )}
        </Card>
      </div>

      <div className="flex flex-col-reverse gap-2 border-t border-slate-200 pt-4 sm:flex-row sm:justify-end dark:border-slate-800">
        <LinkButton href={cancelHref} variant="ghost">
          {t("common.cancel")}
        </LinkButton>
        {initial?.published ? (
          <PendingButton pending={pending} intent="publish">
            {t("common.save")}
          </PendingButton>
        ) : (
          <>
            <PendingButton pending={pending} intent="draft" variant="outline">
              {t("classwork.form.saveDraft")}
            </PendingButton>
            <PendingButton pending={pending} intent="publish">
              {isMaterial ? t("classwork.form.post") : t("classwork.form.assign")}
            </PendingButton>
          </>
        )}
      </div>
    </form>
  );
}
