"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { Camera, Check, Loader2 } from "lucide-react";
import { Checkbox, Field, FormMessage, Input, Select, SubmitButton, Textarea } from "@/components/ui/form";
import { useI18n } from "@/i18n/client";
import { LOCALES } from "@/i18n/core";
import { setLocaleAction } from "@/app/(auth)/actions";
import { useFormAction } from "@/components/ui/use-form-action";
import { cn } from "@/lib/utils";
import { updateMyInfo, updateStudentProfile, uploadAvatar } from "./actions";

export function InfoForm({ firstName, lastName }: { firstName: string; lastName: string }) {
  const { t } = useI18n();
  const { state, pending, onSubmit } = useFormAction(updateMyInfo);
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <FormMessage state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("auth.firstName")} name="firstName" state={state} required>
          <Input id="firstName" name="firstName" defaultValue={firstName} maxLength={60} required />
        </Field>
        <Field label={t("auth.lastName")} name="lastName" state={state} required>
          <Input id="lastName" name="lastName" defaultValue={lastName} maxLength={60} required />
        </Field>
      </div>
      <div className="flex justify-end">
        <SubmitButton pending={pending} pendingText={t("common.saving")}>{t("common.save")}</SubmitButton>
      </div>
    </form>
  );
}

export function AvatarForm() {
  const { t } = useI18n();
  const [state, action] = useActionState(uploadAvatar, null);
  const formRef = useRef<HTMLFormElement>(null);
  const [tooBig, setTooBig] = useState(false);
  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);
  return (
    <form ref={formRef} action={action} className="space-y-2">
      <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800">
        <Camera className="h-4 w-4" />
        {t("profile.avatar.change")}
        <input
          type="file"
          name="avatar"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            if (f.size > 5 * 1024 * 1024) {
              setTooBig(true);
              e.target.value = "";
              return;
            }
            setTooBig(false);
            formRef.current?.requestSubmit();
          }}
        />
      </label>
      <AvatarPending />
      <p className="text-xs text-slate-500">{t("profile.avatar.hint")}</p>
      {tooBig ? <FormMessage state={{ ok: false, error: "profile.avatar.tooLarge" }} /> : <FormMessage state={state} />}
    </form>
  );
}

function AvatarPending() {
  const { t } = useI18n();
  const { pending } = useFormStatus();
  if (!pending) return null;
  return (
    <p className="flex items-center gap-1.5 text-xs text-slate-500">
      <Loader2 className="h-3.5 w-3.5 animate-spin" />
      {t("profile.avatar.uploading")}
    </p>
  );
}

export function LanguageForm({ current }: { current: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-2">
      {LOCALES.map((l) => (
        <button
          key={l}
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              await setLocaleAction(l);
              setSaved(true);
              router.refresh();
            })
          }
          className={cn(
            "inline-flex h-10 items-center gap-2 rounded-lg border px-4 text-sm font-medium transition",
            current === l
              ? "border-brand-600 bg-brand-50 text-brand-700 dark:bg-brand-950/50 dark:text-brand-300"
              : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800",
          )}
        >
          {current === l && <Check className="h-4 w-4" />}
          {t(`profile.languages.${l}`)}
        </button>
      ))}
      {pending && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
      {saved && !pending && <span className="text-sm text-emerald-600">{t("common.saved")}</span>}
    </div>
  );
}

type StudentProfileData = {
  phone: string;
  birthDate: string;
  gender: string;
  university: string;
  faculty: string;
  courseYear: number;
  studentIdNumber: string;
  github: string;
  linkedin: string;
  portfolio: string;
  bio: string;
  priorExperience: string;
  hasLaptop: boolean;
};

export function StudentProfileForm({ profile }: { profile: StudentProfileData }) {
  const { t } = useI18n();
  const { state, pending, onSubmit } = useFormAction(updateStudentProfile);
  const p = profile;
  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <FormMessage state={state} />
      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">{t("auth.onboarding.personal")}</legend>
        <Field label={t("auth.onboarding.phone")} name="phone" state={state} required>
          <Input id="phone" name="phone" type="tel" defaultValue={p.phone} required maxLength={30} />
        </Field>
        <Field label={t("auth.onboarding.birthDate")} name="birthDate" state={state}>
          <Input id="birthDate" name="birthDate" type="date" defaultValue={p.birthDate} />
        </Field>
        <Field label={t("auth.onboarding.gender")} name="gender" state={state}>
          <Select id="gender" name="gender" defaultValue={p.gender}>
            <option value="">—</option>
            <option value="female">{t("auth.onboarding.female")}</option>
            <option value="male">{t("auth.onboarding.male")}</option>
          </Select>
        </Field>
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">{t("auth.onboarding.education")}</legend>
        <Field label={t("auth.onboarding.university")} name="university" state={state} required>
          <Input id="university" name="university" defaultValue={p.university} required maxLength={120} />
        </Field>
        <Field label={t("auth.onboarding.faculty")} name="faculty" state={state} required>
          <Input id="faculty" name="faculty" defaultValue={p.faculty} required maxLength={120} />
        </Field>
        <Field label={t("auth.onboarding.courseYear")} name="courseYear" state={state} required>
          <Select id="courseYear" name="courseYear" defaultValue={String(p.courseYear)}>
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("auth.onboarding.studentId")} name="studentIdNumber" state={state}>
          <Input id="studentIdNumber" name="studentIdNumber" defaultValue={p.studentIdNumber} maxLength={40} />
        </Field>
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">{t("auth.onboarding.links")}</legend>
        <Field label="GitHub" name="github" state={state}>
          <Input id="github" name="github" type="url" placeholder="https://github.com/…" defaultValue={p.github} />
        </Field>
        <Field label="LinkedIn" name="linkedin" state={state}>
          <Input id="linkedin" name="linkedin" type="url" placeholder="https://linkedin.com/in/…" defaultValue={p.linkedin} />
        </Field>
        <Field label={t("auth.onboarding.portfolio")} name="portfolio" state={state} className="sm:col-span-2">
          <Input id="portfolio" name="portfolio" type="url" placeholder="https://…" defaultValue={p.portfolio} />
        </Field>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">{t("profile.about")}</legend>
        <Field label={t("auth.onboarding.bio")} name="bio" state={state}>
          <Textarea id="bio" name="bio" rows={3} defaultValue={p.bio} maxLength={1000} />
        </Field>
        <Field label={t("auth.onboarding.priorExperience")} name="priorExperience" state={state} hint={t("auth.onboarding.priorExperienceHint")}>
          <Textarea id="priorExperience" name="priorExperience" rows={3} defaultValue={p.priorExperience} maxLength={2000} />
        </Field>
        <Checkbox name="hasLaptop" defaultChecked={p.hasLaptop} label={t("auth.onboarding.hasLaptop")} />
      </fieldset>

      <div className="flex justify-end border-t border-slate-100 pt-4 dark:border-slate-800">
        <SubmitButton pending={pending} pendingText={t("common.saving")}>{t("common.save")}</SubmitButton>
      </div>
    </form>
  );
}
