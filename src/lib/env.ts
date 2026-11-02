export const env = {
  appUrl: process.env.APP_URL ?? "http://localhost:3000",
  cookieSecure: process.env.COOKIE_SECURE === "true",
  uploadDir: process.env.UPLOAD_DIR ?? "./uploads",
  maxUploadBytes: Number(process.env.MAX_UPLOAD_MB ?? "50") * 1024 * 1024,
  // only SMTP_USER + SMTP_PASSWORD are required, the rest defaults to google (gmail / workspace)
  smtp: {
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT || "587"),
    user: (process.env.SMTP_USER || "").trim(),
    password: (process.env.SMTP_PASSWORD || "").replace(/\s+/g, ""),
    secure: process.env.SMTP_SECURE === "true",
    from: process.env.MAIL_FROM || "",
  },
  allowedEmailDomains: (process.env.ALLOWED_EMAIL_DOMAINS ?? "")
    .split(",")
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean),
};
