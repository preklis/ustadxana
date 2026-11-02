"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, ChevronDown, LaptopMinimal, XCircle } from "lucide-react";
import { useI18n } from "@/i18n/client";
import { cn, formatDate, fullName } from "@/lib/utils";
import { Avatar, Badge, Card } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/interactive";
import { Field, FormMessage, SubmitButton, Textarea } from "@/components/ui/form";
import { ProfileDetails, type ProfileData } from "@/components/admin/profile-details";
import { approveStudentsAction, rejectStudentAction } from "./actions";

export type Application = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  avatarFileId: string | null;
  createdAt: Date;
  profile: (ProfileData & { updatedAt: Date; createdAt: Date }) | null;
};
export type ClassroomChoice = { id: string; name: string; track: string | null };

function trackMatches(c: ClassroomChoice, track: string | null | undefined) {
  if (!track) return false;
  const t = track.trim().toLowerCase();
  return (c.track ?? c.name).trim().toLowerCase() === t;
}

export function ApprovalsBoard({ applications, classrooms }: { applications: Application[]; classrooms: ClassroomChoice[] }) {
  const { t } = useI18n();
  const [selected, setSelected] = useState<string[]>([]);
  const [approveFor, setApproveFor] = useState<string[] | null>(null);
  const [rejectFor, setRejectFor] = useState<Application | null>(null);

  // drop selections that went away after revalidation
  useEffect(() => {
    setSelected((s) => s.filter((id) => applications.some((a) => a.id === id)));
  }, [applications]);

  const allSelected = applications.length > 0 && selected.length === applications.length;
  const approving = approveFor ? applications.filter((a) => approveFor.includes(a.id)) : [];
  const preselect =
    approving.length === 1
      ? classrooms.filter((c) => trackMatches(c, approving[0].profile?.preferredTrack)).map((c) => c.id)
      : [];

  return (
    <div className="space-y-3">
      <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white/95 px-4 py-2.5 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
        <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            checked={allSelected}
            onChange={(e) => setSelected(e.target.checked ? applications.map((a) => a.id) : [])}
          />
          {selected.length ? t("admin.approvals.selected", { n: selected.length }) : t("admin.approvals.selectAll")}
        </label>
        <Button size="sm" disabled={!selected.length} onClick={() => setApproveFor(selected)}>
          <CheckCircle2 className="h-4 w-4" />
          {t("admin.approvals.approveSelected")}
        </Button>
      </div>

      {applications.map((a) => (
        <ApplicationCard
          key={a.id}
          app={a}
          checked={selected.includes(a.id)}
          onCheck={(on) => setSelected((s) => (on ? [...s, a.id] : s.filter((x) => x !== a.id)))}
          onApprove={() => setApproveFor([a.id])}
          onReject={() => setRejectFor(a)}
        />
      ))}

      <Modal
        open={!!approveFor}
        onClose={() => setApproveFor(null)}
        title={approving.length === 1 ? t("admin.approvals.approveTitleOne", { name: fullName(approving[0]) }) : t("admin.approvals.approveTitleMany", { n: approving.length })}
      >
        {approveFor && (
          <ApproveForm
            key={approveFor.join(",")}
            userIds={approveFor}
            classrooms={classrooms}
            preselect={preselect}
            onDone={() => {
              setSelected((s) => s.filter((id) => !approveFor.includes(id)));
              setApproveFor(null);
            }}
            onCancel={() => setApproveFor(null)}
          />
        )}
      </Modal>

      <Modal open={!!rejectFor} onClose={() => setRejectFor(null)} title={rejectFor ? t("admin.approvals.rejectTitle", { name: fullName(rejectFor) }) : ""}>
        {rejectFor && <RejectForm key={rejectFor.id} userId={rejectFor.id} onDone={() => setRejectFor(null)} onCancel={() => setRejectFor(null)} />}
      </Modal>
    </div>
  );
}

