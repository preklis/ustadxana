import { Trash2 } from "lucide-react";
import { Avatar } from "@/components/ui/primitives";
import { ConfirmAction } from "@/components/ui/interactive";
import { deleteComment } from "@/app/(app)/classrooms/actions";
import { formatDate, fullName } from "@/lib/utils";
import type { TFunction } from "@/i18n/core";
import { CommentForm } from "./comment-form";

type Person = { id: string; firstName: string; lastName: string; avatarFileId: string | null };
export type CommentItem = { id: string; body: string; createdAt: Date; author: Person };

export function CommentThread({
  comments,
  target,
  me,
  canModerate,
  canPost = true,
  t,
  locale,
  placeholder,
}: {
  comments: CommentItem[];
  target: string;
  me: Person;
  canModerate: boolean;
  canPost?: boolean;
  t: TFunction;
  locale: string;
  placeholder: string;
}) {
  return (
    <div className="space-y-3">
      {comments.length > 0 && (
        <ul className="space-y-3">
          {comments.map((c) => (
            <li key={c.id} className="group flex gap-2.5">
              <Avatar user={c.author} size={32} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                    {c.author.id === me.id ? t("common.you") : fullName(c.author)}
                  </span>
                  <span className="text-xs text-slate-500">{formatDate(c.createdAt, locale, true)}</span>
                </div>
                <p className="whitespace-pre-wrap break-words text-sm text-slate-700 dark:text-slate-300">{c.body}</p>
              </div>
              {(c.author.id === me.id || canModerate) && (
                <ConfirmAction
                  action={deleteComment.bind(null, c.id)}
                  label={<span className="sr-only">{t("common.delete")}</span>}
                  icon={<Trash2 className="h-4 w-4" />}
                  size="icon"
                  className="h-8 w-8 shrink-0 text-slate-400 opacity-100 hover:text-red-600 sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100"
                  confirmText={t("classroom.comments.confirmDelete")}
                />
              )}
            </li>
          ))}
        </ul>
      )}
      {canPost && <CommentForm target={target} placeholder={placeholder} me={me} />}
    </div>
  );
}
