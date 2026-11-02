import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { getI18n } from "@/i18n/server";
import { Card, CardBody } from "@/components/ui/primitives";
import { ProfileForm } from "./profile-form";
import { acceptedStudentApplication } from "@/lib/applications/server";
import { mappedValue, parseQuestions, type Answers } from "@/lib/applications/questions";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t("auth.onboarding.title") };
}

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  const user = await requireUser();
  if (user.role !== "STUDENT" || user.status === "ACTIVE" || user.status === "SUSPENDED") redirect("/dashboard");
  if (user.status === "PENDING_APPROVAL" && !(await searchParams).edit) redirect("/pending");
  const { t } = await getI18n();
  const profile = await db.studentProfile.findUnique({ where: { userId: user.id } });
  const tracks = await db.classroom.findMany({
    where: { archived: false, season: { registrationOpen: true } },
    select: { track: true, name: true },
  });
  const trackOptions = [...new Set(tracks.map((c) => c.track || c.name))];
  const fromApplication = profile ? null : await prefillFromApplication(user.email);

  return (
    <div>
      <Steps current={2} labels={[t("auth.onboarding.step1"), t("auth.onboarding.step2"), t("auth.onboarding.step3")]} />
      <h1 className="mt-8 text-2xl font-bold tracking-tight">{t("auth.onboarding.title")}</h1>
      <p className="mt-1 text-sm text-slate-500">{t("auth.onboarding.subtitle")}</p>
      <Card className="mt-6">
        <CardBody>
          <ProfileForm
            user={{ firstName: user.firstName, lastName: user.lastName, email: user.email }}
            profile={profile ? { ...profile, birthDate: profile.birthDate?.toISOString().slice(0, 10) ?? "" } : fromApplication}
            trackOptions={trackOptions}
          />
        </CardBody>
      </Card>
    </div>
  );
}

function Steps({ current, labels }: { current: number; labels: string[] }) {
  return (
    <ol className="flex items-center gap-2 text-xs font-medium sm:text-sm">
      {labels.map((l, i) => {
        const n = i + 1;
        const done = n < current;
        const active = n === current;
        return (
          <li key={l} className="flex flex-1 items-center gap-2">
            <span
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                done ? "bg-emerald-500 text-white" : active ? "bg-brand-600 text-brand-fg" : "bg-slate-200 text-slate-500 dark:bg-slate-800"
              }`}
            >
              {done ? "✓" : n}
            </span>
            <span className={active ? "text-slate-900 dark:text-white" : "text-slate-500"}>{l}</span>
            {n < labels.length && <span className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />}
          </li>
        );
      })}
    </ol>
  );
}

// answers from an accepted application fill in the profile so they don't type everything twice
async function prefillFromApplication(email: string) {
  const app = await acceptedStudentApplication(email);
  if (!app) return null;
  const qs = parseQuestions(app.form.questions);
  const a = app.answers as Answers;
  const v = (f: Parameters<typeof mappedValue>[2]) => mappedValue(qs, a, f);
  const year = parseInt(v("courseYear"), 10);
  return {
    phone: v("phone"),
    birthDate: /^d{4}-d{2}-d{2}$/.test(v("birthDate")) ? v("birthDate") : "",
    gender: null,
    university: v("university"),
    faculty: v("faculty"),
    courseYear: Number.isInteger(year) && year >= 1 && year <= 6 ? year : 1,
    studentIdNumber: null,
    github: v("github") || null,
    linkedin: v("linkedin") || null,
    portfolio: v("portfolio") || null,
    bio: null,
    preferredTrack: v("preferredTrack") || null,
    motivation: v("motivation") || null,
    priorExperience: v("priorExperience") || null,
    hasLaptop: true,
  };
}
