import Link from "next/link";
import { CalendarDays, CheckCircle2, DoorClosed, DoorOpen, School, Trash2, Users } from "lucide-react";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { cn, formatDate } from "@/lib/utils";
import { getI18n } from "@/i18n/server";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui/primitives";
import { ActionButton } from "@/components/admin/action-button";
import { toDateInput } from "../_lib/shared";
import { SeasonFormButton } from "./season-form";
import { deleteSeasonAction, setActiveSeasonAction, setRegistrationOpenAction } from "./actions";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t("admin.seasons.title") };
}

export default async function AdminSeasonsPage() {
  const actor = await requirePermission("MANAGE_SEASONS");
  const { t, locale } = await getI18n();

  const seasons = await db.season.findMany({
    orderBy: [{ isActive: "desc" }, { number: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
    include: { _count: { select: { classrooms: true } } },
  });
  const studentCounts = await Promise.all(
    seasons.map((s) =>
      db.classroomMember
        .findMany({ where: { role: "STUDENT", classroom: { seasonId: s.id } }, distinct: ["userId"], select: { userId: true } })
        .then((r) => r.length),
    ),
  );
  const maxNumber = seasons.reduce((m, s) => Math.max(m, s.number ?? 0), 0);
  const manageClassrooms = can(actor, "MANAGE_CLASSROOMS");

  return (
    <div>
      <PageHeader title={t("admin.seasons.title")} description={t("admin.seasons.description")} actions={<SeasonFormButton suggestedNumber={maxNumber + 1} />} />

      {seasons.length === 0 ? (
        <EmptyState
          icon={<CalendarDays className="h-10 w-10" />}
          title={t("admin.seasons.empty")}
          description={t("admin.seasons.emptyText")}
          action={<SeasonFormButton suggestedNumber={1} />}
        />
      ) : (
        <div className="space-y-3">
          {seasons.map((s, i) => (
            <Card key={s.id} className={cn(s.isActive && "border-emerald-300 ring-1 ring-emerald-200 dark:border-emerald-800 dark:ring-emerald-900")}>
              <div className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{s.name}</h3>
                    {s.number !== null && <Badge>#{s.number}</Badge>}
                    {s.isActive && <Badge tone="green">{t("admin.seasons.active")}</Badge>}
                    <Badge tone={s.registrationOpen ? "blue" : "gray"}>
                      {s.registrationOpen ? t("admin.seasons.registrationOpen") : t("admin.seasons.registrationClosed")}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-slate-500">
                    {s.startDate || s.endDate ? `${formatDate(s.startDate, locale)} – ${formatDate(s.endDate, locale)}` : t("admin.seasons.noDates")}
                  </p>
                  {s.description && <p className="mt-2 max-w-2xl whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300">{s.description}</p>}
                  <div className="mt-3 flex flex-wrap gap-4 text-sm text-slate-600 dark:text-slate-400">
                    {manageClassrooms ? (
                      <Link href={`/admin/classrooms?season=${s.id}`} className="inline-flex items-center gap-1.5 hover:text-brand-600">
                        <School className="h-4 w-4" />
                        {t("admin.seasons.classroomsCount", { n: s._count.classrooms })}
                      </Link>
                    ) : (
                      <span className="inline-flex items-center gap-1.5">
                        <School className="h-4 w-4" />
                        {t("admin.seasons.classroomsCount", { n: s._count.classrooms })}
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1.5">
                      <Users className="h-4 w-4" />
                      {t("admin.seasons.studentsCount", { n: studentCounts[i] })}
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {!s.isActive && (
                    <ActionButton
                      action={setActiveSeasonAction.bind(null, s.id)}
                      label={t("admin.seasons.setActive")}
                      icon={<CheckCircle2 className="h-4 w-4" />}
                      variant="outline"
                      confirmText={t("admin.seasons.setActiveConfirm", { name: s.name })}
                    />
                  )}
                  <ActionButton
                    action={setRegistrationOpenAction.bind(null, s.id, !s.registrationOpen)}
                    label={s.registrationOpen ? t("admin.seasons.closeRegistration") : t("admin.seasons.openRegistration")}
                    icon={s.registrationOpen ? <DoorClosed className="h-4 w-4" /> : <DoorOpen className="h-4 w-4" />}
                    variant="outline"
                    confirmText={s.registrationOpen ? t("admin.seasons.closeRegistrationConfirm") : t("admin.seasons.openRegistrationConfirm")}
                  />
                  <SeasonFormButton
                    season={{
                      id: s.id,
                      name: s.name,
                      number: s.number,
                      description: s.description,
                      startDate: toDateInput(s.startDate),
                      endDate: toDateInput(s.endDate),
                    }}
                  />
                  {s._count.classrooms === 0 && (
                    <ActionButton
                      action={deleteSeasonAction.bind(null, s.id)}
                      label={t("common.delete")}
                      icon={<Trash2 className="h-4 w-4" />}
                      className="text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
                      confirmText={`${t("admin.seasons.deleteConfirm", { name: s.name })} ${t("common.cannotUndo")}`}
                    />
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
