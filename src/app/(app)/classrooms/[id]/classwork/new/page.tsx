import { notFound } from "next/navigation";
import type { AssignmentType } from "@prisma/client";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { getI18n } from "@/i18n/server";
import { PageHeader } from "@/components/ui/primitives";
import { AssignmentForm } from "@/components/classroom/assignment-form";
import { getClassroomContext } from "../../../_lib/context";

const TYPES: AssignmentType[] = ["ASSIGNMENT", "MATERIAL", "QUESTION"];

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t("classwork.form.newTitle") };
}

export default async function NewAssignmentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const { classroom, access } = await getClassroomContext(id);
  if (!access.canTeach || classroom.archived) notFound();
  const { t } = await getI18n();

  const topics = await db.topic.findMany({
    where: { classroomId: classroom.id },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    select: { id: true, name: true },
  });
  const type = TYPES.find((x) => x === sp.type) ?? "ASSIGNMENT";
  const topicId = topics.find((x) => x.id === sp.topic)?.id ?? null;
  const back = `/classrooms/${classroom.id}/classwork`;

  return (
    <div>
      <PageHeader title={t("classwork.form.newTitle")} back={{ href: back, label: t("classroom.tabs.classwork") }} />
      <AssignmentForm
        classroomId={classroom.id}
        topics={topics}
        defaultType={type}
        defaultTopicId={topicId}
        cancelHref={back}
        maxMb={Math.round(env.maxUploadBytes / 1024 / 1024)}
      />
    </div>
  );
}
