import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ChevronRight, EyeOff, Mail, Trash2, UserCheck } from "lucide-react";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { answerText, parseQuestions, type Answers } from "@/lib/applications/questions";
import { cn, formatDate, fullName } from "@/lib/utils";
import { getI18n } from "@/i18n/server";
import { Avatar, Badge, Card, CardBody, CardHeader, PageHeader } from "@/components/ui/primitives";
import { LinkButton } from "@/components/ui/button";
import { ActionButton } from "@/components/admin/action-button";
import { cleanParams, listOrder, listQs, listWhere } from "../../_lib";
import { deleteApplicationAction } from "../../actions";
import { ReviewForm, StatusPicker } from "../../review-panel";

type Props = {
  params: Promise<{ id: string; appId: string }>;
  searchParams: Promise<{ status?: string; q?: string; sort?: string }>;
};

export async function generateMetadata({ params }: Props) {
  const app = await db.application.findUnique({ where: { id: (await params).appId }, select: { name: true, email: true } });
  return { title: app ? app.name || app.email : "404" };
}

export default async function ApplicationDetailPage({ params, searchParams }: Props) {
  const actor = await requirePermission("REVIEW_APPLICATIONS");
  const { id, appId } = await params;
  const p = cleanParams(await searchParams);
  const app = await db.application.findUnique({
    where: { id: appId },
    include: {
      form: true,
      reviews: { orderBy: { updatedAt: "desc" }, include: { reviewer: { select: { id: true, firstName: true, lastName: true, email: true, avatarFileId: true } } } },
    },
  });
  if (!app || app.formId !== id) notFound();
  const { t, locale } = await getI18n();
  const manage = can(actor, "MANAGE_APPLICATIONS");
  const questions = parseQuestions(app.form.questions);
  const answers = app.answers as Answers;
  const mine = app.reviews.find((r) => r.reviewerId === actor.id) ?? null;
  // blind review: you see the others after you've scored, people running the form see everything
  const showOthers = !!mine || manage;
  const others = app.reviews.filter((r) => r.reviewerId !== actor.id);

  const ids = (await db.application.findMany({ where: listWhere(id, p, actor.id), orderBy: listOrder(p), select: { id: true } })).map((a) => a.id);
  const idx = ids.indexOf(app.id);
  const prevId = idx > 0 ? ids[idx - 1] : null;
  const nextId = idx >= 0 ? ids[idx + 1] ?? null : ids[0] ?? null;
  const q = listQs(p);
  const base = `/admin/applications/${id}`;
  const [decider, registered] = await Promise.all([
    app.decidedById ? db.user.findUnique({ where: { id: app.decidedById }, select: { firstName: true, lastName: true, email: true } }) : null,
    app.userId ? db.user.findUnique({ where: { id: app.userId }, select: { id: true } }) : null,
  ]);

  return (
    <div>
      <PageHeader
        title={app.name || app.email}
        description={
          <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
            <a href={`mailto:${app.email}`} className="inline-flex items-center gap-1 hover:text-brand-600">
              <Mail className="h-3.5 w-3.5" />
              {app.email}
            </a>
            <span>
              {t("applications.detail.submittedAt", { date: formatDate(app.submittedAt, locale, true) })}
              {app.updatedAt.getTime() - app.submittedAt.getTime() > 60_000 && ` · ${t("applications.detail.updatedAt", { date: formatDate(app.updatedAt, locale, true) })}`}
            </span>
          </span>
        }
        back={{ href: `${base}${q}`, label: app.form.title }}
        actions={
          <div className="flex items-center gap-1">
            {idx >= 0 && <span className="mr-2 text-sm text-slate-500">{t("applications.detail.position", { n: idx + 1, total: ids.length })}</span>}
            <LinkButton href={prevId ? `${base}/${prevId}${q}` : "#"} variant="outline" size="sm" aria-disabled={!prevId} className={cn(!prevId && "pointer-events-none opacity-40")}>
              <ChevronLeft className="h-4 w-4" />
              {t("applications.detail.prev")}
            </LinkButton>
            <LinkButton href={nextId ? `${base}/${nextId}${q}` : "#"} variant="outline" size="sm" aria-disabled={!nextId} className={cn(!nextId && "pointer-events-none opacity-40")}>
              {t("applications.detail.next")}
              <ChevronRight className="h-4 w-4" />
            </LinkButton>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Card>
          <CardHeader title={t("applications.detail.answers")} />
          <CardBody>
            <dl className="space-y-5">
              {questions.map((qq) =>
                qq.type === "section" ? (
                  <h3 key={qq.id} className="border-t border-slate-100 pt-5 text-base font-bold text-slate-900 first:border-0 first:pt-0 dark:border-slate-800 dark:text-white">
                    {qq.label}
                  </h3>
                ) : (
                  <div key={qq.id}>
                    <dt className="text-sm font-medium text-slate-500">{qq.label}</dt>
                    <dd className="mt-1 whitespace-pre-wrap break-words text-slate-900 dark:text-slate-100">
                      {answers[qq.id] !== undefined ? (
                        qq.type === "url" ? (
                          <a href={String(answers[qq.id])} target="_blank" rel="noopener noreferrer nofollow" className="text-brand-600 hover:underline">
                            {String(answers[qq.id])}
                          </a>
                        ) : (
                          answerText(answers[qq.id], t("applications.detail.other"))
                        )
                      ) : (
                        <span className="text-sm italic text-slate-400">{t("applications.detail.noAnswer")}</span>
                      )}
                    </dd>
                  </div>
                ),
              )}
            </dl>
          </CardBody>
        </Card>

        <div className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <Card>
            <CardHeader title={t("applications.detail.decision")} description={t("applications.detail.decisionHint")} />
            <CardBody className="space-y-3">
              <StatusPicker key={app.status} applicationId={app.id} status={app.status} />
              <div className="space-y-1 text-xs text-slate-500">
                {decider && app.decidedAt && (
                  <p>
                    {fullName(decider)} · {formatDate(app.decidedAt, locale, true)}
                  </p>
                )}
                <p>
                  {app.notifiedStatus
                    ? t("applications.detail.emailed", { status: t(`applications.statuses.${app.notifiedStatus}`) })
                    : t("applications.detail.notEmailed")}
                </p>
                {registered && (
                  <p className="inline-flex items-center gap-1 text-emerald-600">
                    <UserCheck className="h-3.5 w-3.5" />
                    {t("applications.detail.registered")}
                    {can(actor, "MANAGE_USERS") && (
                      <Link href={`/admin/users/${registered.id}`} className="ml-1 font-semibold underline">
                        {t("applications.detail.openUser")}
                      </Link>
                    )}
                  </p>
                )}
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title={t("applications.detail.yourReview")} />
            <CardBody>
              <ReviewForm key={app.id} applicationId={app.id} mine={mine ? { score: mine.score, comment: mine.comment } : null} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title={t("applications.detail.reviews")}
              action={
                showOthers && app.avgScore !== null ? (
                  <span className="text-right">
                    <span className="block font-mono text-xl font-bold text-slate-900 dark:text-white">{app.avgScore.toFixed(1)}</span>
                    <span className="text-xs text-slate-500">{t("applications.detail.average")}</span>
                  </span>
                ) : undefined
              }
            />
            <CardBody>
              {!showOthers ? (
                <p className="flex items-start gap-2 text-sm text-slate-500">
                  <EyeOff className="mt-0.5 h-4 w-4 shrink-0" />
                  {t("applications.detail.othersHidden")}
                </p>
              ) : others.length === 0 && !mine ? (
                <p className="text-sm text-slate-400">{t("applications.detail.noReviews")}</p>
              ) : (
                <ul className="space-y-4">
                  {[...(mine ? [mine] : []), ...others].map((r) => (
                    <li key={r.id} className="flex gap-3">
                      <Avatar user={r.reviewer} size={32} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                            {r.reviewerId === actor.id ? t("common.you") : fullName(r.reviewer)}
                          </span>
                          <Badge tone={r.score >= 8 ? "green" : r.score >= 5 ? "blue" : "red"} className="font-mono">
                            {r.score}/10
                          </Badge>
                        </div>
                        {r.comment && <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300">{r.comment}</p>}
                        <p className="mt-0.5 text-xs text-slate-400">{formatDate(r.updatedAt, locale, true)}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          {manage && (
            <div className="text-right">
              <ActionButton
                action={deleteApplicationAction.bind(null, app.id)}
                label={t("common.delete")}
                icon={<Trash2 className="h-4 w-4" />}
                className="text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
                confirmText={t("applications.detail.deleteConfirm")}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
