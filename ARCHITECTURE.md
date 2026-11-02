# Notes for developers

Stack: Next.js 15 (app router, server actions), Prisma + Postgres, Tailwind.

## Roles

- SUPERADMIN - project lead, can do everything
- ADMIN - coordinators, defaults in `ROLE_DEFAULTS` (src/lib/permissions.ts)
- STAFF - nothing global, only sees classrooms they're added to as staff
- MENTOR - teaches classrooms they're added to
- STUDENT - only their own classrooms

On top of the role, any user can get extra permissions (`User.extraPermissions`).

Use `can(user, "PERM")` for global checks and `getClassroomAccess(user, classroomId)` for anything inside a classroom. Every classroom page/action should check access and `notFound()` if the user can't view it.

Students register themselves (email code -> profile -> approval). Team accounts are created from /admin/users with a temp password.

## Where things are

- `src/app/(auth)` - login, register, password reset, auth actions
- `src/app/(setup)` - onboarding, pending, change-password (no sidebar)
- `src/app/(app)` - the actual app with the sidebar
- `src/app/api/files/[id]` - file downloads, permission checked there
- `src/components/ui` - small UI kit
- `src/lib` - db, auth, permissions, storage, mail, audit
- `src/i18n/messages/{az,en}` - translations, one file per section

## Conventions

- server components by default, client components only for forms/interactive stuff
- form actions return `ActionState` (`ok()` / `fail()` from src/lib/action.ts); on the client use `useFormAction` so the form isn't cleared on errors
- no hardcoded UI text, use `t("namespace.key")` (`getI18n()` on the server, `useI18n()` on the client). az and en files should have the same keys
- uploads: `<FileInput />` in the form, `saveUploads(filesFrom(fd), user.id, { assignmentId })` in the action
- log admin/teacher actions with `audit()`, notify people with `notify()`
- dates are shown in Baku time (`formatDate`, `toDateTimeLocal`, `fromDateTimeLocal`)

`npm run smoke` hits every page as each demo role against a running server on :3100 (needs `SEED_DEMO=true npm run db:seed` first).
