"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { AttendanceStatus } from "@prisma/client";
import { CheckCheck, Eraser, MessageSquarePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormMessage, Input, SubmitButton } from "@/components/ui/form";
import { Avatar } from "@/components/ui/primitives";
import { useFormAction } from "@/components/ui/use-form-action";
import { useI18n } from "@/i18n/client";
import { cn, fullName } from "@/lib/utils";
import { ATTENDANCE_STATUSES, STATUS_ACTIVE, STATUS_STYLE } from "@/components/attendance/constants";
import { saveAttendance } from "./actions";

type Row = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  avatarFileId: string | null;
  status: AttendanceStatus | null;
  note: string | null;
};

export function AttendanceForm({
  classroomId,
  date,
  maxDate,
  title,
  students,
  isExisting,
}: {
  classroomId: string;
  date: string;
  maxDate: string;
  title: string;
  students: Row[];
  isExisting: boolean;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const { state, pending, onSubmit } = useFormAction(saveAttendance);
  const [statuses, setStatuses] = useState<Record<string, AttendanceStatus | null>>(() =>
    Object.fromEntries(students.map((s) => [s.id, s.status])),
  );
  const [openNotes, setOpenNotes] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(students.filter((s) => s.note).map((s) => [s.id, true])),
  );

  const counts = useMemo(() => {
    const c: Record<string, number> = { PRESENT: 0, LATE: 0, ABSENT: 0, EXCUSED: 0, none: 0 };
    for (const s of students) c[statuses[s.id] ?? "none"]++;
    return c;
  }, [statuses, students]);

  function setAll(v: AttendanceStatus | null) {
    setStatuses(Object.fromEntries(students.map((s) => [s.id, v])));
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <input type="hidden" name="classroomId" value={classroomId} />
      <input type="hidden" name="date" value={date} />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="grid gap-3 sm:grid-cols-[auto_minmax(0,16rem)]">
          <label className="space-y-1.5">
            <span className="block text-sm font-medium text-slate-700 dark:text-slate-300">{t("attendance.date")}</span>
            <Input
              type="date"
              value={date}
              max={maxDate}
              onChange={(e) => {
                if (e.target.value) router.push(`/classrooms/${classroomId}/attendance?view=take&date=${e.target.value}`);
              }}
            />
          </label>
          <label className="space-y-1.5">
            <span className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              {t("attendance.sessionTitle")} <span className="font-normal text-slate-400">({t("common.optional")})</span>
            </span>
            <Input name="title" defaultValue={title} maxLength={120} placeholder={t("attendance.sessionTitlePh")} />
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setAll("PRESENT")}>
            <CheckCheck className="h-4 w-4" />
            {t("attendance.markAllPresent")}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setAll(null)}>
            <Eraser className="h-4 w-4" />
            {t("attendance.clearAll")}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        {ATTENDANCE_STATUSES.map((s) => (
          <span key={s} className={cn("rounded-full px-2.5 py-1 font-medium", STATUS_STYLE[s])}>
            {t(`attendance.status.${s}`)}: {counts[s]}
          </span>
        ))}
        <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          {t("attendance.unmarked")}: {counts.none}
        </span>
        {isExisting && <span className="px-1 py-1 text-slate-500">{t("attendance.editingExisting")}</span>}
      </div>

      <FormMessage state={state} />

      <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
        {students.map((s) => {
          const current = statuses[s.id];
          return (
            <li key={s.id} className="px-4 py-3">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar user={s} size={34} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">{fullName(s)}</p>
                    <p className="truncate text-xs text-slate-500">{s.email}</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <input type="hidden" name={`status:${s.id}`} value={current ?? ""} />
                  {ATTENDANCE_STATUSES.map((st) => (
                    <button
                      key={st}
                      type="button"
                      aria-pressed={current === st}
                      onClick={() => setStatuses((prev) => ({ ...prev, [s.id]: prev[s.id] === st ? null : st }))}
                      className={cn(
                        "h-8 rounded-lg border px-3 text-xs font-semibold transition",
                        current === st
                          ? STATUS_ACTIVE[st]
                          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800",
                      )}
                    >
                      {t(`attendance.status.${st}`)}
                    </button>
                  ))}
                  <button
                    type="button"
                    title={t("attendance.addNote")}
                    aria-label={t("attendance.addNote")}
                    onClick={() => setOpenNotes((p) => ({ ...p, [s.id]: !p[s.id] }))}
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800",
                      openNotes[s.id] && "text-brand-600",
                    )}
                  >
                    <MessageSquarePlus className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className={cn("mt-2 md:pl-[46px]", !openNotes[s.id] && "hidden")}>
                <Input name={`note:${s.id}`} defaultValue={s.note ?? ""} maxLength={300} placeholder={t("attendance.notePh")} className="h-9" />
              </div>
            </li>
          );
        })}
      </ul>

      <div className="flex items-center justify-end gap-3">
        <SubmitButton pending={pending} pendingText={t("common.saving")}>{t("attendance.save")}</SubmitButton>
      </div>
    </form>
  );
}
