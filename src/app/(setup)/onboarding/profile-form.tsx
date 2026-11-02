"use client";

import { Checkbox, Field, FormMessage, Input, Select, SubmitButton, Textarea } from "@/components/ui/form";
import { useFormAction } from "@/components/ui/use-form-action";
import { useI18n } from "@/i18n/client";
import { submitProfile } from "@/app/(auth)/actions";

type P = {
  phone?: string;
  birthDate?: string;
  gender?: string | null;
  university?: string;
  faculty?: string;
  courseYear?: number;
  studentIdNumber?: string | null;
  github?: string | null;
  linkedin?: string | null;
  portfolio?: string | null;
  preferredTrack?: string | null;
  priorExperience?: string | null;
  motivation?: string | null;
  bio?: string | null;
  hasLaptop?: boolean;
} | null;

export function ProfileForm({ user, profile, trackOptions }: { user: { firstName: string; lastName: string; email: string }; profile: P; trackOptions: string[] }) {
  const { t } = useI18n();
  const { state, pending, onSubmit } = useFormAction(submitProfile);
  const p = profile ?? {};
  return (
    <form onSubmit={onSubmit} className="space-y-8">
      <FormMessage state={state} />

      <Section title={t("auth.onboarding.personal")}>
        <Field label={t("auth.firstName")} name="firstName" state={state} required>
          <Input id="firstName" name="firstName" defaultValue={user.firstName} required />
        </Field>
        <Field label={t("auth.lastName")} name="lastName" state={state} required>
          <Input id="lastName" name="lastName" defaultValue={user.lastName} required />
        </Field>
        <Field label={t("common.email")}>
          <Input value={user.email} disabled readOnly />
        </Field>
        <Field label={t("auth.onboarding.phone")} name="phone" state={state} required>
          <Input id="phone" name="phone" type="tel" placeholder="+994 50 123 45 67" defaultValue={p.phone ?? ""} required />
        </Field>
        <Field label={t("auth.onboarding.birthDate")} name="birthDate" state={state}>
          <Input id="birthDate" name="birthDate" type="date" defaultValue={p.birthDate ?? ""} />
        </Field>
        <Field label={t("auth.onboarding.gender")} name="gender" state={state}>
          <Select id="gender" name="gender" defaultValue={p.gender ?? ""}>
            <option value="">—</option>
            <option value="female">{t("auth.onboarding.female")}</option>
            <option value="male">{t("auth.onboarding.male")}</option>
          </Select>
        </Field>
      </Section>

      <Section title={t("auth.onboarding.education")}>
        <Field label={t("auth.onboarding.university")} name="university" state={state} required>
          <Input id="university" name="university" defaultValue={p.university ?? ""} required />
        </Field>
        <Field label={t("auth.onboarding.faculty")} name="faculty" state={state} required>
          <Input id="faculty" name="faculty" placeholder={t("auth.onboarding.facultyPh")} defaultValue={p.faculty ?? ""} required />
        </Field>
        <Field label={t("auth.onboarding.courseYear")} name="courseYear" state={state} required>
          <Select id="courseYear" name="courseYear" defaultValue={String(p.courseYear ?? 1)}>
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("auth.onboarding.studentId")} name="studentIdNumber" state={state}>
          <Input id="studentIdNumber" name="studentIdNumber" defaultValue={p.studentIdNumber ?? ""} />
        </Field>
      </Section>

      <Section title={t("auth.onboarding.links")}>
        <Field label="GitHub" name="github" state={state}>
          <Input id="github" name="github" placeholder="https://github.com/…" defaultValue={p.github ?? ""} />
        </Field>
        <Field label="LinkedIn" name="linkedin" state={state}>
          <Input id="linkedin" name="linkedin" placeholder="https://linkedin.com/in/…" defaultValue={p.linkedin ?? ""} />
        </Field>
        <Field label={t("auth.onboarding.portfolio")} name="portfolio" state={state} className="sm:col-span-2">
          <Input id="portfolio" name="portfolio" placeholder="https://…" defaultValue={p.portfolio ?? ""} />
        </Field>
      </Section>

      <Section title={t("auth.onboarding.camp")} single>
        <Field label={t("auth.onboarding.preferredTrack")} name="preferredTrack" state={state}>
          {trackOptions.length ? (
            <Select id="preferredTrack" name="preferredTrack" defaultValue={p.preferredTrack ?? ""}>
              <option value="">—</option>
              {trackOptions.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </Select>
          ) : (
            <Input id="preferredTrack" name="preferredTrack" defaultValue={p.preferredTrack ?? ""} />
          )}
        </Field>
        <Field label={t("auth.onboarding.priorExperience")} name="priorExperience" state={state} hint={t("auth.onboarding.priorExperienceHint")}>
          <Textarea id="priorExperience" name="priorExperience" rows={3} defaultValue={p.priorExperience ?? ""} />
        </Field>
        <Field label={t("auth.onboarding.motivation")} name="motivation" state={state} required hint={t("auth.onboarding.motivationHint")}>
          <Textarea id="motivation" name="motivation" rows={5} defaultValue={p.motivation ?? ""} required minLength={20} />
        </Field>
        <Field label={t("auth.onboarding.bio")} name="bio" state={state}>
          <Textarea id="bio" name="bio" rows={3} defaultValue={p.bio ?? ""} />
        </Field>
        <Checkbox name="hasLaptop" defaultChecked={p.hasLaptop ?? true} label={t("auth.onboarding.hasLaptop")} />
      </Section>

      <div className="flex justify-end border-t border-slate-100 pt-6 dark:border-slate-800">
        <SubmitButton size="lg" pending={pending}>{t("auth.onboarding.submit")}</SubmitButton>
      </div>
    </form>
  );
}

function Section({ title, children, single }: { title: string; children: React.ReactNode; single?: boolean }) {
  return (
    <fieldset>
      <legend className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">{title}</legend>
      <div className={single ? "space-y-4" : "grid gap-4 sm:grid-cols-2"}>{children}</div>
    </fieldset>
  );
}
