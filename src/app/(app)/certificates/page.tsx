import Link from "next/link";
import type { Certificate, CertificateType } from "@prisma/client";
import { Award, Download, ExternalLink, GraduationCap, Medal, RotateCcw, ShieldOff, Sparkles, Users } from "lucide-react";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { requireActiveUser } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { getActiveSeason } from "@/lib/season";
import { getI18n } from "@/i18n/server";
import { cn, formatDate, fullName } from "@/lib/utils";
import { buttonClass } from "@/components/ui/button";
import { Avatar, Badge, Card, CardBody, CardHeader, EmptyState, PageHeader, StatCard, Table, Tabs, td, th } from "@/components/ui/primitives";
import { ConfirmAction } from "@/components/ui/interactive";
import { percentTone } from "@/components/attendance/constants";
import { classroomEligibility, parseThresholds } from "@/components/certificates/eligibility";
import { CopyButton, IssueButton, ManageFilters } from "./certificate-controls";
import { issueSingleCertificate, issueStudentCertificates, issueTeamCertificates, setCertificateRevoked } from "./actions";

type SP = { tab?: string; season?: string; classroom?: string; p?: string; da?: string; dg?: string };

const TYPE_STYLE: Record<CertificateType, { gradient: string; tone: "blue" | "yellow" | "green" | "purple" }> = {
  PARTICIPATION: { gradient: "from-brand-700 via-brand-600 to-brand-400", tone: "blue" },
  DISTINCTION: { gradient: "from-amber-600 via-amber-500 to-yellow-400", tone: "yellow" },
  MENTOR: { gradient: "from-emerald-700 via-emerald-600 to-teal-400", tone: "green" },
  STAFF: { gradient: "from-violet-700 via-violet-600 to-fuchsia-400", tone: "purple" },
};

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t("certificates.title") };
}

export default async function CertificatesPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireActiveUser();
  const { t } = await getI18n();
  const sp = await searchParams;
  const manager = can(user, "MANAGE_CERTIFICATES");
  const tab = manager && sp.tab === "manage" ? "manage" : "mine";

  return (
    <div className="space-y-2">
      <PageHeader title={t("certificates.title")} description={tab === "manage" ? t("certificates.manageSubtitle") : t("certificates.subtitle")} />
      {manager && (
        <Tabs
          active={tab}
          tabs={[
            { key: "mine", label: t("certificates.mine"), href: "/certificates" },
            { key: "manage", label: t("certificates.manage"), href: "/certificates?tab=manage" },
          ]}
        />
      )}
      {tab === "manage" ? <Manage sp={sp} /> : <Mine userId={user.id} />}
    </div>
  );
}

async function Mine({ userId }: { userId: string }) {
  const { t, locale } = await getI18n();
  const certs = await db.certificate.findMany({
    where: { holderId: userId, revokedAt: null },
    include: { season: { select: { name: true } } },
    orderBy: { issuedAt: "desc" },
  });
  if (!certs.length)
    return <EmptyState icon={<Award className="h-8 w-8" />} title={t("certificates.noneYet")} description={t("certificates.noneYetText")} />;

  return (
    <div className="grid gap-5 md:grid-cols-2">
      {certs.map((c) => {
        const verifyUrl = `${env.appUrl}/verify/${c.code}`;
        return (
          <Card key={c.id} className="overflow-hidden">
            <div className={cn("relative bg-gradient-to-br p-5 text-white", TYPE_STYLE[c.type].gradient)}>
              <div className="absolute -right-6 -top-6 h-28 w-28 rounded-full bg-white/10" />
              <div className="absolute -bottom-10 right-10 h-24 w-24 rounded-full bg-white/10" />
              <div className="relative flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-widest text-white/80">{c.season.name}</p>
                  <h3 className="mt-1 text-xl font-bold">{t(`certificates.titles.${c.type}`)}</h3>
                  {c.trackName && <p className="mt-1 truncate text-sm text-white/90">{c.trackName}</p>}
                </div>
                <TypeIcon type={c.type} className="h-10 w-10 shrink-0 text-white/90" />
              </div>
            </div>
            <CardBody className="space-y-4">
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-xs uppercase tracking-wide text-slate-500">{t("certificates.issuedOn")}</dt>
                  <dd className="mt-0.5 font-medium">{formatDate(c.issuedAt, locale)}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-slate-500">{t("certificates.code")}</dt>
                  <dd className="mt-0.5 font-mono font-semibold tracking-wider">{c.code}</dd>
                </div>
              </dl>
              <div className="flex flex-wrap gap-2">
                <a href={`/api/certificates/${c.id}/pdf`} className={buttonClass("primary", "sm")}>
                  <Download className="h-4 w-4" />
                  {t("certificates.downloadPdf")}
                </a>
                <a href={`/verify/${c.code}`} target="_blank" rel="noopener noreferrer" className={buttonClass("outline", "sm")}>
                  <ExternalLink className="h-4 w-4" />
                  {t("certificates.verifyPage")}
                </a>
                <CopyButton text={verifyUrl} label={t("certificates.copyLink")} />
              </div>
            </CardBody>
          </Card>
        );
      })}
    </div>
  );
}

