import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { getI18n } from "@/i18n/server";
import { toDateTimeLocal } from "@/lib/utils";
import { PageHeader } from "@/components/ui/primitives";
import { AssignmentForm } from "@/components/classroom/assignment-form";
import { getClassroomContext } from "../../../../_lib/context";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t("classwork.form.editTitle") };
}

export default async function EditAssignmentPage({ params }: { params: Promise<{ id: string; assignmentId: string }> }) {
  const { id, assignmentId } = await params;
  const { classroom, access } = await getClassroomContext(id);
  if (!access.canTeach || classroom.archived) notFound();
  const { t } = await getI18n();

  const [assignment, topics] = await Promise.all([
    db.assignment.findFirst({
      where: { id: assignmentId, classroomId: classroom.id },
      include: { attachments: { select: { id: true, originalName: true }, orderBy: { createdAt: "asc" } } },
    }),
    db.topic.findMany({
      where: { classroomId: classroom.id },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
      select: { id: true, name: true },
    }),
  ]);
  if (!assignment) notFound();
  const back = `/classrooms/${classroom.id}/classwork/${assignment.id}`;

  return (
    <div>
      <PageHeader title={t("classwork.form.editTitle")} back={{ href: back, label: assignment.title }} />
      <AssignmentForm
        classroomId={classroom.id}
        topics={topics}
        cancelHref={back}
        maxMb={Math.round(env.maxUploadBytes / 1024 / 1024)}
        initial={{
          id: assignment.id,
          type: assignment.type,
          title: assignment.title,
          description: assignment.description ?? "",
          topicId: assignment.topicId,
          links: assignment.links,
          maxPoints: assignment.maxPoints,
          dueAt: toDateTimeLocal(assignment.dueAt),
          allowLate: assignment.allowLate,
          published: assignment.published,
          attachments: assignment.attachments,
        }}
      />
    </div>
  );
}
