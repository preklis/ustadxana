// usage: npm run mail:test -- you@example.com
import nodemailer from "nodemailer";

const user = (process.env.SMTP_USER || "").trim();
const pass = (process.env.SMTP_PASSWORD || "").replace(/\s+/g, "");
const to = process.argv[2];

if (!user || !pass) {
  console.error("SMTP_USER / SMTP_PASSWORD are empty in .env");
  process.exit(1);
}
if (!to) {
  console.error("pass a recipient: npm run mail:test -- you@example.com");
  process.exit(1);
}

const port = Number(process.env.SMTP_PORT || "587");
const t = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port,
  secure: process.env.SMTP_SECURE === "true" || port === 465,
  auth: { user, pass },
});

t.verify()
  .then(() => t.sendMail({ from: `Ustadxana <${user}>`, to, subject: "Ustadxana test", text: "Email setup works." }))
  .then((info) => console.log(`sent from ${user} to ${to} (${info.messageId})`))
  .catch((e) => {
    console.error("failed:", e.message);
    if (/535|Username and Password/i.test(e.message)) console.error("-> wrong app password, or 2-step verification is off for this account");
    process.exit(1);
  });
