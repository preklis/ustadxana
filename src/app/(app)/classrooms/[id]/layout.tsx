import Link from "next/link";
import { Archive, CalendarDays, Clock, MapPin, Settings2 } from "lucide-react";
import { getI18n } from "@/i18n/server";
import { cn } from "@/lib/utils";
import { CLASSROOM_COLORS } from "@/components/ui/primitives";
import { ClassroomTabs } from "@/components/classroom/classroom-tabs";
import { getClassroomContext } from "../_lib/context";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { classroom } = await getClassroomContext(id);
  return { title: classroom.name };
}

export default async function ClassroomLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { classroom, access } = await getClassroomContext(id);
  const { t } = await getI18n();
  const base = `/classrooms/${classroom.id}`;

  const tabs = [
    { href: base, label: t("classroom.tabs.stream"), exact: true },
    { href: `${base}/classwork`, label: t("classroom.tabs.classwork") },
    { href: `${base}/people`, label: t("classroom.tabs.people") },
    ...(access.canViewGrades ? [{ href: `${base}/grades`, label: t("classroom.tabs.grades") }] : []),
    ...(access.canTakeAttendance || access.isStudent ? [{ href: `${base}/attendance`, label: t("classroom.tabs.attendance") }] : []),
  ];

  const meta = [
    classroom.room && { icon: MapPin, text: classroom.room },
    classroom.schedule && { icon: Clock, text: classroom.schedule },
    { icon: CalendarDays, text: classroom.season.name },
  ].filter(Boolean) as { icon: typeof MapPin; text: string }[];

  return (
    <div>
      <Link href="/classrooms" className="mb-3 inline-block text-sm text-slate-500 hover:text-brand-600">
        ← {t("classroom.list.title")}
      </Link>

      <header
        className={cn(
          "relative mb-4 overflow-hidden rounded-2xl bg-gradient-to-br p-5 text-white shadow-sm sm:p-7",
          CLASSROOM_COLORS[classroom.color] ?? CLASSROOM_COLORS.blue,
        )}
      >
        <div className="pointer-events-none absolute -bottom-16 -right-10 h-48 w-48 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute -top-20 right-32 h-40 w-40 rounded-full bg-white/10" />
        <div className="relative flex items-start justify-between gap-4">
          <div className="min-w-0">
            {classroom.archived && (
              <span className="mb-2 inline-flex items-center gap-1 rounded-full bg-black/25 px-2.5 py-0.5 text-xs font-medium">
                <Archive className="h-3.5 w-3.5" />
                {t("classroom.archived")}
              </span>
            )}
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{classroom.name}</h1>
            {classroom.track && <p className="mt-1 text-base text-white/90 sm:text-lg">{classroom.track}</p>}
            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-white/85">
              {meta.map(({ icon: Icon, text }) => (
                <span key={text} className="flex items-center gap-1.5">
                  <Icon className="h-4 w-4 shrink-0" />
                  {text}
                </span>
              ))}
            </div>
          </div>
          {access.canManage && (
            <Link
              href={`/admin/classrooms/${classroom.id}`}
              title={t("classroom.settings")}
              aria-label={t("classroom.settings")}
              className="shrink-0 rounded-lg bg-white/15 p-2 text-white transition hover:bg-white/25"
            >
              <Settings2 className="h-5 w-5" />
            </Link>
          )}
        </div>
      </header>

      <ClassroomTabs tabs={tabs} />
      {children}
    </div>
  );
}