function TypeIcon({ type, className }: { type: CertificateType; className?: string }) {
  const Icon = type === "DISTINCTION" ? Medal : type === "MENTOR" ? GraduationCap : type === "STAFF" ? Users : Award;
  return <Icon className={className} />;
}

async function Manage({ sp }: { sp: SP }) {
  const { t, locale } = await getI18n();
  const [seasons, active] = await Promise.all([
    db.season.findMany({ orderBy: [{ startDate: "desc" }, { createdAt: "desc" }], select: { id: true, name: true } }),
    getActiveSeason(),
  ]);
  if (!seasons.length) return <EmptyState icon={<Award className="h-8 w-8" />} title={t("certificates.noSeasons")} />;

  const seasonId = seasons.some((s) => s.id === sp.season) ? sp.season! : (active?.id ?? seasons[0].id);
  const classrooms = await db.classroom.findMany({
    where: { seasonId },
    orderBy: { name: "asc" },
    select: { id: true, name: true, track: true, archived: true },
  });
  const classroom = classrooms.find((c) => c.id === sp.classroom) ?? null;
  const thr = parseThresholds({ p: sp.p, da: sp.da, dg: sp.dg });

  return (
    <div className="space-y-6">
      <Card>
        <CardBody>
          <ManageFilters
            seasons={seasons.map((s) => ({ id: s.id, label: s.name }))}
            classrooms={classrooms.map((c) => ({ id: c.id, label: c.archived ? `${c.name} (${t("certificates.archived")})` : c.name }))}
            season={seasonId}
            classroom={classroom?.id ?? ""}
            p={thr.participation}
            da={thr.distinctionAttendance}
            dg={thr.distinctionGrade}
          />
          <p className="mt-3 text-xs text-slate-500">
            {t("certificates.criteriaText", { p: thr.participation, da: thr.distinctionAttendance, dg: thr.distinctionGrade })} {t("certificates.ruleHint")}
          </p>
        </CardBody>
      </Card>

      {classroom ? (
        <ClassroomSection classroomId={classroom.id} thr={thr} />
      ) : (
        <EmptyState icon={<Sparkles className="h-8 w-8" />} title={t("certificates.pickClassroom")} description={t("certificates.pickClassroomText")} />
      )}

      <IssuedList seasonId={seasonId} classroomId={classroom?.id} locale={locale} />
    </div>
  );
}

function certBadges(certs: Pick<Certificate, "id" | "type" | "revokedAt">[], t: (k: string) => string) {
  return certs.map((c) => (
    <Badge key={c.id} tone={c.revokedAt ? "red" : TYPE_STYLE[c.type].tone} className={cn(c.revokedAt && "line-through")}>
      {t(`certificates.types.${c.type}`)}
    </Badge>
  ));
}

