"use client";

import { Pencil, Plus, Send } from "lucide-react";
import type { AnnouncementAudience } from "@prisma/client";
import { Checkbox, Field, FormMessage, Input, Select, SubmitButton, Textarea } from "@/components/ui/form";
import { FileInput, ModalTrigger } from "@/components/ui/interactive";
import { useFormAction } from "@/components/ui/use-form-action";
import { useI18n } from "@/i18n/client";
import { formatBytes } from "@/lib/utils";
import { addComment, createAnnouncement, updateAnnouncement } from "./actions";

type Existing = {
  id: string;
  title: string | null;
  body: string;
  audience: AnnouncementAudience;
  pinned: boolean;
  files: { id: string; originalName: string; size: number }[];
};

function AnnouncementForm({ existing, maxMb, onDone }: { existing?: Existing; maxMb: number; onDone: () => void }) {
  const { t } = useI18n();
  const { state, pending, onSubmit } = useFormAction(existing ? updateAnnouncement : createAnnouncement, { onOk: onDone });
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {existing && <input type="hidden" name="id" value={existing.id} />}
      <FormMessage state={state} />
      <Field label={t("announcements.titleLabel")} name="title" state={state}>
        <Input id="title" name="title" maxLength={200} defaultValue={existing?.title ?? ""} placeholder={t("announcements.titlePh")} />
      </Field>
      <Field label={t("announcements.body")} name="body" state={state} required>
        <Textarea id="body" name="body" rows={7} maxLength={10000} required defaultValue={existing?.body ?? ""} placeholder={t("announcements.bodyPh")} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("announcements.audience")} name="audience" state={state}>
          <Select id="audience" name="audience" defaultValue={existing?.audience ?? "EVERYONE"}>
            {(["EVERYONE", "STUDENTS", "TEAM"] as const).map((a) => (
              <option key={a} value={a}>
                {t(`announcements.audiences.${a}`)}
              </option>
            ))}
          </Select>
        </Field>
        <div className="flex items-end pb-2">
          <Checkbox name="pinned" defaultChecked={existing?.pinned ?? false} label={t("announcements.pinToTop")} />
        </div>
      </div>
      {existing && existing.files.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{t("common.files")}</p>
          <ul className="space-y-1">
            {existing.files.map((f) => (
              <li key={f.id} className="flex items-center justify-between gap-2 rounded-md bg-slate-50 px-3 py-1.5 text-sm dark:bg-slate-800">
                <span className="truncate">
                  {f.originalName} <span className="text-xs text-slate-400">({formatBytes(f.size)})</span>
                </span>
                <Checkbox name="removeFile" value={f.id} label={t("common.remove")} className="shrink-0 text-xs" />
              </li>
            ))}
          </ul>
        </div>
      )}
      <Field label={t("common.attachFiles")}>
        <FileInput name="files" maxMb={maxMb} />
      </Field>
      <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
        <SubmitButton pending={pending} pendingText={t("common.saving")}>{existing ? t("common.save") : t("announcements.post")}</SubmitButton>
      </div>
    </form>
  );
}

export function NewAnnouncementButton({ maxMb }: { maxMb: number }) {
  const { t } = useI18n();
  return (
    <ModalTrigger label={t("announcements.new")} title={t("announcements.new")} icon={<Plus className="h-4 w-4" />} modalSize="lg">
      {(close) => <AnnouncementForm maxMb={maxMb} onDone={close} />}
    </ModalTrigger>
  );
}

export function EditAnnouncementButton({ existing, maxMb }: { existing: Existing; maxMb: number }) {
  const { t } = useI18n();
  return (
    <ModalTrigger label={t("common.edit")} title={t("announcements.edit")} variant="ghost" size="sm" icon={<Pencil className="h-4 w-4" />} modalSize="lg">
      {(close) => <AnnouncementForm existing={existing} maxMb={maxMb} onDone={close} />}
    </ModalTrigger>
  );
}

export function CommentForm({ announcementId }: { announcementId: string }) {
  const { t } = useI18n();
  const { state, pending, onSubmit, formKey } = useFormAction(addComment, { resetOnOk: true });
  return (
    <form key={formKey} onSubmit={onSubmit} className="space-y-2">
      <input type="hidden" name="announcementId" value={announcementId} />
      <div className="flex items-start gap-2">
        <Textarea name="body" rows={1} maxLength={2000} required placeholder={t("announcements.commentPh")} className="min-h-[40px]" />
        <SubmitButton pending={pending} size="icon" className="h-10 w-10 shrink-0">
          <Send className="h-4 w-4" />
          <span className="sr-only">{t("announcements.sendComment")}</span>
        </SubmitButton>
      </div>
      {state?.error && <FormMessage state={state} />}
    </form>
  );
}
