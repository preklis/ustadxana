import { notFound } from "next/navigation";
import { Trash2 } from "lucide-react";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";
import { parseQuestions } from "@/lib/applications/questions";
import { getI18n } from "@/i18n/server";
import { PageHeader } from "@/components/ui/primitives";
import { ActionButton } from "@/components/admin/action-button";
import { toDateInput } from "../../../_lib/shared";
import { FormBuilder } from "../../form-builder";
import { deleteFormAction } from "../../actions";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t("applications.builder.titleEdit") };
}

export default async function EditApplicationFormPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("MANAGE_APPLICATIONS");
  const { id } = await params;
  const form = await db.applicationForm.findUnique({ where: { id }, include: { _count: { select: { applications: true } } } });
  if (!form) notFound();
  const { t } = await getI18n();
  const seasons = await db.season.findMany({ orderBy: [{ isActive: "desc" }, { createdAt: "desc" }], select: { id: true, name: true } });
  const n = form._count.applications;

  return (
    <div>
      <PageHeader
        title={t("applications.builder.titleEdit")}
        description={form.title}
        back={{ href: `/admin/applications/${form.id}`, label: form.title }}
        actions={
          !form.isOpen && (
            <ActionButton
              action={deleteFormAction.bind(null, form.id)}
              label={t("common.delete")}
              icon={<Trash2 className="h-4 w-4" />}
              className="text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
              confirmText={`${t("applications.forms.deleteConfirm", { title: form.title, n })} ${t("common.cannotUndo")}`}
            />
          )
        }
      />
      <FormBuilder
        seasons={seasons}
        responseCount={n}
        form={{
          id: form.id,
          title: form.title,
          slug: form.slug,
          description: form.description ?? "",
          kind: form.kind,
          seasonId: form.seasonId ?? "",
          // stored as the last second of the day
          closesAt: toDateInput(form.closesAt),
          allowEdit: form.allowEdit,
          confirmation: form.confirmation ?? "",
          questions: parseQuestions(form.questions),
        }}
      />
    </div>
  );
}
