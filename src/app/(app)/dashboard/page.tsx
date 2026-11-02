import { requireActiveUser, type SessionUser } from "@/lib/auth/session";
import { can, permissionsOf } from "@/lib/permissions";
import { getI18n } from "@/i18n/server";
import { Alert, PageHeader } from "@/components/ui/primitives";
import { StudentDashboard } from "@/components/dashboard/student-dashboard";
import { TeamDashboard } from "@/components/dashboard/team-dashboard";
import { AdminDashboard } from "@/components/dashboard/admin-dashboard";
import { ThemeSlot } from "@/components/theme-slot";
import { ApplicationsWidget } from "@/components/dashboard/applications-widget";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t("dashboard.title") };
}

function hasOverview(user: SessionUser) {
  if (user.role === "SUPERADMIN" || user.role === "ADMIN") return true;
  if (user.role === "STUDENT") return false;
  const p = permissionsOf(user);
  return p.has("VIEW_ALL_CLASSROOMS") || p.has("MANAGE_USERS") || p.has("APPROVE_STUDENTS") || p.has("MANAGE_CLASSROOMS");
}

function greetingKey() {
  const hour = (new Date().getUTCHours() + 4) % 24; // Asia/Baku
  if (hour >= 5 && hour < 12) return "dashboard.greeting.morning";
  if (hour >= 12 && hour < 18) return "dashboard.greeting.afternoon";
  return "dashboard.greeting.evening";
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const user = await requireActiveUser();
  const { t } = await getI18n();
  const { denied } = await searchParams;
  const name = user.firstName || user.email;
  const subtitle =
    user.role === "STUDENT" ? t("dashboard.subtitle.student") : hasOverview(user) ? t("dashboard.subtitle.admin") : t("dashboard.subtitle.team");

  return (
    <div className="bc-dashboard">
      {denied === "1" && (
        <Alert tone="red" className="mb-5">
          {t("common.denied")}
        </Alert>
      )}
      <PageHeader title={t(greetingKey(), { name })} description={subtitle} />
      <ThemeSlot name="dashboardTop" className="mb-6" />
      {can(user, "REVIEW_APPLICATIONS") && <ApplicationsWidget user={user} />}
      {user.role === "APPLICANT_CHECKER" ? null : user.role === "STUDENT" ? (
        <StudentDashboard user={user} />
      ) : hasOverview(user) ? (
        <AdminDashboard user={user} />
      ) : (
        <TeamDashboard user={user} />
      )}
    </div>
  );
}
