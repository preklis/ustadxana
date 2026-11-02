// creates a session per role in the db, hits every page and reports non-200s
import { PrismaClient } from "@prisma/client";
import { createHash, randomBytes } from "node:crypto";

const db = new PrismaClient();
const BASE = "http://localhost:3100";

async function sessionFor(email: string) {
  const user = await db.user.findUniqueOrThrow({ where: { email } });
  await db.user.update({ where: { id: user.id }, data: { mustChangePassword: false } });
  const token = randomBytes(32).toString("base64url");
  await db.session.create({
    data: { userId: user.id, tokenHash: createHash("sha256").update(token).digest("hex"), expiresAt: new Date(Date.now() + 3600e3) },
  });
  return token;
}

async function main() {
  const classroom = await db.classroom.findFirstOrThrow();
  const assignment = await db.assignment.findFirstOrThrow({ where: { classroomId: classroom.id } });
  const anyUser = await db.user.findFirstOrThrow({ where: { email: "student1@demo.az" } });
  const c = `/classrooms/${classroom.id}`;
  // applicant checker may not exist on older dev databases
  await db.user.upsert({
    where: { email: "checker@demo.az" },
    update: {},
    create: { email: "checker@demo.az", passwordHash: "x", role: "APPLICANT_CHECKER", status: "ACTIVE", firstName: "Fərid", lastName: "Yoxlayıcı" },
  });
  const appForm = await db.applicationForm.findFirst({ include: { applications: { take: 1, select: { id: true } } } });
  const formPages = appForm
    ? [`/admin/applications/${appForm.id}`, `/admin/applications/${appForm.id}?tab=summary`, `/admin/applications/${appForm.id}?sort=score`, `/api/applications/${appForm.id}/export`,
       ...(appForm.applications[0] ? [`/admin/applications/${appForm.id}/${appForm.applications[0].id}`] : [])]
    : [];
  const common = ["/dashboard", "/classrooms", c, `${c}/classwork`, `${c}/classwork/${assignment.id}`, `${c}/people`, `${c}/attendance`, "/announcements", "/certificates", "/notifications", "/profile"];
  const plan: Record<string, string[]> = {
    [(process.env.SUPERADMIN_EMAIL ?? "nizami@example.com").toLowerCase()]: [...common, `${c}/grades`, `${c}/grades/export`, `${c}/attendance/export`, `${c}/classwork/new`, `${c}/classwork/${assignment.id}/edit`, `${c}/classwork/${assignment.id}?view=work`,
      "/admin/users", `/admin/users/${anyUser.id}`, "/admin/approvals", "/admin/approvals?tab=rejected", "/admin/classrooms", `/admin/classrooms/${classroom.id}`, "/admin/seasons", "/admin/audit", "/admin/appearance", "/api/theme",
      "/admin/applications", "/admin/applications/new", ...formPages, ...(appForm ? [`/admin/applications/${appForm.id}/edit`, `/apply/${appForm.slug}?preview=1`] : [])],
    "checker@demo.az": ["/dashboard", "/announcements", "/notifications", "/profile", "/admin/applications", ...formPages],
    "mentor@demo.az": [...common, `${c}/grades`, `${c}/classwork/new`, `${c}/classwork/${assignment.id}?view=work`],
    "staff@demo.az": [...common],
    "student1@demo.az": [...common, "/todo", "/todo?tab=missing"],
  };
  // should be blocked for students
  const denied = ["/admin/users", "/admin/approvals", "/admin/appearance", "/admin/applications", "/admin/applications/new", `${c}/grades`, `${c}/classwork/new`];

  let failures = 0;
  for (const [email, paths] of Object.entries(plan)) {
    const token = await sessionFor(email);
    for (const p of paths) {
      const res = await fetch(BASE + p, { headers: { cookie: `bc_session=${token}` }, redirect: "manual" });
      const body = res.status === 200 ? await res.text() : "";
      const bad = res.status >= 400 || body.includes("Application error") || /\b(classroom|classwork|admin|common|dashboard|attendance|certificates|profile|announcements|notifications|auth|nav|applications)\.[a-zA-Z]+\.[a-zA-Z_.]+/.test(body.replace(/<script[\s\S]*?<\/script>/g, ""));
      if (bad || res.status !== 200) {
        failures++;
        const key = body.replace(/<script[\s\S]*?<\/script>/g, "").match(/\b(classroom|classwork|admin|common|dashboard|attendance|certificates|profile|announcements|notifications|auth|nav|applications)\.[a-zA-Z]+\.[a-zA-Z_.]+/)?.[0];
        console.log(`${email.padEnd(20)} ${String(res.status).padEnd(4)} ${p} ${res.headers.get("location") ?? ""} ${key ? "MISSING_KEY " + key : ""}`);
      }
    }
    if (email === "student1@demo.az") {
      for (const p of denied) {
        const res = await fetch(BASE + p, { headers: { cookie: `bc_session=${token}` }, redirect: "manual" });
        if (res.status === 200) { failures++; console.log(`STUDENT NOT BLOCKED: ${p}`); }
      }
    }
  }
  for (const p of ["/login", "/register", "/forgot-password", "/apply"]) {
    const res = await fetch(BASE + p);
    if (res.status !== 200) { failures++; console.log(`public ${res.status} ${p}`); }
  }
  console.log(`done, ${failures} issue(s)`);
}
main().finally(() => db.$disconnect());
