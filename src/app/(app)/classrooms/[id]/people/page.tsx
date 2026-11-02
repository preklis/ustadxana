import { UserCog, Users } from "lucide-react";
import type { ClassroomRole } from "@prisma/client";
import { db } from "@/lib/db";
import { isTeam } from "@/lib/permissions";
import { getI18n } from "@/i18n/server";
import { fullName } from "@/lib/utils";
import { LinkButton } from "@/components/ui/button";
import { Avatar, Card, EmptyState } from "@/components/ui/primitives";
import { getClassroomContext } from "../../_lib/context";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [{ classroom }, { t }] = await Promise.all([getClassroomContext(id), getI18n()]);
  return { title: `${t("classroom.tabs.people")} · ${classroom.name}` };
}

const SECTIONS: { role: ClassroomRole; key: string }[] = [
  { role: "MENTOR", key: "mentors" },
  { role: "STAFF", key: "staff" },
  { role: "STUDENT", key: "students" },
];

export default async function PeoplePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, classroom, access } = await getClassroomContext(id);
  const { t } = await getI18n();
  const showEmail = isTeam(user);

  const members = await db.classroomMember.findMany({
    where: { classroomId: classroom.id },
    orderBy: [{ user: { firstName: "asc" } }, { user: { lastName: "asc" } }],
    select: {
      role: true,
      user: { select: { id: true, firstName: true, lastName: true, email: true, avatarFileId: true, title: true } },
    },
  });

  return (
    <div className="space-y-6">
      {access.canManage && (
        <div className="flex justify-end">
          <LinkButton href={`/admin/classrooms/${classroom.id}`} variant="outline">
            <UserCog className="h-4 w-4" />
            {t("classroom.people.manage")}
          </LinkButton>
        </div>
      )}

      {SECTIONS.map(({ role, key }) => {
        const list = members.filter((m) => m.role === role).map((m) => m.user);
        if (role === "STAFF" && list.length === 0) return null;
        return (
          <section key={role}>
            <div className="mb-3 flex items-end justify-between border-b-2 border-brand-600/70 pb-2">
              <h2 className="text-xl font-semibold text-brand-700 dark:text-brand-400">{t(`classroom.people.${key}`)}</h2>
              <span className="text-sm text-slate-500">
                {role === "STUDENT" ? t("classroom.studentCount", { n: list.length }) : list.length}
              </span>
            </div>
            {list.length === 0 ? (
              role === "STUDENT" ? (
                <EmptyState icon={<Users className="h-8 w-8" />} title={t("classroom.people.noStudents")} />
              ) : (
                <p className="px-1 py-2 text-sm text-slate-500">{t("classroom.noMentors")}</p>
              )
            ) : (
              <Card className="divide-y divide-slate-100 dark:divide-slate-800">
                {list.map((u) => (
                  <div key={u.id} className="flex items-center gap-3 px-4 py-3">
                    <Avatar user={u} size={role === "STUDENT" ? 36 : 40} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-slate-900 dark:text-slate-100">
                        {fullName(u)}
                        {u.id === user.id && <span className="ml-1.5 text-xs font-normal text-slate-400">({t("common.you")})</span>}
                      </p>
                      {(role !== "STUDENT" && u.title) || showEmail ? (
                        <p className="truncate text-xs text-slate-500">
                          {[role !== "STUDENT" ? u.title : null, showEmail ? u.email : null].filter(Boolean).join(" · ")}
                        </p>
                      ) : null}
                    </div>
                    {showEmail && (
                      <a
                        href={`mailto:${u.email}`}
                        className="hidden shrink-0 text-sm text-brand-600 hover:underline sm:inline"
                      >
                        {t("common.email")}
                      </a>
                    )}
                  </div>
                ))}
              </Card>
            )}
          </section>
        );
      })}
    </div>
  );
}
