import type { ClassroomRole, Permission, Role, User } from "@prisma/client";
import { db } from "./db";

export const ALL_PERMISSIONS: Permission[] = [
  "MANAGE_USERS",
  "APPROVE_STUDENTS",
  "VIEW_ALL_CLASSROOMS",
  "MANAGE_CLASSROOMS",
  "MANAGE_SEASONS",
  "POST_ANNOUNCEMENTS",
  "MANAGE_ATTENDANCE",
  "VIEW_GRADES",
  "MANAGE_CERTIFICATES",
  "VIEW_AUDIT_LOG",
  "MANAGE_APPEARANCE",
  "REVIEW_APPLICATIONS",
  "MANAGE_APPLICATIONS",
];

export const ROLE_DEFAULTS: Record<Role, Permission[]> = {
  SUPERADMIN: ALL_PERMISSIONS,
  ADMIN: [
    "MANAGE_USERS",
    "APPROVE_STUDENTS",
    "VIEW_ALL_CLASSROOMS",
    "MANAGE_CLASSROOMS",
    "POST_ANNOUNCEMENTS",
    "MANAGE_ATTENDANCE",
    "VIEW_GRADES",
    "MANAGE_CERTIFICATES",
    "MANAGE_APPEARANCE",
    "REVIEW_APPLICATIONS",
    "MANAGE_APPLICATIONS",
  ],
  STAFF: [],
  MENTOR: [],
  STUDENT: [],
  APPLICANT_CHECKER: ["REVIEW_APPLICATIONS"],
};

export const TEAM_ROLES: Role[] = ["SUPERADMIN", "ADMIN", "STAFF", "MENTOR", "APPLICANT_CHECKER"];

type PermUser = Pick<User, "role" | "extraPermissions">;

export function permissionsOf(user: PermUser): Set<Permission> {
  return new Set<Permission>([...ROLE_DEFAULTS[user.role], ...user.extraPermissions]);
}

export function can(user: PermUser, perm: Permission) {
  if (user.role === "SUPERADMIN") return true;
  const p = permissionsOf(user);
  // whoever builds the forms can also read the responses
  return p.has(perm) || (perm === "REVIEW_APPLICATIONS" && p.has("MANAGE_APPLICATIONS"));
}

// opening an application form to the public is the project lead's call only
export function canOpenApplications(user: Pick<User, "role">) {
  return user.role === "SUPERADMIN";
}

export function isTeam(user: Pick<User, "role">) {
  return TEAM_ROLES.includes(user.role);
}

// only the superadmin can manage admins, nobody can create another superadmin from the ui
export function assignableRoles(actor: Pick<User, "role">): Role[] {
  if (actor.role === "SUPERADMIN") return ["ADMIN", "STAFF", "MENTOR", "APPLICANT_CHECKER", "STUDENT"];
  return ["STAFF", "MENTOR", "APPLICANT_CHECKER", "STUDENT"];
}

export function canEditUser(
  actor: Pick<User, "id" | "role" | "extraPermissions">,
  target: Pick<User, "id" | "role"> & Partial<Pick<User, "extraPermissions">>,
) {
  if (actor.id === target.id) return false; // use profile page for self
  if (target.role === "SUPERADMIN") return false;
  if (actor.role === "SUPERADMIN") return true;
  if (!can(actor, "MANAGE_USERS")) return false;
  if (target.role === "ADMIN") return false;
  // non-superadmins cant manage someone holding perms they dont have
  const mine = permissionsOf(actor);
  return (target.extraPermissions ?? []).every((p) => mine.has(p));
}

export type ClassroomAccess = {
  canView: boolean;
  canTeach: boolean;
  canManage: boolean;
  canTakeAttendance: boolean;
  canViewGrades: boolean;
  isStudent: boolean;
  memberRole: ClassroomRole | null;
};

const NO_ACCESS: ClassroomAccess = {
  canView: false,
  canTeach: false,
  canManage: false,
  canTakeAttendance: false,
  canViewGrades: false,
  isStudent: false,
  memberRole: null,
};

export async function getClassroomAccess(
  user: Pick<User, "id" | "role" | "extraPermissions">,
  classroomId: string,
): Promise<ClassroomAccess> {
  const membership = await db.classroomMember.findUnique({
    where: { classroomId_userId: { classroomId, userId: user.id } },
    select: { role: true },
  });
  return accessFrom(user, membership?.role ?? null);
}

export function accessFrom(
  user: Pick<User, "role" | "extraPermissions">,
  memberRole: ClassroomRole | null,
): ClassroomAccess {
  const perms = permissionsOf(user);
  const superish = user.role === "SUPERADMIN";
  const viewAll = superish || perms.has("VIEW_ALL_CLASSROOMS");
  const manage = superish || perms.has("MANAGE_CLASSROOMS");

  if (user.role === "STUDENT") {
    return memberRole === "STUDENT" ? { ...NO_ACCESS, canView: true, isStudent: true, memberRole } : NO_ACCESS;
  }

  const isMentor = memberRole === "MENTOR";
  const isStaffMember = memberRole === "STAFF";
  const canView = viewAll || isMentor || isStaffMember;
  if (!canView) return NO_ACCESS;

  return {
    canView: true,
    canTeach: isMentor || manage,
    canManage: manage,
    canTakeAttendance: isMentor || manage || perms.has("MANAGE_ATTENDANCE"),
    canViewGrades: isMentor || manage || perms.has("VIEW_GRADES"),
    isStudent: false,
    memberRole,
  };
}

export function visibleClassroomsWhere(user: Pick<User, "id" | "role" | "extraPermissions">) {
  if (user.role !== "STUDENT" && (user.role === "SUPERADMIN" || permissionsOf(user).has("VIEW_ALL_CLASSROOMS"))) {
    return {};
  }
  if (user.role === "STUDENT") {
    return { members: { some: { userId: user.id, role: "STUDENT" as const } } };
  }
  return { members: { some: { userId: user.id } } };
}
