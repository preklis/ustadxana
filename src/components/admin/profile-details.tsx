"use client";

import { ExternalLink } from "lucide-react";
import { useI18n } from "@/i18n/client";
import { formatDate } from "@/lib/utils";

export type ProfileData = {
  phone: string;
  birthDate: Date | string | null;
  gender: string | null;
  university: string;
  faculty: string;
  courseYear: number;
  studentIdNumber: string | null;
  github: string | null;
  linkedin: string | null;
  portfolio: string | null;
  bio: string | null;
  preferredTrack: string | null;
  motivation: string | null;
  priorExperience: string | null;
  hasLaptop: boolean;
  createdAt?: Date | string;
  updatedAt?: Date | string;
};

function href(v: string) {
  return /^https?:\/\//i.test(v) ? v : `https://${v}`;
}

export function ProfileDetails({ profile, email }: { profile: ProfileData; email?: string }) {
  const { t, locale } = useI18n();
  const links = [
    { label: "GitHub", value: profile.github },
    { label: "LinkedIn", value: profile.linkedin },
    { label: t("auth.onboarding.portfolio"), value: profile.portfolio },
  ].filter((l): l is { label: string; value: string } => !!l.value);

  const facts: { label: string; value: React.ReactNode }[] = [
    ...(email ? [{ label: t("common.email"), value: <a className="text-brand-600 hover:underline" href={`mailto:${email}`}>{email}</a> }] : []),
    { label: t("auth.onboarding.phone"), value: <a className="text-brand-600 hover:underline" href={`tel:${profile.phone.replace(/\s+/g, "")}`}>{profile.phone}</a> },
    { label: t("auth.onboarding.university"), value: profile.university },
    { label: t("auth.onboarding.faculty"), value: profile.faculty },
    { label: t("auth.onboarding.courseYear"), value: profile.courseYear },
    { label: t("auth.onboarding.studentId"), value: profile.studentIdNumber || "—" },
    { label: t("auth.onboarding.birthDate"), value: profile.birthDate ? formatDate(profile.birthDate, locale) : "—" },
    {
      label: t("auth.onboarding.gender"),
      value: profile.gender === "female" ? t("auth.onboarding.female") : profile.gender === "male" ? t("auth.onboarding.male") : "—",
    },
    { label: t("auth.onboarding.preferredTrack"), value: profile.preferredTrack || "—" },
    { label: t("admin.profile.laptop"), value: profile.hasLaptop ? t("common.yes") : <span className="font-semibold text-red-600">{t("common.no")}</span> },
    ...(profile.createdAt ? [{ label: t("admin.profile.submitted"), value: formatDate(profile.updatedAt ?? profile.createdAt, locale, true) }] : []),
  ];

  const texts = [
    { label: t("auth.onboarding.motivation"), value: profile.motivation },
    { label: t("auth.onboarding.priorExperience"), value: profile.priorExperience },
    { label: t("auth.onboarding.bio"), value: profile.bio },
  ];

  return (
    <div className="space-y-5">
      <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
        {facts.map((f) => (
          <div key={f.label} className="min-w-0">
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{f.label}</dt>
            <dd className="mt-0.5 break-words text-sm text-slate-900 dark:text-slate-100">{f.value}</dd>
          </div>
        ))}
      </dl>

      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{t("common.links")}</p>
        {links.length ? (
          <ul className="mt-1 flex flex-wrap gap-2">
            {links.map((l) => (
              <li key={l.label}>
                <a
                  href={href(l.value)}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-slate-200 px-2.5 py-1 text-sm text-brand-700 hover:bg-brand-50 dark:border-slate-700 dark:text-brand-300 dark:hover:bg-slate-800"
                >
                  <span className="font-medium">{l.label}</span>
                  <span className="truncate text-slate-500">{l.value.replace(/^https?:\/\/(www\.)?/i, "")}</span>
                  <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-sm text-slate-400">—</p>
        )}
      </div>

      {texts.map((x) => (
        <div key={x.label}>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{x.label}</p>
          <p className="mt-1 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm text-slate-800 dark:bg-slate-800/60 dark:text-slate-200">
            {x.value || <span className="text-slate-400">—</span>}
          </p>
        </div>
      ))}
    </div>
  );
}
