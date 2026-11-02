# Ustadxana

Self-hosted platform for running training camps: application forms, admissions, classrooms, assignments, grading, attendance and certificates, season after season. It started as a replacement for Google Classroom + Google Forms at a university IT camp.

Everyone uses the same site. What you see depends on your role:

- **Students** register with their email, fill in their profile and wait for approval. After that: classrooms, assignments, grades, attendance, certificates.
- **Mentors** run their classrooms (posts, assignments, grading, attendance).
- **Staff** only see the classrooms they're assigned to, plus whatever extra permissions they're given.
- **Applicant checkers** score applications.
- **Project lead** (superadmin) manages accounts, permissions, approvals, seasons and certificates.

The interface is in Azerbaijani and English.

## Running locally

Needs Node 20+ and Docker.

```bash
cp .env.example .env
docker compose up -d db
npm install
npx prisma migrate dev
npm run db:seed
npm run dev
```

Log in with `SUPERADMIN_EMAIL` / `SUPERADMIN_PASSWORD` from `.env`.

For test data run `SEED_DEMO=true npm run db:seed`. It creates mentor@demo.az, staff@demo.az, coordinator@demo.az, checker@demo.az (applicant checker) and student1-5@demo.az, all with password `Demo12345`.

Until SMTP is set up, verification codes and welcome emails are printed to the server console.

## Deploying

```bash
docker compose --profile prod up -d --build
```

Before that, set these in `.env`:

- `POSTGRES_PASSWORD`
- `APP_URL`
- `COOKIE_SECURE=true` if served over https
- the superadmin credentials

The container runs the migrations and creates the superadmin on startup.

Put nginx (or caddy) in front of port 3000 and allow bigger uploads (`client_max_body_size 60m;`).

Backups:

- database: `docker compose exec db pg_dump -U ustadxana ustadxana > backup.sql`
- uploaded files: the `uploads` volume

## Email

Fill in the `SMTP_*` variables and `MAIL_FROM` in `.env` and restart the app. `ALLOWED_EMAIL_DOMAINS` can limit student sign-ups to certain domains, e.g. `students.example.edu`.

## Applications

This replaces the Google Form. Under Administration → Applications, people with "Manage application forms" build a form
(short/long text, choices, checkboxes, dropdown, scale, number, phone, link, date, section titles). Questions can be
linked to profile fields. A form stays closed until the **project lead** opens it. Then a banner appears on top of the
sign-in pages (and inside the app for students) and anyone can apply at `/apply` after confirming their email with a code.

Applicant checkers (role `APPLICANT_CHECKER`, or anyone with "Review applications") score each applicant 1–10 with
notes. Other reviewers' scores stay hidden until you've scored. Statuses: new, shortlisted, waitlist, accepted,
rejected. "Email decisions" sends the results. Accepted student applicants can register with the same email even when
registration is closed. Their profile is prefilled from the answers and they're approved automatically. Responses
export to CSV.

## Themes

The look is controlled by theme packs (zip: theme.json + style.css + html slots + assets), installed and switched
under Administration → Appearance. Three come built in. Name, logo, colors and texts (including the emails) follow the active theme, so you can brand it for your own camp without touching the code. Format and css hooks: [THEMES.md](THEMES.md),
example pack in `themes/example-no-terminal`.

## Season checklist

1. Create or activate the season. Either open registration, or build an application form and have the project lead open it.
2. Create classrooms and add mentors and staff.
3. Approve students and put them in classrooms.
4. Run the camp.
5. Issue certificates.
6. Close registration.
