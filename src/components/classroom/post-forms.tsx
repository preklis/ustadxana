"use client";

import { useState } from "react";
import { MoreHorizontal, Pencil, Pin, PinOff, Trash2 } from "lucide-react";
import { useI18n } from "@/i18n/client";
import { createPost, deletePost, togglePin, updatePost } from "@/app/(app)/classrooms/actions";
import { Avatar } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, FormMessage, Textarea } from "@/components/ui/form";
import { ConfirmAction, FileInput, Modal } from "@/components/ui/interactive";
import { useFormAction } from "./use-form-action";
import { PendingButton } from "./pending-button";

type Me = { id: string; firstName: string; lastName: string; avatarFileId: string | null };
type FileRow = { id: string; originalName: string };

export function PostComposer({ classroomId, me, maxMb }: { classroomId: string; me: Me; maxMb: number }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const { state, pending, onSubmit, formKey } = useFormAction(createPost, {
    resetOnOk: true,
    onOk: () => setOpen(false),
  });

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 text-left text-sm text-slate-500 shadow-sm transition hover:border-brand-300 hover:text-brand-700 dark:border-slate-800 dark:bg-slate-900 dark:hover:text-brand-300"
      >
        <Avatar user={me} size={36} />
        {t("classroom.stream.composerPlaceholder")}
      </button>
    );
  }

  return (
    <form
      key={formKey}
      onSubmit={onSubmit}
      className="space-y-4 rounded-xl border border-brand-200 bg-white p-4 shadow-sm dark:border-brand-900 dark:bg-slate-900"
    >
      <input type="hidden" name="classroomId" value={classroomId} />
      <FormMessage state={state} />
      <Field name="body" state={state}>
        <Textarea
          id="body"
          name="body"
          rows={4}
          required
          maxLength={5000}
          autoFocus
          placeholder={t("classroom.stream.composerPlaceholder")}
        />
      </Field>
      <FileInput maxMb={maxMb} />
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Checkbox name="pinned" label={t("classroom.stream.pinToTop")} />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
            {t("common.cancel")}
          </Button>
          <PendingButton pending={pending}>{t("classroom.stream.post")}</PendingButton>
        </div>
      </div>
    </form>
  );
}

export function PostMenu({
  post,
  canEdit,
  canPin,
  maxMb,
}: {
  post: { id: string; body: string; pinned: boolean; attachments: FileRow[] };
  canEdit: boolean;
  canPin: boolean;
  maxMb: number;
}) {
  const { t } = useI18n();
  const [menu, setMenu] = useState(false);
  const [editing, setEditing] = useState(false);
  const { state, pending, onSubmit } = useFormAction(updatePost, { onOk: () => setEditing(false) });

  return (
    <div className="relative">
      <Button variant="ghost" size="icon" onClick={() => setMenu((v) => !v)} aria-label={t("common.actions")} aria-expanded={menu}>
        <MoreHorizontal className="h-5 w-5" />
      </Button>
      {menu && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setMenu(false)} />
          <div className="absolute right-0 z-20 mt-1 w-48 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-900">
            {canEdit && (
              <button
                type="button"
                onClick={() => {
                  setMenu(false);
                  setEditing(true);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <Pencil className="h-4 w-4" />
                {t("common.edit")}
              </button>
            )}
            {canPin && (
              <ConfirmAction
                action={async () => {
                  setMenu(false);
                  await togglePin(post.id);
                }}
                skipConfirm
                label={post.pinned ? t("classroom.stream.unpin") : t("classroom.stream.pin")}
                icon={post.pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                className="h-auto w-full justify-start rounded-none px-3 py-2 font-normal"
              />
            )}
            {canEdit && (
              <ConfirmAction
                action={() => deletePost(post.id)}
                confirmText={t("classroom.stream.confirmDelete")}
                label={t("common.delete")}
                icon={<Trash2 className="h-4 w-4" />}
                className="h-auto w-full justify-start rounded-none px-3 py-2 font-normal text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
              />
            )}
          </div>
        </>
      )}

      <Modal open={editing} onClose={() => setEditing(false)} title={t("classroom.stream.editPost")} size="lg">
        <form onSubmit={onSubmit} className="space-y-4">
          <input type="hidden" name="postId" value={post.id} />
          <FormMessage state={state} />
          <Field name="body" state={state}>
            <Textarea id="body" name="body" rows={6} required maxLength={5000} defaultValue={post.body} />
          </Field>
          {post.attachments.length > 0 && (
            <Field label={t("common.files")}>
              <ul className="space-y-1.5">
                {post.attachments.map((f) => (
                  <li key={f.id} className="flex items-center justify-between gap-3 rounded-md bg-slate-50 px-3 py-2 text-sm dark:bg-slate-800">
                    <span className="truncate">{f.originalName}</span>
                    <Checkbox name="removeFile" value={f.id} label={t("common.remove")} className="shrink-0 text-xs" />
                  </li>
                ))}
              </ul>
            </Field>
          )}
          <FileInput maxMb={maxMb} />
          <Checkbox name="pinned" defaultChecked={post.pinned} label={t("classroom.stream.pinToTop")} />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setEditing(false)} disabled={pending}>
              {t("common.cancel")}
            </Button>
            <PendingButton pending={pending}>{t("common.save")}</PendingButton>
          </div>
        </form>
      </Modal>
    </div>
  );
}
