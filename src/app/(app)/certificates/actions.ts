"use server";

import { revalidatePath } from "next/cache";
import { Prisma, type CertificateType } from "@prisma/client";
import { db } from "@/lib/db";
import { requireActiveUser } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { audit, notify } from "@/lib/audit";
import { fullName } from "@/lib/utils";
import { classroomEligibility, generateCertificateCode, parseThresholds, type Thresholds } from "@/components/certificates/eligibility";

const TYPES: CertificateType[] = ["PARTICIPATION", "DISTINCTION", "MENTOR", "STAFF"];

export type IssueResult = { issued: number; skipped: number } | { error: string };

async function requireManager() {
  const user = await requireActiveUser();
  return can(user, "MANAGE_CERTIFICATES") ? user : null;
}

type Candidate = { holderId: string; type: CertificateType; holderName: string };

async function issue(issuerId: string, classroomId: string, candidates: Candidate[]) {
  const classroom = await db.classroom.findUnique({ where: { id: classroomId }, select: { id: true, name: true, track: true, seasonId: true } });
  if (!classroom || !candidates.length) return { issued: 0, skipped: candidates.length, created: [] as { id: string; holderId: string }[] };
  const existing = await db.certificate.findMany({
    where: { classroomId, seasonId: classroom.seasonId, holderId: { in: candidates.map((c) => c.holderId) } },
    select: { holderId: true, type: true },
  });
  const have = new Set(existing.map((e) => `${e.holderId}:${e.type}`));
  const todo = candidates.filter((c) => !have.has(`${c.holderId}:${c.type}`));
  const trackName = classroom.track ? `${classroom.track} — ${classroom.name}` : classroom.name;
  const created: { id: string; holderId: string }[] = [];
  for (const c of todo) {
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const cert = await db.certificate.create({
          data: {
            code: generateCertificateCode(),
            holderId: c.holderId,
            seasonId: classroom.seasonId,
            classroomId,
            type: c.type,
            holderName: c.holderName,
            trackName,
            issuedById: issuerId,
          },
          select: { id: true, holderId: true },
        });
        created.push(cert);
        break;
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
          const target = String((e.meta as { target?: unknown } | undefined)?.target ?? "");
          if (target.includes("code")) continue; // code collision, retry
          break; // someone else created it, skip
        }
        throw e;
      }
    }
  }
  return { issued: created.length, skipped: candidates.length - created.length, created };
}

async function finish(issuerId: string, classroomId: string, kind: string, res: Awaited<ReturnType<typeof issue>>) {
  if (res.created.length) {
    await audit(issuerId, "certificate.issue", { type: "classroom", id: classroomId }, { kind, count: res.created.length });
    await notify(
      res.created.map((c) => c.holderId),
      { title: "certificates.notify.issuedTitle", body: "certificates.notify.issuedBody", link: "/certificates" },
    );
  }
  revalidatePath("/certificates");
  return { issued: res.issued, skipped: res.skipped };
}

export async function issueStudentCertificates(
  classroomId: string,
  type: "PARTICIPATION" | "DISTINCTION",
  thresholds: Thresholds,
): Promise<IssueResult> {
  const user = await requireManager();
  if (!user) return { error: "certificates.errors.forbidden" };
  if (type !== "PARTICIPATION" && type !== "DISTINCTION") return { error: "common.invalidInput" };
  const th = parseThresholds({ p: thresholds?.participation, da: thresholds?.distinctionAttendance, dg: thresholds?.distinctionGrade });
  const rows = await classroomEligibility(classroomId, th);
  const qualified = rows.filter((r) => (type === "DISTINCTION" ? r.distinction : r.participation));
  const res = await issue(
    user.id,
    classroomId,
    qualified.map((r) => ({ holderId: r.id, type, holderName: fullName(r) })),
  );
  return finish(user.id, classroomId, `${type}:${th.participation}/${th.distinctionAttendance}/${th.distinctionGrade}`, res);
}

export async function issueSingleCertificate(classroomId: string, holderId: string, type: CertificateType): Promise<IssueResult> {
  const user = await requireManager();
  if (!user) return { error: "certificates.errors.forbidden" };
  if (!TYPES.includes(type)) return { error: "common.invalidInput" };
  const member = await db.classroomMember.findUnique({
    where: { classroomId_userId: { classroomId, userId: holderId } },
    select: { role: true, user: { select: { firstName: true, lastName: true, email: true } } },
  });
  if (!member) return { error: "certificates.errors.notMember" };
  const okType =
    member.role === "STUDENT" ? type === "PARTICIPATION" || type === "DISTINCTION" : member.role === type; // MENTOR→MENTOR, STAFF→STAFF
  if (!okType) return { error: "common.invalidInput" };
  const res = await issue(user.id, classroomId, [{ holderId, type, holderName: fullName(member.user) }]);
  return finish(user.id, classroomId, `${type}:manual`, res);
}

export async function issueTeamCertificates(classroomId: string): Promise<IssueResult> {
  const user = await requireManager();
  if (!user) return { error: "certificates.errors.forbidden" };
  const members = await db.classroomMember.findMany({
    where: { classroomId, role: { in: ["MENTOR", "STAFF"] } },
    select: { role: true, user: { select: { id: true, firstName: true, lastName: true, email: true } } },
  });
  const res = await issue(
    user.id,
    classroomId,
    members.map((m) => ({ holderId: m.user.id, type: m.role as CertificateType, holderName: fullName(m.user) })),
  );
  return finish(user.id, classroomId, "TEAM", res);
}

export async function setCertificateRevoked(id: string, revoked: boolean) {
  const user = await requireManager();
  if (!user) return;
  const cert = await db.certificate.findUnique({ where: { id }, select: { id: true, revokedAt: true, code: true } });
  if (!cert || !!cert.revokedAt === revoked) return;
  await db.certificate.update({ where: { id }, data: { revokedAt: revoked ? new Date() : null } });
  await audit(user.id, revoked ? "certificate.revoke" : "certificate.restore", { type: "certificate", id }, { code: cert.code });
  revalidatePath("/certificates");
  revalidatePath(`/verify/${cert.code}`);
}
