import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { getClassroomAccess, isTeam } from "@/lib/permissions";
import { readStoredFile } from "@/lib/storage";

const INLINE = /^(image\/|video\/|audio\/|application\/pdf|text\/plain)/;

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const file = await db.fileObject.findUnique({
    where: { id },
    include: {
      assignment: { select: { classroomId: true, published: true } },
      submission: { select: { studentId: true, assignment: { select: { classroomId: true } } } },
      announcement: { select: { classroomId: true, audience: true } },
      avatarOf: { select: { id: true } },
    },
  });
  if (!file) return new NextResponse("Not found", { status: 404 });

  let allowed = file.uploaderId === user.id || !!file.avatarOf;
  if (!allowed && user.status === "ACTIVE") {
    if (file.assignment) {
      const a = await getClassroomAccess(user, file.assignment.classroomId);
      allowed = a.canView && (file.assignment.published || !a.isStudent);
    } else if (file.submission) {
      if (file.submission.studentId === user.id) allowed = true;
      else {
        const a = await getClassroomAccess(user, file.submission.assignment.classroomId);
        allowed = a.canTeach || a.canViewGrades;
      }
    } else if (file.announcement) {
      if (file.announcement.classroomId) {
        allowed = (await getClassroomAccess(user, file.announcement.classroomId)).canView;
      } else {
        const aud = file.announcement.audience;
        allowed = aud === "EVERYONE" || (aud === "STUDENTS" ? user.role === "STUDENT" || isTeam(user) : isTeam(user));
      }
    }
  }
  if (!allowed) return new NextResponse("Forbidden", { status: 403 });

  let data: Buffer;
  try {
    data = await readStoredFile(file.storageKey);
  } catch {
    return new NextResponse("File missing", { status: 404 });
  }
  const disposition = INLINE.test(file.mimeType) && !file.mimeType.includes("svg") ? "inline" : "attachment";
  return new NextResponse(new Uint8Array(data), {
    headers: {
      "Content-Type": file.mimeType,
      "Content-Length": String(file.size),
      "Content-Disposition": `${disposition}; filename*=UTF-8''${encodeURIComponent(file.originalName)}`,
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "sandbox",
    },
  });
}
