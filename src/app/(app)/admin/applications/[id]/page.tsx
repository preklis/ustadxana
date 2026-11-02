import Link from "next/link";
import { notFound } from "next/navigation";
import { DoorClosed, DoorOpen, Download, Eye, PencilLine, Search, UserCheck } from "lucide-react";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { requirePermission } from "@/lib/auth/session";
import { can, canOpenApplications } from "@/lib/permissions";
import { pendingDecisionsWhere } from "@/lib/applications/server";
import { answerText, CHOICE_TYPES, isFormLive, isOther, parseQuestions, STATUSES, STATUS_TONES, type Answers, type Question } from "@/lib/applications/questions";
import { cn, formatDate } from "@/lib/utils";
import { getI18n } from "@/i18n/server";
import type { TFunction } from "@/i18n/core";
import { Alert, Badge, Card, CardBody, CardHeader, EmptyState, PageHeader, Pagination, Table, Tabs, td, th } from "@/components/ui/primitives";
import { LinkButton } from "@/components/ui/button";
import { Input } from "@/components/ui/form";
import { ActionButton } from "@/components/admin/action-button";
import { CopyButton } from "@/components/admin/copy-button";
import { pageFrom } from "../../_lib/shared";
import { cleanParams, listOrder, listQs, listWhere } from "../_lib";
import { setFormOpenAction } from "../actions";
import { SendDecisionsButton } from "../send-decisions";

const PER_PAGE = 50;

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ status?: string; q?: string; sort?: string; page?: string; tab?: string; created?: string }>;
};

export async function generateMetadata({ params }: Props) {
  const form = await db.applicationForm.findUnique({ where: { id: (await params).id }, select: { title: true } });
  return { title: form?.title ?? "404" };
}

export default async function FormResponsesPage({ params, searchParams }: Props) {
  const actor = await requirePermission("REVIEW_APPLICATIONS");
  const { id } = await params;
  const sp = await searchParams;
  const form = await db.applicationForm.findUnique({ where: { id }, include: { season: { select: { name: true } } } });
  if (!form) notFound();
  const { t, locale } = await getI18n();
  const manage = can(actor, "MANAGE_APPLICATIONS");
  const lead = canOpenApplications(actor);
  const live = isFormLive(form);
  const tab = sp.tab === "summary" ? "summary" : "responses";
  const p = cleanParams(sp);

  const [byStatus, pendingEmails] = await Promise.all([
    db.application.groupBy({ by: ["status"], where: { formId: id }, _count: true }),
    manage ? db.application.count({ where: pendingDecisionsWhere(id) }) : Promise.resolve(0),
  ]);
  const total = byStatus.reduce((s, r) => s + r._count, 0);

  return (
    <div>
      <PageHeader
        title={form.title}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            {live ? <Badge tone="green">{t("applications.forms.open")}</Badge> : <Badge>{t("applications.forms.closed")}</Badge>}
            <Badge tone={form.kind === "TEAM" ? "orange" : "blue"}>{t(`applications.kinds.${form.kind}`)}</Badge>
            {form.season && <span>{form.season.name}</span>}
            {form.closesAt && <span>· {t("applications.forms.closesOn", { date: formatDate(form.closesAt, locale) })}</span>}
          </span>
        }
        back={{ href: "/admin/applications", label: t("applications.title") }}
        actions={
          <>
            {lead && (
              <ActionButton
                action={setFormOpenAction.bind(null, form.id, !form.isOpen)}
                label={form.isOpen ? t("applications.forms.closeApply") : t("applications.forms.openApply")}
                icon={form.isOpen ? <DoorClosed className="h-4 w-4" /> : <DoorOpen className="h-4 w-4" />}
                variant={form.isOpen ? "outline" : "primary"}
                confirmText={t(form.isOpen ? "applications.forms.closeConfirm" : "applications.forms.openConfirm", { title: form.title })}
              />
            )}
            {live && <CopyButton value={`${env.appUrl}/apply/${form.slug}`} label={t("applications.forms.publicLink")} />}
            <LinkButton href={`/apply/${form.slug}?preview=1`} target="_blank" variant="ghost" size="sm">
              <Eye className="h-4 w-4" />
              {t("applications.builder.preview")}
            </LinkButton>
            {manage && (
              <LinkButton href={`/admin/applications/${form.id}/edit`} variant="ghost" size="sm">
                <PencilLine className="h-4 w-4" />
                {t("applications.forms.edit")}
              </LinkButton>
            )}
          </>
        }
      />

      {sp.created === "1" && (
        <Alert tone="green" className="mb-5">
          {t("applications.builder.created")}
        </Alert>
      )}

      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <Tabs
          active={tab}
          tabs={[
            { key: "responses", label: `${t("applications.responses.tabs.responses")} · ${total}`, href: `/admin/applications/${id}` },
            { key: "summary", label: t("applications.responses.tabs.summary"), href: `/admin/applications/${id}?tab=summary` },
          ]}
        />
        <div className="flex flex-wrap items-start gap-2">
          {manage && <SendDecisionsButton formId={id} pending={pendingEmails} />}
          <LinkButton href={`/api/applications/${id}/export`} variant="outline" size="sm" prefetch={false}>
            <Download className="h-4 w-4" />
            {t("applications.responses.export")}
          </LinkButton>
        </div>
      </div>

      {tab === "summary" ? (
        <Summary formId={id} questions={parseQuestions(form.questions)} byStatus={byStatus} total={total} t={t} />
      ) : (
        <Responses formId={id} actorId={actor.id} p={p} page={pageFrom(sp.page)} byStatus={byStatus} total={total} t={t} locale={locale} />
      )}
    </div>
  );
}

