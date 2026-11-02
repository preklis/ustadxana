import { requireActiveUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { can, isTeam } from "@/lib/permissions";
import { AppShell, type NavItem } from "@/components/shell/app-shell";
import { ApplyBanner } from "@/components/apply-banner";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireActiveUser();
  const reviewer = can(user, "REVIEW_APPLICATIONS");
  const [unread, pendingApprovals, toReview] = await Promise.all([
    db.notification.count({ where: { userId: user.id, readAt: null } }),
    can(user, "APPROVE_STUDENTS") ? db.user.count({ where: { role: "STUDENT", status: "PENDING_APPROVAL" } }) : Promise.resolve(0),
    reviewer
      ? db.application.count({ where: { form: { isOpen: true }, status: "SUBMITTED", reviews: { none: { reviewerId: user.id } } } })
      : Promise.resolve(0),
  ]);
  // applicant checkers have no classrooms or certificates, keep their menu short
  const checker = user.role === "APPLICANT_CHECKER";

  const main: NavItem[] = [
    { href: "/dashboard", label: "nav.dashboard", icon: "home" },
    ...(checker ? [] : [{ href: "/classrooms", label: "nav.classrooms", icon: "classrooms" } as NavItem]),
    ...(checker ? [{ href: "/admin/applications", label: "nav.applications", icon: "inbox", badge: toReview || undefined } as NavItem] : []),
    ...(user.role === "STUDENT" ? [{ href: "/todo", label: "nav.todo", icon: "todo" } as NavItem] : []),
    { href: "/announcements", label: "nav.announcements", icon: "megaphone" },
    ...(checker ? [] : [{ href: "/certificates", label: "nav.certificates", icon: "award" } as NavItem]),
    { href: "/notifications", label: "nav.notifications", icon: "bell", badge: unread || undefined },
  ];

  const admin: NavItem[] = [];
  if (can(user, "APPROVE_STUDENTS")) admin.push({ href: "/admin/approvals", label: "nav.approvals", icon: "check", badge: pendingApprovals || undefined });
  if (reviewer && !checker) admin.push({ href: "/admin/applications", label: "nav.applications", icon: "inbox", badge: toReview || undefined });
  if (can(user, "MANAGE_USERS")) admin.push({ href: "/admin/users", label: "nav.users", icon: "users" });
  if (can(user, "MANAGE_CLASSROOMS")) admin.push({ href: "/admin/classrooms", label: "nav.manageClassrooms", icon: "layout" });
  if (can(user, "MANAGE_SEASONS")) admin.push({ href: "/admin/seasons", label: "nav.seasons", icon: "calendar" });
  if (can(user, "MANAGE_APPEARANCE")) admin.push({ href: "/admin/appearance", label: "nav.appearance", icon: "palette" });
  if (can(user, "VIEW_AUDIT_LOG")) admin.push({ href: "/admin/audit", label: "nav.audit", icon: "scroll" });

  return (
    <AppShell
      user={{
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        avatarFileId: user.avatarFileId,
        isTeam: isTeam(user),
      }}
      main={main}
      admin={admin}
      banner={user.role === "STUDENT" ? <ApplyBanner audience="student" /> : null}
    >
      {children}
    </AppShell>
  );
}
