"use client";

import { ArrowDown, ArrowUp, Check, Tags, Trash2 } from "lucide-react";
import { useI18n } from "@/i18n/client";
import { createTopic, deleteTopic, moveTopic, renameTopic } from "@/app/(app)/classrooms/[id]/classwork/actions";
import { Field, FormMessage, Input } from "@/components/ui/form";
import { ConfirmAction, ModalTrigger } from "@/components/ui/interactive";
import { useFormAction } from "./use-form-action";
import { PendingButton } from "./pending-button";

type Topic = { id: string; name: string };

export function TopicManager({ classroomId, topics }: { classroomId: string; topics: Topic[] }) {
  const { t } = useI18n();
  return (
    <ModalTrigger label={t("classwork.topics.manage")} title={t("classwork.topics.title")} variant="outline" icon={<Tags className="h-4 w-4" />}>
      {() => (
        <div className="space-y-5">
          {topics.length === 0 ? (
            <p className="text-sm text-slate-500">{t("classwork.topics.empty")}</p>
          ) : (
            <ul className="space-y-2">
              {topics.map((topic, i) => (
                <TopicRow key={topic.id} topic={topic} first={i === 0} last={i === topics.length - 1} />
              ))}
            </ul>
          )}
          <NewTopicForm classroomId={classroomId} />
        </div>
      )}
    </ModalTrigger>
  );
}

function TopicRow({ topic, first, last }: { topic: Topic; first: boolean; last: boolean }) {
  const { t } = useI18n();
  const { state, pending, onSubmit } = useFormAction(renameTopic);
  return (
    <li className="rounded-lg border border-slate-200 p-2 dark:border-slate-700">
      <div className="flex items-center gap-1.5">
        <form onSubmit={onSubmit} className="flex min-w-0 flex-1 items-center gap-1.5">
          <input type="hidden" name="topicId" value={topic.id} />
          <Input name="name" defaultValue={topic.name} required maxLength={80} aria-label={t("classwork.topics.name")} className="h-9" />
          <PendingButton pending={pending} variant="ghost" size="icon" title={t("common.save")} aria-label={t("common.save")}>
            {!pending && <Check className="h-4 w-4" />}
          </PendingButton>
        </form>
        <ConfirmAction
          action={() => moveTopic(topic.id, "up")}
          skipConfirm
          size="icon"
          label={<span className="sr-only">{t("classwork.topics.moveUp")}</span>}
          icon={<ArrowUp className="h-4 w-4" />}
          className={first ? "invisible" : undefined}
        />
        <ConfirmAction
          action={() => moveTopic(topic.id, "down")}
          skipConfirm
          size="icon"
          label={<span className="sr-only">{t("classwork.topics.moveDown")}</span>}
          icon={<ArrowDown className="h-4 w-4" />}
          className={last ? "invisible" : undefined}
        />
        <ConfirmAction
          action={() => deleteTopic(topic.id)}
          confirmText={t("classwork.topics.confirmDelete", { name: topic.name })}
          size="icon"
          label={<span className="sr-only">{t("common.delete")}</span>}
          icon={<Trash2 className="h-4 w-4" />}
          className="text-slate-400 hover:text-red-600"
        />
      </div>
      {state?.error && <FormMessage state={state} className="mt-2" />}
    </li>
  );
}

function NewTopicForm({ classroomId }: { classroomId: string }) {
  const { t } = useI18n();
  const { state, pending, onSubmit, formKey } = useFormAction(createTopic, { resetOnOk: true });
  return (
    <form key={formKey} onSubmit={onSubmit} className="space-y-2 border-t border-slate-100 pt-4 dark:border-slate-800">
      <input type="hidden" name="classroomId" value={classroomId} />
      {state?.error && <FormMessage state={state} />}
      <Field label={t("classwork.topics.new")} name="name" state={state}>
        <div className="flex gap-2">
          <Input id="name" name="name" required maxLength={80} placeholder={t("classwork.topics.namePlaceholder")} />
          <PendingButton pending={pending}>{t("common.add")}</PendingButton>
        </div>
      </Field>
    </form>
  );
}
