import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarClock, Eye, Lock } from "lucide-react";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { verifiedApplyEmail } from "@/lib/applications/server";
import { isFormLive, parseQuestions, type Answers } from "@/lib/applications/questions";
import { getI18n } from "@/i18n/server";
import { formatDate } from "@/lib/utils";
import { Alert, Card, CardBody } from "@/components/ui/primitives";
import { ApplyEmailStep, ApplyForm, QuestionList } from "./apply-client";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ preview?: string }> };

export async function generateMetadata({ params }: Props) {
  const form = await db.applicationForm.findUnique({ where: { slug: (await params).slug }, select: { title: true } });
  return { title: form?.title ?? "404" };
}

export default async function ApplyFormPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const form = await db.applicationForm.findUnique({ where: { slug }, include: { season: { select: { name: true } } } });
  if (!form) notFound();
  const [{ t, locale }, user, sp] = await Promise.all([getI18n(), getCurrentUser(), searchParams]);
  const staff = !!user && (can(user, "MANAGE_APPLICATIONS") || can(user, "REVIEW_APPLICATIONS"));
  const preview = sp.preview === "1" && staff;
  const live = isFormLive(form);
  const questions = parseQuestions(form.questions);

  const header = (
    <div className="mb-8">
      <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">
        {t(`applications.kinds.${form.kind}`)}
        {form.season && <span className="text-slate-400"> · {form.season.name}</span>}
      </p>
      <h1 className="bc-page-title mt-2 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl dark:text-white">{form.title}</h1>
      {form.description && <p className="mt-4 whitespace-pre-wrap leading-relaxed text-slate-600 dark:text-slate-300">{form.description}</p>}
      {form.closesAt && live && (
        <p className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          <CalendarClock className="h-3.5 w-3.5" />
          {t("applications.apply.until", { date: formatDate(form.closesAt, locale) })}
        </p>
      )}
    </div>
  );

  if (preview) {
    return (
      <div className="animate-fade-up">
        <Alert tone="yellow" className="mb-6" title={t("applications.builder.preview")}>
          <span className="inline-flex items-center gap-1.5">
            <Eye className="h-4 w-4" />
            {live ? t("applications.forms.open") : t("applications.forms.closed")}
          </span>
        </Alert>
        {header}
        <Card>
          <CardBody className="sm:p-8">
            <QuestionList questions={questions} initial={{}} />
          </CardBody>
        </Card>
      </div>
    );
  }

  if (!live) {
    return (
      <div className="animate-fade-up">
        {header}
        <Card>
          <CardBody className="flex items-start gap-4 sm:p-8">
            <Lock className="mt-0.5 h-6 w-6 shrink-0 text-slate-400" />
            <div>
              <h2 className="font-semibold text-slate-900 dark:text-white">{t("applications.apply.closed")}</h2>
              <p className="mt-1 text-sm text-slate-500">{t("applications.apply.closedText")}</p>
              <Link href="/apply" className="mt-4 inline-block text-sm font-semibold text-brand-600 hover:underline">
                {t("applications.apply.back")}
              </Link>
            </div>
          </CardBody>
        </Card>
      </div>
    );
  }

  const email = user && user.status !== "SUSPENDED" ? user.email : await verifiedApplyEmail(form.id);
  const existing = email
    ? await db.application.findUnique({ where: { formId_email: { formId: form.id, email } }, select: { answers: true, submittedAt: true } })
    : null;

  return (
    <div className="animate-fade-up">
      {header}
      <Card>
        <CardBody className="sm:p-8">
          {!email ? (
            <ApplyEmailStep formId={form.id} />
          ) : (
            <ApplyForm
              formId={form.id}
              slug={form.slug}
              email={email}
              signedIn={!!user}
              questions={questions}
              initial={(existing?.answers as Answers | undefined) ?? null}
              submittedAt={existing ? formatDate(existing.submittedAt, locale, true) : null}
              allowEdit={form.allowEdit}
              confirmation={form.confirmation}
            />
          )}
        </CardBody>
      </Card>
      {!user && (
        <p className="mt-6 text-center text-sm text-slate-500">
          <Link href="/login" className="font-medium hover:text-brand-600">
            {t("applications.apply.signIn")}
          </Link>
        </p>
      )}
    </div>
  );
}
