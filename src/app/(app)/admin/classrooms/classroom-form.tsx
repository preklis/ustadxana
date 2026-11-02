"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus } from "lucide-react";
import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/utils";
import { CLASSROOM_COLORS } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/interactive";
import { Field, FormMessage, Input, Select, SubmitButton, Textarea } from "@/components/ui/form";
import { saveClassroomAction } from "./actions";

export type ClassroomValues = {
  id: string;
  seasonId: string;
  name: string;
  track: string | null;
  description: string | null;
  room: string | null;
  schedule: string | null;
  color: string;
};
type SeasonOption = { id: string; name: string };

export function ClassroomFormButton({
  classroom,
  seasons,
  defaultSeasonId,
  tracks,
  variant,
}: {
  classroom?: ClassroomValues;
  seasons: SeasonOption[];
  defaultSeasonId?: string;
  tracks: string[];
  variant?: "primary" | "outline" | "ghost";
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [round, setRound] = useState(0);
  const close = () => {
    setOpen(false);
    setRound((r) => r + 1);
  };
  return (
    <>
      <Button variant={variant ?? (classroom ? "outline" : "primary")} size={classroom ? "sm" : "md"} onClick={() => setOpen(true)}>
        {classroom ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
        {classroom ? t("common.edit") : t("admin.classrooms.create")}
      </Button>
      <Modal open={open} onClose={close} title={classroom ? t("admin.classrooms.editTitle") : t("admin.classrooms.createTitle")} size="lg">
        <ClassroomForm key={round} classroom={classroom} seasons={seasons} defaultSeasonId={defaultSeasonId} tracks={tracks} close={close} />
      </Modal>
    </>
  );
}

function ClassroomForm({
  classroom,
  seasons,
  defaultSeasonId,
  tracks,
  close,
}: {
  classroom?: ClassroomValues;
  seasons: SeasonOption[];
  defaultSeasonId?: string;
  tracks: string[];
  close: () => void;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [state, action] = useActionState(saveClassroomAction.bind(null, classroom?.id ?? null), null);
  const [color, setColor] = useState(classroom?.color ?? "blue");

  useEffect(() => {
    if (!state?.ok) return;
    close();
    if (!classroom && state.data?.id) router.push(`/admin/classrooms/${state.data.id}`);
  }, [state, close, classroom, router]);

  return (
    <form action={action} className="space-y-4">
      <FormMessage state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("admin.classrooms.fields.name")} name="name" state={state} required className="sm:col-span-2">
          <Input id="name" name="name" defaultValue={classroom?.name} required minLength={2} maxLength={120} placeholder={t("admin.classrooms.fields.namePh")} />
        </Field>
        <Field label={t("admin.classrooms.fields.track")} name="track" state={state} hint={t("admin.classrooms.fields.trackHint")}>
          <Input id="track" name="track" defaultValue={classroom?.track ?? ""} maxLength={80} list="track-options" placeholder="Backend" />
          <datalist id="track-options">
            {tracks.map((tr) => (
              <option key={tr} value={tr} />
            ))}
          </datalist>
        </Field>
        <Field label={t("admin.classrooms.fields.season")} name="seasonId" state={state} required>
          <Select id="seasonId" name="seasonId" defaultValue={classroom?.seasonId ?? defaultSeasonId} required>
            {seasons.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("admin.classrooms.fields.room")} name="room" state={state}>
          <Input id="room" name="room" defaultValue={classroom?.room ?? ""} maxLength={80} placeholder="Lab 301" />
        </Field>
        <Field label={t("admin.classrooms.fields.schedule")} name="schedule" state={state}>
          <Input id="schedule" name="schedule" defaultValue={classroom?.schedule ?? ""} maxLength={200} placeholder={t("admin.classrooms.fields.schedulePh")} />
        </Field>
        <Field label={t("admin.classrooms.fields.description")} name="description" state={state} className="sm:col-span-2">
          <Textarea id="description" name="description" rows={3} defaultValue={classroom?.description ?? ""} maxLength={2000} />
        </Field>
      </div>
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">{t("admin.classrooms.fields.color")}</legend>
        <input type="hidden" name="color" value={color} />
        <div className="flex flex-wrap gap-2">
          {Object.entries(CLASSROOM_COLORS).map(([key, gradient]) => (
            <button
              key={key}
              type="button"
              onClick={() => setColor(key)}
              aria-label={key}
              aria-pressed={color === key}
              className={cn(
                "h-9 w-9 rounded-full bg-gradient-to-br ring-offset-2 transition dark:ring-offset-slate-900",
                gradient,
                color === key ? "ring-2 ring-brand-500" : "hover:scale-110",
              )}
            />
          ))}
        </div>
      </fieldset>
      <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
        <Button variant="ghost" onClick={close}>
          {t("common.cancel")}
        </Button>
        <SubmitButton pendingText={t("common.saving")}>{classroom ? t("common.save") : t("common.create")}</SubmitButton>
      </div>
    </form>
  );
}
