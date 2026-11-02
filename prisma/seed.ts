// safe to rerun. SEED_DEMO=true also creates demo users/classrooms
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

async function main() {
  const email = (process.env.SUPERADMIN_EMAIL ?? "nizami@example.com").toLowerCase();
  const password = process.env.SUPERADMIN_PASSWORD ?? "ChangeMe123!";

  const admin = await db.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      passwordHash: await bcrypt.hash(password, 12),
      role: "SUPERADMIN",
      status: "ACTIVE",
      firstName: process.env.SUPERADMIN_FIRST_NAME ?? "Nizami",
      lastName: process.env.SUPERADMIN_LAST_NAME ?? "Taghizada",
      title: "Project Lead",
    },
  });
  console.log(`Superadmin: ${admin.email}`);

  // first run creates season 1, later runs keep whatever season is active
  const season =
    (await db.season.findFirst({ where: { isActive: true } })) ??
    (await db.season.create({
      data: {
        name: "Mövsüm 1",
        number: 1,
        description: "İlk mövsüm",
        isActive: true,
        registrationOpen: true,
        createdById: admin.id,
      },
    }));
  console.log(`Season: ${season.name}`);

  if (process.env.SEED_DEMO === "true") await demo(season.id, admin.id);
}

async function demo(seasonId: string, adminId: string) {
  const pw = await bcrypt.hash("Demo12345", 12);
  const mk = (email: string, role: "MENTOR" | "STAFF" | "STUDENT" | "ADMIN" | "APPLICANT_CHECKER", firstName: string, lastName: string) =>
    db.user.upsert({
      where: { email },
      update: {},
      create: { email, passwordHash: pw, role, status: "ACTIVE", firstName, lastName },
    });

  const mentor = await mk("mentor@demo.az", "MENTOR", "Murad", "Mentorov");
  const staff = await mk("staff@demo.az", "STAFF", "Səbinə", "Staffova");
  await mk("coordinator@demo.az", "ADMIN", "Kamran", "Koordinatorov");
  await mk("checker@demo.az", "APPLICANT_CHECKER", "Fərid", "Yoxlayıcı");
  const students = await Promise.all(
    ["Aysel", "Elvin", "Nigar", "Rauf", "Leyla"].map((n, i) => mk(`student${i + 1}@demo.az`, "STUDENT", n, "Tələbəyev")),
  );
  for (const s of students) {
    await db.studentProfile.upsert({
      where: { userId: s.id },
      update: {},
      create: { userId: s.id, phone: "+994500000000", university: "Demo Universiteti", faculty: "Kompüter elmləri", courseYear: 2, motivation: "Demo student profile for testing." },
    });
  }

  const existing = await db.classroom.findFirst({ where: { seasonId, name: "Backend with Java" } });
  const classroom =
    existing ??
    (await db.classroom.create({
      data: { seasonId, name: "Backend with Java", track: "Backend", description: "Java, Spring Boot, REST APIs", color: "blue", room: "Lab 301" },
    }));
  await db.classroomMember.createMany({
    data: [
      { classroomId: classroom.id, userId: mentor.id, role: "MENTOR" },
      { classroomId: classroom.id, userId: staff.id, role: "STAFF" },
      ...students.map((s) => ({ classroomId: classroom.id, userId: s.id, role: "STUDENT" as const })),
    ],
    skipDuplicates: true,
  });
  if (!existing) {
    await db.assignment.create({
      data: {
        classroomId: classroom.id,
        authorId: mentor.id,
        title: "Hello, Spring Boot",
        description: "Create a Spring Boot app with a /hello endpoint and push it to GitHub.",
        maxPoints: 100,
        dueAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        publishedAt: new Date(),
      },
    });
    await db.announcement.create({
      data: { classroomId: classroom.id, seasonId, authorId: mentor.id, body: "Welcome to the Backend track! Install JDK 21 and IntelliJ before day 1." },
    });
  }
  console.log("Demo data created (password for demo users: Demo12345)");
  void adminId;
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
