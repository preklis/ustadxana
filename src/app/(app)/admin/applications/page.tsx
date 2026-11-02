import Link from "next/link";
import { DoorClosed, DoorOpen, Eye, Inbox, Lock, PencilLine, Plus } from "lucide-react";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { requirePermission } from "@/lib/auth/session";
import { can, canOpenApplications } from "@/lib/permissions";
import { isFormLive, STATUSES, STATUS_TONES } from "@/lib/applications/questions";
import { cn, formatDate, fullName } from "@/lib/utils";
import { getI18n } from "@/i18n/server";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui/primitives";
import { LinkButton } from "@/components/ui/button";
import { ActionButton } from "@/components/admin/action-button";
import { CopyButton } from "@/components/admin/copy-button";
import { setFormOpenAction } from "./actions";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t("applications.title") };
}

export default async function ApplicationFormsPage() {
  const actor = await requirePermission("REVIEW_APPLICATIONS");
  const { t, locale } = await getI18n();
  const manage = can(actor, "MANAGE_APPLICATIONS");
  const lead = canOpenApplications(actor);

  const forms = await db.applicationForm.findMany({
    orderBy: [{ isOpen: "desc" }, { createdAt: "desc" }],
    include: { season: { select: { name: true } }, _count: { select: { applications: true } } },
  });
  const ids = forms.map((f) => f.id);
  const [byStatus, unscored, openers] = await Promise.all([
    db.application.groupBy({ by: ["formId", "status"], where: { formId: { in: ids } }, _count: true }),
    db.application.groupBy({ by: ["formId"], where: { formId: { in: ids }, reviews: { none: { reviewerId: actor.id } } }, _count: true }),
    db.user.findMany({
      where: { id: { in: forms.map((f) => f.openedById).filter((x): x is string => !!x) } },
      select: { id: true, firstName: true, lastName: true, email: true },
    }),
  ]);
  const count = (formId: string, status: string) => byStatus.find((r) => r.formId === formId && r.status === status)?._count ?? 0;

  return (
    <div>
      <PageHeader
        title={t("applications.title")}
        description={t("applications.description")}
        actions={
          manage && (
            <LinkButton href="/admin/applications/new">
              <Plus className="h-4 w-4" />
              {t("applications.forms.new")}
            </LinkButton>
          )
        }
      />

      {forms.length === 0 ? (
        <EmptyState
          icon={<Inbox className="h-10 w-10" />}
          title={t("applications.forms.empty")}
          description={manage ? t("applications.forms.emptyText") : t("applications.forms.emptyChecker")}
          action={
            manage && (
              <LinkButton href="/admin/applications/new">
                <Plus className="h-4 w-4" />
                {t("applications.forms.new")}
              </LinkButton>
            )
          }
        />
      ) : (
        <div className="space-y-3">
          {forms.map((f) => {
            const live = isFormLive(f);
            const expired = f.isOpen && !live;
            const mine = unscored.find((u) => u.formId === f.id)?._count ?? 0;
            const opener = openers.find((o) => o.id === f.openedById);
            const url = `${env.appUrl}/apply/${f.slug}`;
            return (
              <Card key={f.id} className={cn(live && "border-emerald-300 ring-1 ring-emerald-200 dark:border-emerald-800 dark:ring-emerald-900")}>
                <div className="flex flex-col gap-4 p-5 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/admin/applications/${f.id}`} className="text-lg font-semibold text-slate-900 hover:text-brand-600 dark:text-white">
                        {f.title}
                      </Link>
                      {live ? (
                        <Badge tone="green">{t("applications.forms.open")}</Badge>
                      ) : expired ? (
                        <Badge tone="yellow">{t("applications.forms.expired")}</Badge>
                      ) : (
                        <Badge>{t("applications.forms.closed")}</Badge>
                      )}
                      <Badge tone={f.kind === "TEAM" ? "orange" : "blue"}>{t(`applications.kinds.${f.kind}`)}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-slate-500">
                      {f.season?.name ?? t("applications.forms.noSeason")}
                      {f.closesAt && ` · ${t("applications.forms.closesOn", { date: formatDate(f.closesAt, locale) })}`}
                      {live && opener && ` · ${t("applications.forms.openedBy", { name: fullName(opener) })}`}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-1.5">
                      <span className="mr-1 text-sm font-semibold text-slate-700 dark:text-slate-200">{t("applications.forms.responses", { n: f._count.applications })}</span>
                      {STATUSES.map((s) => {
                        const n = count(f.id, s);
                        return n ? (
                          <Badge key={s} tone={STATUS_TONES[s]}>
                            {t(`applications.statuses.${s}`)} · {n}
                          </Badge>
                        ) : null;
                      })}
                      {mine > 0 && <span className="ml-1 text-xs font-medium text-amber-600 dark:text-amber-400">{t("applications.forms.toReview", { n: mine })}</span>}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                    {lead ? (
                      <ActionButton
                        action={setFormOpenAction.bind(null, f.id, !f.isOpen)}
                        label={f.isOpen ? t("applications.forms.closeApply") : t("applications.forms.openApply")}
                        icon={f.isOpen ? <DoorClosed className="h-4 w-4" /> : <DoorOpen className="h-4 w-4" />}
                        variant={f.isOpen ? "outline" : "primary"}
                        confirmText={t(f.isOpen ? "applications.forms.closeConfirm" : "applications.forms.openConfirm", { title: f.title })}
                      />
                    ) : (
                      !f.isOpen && (
                        <span className="inline-flex items-center gap-1 text-xs text-slate-400" title={t("applications.forms.onlyLead")}>
                          <Lock className="h-3.5 w-3.5" />
                          {t("applications.forms.onlyLead")}
                        </span>
                      )
                    )}
                    {live && <CopyButton value={url} label={t("applications.forms.publicLink")} />}
                    <LinkButton href={`/admin/applications/${f.id}`} variant="outline" size="sm">
                      <Eye className="h-4 w-4" />
                      {t("applications.forms.view")}
                    </LinkButton>
                    {manage && (
                      <LinkButton href={`/admin/applications/${f.id}/edit`} variant="ghost" size="sm">
                        <PencilLine className="h-4 w-4" />
                        {t("applications.forms.edit")}
                      </LinkButton>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