async function Responses({
  formId,
  actorId,
  p,
  page,
  byStatus,
  total,
  t,
  locale,
}: {
  formId: string;
  actorId: string;
  p: ReturnType<typeof cleanParams>;
  page: number;
  byStatus: { status: string; _count: number }[];
  total: number;
  t: TFunction;
  locale: string;
}) {
  const where = listWhere(formId, p, actorId);
  const [count, apps] = await Promise.all([
    db.application.count({ where }),
    db.application.findMany({
      where,
      orderBy: listOrder(p),
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
      select: {
        id: true,
        name: true,
        email: true,
        status: true,
        avgScore: true,
        reviewCount: true,
        submittedAt: true,
        userId: true,
        reviews: { where: { reviewerId: actorId }, select: { score: true } },
      },
    }),
  ]);
  const base = `/admin/applications/${formId}`;
  const statusCount = (s: string) => byStatus.find((r) => r.status === s)?._count ?? 0;
  const chip = (active: boolean) =>
    cn(
      "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium transition",
      active
        ? "border-brand-600 bg-brand-600 text-brand-fg"
        : "border-slate-200 text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:text-slate-300 dark:hover:border-slate-600",
    );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-1.5">
          <Link href={`${base}${listQs({ ...p, status: undefined })}`} className={chip(!p.status)}>
            {t("applications.responses.all")} <span className="opacity-70">{total}</span>
          </Link>
          {STATUSES.map((s) => (
            <Link key={s} href={`${base}${listQs({ ...p, status: s })}`} className={chip(p.status === s)}>
              {t(`applications.statuses.${s}`)} <span className="opacity-70">{statusCount(s)}</span>
            </Link>
          ))}
        </div>
        <form className="flex items-center gap-2" action={base}>
          {p.status && <input type="hidden" name="status" value={p.status} />}
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input name="q" defaultValue={p.q} placeholder={t("applications.responses.search")} className="w-56 pl-9" />
          </div>
          <select
            name="sort"
            defaultValue={p.sort ?? ""}
            className="h-10 rounded-lg border border-slate-300 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-900"
            aria-label="sort"
          >
            <option value="">{t("applications.responses.sort.newest")}</option>
            <option value="score">{t("applications.responses.sort.score")}</option>
            <option value="unscored">{t("applications.responses.sort.unscored")}</option>
          </select>
          <button type="submit" className="h-10 rounded-lg bg-slate-900 px-3 text-sm font-medium text-white dark:bg-slate-100 dark:text-slate-900">
            {t("common.search")}
          </button>
        </form>
      </div>

      {apps.length === 0 ? (
        <EmptyState title={total === 0 ? t("applications.responses.none") : t("applications.responses.noMatch")} />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <thead>
                <tr className="text-left">
                  <th className={th}>{t("applications.responses.applicant")}</th>
                  <th className={th}>{t("applications.responses.submitted")}</th>
                  <th className={cn(th, "text-right")}>{t("applications.responses.score")}</th>
                  <th className={cn(th, "text-right")}>{t("applications.responses.myScore")}</th>
                  <th className={th}>{t("applications.responses.status")}</th>
                </tr>
              </thead>
              <tbody>
                {apps.map((a) => (
                  <tr key={a.id} className="group hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className={td}>
                      <Link href={`${base}/${a.id}${listQs(p)}`} className="block">
                        <span className="font-medium text-slate-900 group-hover:text-brand-600 dark:text-slate-100">{a.name || a.email}</span>
                        {a.name && <span className="block text-xs text-slate-500">{a.email}</span>}
                      </Link>
                    </td>
                    <td className={cn(td, "whitespace-nowrap text-sm text-slate-500")}>{formatDate(a.submittedAt, locale, true)}</td>
                    <td className={cn(td, "text-right font-mono text-sm")}>
                      {a.avgScore !== null ? (
                        <span>
                          <span className="font-semibold text-slate-900 dark:text-white">{a.avgScore.toFixed(1)}</span>
                          <span className="text-xs text-slate-400"> · {a.reviewCount}</span>
                        </span>
                      ) : (
                        <span className="text-slate-300 dark:text-slate-600">—</span>
                      )}
                    </td>
                    <td className={cn(td, "text-right font-mono text-sm")}>
                      {a.reviews[0] ? a.reviews[0].score : <span className="text-amber-500">•</span>}
                    </td>
                    <td className={td}>
                      <span className="inline-flex items-center gap-1.5">
                        <Badge tone={STATUS_TONES[a.status]}>{t(`applications.statuses.${a.status}`)}</Badge>
                        {a.userId && (
                          <span title={t("applications.responses.registered")}>
                            <UserCheck className="h-4 w-4 text-emerald-500" />
                          </span>
                        )}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        </Card>
      )}
      {count > PER_PAGE && (
        <Pagination
          page={page}
          totalPages={Math.ceil(count / PER_PAGE)}
          hrefFor={(n) => `${base}${listQs(p, { page: n })}`}
          prevLabel={t("common.prev")}
          nextLabel={t("common.next")}
        />
      )}
    </div>
  );
}

async function Summary({
  formId,
  questions,
  byStatus,
  total,
  t,
}: {
  formId: string;
  questions: Question[];
  byStatus: { status: string; _count: number }[];
  total: number;
  t: TFunction;
}) {
  if (total === 0) return <EmptyState title={t("applications.summary.noAnswers")} />;
  const rows = await db.application.findMany({ where: { formId }, select: { answers: true }, orderBy: { submittedAt: "desc" } });
  const answers = rows.map((r) => r.answers as Answers);
  const other = t("applications.detail.other");

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader title={t("applications.summary.statusBreakdown")} description={t("applications.summary.answers", { n: total })} />
        <CardBody>
          <Bars items={STATUSES.map((s) => ({ label: t(`applications.statuses.${s}`), n: byStatus.find((r) => r.status === s)?._count ?? 0 }))} total={total} />
        </CardBody>
      </Card>
      {questions
        .filter((q) => q.type !== "section")
        .map((q) => {
          const given = answers.map((a) => a[q.id]).filter((v) => v !== undefined && v !== "" && !(Array.isArray(v) && v.length === 0));
          const wide = q.type === "long" || q.type === "short";
          return (
            <Card key={q.id} className={cn(wide && "lg:col-span-2")}>
              <CardHeader title={q.label} description={t("applications.summary.answers", { n: given.length })} />
              <CardBody>
                {given.length === 0 ? (
                  <p className="text-sm text-slate-400">{t("applications.summary.noAnswers")}</p>
                ) : CHOICE_TYPES.includes(q.type) ? (
                  <Bars items={choiceCounts(q, given, other)} total={given.length} />
                ) : q.type === "scale" ? (
                  <ScaleSummary q={q} given={given as string[]} t={t} />
                ) : q.type === "number" ? (
                  <NumberSummary given={given as string[]} t={t} />
                ) : (
                  <TextSummary given={given.map((g) => answerText(g, other))} t={t} />
                )}
              </CardBody>
            </Card>
          );
        })}
    </div>
  );
}

function choiceCounts(q: Question, given: (string | string[])[], other: string) {
  const counts = new Map<string, number>(q.options.map((o) => [o, 0]));
  let others = 0;
  for (const g of given) {
    for (const v of Array.isArray(g) ? g : [g]) {
      if (isOther(v)) others++;
      else if (counts.has(v)) counts.set(v, (counts.get(v) ?? 0) + 1);
    }
  }
  const items = [...counts].map(([label, n]) => ({ label, n }));
  if (q.other || others) items.push({ label: other, n: others });
  return items;
}

function Bars({ items, total }: { items: { label: string; n: number }[]; total: number }) {
  const max = Math.max(1, ...items.map((i) => i.n));
  return (
    <ul className="space-y-2.5">
      {items.map((i) => (
        <li key={i.label}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate text-slate-700 dark:text-slate-300">{i.label}</span>
            <span className="shrink-0 font-mono text-xs text-slate-500">
              {i.n} · {total ? Math.round((i.n / total) * 100) : 0}%
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div className="h-full rounded-full bg-brand-500" style={{ width: `${(i.n / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function ScaleSummary({ q, given, t }: { q: Question; given: string[]; t: TFunction }) {
  const nums = given.map(Number).filter(Number.isFinite);
  const avg = nums.reduce((s, n) => s + n, 0) / (nums.length || 1);
  const steps: { label: string; n: number }[] = [];
  for (let i = q.min ?? 1; i <= (q.max ?? 5); i++) steps.push({ label: String(i), n: nums.filter((n) => n === i).length });
  const max = Math.max(1, ...steps.map((s) => s.n));
  return (
    <div>
      <p className="mb-4 text-sm font-semibold text-slate-900 dark:text-white">{t("applications.summary.average", { n: avg.toFixed(1) })}</p>
      <div className="flex h-28 items-end gap-1.5">
        {steps.map((s) => (
          <div key={s.label} className="flex flex-1 flex-col items-center gap-1">
            <span className="font-mono text-[10px] text-slate-500">{s.n}</span>
            <div className="w-full rounded-t bg-brand-500" style={{ height: `${Math.max(2, (s.n / max) * 80)}px` }} />
            <span className="text-xs text-slate-500">{s.label}</span>
          </div>
        ))}
      </div>
      {(q.minLabel || q.maxLabel) && (
        <div className="mt-1 flex justify-between text-[11px] text-slate-400">
          <span>{q.minLabel}</span>
          <span>{q.maxLabel}</span>
        </div>
      )}
    </div>
  );
}

function NumberSummary({ given, t }: { given: string[]; t: TFunction }) {
  const nums = given.map((g) => Number(g.replace(",", "."))).filter(Number.isFinite);
  const avg = nums.reduce((s, n) => s + n, 0) / (nums.length || 1);
  return (
    <p className="font-mono text-sm text-slate-700 dark:text-slate-300">
      {t("applications.summary.average", { n: Math.round(avg * 10) / 10 })} · min {Math.min(...nums)} · max {Math.max(...nums)}
    </p>
  );
}

function TextSummary({ given, t }: { given: string[]; t: TFunction }) {
  const shown = given.slice(0, 8);
  return (
    <div>
      <ul className="divide-y divide-slate-100 dark:divide-slate-800">
        {shown.map((g, i) => (
          <li key={i} className="line-clamp-3 whitespace-pre-wrap py-2 text-sm text-slate-700 first:pt-0 dark:text-slate-300">
            {g}
          </li>
        ))}
      </ul>
      {given.length > shown.length && <p className="mt-2 text-xs text-slate-400">{t("applications.summary.more", { n: given.length - shown.length })}</p>}
    </div>
  );
}