async function ClassroomSection({ classroomId, thr }: { classroomId: string; thr: ReturnType<typeof parseThresholds> }) {
  const { t } = await getI18n();
  const [rows, team, certs] = await Promise.all([
    classroomEligibility(classroomId, thr),
    db.classroomMember.findMany({
      where: { classroomId, role: { in: ["MENTOR", "STAFF"] } },
      select: { role: true, user: { select: { id: true, firstName: true, lastName: true, email: true, avatarFileId: true } } },
    }),
    db.certificate.findMany({ where: { classroomId }, select: { id: true, holderId: true, type: true, revokedAt: true } }),
  ]);
  const byHolder = new Map<string, typeof certs>();
  for (const c of certs) byHolder.set(c.holderId, [...(byHolder.get(c.holderId) ?? []), c]);
  const has = (uid: string, type: CertificateType) => (byHolder.get(uid) ?? []).some((c) => c.type === type);

  const partQ = rows.filter((r) => r.participation);
  const distQ = rows.filter((r) => r.distinction);
  const newPart = partQ.filter((r) => !has(r.id, "PARTICIPATION")).length;
  const newDist = distQ.filter((r) => !has(r.id, "DISTINCTION")).length;
  const newTeam = team.filter((m) => !has(m.user.id, m.role as CertificateType)).length;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={t("certificates.stats.students")} value={rows.length} icon={<Users className="h-5 w-5" />} />
        <StatCard label={t("certificates.stats.participation")} value={partQ.length} icon={<Award className="h-5 w-5" />} hint={t("certificates.stats.newToIssue", { n: newPart })} />
        <StatCard label={t("certificates.stats.distinction")} value={distQ.length} icon={<Medal className="h-5 w-5" />} hint={t("certificates.stats.newToIssue", { n: newDist })} />
        <StatCard label={t("certificates.stats.issued")} value={certs.filter((c) => !c.revokedAt).length} icon={<Sparkles className="h-5 w-5" />} />
      </div>

      <Card>
        <CardHeader
          title={t("certificates.students")}
          description={t("certificates.studentsHint")}
          action={
            <div className="flex flex-wrap justify-end gap-2">
              <IssueButton
                action={issueStudentCertificates.bind(null, classroomId, "PARTICIPATION", thr)}
                label={t("certificates.issueParticipation", { n: newPart })}
                confirmText={t("certificates.issueConfirm", { n: newPart })}
                disabled={!newPart}
                icon={<Award className="h-4 w-4" />}
              />
              <IssueButton
                action={issueStudentCertificates.bind(null, classroomId, "DISTINCTION", thr)}
                label={t("certificates.issueDistinction", { n: newDist })}
                confirmText={t("certificates.issueConfirm", { n: newDist })}
                disabled={!newDist}
                variant="outline"
                icon={<Medal className="h-4 w-4" />}
              />
            </div>
          }
        />
        {rows.length ? (
          <Table>
            <thead>
              <tr>
                <th className={th}>{t("certificates.student")}</th>
                <th className={cn(th, "text-center")}>{t("certificates.attendance")}</th>
                <th className={cn(th, "text-center")}>{t("certificates.avgGrade")}</th>
                <th className={th}>{t("certificates.qualifies")}</th>
                <th className={th}>{t("certificates.issued")}</th>
                <th className={cn(th, "text-right")}>{t("common.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className={td}>
                    <div className="flex items-center gap-2.5">
                      <Avatar user={r} size={30} />
                      <div className="min-w-0">
                        <p className="truncate font-medium">{fullName(r)}</p>
                        <p className="truncate text-xs text-slate-500">{r.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className={cn(td, "text-center")}>
                    <Badge tone={percentTone(r.attendance)}>{r.attendance === null ? "—" : `${r.attendance}%`}</Badge>
                    <p className="mt-0.5 text-[11px] text-slate-400">{t("certificates.sessionsN", { n: r.sessionsRecorded })}</p>
                  </td>
                  <td className={cn(td, "text-center")}>
                    <Badge tone={percentTone(r.grade)}>{r.grade === null ? "—" : `${r.grade}%`}</Badge>
                    <p className="mt-0.5 text-[11px] text-slate-400">
                      {r.gradedCount}/{r.gradableTotal}
                    </p>
                  </td>
                  <td className={td}>
                    {r.distinction ? (
                      <Badge tone="yellow">{t("certificates.types.DISTINCTION")}</Badge>
                    ) : r.participation ? (
                      <Badge tone="blue">{t("certificates.types.PARTICIPATION")}</Badge>
                    ) : (
                      <span className="text-xs text-slate-400">{t("certificates.notQualified")}</span>
                    )}
                  </td>
                  <td className={td}>
                    <div className="flex flex-wrap gap-1">{certBadges(byHolder.get(r.id) ?? [], t)}</div>
                  </td>
                  <td className={cn(td, "text-right")}>
                    <div className="flex flex-wrap justify-end gap-1">
                      {(["PARTICIPATION", "DISTINCTION"] as const)
                        .filter((type) => !has(r.id, type))
                        .map((type) => (
                          <IssueButton
                            key={type}
                            action={issueSingleCertificate.bind(null, classroomId, r.id, type)}
                            label={t(`certificates.issueOne.${type}`)}
                            confirmText={
                              (type === "DISTINCTION" ? r.distinction : r.participation)
                                ? undefined
                                : t("certificates.issueOverrideConfirm", { name: fullName(r) })
                            }
                            variant="ghost"
                          />
                        ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <CardBody>
            <EmptyState title={t("certificates.noStudents")} />
          </CardBody>
        )}
      </Card>

      <Card>
        <CardHeader
          title={t("certificates.team")}
          description={t("certificates.teamHint")}
          action={
            <IssueButton
              action={issueTeamCertificates.bind(null, classroomId)}
              label={t("certificates.issueTeam", { n: newTeam })}
              confirmText={t("certificates.issueConfirm", { n: newTeam })}
              disabled={!newTeam}
              variant="outline"
              icon={<GraduationCap className="h-4 w-4" />}
            />
          }
        />
        {team.length ? (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {team.map((m) => (
              <li key={m.user.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <Avatar user={m.user} size={30} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{fullName(m.user)}</p>
                    <p className="text-xs text-slate-500">{t(`common.classroomRoles.${m.role}`)}</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {certBadges(byHolder.get(m.user.id) ?? [], t)}
                  {!has(m.user.id, m.role as CertificateType) && (
                    <IssueButton
                      action={issueSingleCertificate.bind(null, classroomId, m.user.id, m.role as CertificateType)}
                      label={t(`certificates.issueOne.${m.role}`)}
                      variant="ghost"
                    />
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <CardBody>
            <p className="text-sm text-slate-500">{t("certificates.noTeam")}</p>
          </CardBody>
        )}
      </Card>
    </div>
  );
}

async function IssuedList({ seasonId, classroomId, locale }: { seasonId: string; classroomId?: string; locale: string }) {
  const { t } = await getI18n();
  const certs = await db.certificate.findMany({
    where: { seasonId, ...(classroomId ? { classroomId } : {}) },
    orderBy: [{ issuedAt: "desc" }],
    take: 500,
    include: {
      holder: { select: { id: true, firstName: true, lastName: true, email: true, avatarFileId: true } },
      classroom: { select: { name: true } },
    },
  });
  return (
    <Card>
      <CardHeader title={t("certificates.issuedList")} description={t("certificates.issuedListCount", { n: certs.length })} />
      {certs.length ? (
        <Table>
          <thead>
            <tr>
              <th className={th}>{t("certificates.holder")}</th>
              <th className={th}>{t("certificates.type")}</th>
              {!classroomId && <th className={th}>{t("certificates.classroom")}</th>}
              <th className={th}>{t("certificates.code")}</th>
              <th className={th}>{t("certificates.issuedOn")}</th>
              <th className={th}>{t("common.status")}</th>
              <th className={cn(th, "text-right")}>{t("common.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {certs.map((c) => (
              <tr key={c.id} className={cn(c.revokedAt && "opacity-70")}>
                <td className={td}>
                  <div className="flex items-center gap-2">
                    <Avatar user={c.holder} size={26} />
                    <span className="truncate font-medium">{c.holderName}</span>
                  </div>
                </td>
                <td className={td}>
                  <Badge tone={TYPE_STYLE[c.type].tone}>{t(`certificates.types.${c.type}`)}</Badge>
                </td>
                {!classroomId && <td className={cn(td, "text-slate-600 dark:text-slate-400")}>{c.classroom?.name ?? "—"}</td>}
                <td className={td}>
                  <Link href={`/verify/${c.code}`} target="_blank" className="font-mono text-xs font-semibold tracking-wider text-brand-700 hover:underline dark:text-brand-400">
                    {c.code}
                  </Link>
                </td>
                <td className={cn(td, "whitespace-nowrap")}>{formatDate(c.issuedAt, locale)}</td>
                <td className={td}>
                  {c.revokedAt ? <Badge tone="red">{t("certificates.revoked")}</Badge> : <Badge tone="green">{t("certificates.valid")}</Badge>}
                </td>
                <td className={cn(td, "text-right")}>
                  <div className="flex justify-end gap-1">
                    <a href={`/api/certificates/${c.id}/pdf`} className={buttonClass("ghost", "sm")} title={t("certificates.downloadPdf")}>
                      <Download className="h-4 w-4" />
                      <span className="sr-only">{t("certificates.downloadPdf")}</span>
                    </a>
                    {c.revokedAt ? (
                      <ConfirmAction action={setCertificateRevoked.bind(null, c.id, false)} label={t("certificates.restore")} icon={<RotateCcw className="h-4 w-4" />} />
                    ) : (
                      <ConfirmAction
                        action={setCertificateRevoked.bind(null, c.id, true)}
                        label={t("certificates.revoke")}
                        confirmText={t("certificates.revokeConfirm", { name: c.holderName })}
                        icon={<ShieldOff className="h-4 w-4" />}
                        className="text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
                      />
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      ) : (
        <CardBody>
          <p className="text-sm text-slate-500">{t("certificates.noneIssued")}</p>
        </CardBody>
      )}
    </Card>
  );
}
