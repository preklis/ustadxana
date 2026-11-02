import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireActiveUser } from "@/lib/auth/session";
import { getClassroomAccess } from "@/lib/permissions";

export const getClassroomContext = cache(async (id: string) => {
  const user = await requireActiveUser();
  const classroom = await db.classroom.findUnique({
    where: { id },
    include: { season: { select: { id: true, name: true, isActive: true } } },
  });
  if (!classroom) notFound();
  const access = await getClassroomAccess(user, classroom.id);
  if (!access.canView) notFound();
  return { user, classroom, access };
});

export const authorSelect = { id: true, firstName: true, lastName: true, avatarFileId: true } as const;

export const fileSelect = { id: true, originalName: true, mimeType: true, size: true } as const;

export async function classroomStudents(classroomId: string) {
  const rows = await db.classroomMember.findMany({
    where: { classroomId, role: "STUDENT" },
    select: { user: { select: { ...authorSelect, email: true } } },
    orderBy: [{ user: { firstName: "asc" } }, { user: { lastName: "asc" } }],
  });
  return rows.map((r) => r.user);
}
