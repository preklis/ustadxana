import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";
import { blankQuestion, newQuestionId, type Question } from "@/lib/applications/questions";
import { getI18n } from "@/i18n/server";
import { MESSAGES } from "@/i18n/messages";
import { PageHeader } from "@/components/ui/primitives";
import { FormBuilder } from "../form-builder";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t("applications.builder.titleNew") };
}

type Template = typeof import("@/i18n/messages/en/applications").default.builder.template;

// a new form starts with the questions the google form used to have
function starterQuestions(tp: Template): Question[] {
  const q = (type: Question["type"], label: string, extra: Partial<Question> = {}): Question => ({ ...blankQuestion(type), id: newQuestionId(), label, ...extra });
  return [
    q("short", tp.firstName, { field: "firstName" }),
    q("short", tp.lastName, { field: "lastName" }),
    q("phone", tp.phone, { field: "phone" }),
    q("short", tp.university, { field: "university" }),
    q("short", tp.faculty, { field: "faculty" }),
    q("dropdown", tp.courseYear, { options: [...tp.courseYears], field: "courseYear" }),
    q("single", tp.track, { options: [...tp.tracks], other: true, field: "preferredTrack" }),
    q("url", tp.github, { required: false, field: "github" }),
    q("long", tp.experience, { field: "priorExperience" }),
    q("long", tp.motivation, { help: tp.motivationHelp, field: "motivation" }),
    q("single", tp.laptop, { options: [tp.yes, tp.no] }),
  ];
}

export default async function NewApplicationFormPage() {
  await requirePermission("MANAGE_APPLICATIONS");
  const { t, locale } = await getI18n();
  const seasons = await db.season.findMany({ orderBy: [{ isActive: "desc" }, { createdAt: "desc" }], select: { id: true, name: true, isActive: true } });
  const tp = (MESSAGES[locale].applications as { builder: { template: Template } }).builder.template;

  return (
    <div>
      <PageHeader title={t("applications.builder.titleNew")} back={{ href: "/admin/applications", label: t("applications.title") }} />
      <FormBuilder
        seasons={seasons}
        responseCount={0}
        form={{
          id: "",
          title: "",
          slug: "",
          description: "",
          kind: "STUDENT",
          seasonId: seasons[0]?.id ?? "",
          closesAt: "",
          allowEdit: true,
          confirmation: "",
          questions: starterQuestions(tp),
        }}
      />
    </div>
  );
}
