import Link from "next/link";
import { KeyRound, Languages, School, Trash2, UserRound } from "lucide-react";
import { db } from "@/lib/db";
import { requireActiveUser } from "@/lib/auth/session";
import { getI18n } from "@/i18n/server";
import { cn, formatDate, fullName } from "@/lib/utils";
import { Avatar, Badge, Card, CardBody, CardHeader, CLASSROOM_COLORS, EmptyState, PageHeader, ROLE_TONE } from "@/components/ui/primitives";
import { ConfirmAction } from "@/components/ui/interactive";
import { ChangePasswordForm } from "@/components/change-password-form";
import { AvatarForm, InfoForm, LanguageForm, StudentProfileForm } from "./profile-forms";
import { removeAvatar } from "./actions";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t("profile.title") };
}

export default async function ProfilePage() {
  const user = await requireActiveUser();
  const { t, locale } = await getI18n();
  const [profile, memberships] = await Promise.all([
    user.role === "STUDENT" ? db.studentProfile.findUnique({ where: { userId: user.id } }) : Promise.resolve(null),
    db.classroomMember.findMany({
      where: { userId: user.id },
      include: { classroom: { select: { id: true, name: true, track: true, color: true, archived: true, season: { select: { name: true } } } } },
      orderBy: { joinedAt: "desc" },
    }),
  ]);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader title={t("profile.title")} description={t("profile.subtitle")} />

      {/* Identity card */}
      <Card className="overflow-hidden">
        <div className="h-20 bg-gradient-to-r from-brand-700 via-brand-600 to-brand-400" />
        <div className="flex flex-col gap-4 px-5 pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="-mt-10 flex items-end gap-4">
            <Avatar user={user} size={88} className="ring-4 ring-white dark:ring-slate-900" />
            <div className="min-w-0 pb-1">
              <h2 className="truncate text-xl font-bold text-slate-900 dark:text-white">{fullName(user)}</h2>
              <p className="truncate text-sm text-slate-500">{user.email}</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <Badge tone={ROLE_TONE[user.role]}>{t(`common.roles.${user.role}`)}</Badge>
                {user.title && <Badge>{user.title}</Badge>}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-start gap-2">
            <AvatarForm />
            {user.avatarFileId && (
              <ConfirmAction
                action={removeAvatar}
                label={t("profile.avatar.remove")}
                icon={<Trash2 className="h-4 w-4" />}
                className="text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
              />
            )}
          </div>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title={<span className="flex items-center gap-2"><UserRound className="h-4 w-4 text-brand-600" />{t("profile.myInfo")}</span>} />
          <CardBody className="space-y-4">
            <InfoForm firstName={user.firstName} lastName={user.lastName} />
            <dl className="grid grid-cols-1 gap-3 border-t border-slate-100 pt-4 text-sm dark:border-slate-800 sm:grid-cols-2">
              <Info label={t("common.email")} value={user.email} />
              <Info label={t("profile.role")} value={t(`common.roles.${user.role}`)} />
              <Info label={t("profile.jobTitle")} value={user.title ?? "—"} />
              <Info label={t("profile.memberSince")} value={formatDate(user.createdAt, locale)} />
            </dl>
            <p className="text-xs text-slate-500">{t("profile.readOnlyHint")}</p>
          </CardBody>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader
              title={<span className="flex items-center gap-2"><Languages className="h-4 w-4 text-brand-600" />{t("common.language")}</span>}
              description={t("profile.languageHint")}
            />
            <CardBody>
              <LanguageForm current={locale} />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title={<span className="flex items-center gap-2"><KeyRound className="h-4 w-4 text-brand-600" />{t("profile.password")}</span>} />
            <CardBody>
              <ChangePasswordForm />
            </CardBody>
          </Card>
        </div>
      </div>

      {user.role === "STUDENT" && (
        <Card>
          <CardHeader title={t("profile.studentProfile")} description={t("profile.studentProfileHint")} />
          <CardBody>
            {profile ? (
              <StudentProfileForm
                profile={{
                  phone: profile.phone,
                  birthDate: profile.birthDate ? profile.birthDate.toISOString().slice(0, 10) : "",
                  gender: profile.gender ?? "",
                  university: profile.university,
                  faculty: profile.faculty,
                  courseYear: profile.courseYear,
                  studentIdNumber: profile.studentIdNumber ?? "",
                  github: profile.github ?? "",
                  linkedin: profile.linkedin ?? "",
                  portfolio: profile.portfolio ?? "",
                  bio: profile.bio ?? "",
                  priorExperience: profile.priorExperience ?? "",
                  hasLaptop: profile.hasLaptop,
                }}
              />
            ) : (
              <p className="text-sm text-slate-500">{t("profile.errors.noProfile")}</p>
            )}
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader title={<span className="flex items-center gap-2"><School className="h-4 w-4 text-brand-600" />{t("profile.myClassrooms")}</span>} />
        <CardBody>
          {memberships.length ? (
            <ul className="grid gap-3 sm:grid-cols-2">
              {memberships.map((m) => (
                <li key={m.classroomId}>
                  <Link
                    href={`/classrooms/${m.classroomId}`}
                    className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 transition hover:border-brand-300 hover:shadow-sm dark:border-slate-800 dark:hover:border-brand-700"
                  >
                    <span className={cn("h-10 w-1.5 shrink-0 rounded-full bg-gradient-to-b", CLASSROOM_COLORS[m.classroom.color] ?? CLASSROOM_COLORS.blue)} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-slate-900 dark:text-white">{m.classroom.name}</span>
                      <span className="block truncate text-xs text-slate-500">
                        {m.classroom.season.name}
                        {m.classroom.track ? ` · ${m.classroom.track}` : ""}
                      </span>
                    </span>
                    <span className="flex flex-col items-end gap-1">
                      <Badge tone={m.role === "STUDENT" ? "gray" : m.role === "MENTOR" ? "green" : "orange"}>{t(`common.classroomRoles.${m.role}`)}</Badge>
                      {m.classroom.archived && <Badge tone="yellow">{t("profile.archived")}</Badge>}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={<School className="h-8 w-8" />} title={t("profile.noClassrooms")} description={t("profile.noClassroomsText")} />
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-0.5 truncate text-slate-900 dark:text-slate-100">{value}</dd>
    </div>
  );
}