function ApplicationCard({
  app,
  checked,
  onCheck,
  onApprove,
  onReject,
}: {
  app: Application;
  checked: boolean;
  onCheck: (on: boolean) => void;
  onApprove: () => void;
  onReject: () => void;
}) {
  const { t, locale } = useI18n();
  const [open, setOpen] = useState(false);
  const p = app.profile;
  return (
    <Card className={cn("transition", checked && "border-brand-300 ring-1 ring-brand-200 dark:border-brand-800 dark:ring-brand-900")}>
      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <input
            type="checkbox"
            aria-label={fullName(app)}
            className="mt-2.5 h-4 w-4 shrink-0 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            checked={checked}
            onChange={(e) => onCheck(e.target.checked)}
          />
          <Avatar user={app} size={40} />
          <div className="min-w-0">
            <Link href={`/admin/users/${app.id}`} className="font-semibold text-slate-900 hover:text-brand-600 dark:text-white">
              {fullName(app)}
            </Link>
            <p className="truncate text-sm text-slate-500">{app.email}</p>
            {p && (
              <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                {p.university} · {p.faculty} · {t("admin.approvals.year", { n: p.courseYear })}
              </p>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {p?.preferredTrack && <Badge tone="blue">{p.preferredTrack}</Badge>}
              {p && !p.hasLaptop && (
                <Badge tone="red">
                  <LaptopMinimal className="mr-1 h-3 w-3" />
                  {t("admin.approvals.noLaptop")}
                </Badge>
              )}
              <span className="text-xs text-slate-400">
                {t("admin.approvals.submittedAt", { date: formatDate(p?.updatedAt ?? app.createdAt, locale, true) })}
              </span>
            </div>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
          <Button size="sm" variant="ghost" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
            <ChevronDown className={cn("h-4 w-4 transition", open && "rotate-180")} />
            {open ? t("admin.approvals.hideProfile") : t("admin.approvals.showProfile")}
          </Button>
          <Button size="sm" variant="outline" onClick={onReject}>
            <XCircle className="h-4 w-4 text-red-600" />
            {t("admin.approvals.reject")}
          </Button>
          <Button size="sm" onClick={onApprove}>
            <CheckCircle2 className="h-4 w-4" />
            {t("admin.approvals.approve")}
          </Button>
        </div>
      </div>
      {open && (
        <div className="border-t border-slate-100 p-4 dark:border-slate-800">
          {p ? <ProfileDetails profile={p} email={app.email} /> : <p className="text-sm text-slate-500">{t("admin.profile.none")}</p>}
        </div>
      )}
    </Card>
  );
}

function ApproveForm({
  userIds,
  classrooms,
  preselect,
  onDone,
  onCancel,
}: {
  userIds: string[];
  classrooms: ClassroomChoice[];
  preselect: string[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  const [state, action] = useActionState(approveStudentsAction, null);
  const [picked, setPicked] = useState<string[]>(preselect);
  useEffect(() => {
    if (state?.ok) onDone();
  }, [state, onDone]);

  return (
    <form action={action} className="space-y-4">
      <FormMessage state={state} />
      {userIds.map((id) => (
        <input key={id} type="hidden" name="userIds" value={id} />
      ))}
      <p className="text-sm text-slate-600 dark:text-slate-300">{t("admin.approvals.approveText")}</p>
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">
          {t("admin.approvals.enrollIn")} <span className="font-normal text-slate-400">({t("common.optional")})</span>
        </legend>
        {classrooms.length === 0 ? (
          <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-500 dark:bg-slate-800/60">{t("admin.approvals.noClassrooms")}</p>
        ) : (
          <div className="max-h-64 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2 dark:border-slate-700">
            {classrooms.map((c) => (
              <label key={c.id} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-800">
                <input
                  type="checkbox"
                  name="classroomIds"
                  value={c.id}
                  checked={picked.includes(c.id)}
                  onChange={(e) => setPicked(e.target.checked ? [...picked, c.id] : picked.filter((x) => x !== c.id))}
                  className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                />
                <span className="flex-1 truncate text-slate-800 dark:text-slate-200">{c.name}</span>
                {c.track && <span className="text-xs text-slate-400">{c.track}</span>}
              </label>
            ))}
          </div>
        )}
        {preselect.length > 0 && <p className="mt-1.5 text-xs text-slate-500">{t("admin.approvals.preselectedHint")}</p>}
      </fieldset>
      <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
        <Button variant="ghost" onClick={onCancel}>
          {t("common.cancel")}
        </Button>
        <SubmitButton>
          <CheckCircle2 className="h-4 w-4" />
          {userIds.length > 1 ? t("admin.approvals.approveN", { n: userIds.length }) : t("admin.approvals.approve")}
        </SubmitButton>
      </div>
    </form>
  );
}

function RejectForm({ userId, onDone, onCancel }: { userId: string; onDone: () => void; onCancel: () => void }) {
  const { t } = useI18n();
  const [state, action] = useActionState(rejectStudentAction.bind(null, userId), null);
  useEffect(() => {
    if (state?.ok) onDone();
  }, [state, onDone]);
  return (
    <form action={action} className="space-y-4">
      <FormMessage state={state} />
      <Field label={t("admin.approvals.rejectionReason")} name="reason" state={state} required hint={t("admin.approvals.reasonHint")}>
        <Textarea id="reason" name="reason" rows={4} required minLength={3} maxLength={2000} />
      </Field>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel}>
          {t("common.cancel")}
        </Button>
        <SubmitButton variant="danger">{t("admin.approvals.reject")}</SubmitButton>
      </div>
    </form>
  );
}
