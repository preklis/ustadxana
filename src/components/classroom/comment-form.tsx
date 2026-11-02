"use client";

import { SendHorizontal } from "lucide-react";
import { useI18n } from "@/i18n/client";
import { addComment } from "@/app/(app)/classrooms/actions";
import { Avatar } from "@/components/ui/primitives";
import { FormMessage, Textarea } from "@/components/ui/form";
import { useFormAction } from "./use-form-action";
import { PendingButton } from "./pending-button";

export function CommentForm({
  target,
  placeholder,
  me,
}: {
  target: string;
  placeholder: string;
  me: { id: string; firstName: string; lastName: string; avatarFileId: string | null };
}) {
  const { t } = useI18n();
  const { state, pending, onSubmit, formKey } = useFormAction(addComment, { resetOnOk: true });
  return (
    <div>
      <form key={formKey} onSubmit={onSubmit} className="flex items-start gap-2.5">
        <Avatar user={me} size={32} className="mt-0.5 hidden sm:inline-flex" />
        <input type="hidden" name="target" value={target} />
        <Textarea
          name="body"
          rows={1}
          required
          maxLength={2000}
          placeholder={placeholder}
          aria-label={placeholder}
          className="min-h-[38px] flex-1 py-2"
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) e.currentTarget.form?.requestSubmit();
          }}
        />
        <PendingButton pending={pending} variant="ghost" size="icon" title={t("classroom.comments.send")} aria-label={t("classroom.comments.send")}>
          {!pending && <SendHorizontal className="h-4 w-4" />}
        </PendingButton>
      </form>
      {state?.error && <FormMessage state={state} className="mt-2" />}
    </div>
  );
}
