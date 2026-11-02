// Each namespace lives in its own file so modules can be edited independently.
// Key format used in code: "<namespace>.<path>", e.g. t("classwork.submit").
import type { Locale, Messages } from "./core";

import azCommon from "./messages/az/common";
import azAuth from "./messages/az/auth";
import azNav from "./messages/az/nav";
import azDashboard from "./messages/az/dashboard";
import azClassroom from "./messages/az/classroom";
import azClasswork from "./messages/az/classwork";
import azAttendance from "./messages/az/attendance";
import azAnnouncements from "./messages/az/announcements";
import azAdmin from "./messages/az/admin";
import azCertificates from "./messages/az/certificates";
import azProfile from "./messages/az/profile";
import azNotifications from "./messages/az/notifications";
import azApplications from "./messages/az/applications";

import enCommon from "./messages/en/common";
import enAuth from "./messages/en/auth";
import enNav from "./messages/en/nav";
import enDashboard from "./messages/en/dashboard";
import enClassroom from "./messages/en/classroom";
import enClasswork from "./messages/en/classwork";
import enAttendance from "./messages/en/attendance";
import enAnnouncements from "./messages/en/announcements";
import enAdmin from "./messages/en/admin";
import enCertificates from "./messages/en/certificates";
import enProfile from "./messages/en/profile";
import enNotifications from "./messages/en/notifications";
import enApplications from "./messages/en/applications";

export const MESSAGES: Record<Locale, Messages> = {
  az: {
    common: azCommon,
    auth: azAuth,
    nav: azNav,
    dashboard: azDashboard,
    classroom: azClassroom,
    classwork: azClasswork,
    attendance: azAttendance,
    announcements: azAnnouncements,
    admin: azAdmin,
    certificates: azCertificates,
    profile: azProfile,
    notifications: azNotifications,
    applications: azApplications,
  },
  en: {
    common: enCommon,
    auth: enAuth,
    nav: enNav,
    dashboard: enDashboard,
    classroom: enClassroom,
    classwork: enClasswork,
    attendance: enAttendance,
    announcements: enAnnouncements,
    admin: enAdmin,
    certificates: enCertificates,
    profile: enProfile,
    notifications: enNotifications,
    applications: enApplications,
  },
};
