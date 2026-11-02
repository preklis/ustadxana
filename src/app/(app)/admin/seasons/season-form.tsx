"use client";

import { useActionState, useEffect, useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { useI18n } from "@/i18n/client";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/interactive";
import { Field, FormMessage, Input, SubmitButton, Textarea } from "@/components/ui/form";
import { saveSeasonAction } from "./actions";

export type SeasonValues = {
  id: string;
  name: string;
  number: number | null;
  description: string | null;
  startDate: string;
  endDate: string;
};

export function SeasonFormButton({ season, suggestedNumber }: { season?: SeasonValues; suggestedNumber?: number }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [round, setRound] = useState(0);
  const close = () => {
    setOpen(false);
    setRound((r) => r + 1);
  };
  return (
    <>
      <Button variant={season ? "ghost" : "primary"} size={season ? "sm" : "md"} onClick={() => setOpen(true)}>
        {season ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
        {season ? t("common.edit") : t("admin.seasons.create")}
      </Button>
      <Modal open={open} onClose={close} title={season ? t("admin.seasons.editTitle") : t("admin.seasons.createTitle")}>
        <SeasonForm key={round} season={season} suggestedNumber={suggestedNumber} close={close} />
      </Modal>
    </>
  );
}

function SeasonForm({ season, suggestedNumber, close }: { season?: SeasonValues; suggestedNumber?: number; close: () => void }) {
  const { t } = useI18n();
  const [state, action] = useActionState(saveSeasonAction.bind(null, season?.id ?? null), null);
  useEffect(() => {
    if (state?.ok) close();
  }, [state, close]);
  return (
    <form action={action} className="space-y-4">
      <FormMessage state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("admin.seasons.fields.name")} name="name" state={state} required>
          <Input id="name" name="name" defaultValue={season?.name ?? (suggestedNumber ? `${t("common.appName")} ${suggestedNumber}` : "")} required minLength={2} maxLength={80} />
        </Field>
        <Field label={t("admin.seasons.fields.number")} name="number" state={state}>
          <Input id="number" name="number" type="number" min={1} max={1000} defaultValue={season ? (season.number ?? "") : (suggestedNumber ?? "")} />
        </Field>
        <Field label={t("admin.seasons.fields.startDate")} name="startDate" state={state}>
          <Input id="startDate" name="startDate" type="date" defaultValue={season?.startDate ?? ""} />
        </Field>
        <Field label={t("admin.seasons.fields.endDate")} name="endDate" state={state}>
          <Input id="endDate" name="endDate" type="date" defaultValue={season?.endDate ?? ""} />
        </Field>
        <Field label={t("admin.seasons.fields.description")} name="description" state={state} className="sm:col-span-2">
          <Textarea id="description" name="description" rows={3} defaultValue={season?.description ?? ""} maxLength={2000} />
        </Field>
      </div>
      <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
        <Button variant="ghost" onClick={close}>
          {t("common.cancel")}
        </Button>
        <SubmitButton pendingText={t("common.saving")}>{season ? t("common.save") : t("common.create")}</SubmitButton>
      </div>
    </form>
  );
}
