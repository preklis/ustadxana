"use client";

import { useI18n } from "@/i18n/client";
import { gradeSubmission, saveWork } from "@/app/(app)/classrooms/[id]/classwork/actions";
import { Field, FormMessage, Input, Textarea } from "@/components/ui/form";
import { FileInput } from "@/components/ui/interactive";
import { useFormAction } from "./use-form-action";
import { PendingButton } from "./pending-button";

export function WorkForm({
  assignmentId,
  isQuestion,
  text,
  links,
  maxMb,
}: {
  assignmentId: string;
  isQuestion: boolean;
  text: string;
  links: string[];
  maxMb: number;
}) {
  const { t } = useI18n();
  const { state, pending, onSubmit, formKey } = useFormAction(saveWork, { resetOnOk: true });
  return (
    <form key={formKey} onSubmit={onSubmit} className="space-y-3">
      <input type="hidden" name="assignmentId" value={assignmentId} />
      <FormMessage state={state} />
      <Field
        label={isQuestion ? t("classwork.work.answer") : t("classwork.work.text")}
        name="text"
        state={state}
        required={isQuestion}
      >
        <Textarea
          id="text"
          name="text"
          rows={isQuestion ? 5 : 3}
          maxLength={10000}
          defaultValue={text}
          placeholder={isQuestion ? t("classwork.work.answerPlaceholder") : t("classwork.work.textPlaceholder")}
        />
      </Field>
      {!isQuestion && (
        <>
          <Field label={t("common.links")} name="links" hint={t("common.linksHint")} state={state}>
            <Textarea id="links" name="links" rows={2} defaultValue={links.join("\n")} placeholder="https://" />
          </Field>
          <FileInput maxMb={maxMb} />
        </>
      )}
      <div className="grid gap-2 pt-1 sm:grid-cols-2">
        <PendingButton pending={pending} intent="save" variant="outline">
          {t("classwork.work.saveDraft")}
        </PendingButton>
        <PendingButton pending={pending} intent="turnIn">
          {t("classwork.work.turnIn")}
        </PendingButton>
      </div>
    </form>
  );
}

export function GradeForm({
  assignmentId,
  studentId,
  maxPoints,
  grade,
  feedback,
  returned,
}: {
  assignmentId: string;
  studentId: string;
  maxPoints: number | null;
  grade: number | null;
  feedback: string;
  returned: boolean;
}) {
  const { t } = useI18n();
  const { state, pending, onSubmit } = useFormAction(gradeSubmission);
  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <input type="hidden" name="assignmentId" value={assignmentId} />
      <input type="hidden" name="studentId" value={studentId} />
      <FormMessage state={state} />
      {maxPoints != null && (
        <Field label={t("classwork.grading.grade")} name="grade" state={state}>
          <div className="flex items-center gap-2">
            <Input
              id={`grade-${studentId}`}
              name="grade"
              type="number"
              inputMode="numeric"
              min={0}
              max={maxPoints}
              step={1}
              defaultValue={grade ?? ""}
              className="w-28"
            />
            <span className="text-sm text-slate-500">/ {maxPoints}</span>
          </div>
        </Field>
      )}
      <Field label={t("classwork.grading.feedback")} name="feedback" state={state}>
        <Textarea
          id={`feedback-${studentId}`}
          name="feedback"
          rows={3}
          maxLength={5000}
          defaultValue={feedback}
          placeholder={t("classwork.grading.feedbackPlaceholder")}
        />
      </Field>
      <div className="flex flex-wrap justify-end gap-2">
        <PendingButton pending={pending} intent="save" variant="outline" size="sm">
          {t("common.save")}
        </PendingButton>
        <PendingButton pending={pending} intent="return" size="sm">
          {returned ? t("classwork.grading.returnAgain") : t("classwork.grading.return")}
        </PendingButton>
      </div>
    </form>
  );
}
