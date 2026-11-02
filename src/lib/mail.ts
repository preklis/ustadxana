import "server-only";
import nodemailer from "nodemailer";
import { env } from "./env";
import { getTheme } from "./theme/server";
import { DEFAULT_THEME, type ThemeConfig } from "./theme/config";

let transporter: nodemailer.Transporter | null = null;

function getTransporter() {
  if (!env.smtp.user || !env.smtp.password) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.smtp.host,
      port: env.smtp.port,
      secure: env.smtp.secure || env.smtp.port === 465,
      auth: { user: env.smtp.user, pass: env.smtp.password },
    });
  }
  return transporter;
}

// google rewrites the sender to the logged in account anyway, so keep them matching
function fromAddress() {
  const custom = env.smtp.from;
  if (custom && custom.toLowerCase().includes(env.smtp.user.toLowerCase())) return custom;
  return `${B.name} <${env.smtp.user}>`;
}

export async function sendMail(to: string, subject: string, text: string, html?: string) {
  await loadBrand();
  const t = getTransporter();
  if (!t) {
    // no smtp configured, just log it so dev still works
    console.log(`\n[mail] To: ${to}\n[mail] Subject: ${subject}\n${text}\n`);
    return;
  }
  await t.sendMail({ from: fromAddress(), to, subject, text, html });
}

// all emails are in azerbaijani. table layout + inline styles because email clients ignore most css

const C = {
  bg: "#080c19",
  card: "#0f1529",
  border: "#1a2240",
  text: "#ebeff8",
  muted: "#8592b3",
  body: "#b7c1da",
};

// name, color and footer come from the active theme, so the emails match the site
type Brand = { name: string; accent: string; logoText: string; tagline: string; footer: string; hashtag: string; cli: string; path: string };

function brandOf(theme: ThemeConfig): Brand {
  const id = theme.identity;
  const name = [id.siteName, id.accentWord].filter(Boolean).join(" ");
  const cli = id.siteName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "app";
  return {
    name,
    accent: theme.colors.accent,
    logoText: id.logoText,
    tagline: id.tagline,
    footer: [name, id.orgName].filter(Boolean).join(" · "),
    hashtag: id.hashtag,
    cli: `./${cli}`,
    path: theme.login.terminalPath || `~/${cli}`,
  };
}

let B: Brand = brandOf(DEFAULT_THEME);

async function loadBrand() {
  try {
    B = brandOf(await getTheme());
  } catch {
    // keep the last known brand
  }
}
const SANS = "'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const MONO = "'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace";

function esc(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function button(href: string, label: string) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0 8px"><tr><td style="border-radius:10px;background:${B.accent}">
<a href="${href}" style="display:inline-block;padding:13px 26px;font-family:${SANS};font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:10px">${label}</a>
</td></tr></table>`;
}

function p(html: string) {
  return `<p style="margin:0 0 14px;font-family:${SANS};font-size:15px;line-height:1.6;color:${C.body}">${html}</p>`;
}

function layout(opts: { preheader: string; command: string; title: string; content: string }) {
  return `<!doctype html>
<html lang="az"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark light"><title>${esc(opts.title)}</title></head>
<body style="margin:0;padding:0;background:${C.bg}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(opts.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.bg}">
<tr><td align="center" style="padding:32px 16px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px">

    <tr><td style="padding:0 4px 20px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
        <td style="vertical-align:middle">
          <span style="display:inline-block;width:34px;height:34px;line-height:34px;text-align:center;border-radius:9px;background:${B.accent};font-family:${MONO};font-size:13px;font-weight:700;color:#ffffff;vertical-align:middle">${esc(B.logoText)}</span>
          <span style="font-family:${SANS};font-size:17px;font-weight:800;letter-spacing:-0.3px;color:${C.text};vertical-align:middle;padding-left:10px">${esc(B.name.toUpperCase())}</span>
        </td>
        <td align="right" style="font-family:${MONO};font-size:11px;color:${C.muted};vertical-align:middle">${esc(B.tagline)}</td>
      </tr></table>
    </td></tr>

    <tr><td style="background:${C.card};border:1px solid ${C.border};border-radius:16px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr><td style="padding:12px 18px;border-bottom:1px solid ${C.border};font-family:${MONO};font-size:12px;color:${C.muted}">
          <span style="color:#ff5f57">&#9679;</span> <span style="color:#febc2e">&#9679;</span> <span style="color:#28c840">&#9679;</span>
          <span style="padding-left:8px">${esc(B.path)}</span>
        </td></tr>
        <tr><td style="padding:28px 28px 30px">
          <p style="margin:0 0 10px;font-family:${MONO};font-size:13px;color:${C.muted}"><span style="color:${B.accent}">&gt;</span> ${esc(opts.command)}</p>
          <h1 style="margin:0 0 16px;font-family:${SANS};font-size:22px;line-height:1.3;font-weight:800;letter-spacing:-0.4px;color:${C.text}">${esc(opts.title)}</h1>
          ${opts.content}
        </td></tr>
      </table>
    </td></tr>

    <tr><td style="padding:20px 4px 0">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
        <td style="font-family:${SANS};font-size:12px;line-height:1.6;color:${C.muted}">${esc(B.footer)}<br>Bu e-poçt avtomatik göndərilib, cavab yazmayın.</td>
        <td align="right" style="font-family:${MONO};font-size:12px;color:${C.muted};vertical-align:top">${esc(B.hashtag)}</td>
      </tr></table>
    </td></tr>

  </table>
</td></tr>
</table>
</body></html>`;
}

function codeBoxes(code: string) {
  const cells = code
    .split("")
    .map(
      (d) =>
        `<td style="padding:0 4px"><div style="width:44px;height:54px;line-height:54px;text-align:center;border-radius:10px;background:${C.bg};border:1px solid #2e3856;font-family:${MONO};font-size:26px;font-weight:700;color:#ffffff">${d}</div></td>`,
    )
    .join("");
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0 22px -4px"><tr>${cells}</tr></table>`;
}

export async function sendOtpEmail(to: string, code: string, purpose: "register" | "reset", _locale?: string) {
  await loadBrand();
  const register = purpose === "register";
  const title = register ? "E-poçt ünvanınızı təsdiqləyin" : "Şifrənizi bərpa edin";
  const intro = register
    ? `${B.name} qeydiyyatını tamamlamaq üçün aşağıdakı kodu daxil edin.`
    : "Şifrənizi yeniləmək üçün aşağıdakı kodu daxil edin.";
  const subject = register ? `${code} · ${B.name} təsdiq kodu` : `${code} · ${B.name} şifrə bərpası`;

  const html = layout({
    preheader: `Kodunuz: ${code}. 10 dəqiqə etibarlıdır.`,
    command: register ? `${B.cli} register --verify` : `${B.cli} password --reset`,
    title,
    content:
      p(intro) +
      codeBoxes(code) +
      p(`Kod <strong style="color:${C.text}">10 dəqiqə</strong> ərzində etibarlıdır. Onu heç kimlə paylaşmayın, komandamız sizdən heç vaxt kod istəməyəcək.`) +
      `<p style="margin:18px 0 0;padding-top:16px;border-top:1px solid ${C.border};font-family:${SANS};font-size:13px;line-height:1.6;color:${C.muted}">Bu sorğunu siz göndərməmisinizsə, bu e-poçtu sadəcə nəzərə almayın.</p>`,
  });
  const text = `${title}\n\n${intro}\n\nKod: ${code}\n\nKod 10 dəqiqə ərzində etibarlıdır. Onu heç kimlə paylaşmayın.\nBu sorğunu siz göndərməmisinizsə, bu e-poçtu nəzərə almayın.\n\n${B.footer}`;
  await sendMail(to, subject, text, html);
}

export async function sendWelcomeEmail(to: string, tempPassword: string, _locale?: string, kind: "created" | "reset" = "created") {
  await loadBrand();
  const created = kind === "created";
  const title = created ? `${B.name} hesabınız hazırdır` : "Şifrəniz sıfırlandı";
  const subject = created ? `${B.name} hesabınız yaradıldı` : `${B.name} · yeni müvəqqəti şifrə`;
  const loginUrl = `${env.appUrl}/login`;
  const row = (k: string, v: string) =>
    `<tr><td style="padding:6px 0;font-family:${SANS};font-size:13px;color:${C.muted};width:140px">${k}</td><td style="padding:6px 0;font-family:${MONO};font-size:14px;color:${C.text}">${v}</td></tr>`;

  const html = layout({
    preheader: created ? "Hesabınız yaradıldı, giriş məlumatlarınız içəridədir." : "Yeni müvəqqəti şifrəniz içəridədir.",
    command: created ? `${B.cli} account --create` : `${B.cli} password --reset`,
    title,
    content:
      p(created ? `Sizin üçün ${B.name} platformasında hesab yaradıldı. Giriş məlumatlarınız:` : "Hesabınızın şifrəsi idarəçi tərəfindən sıfırlandı. Yeni giriş məlumatlarınız:") +
      `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:8px 0 6px;padding:14px 16px;background:${C.bg};border:1px solid ${C.border};border-radius:12px">
        ${row("E-poçt", esc(to))}${row("Müvəqqəti şifrə", esc(tempPassword))}
      </table>` +
      button(loginUrl, "Platformaya daxil ol") +
      p(`İlk girişdən sonra sizdən <strong style="color:${C.text}">yeni şifrə</strong> təyin etmək istəniləcək.`),
  });
  const text = `${title}\n\nGiriş: ${loginUrl}\nE-poçt: ${to}\nMüvəqqəti şifrə: ${tempPassword}\n\nİlk girişdən sonra yeni şifrə təyin etməlisiniz.\n\n${B.footer}`;
  await sendMail(to, subject, text, html);
}

export async function sendStatusEmail(to: string, approved: boolean, _locale?: string, reason?: string | null) {
  await loadBrand();
  const loginUrl = `${env.appUrl}/login`;
  if (approved) {
    const title = "Təbriklər, müraciətiniz təsdiqləndi!";
    const html = layout({
      preheader: `${B.name} hesabınız aktivləşdirildi.`,
      command: `${B.cli} status --approved`,
      title,
      content:
        p(`Platformaya xoş gəlmisiniz! Hesabınız aktivləşdirildi. Artıq platformaya daxil olub siniflərinizi, tapşırıqlarınızı və elanları görə bilərsiniz.`) +
        button(loginUrl, "Platformaya daxil ol") +
        p("Uğurlar və məhsuldar düşərgə arzulayırıq!"),
    });
    await sendMail(to, `${B.name} · müraciətiniz təsdiqləndi`, `${title}\n\nHesabınız aktivləşdirildi. Daxil olun: ${loginUrl}\n\n${B.footer}`, html);
    return;
  }
  const title = "Müraciətiniz haqqında";
  const html = layout({
    preheader: `${B.name} müraciətinizin nəticəsi.`,
    command: `${B.cli} status`,
    title,
    content:
      p(`${B.name} proqramına göstərdiyiniz maraq üçün təşəkkür edirik. Təəssüf ki, bu dəfə müraciətiniz təsdiqlənmədi.`) +
      (reason
        ? `<div style="margin:16px 0;padding:14px 16px;background:${C.bg};border:1px solid ${C.border};border-left:3px solid ${B.accent};border-radius:10px;font-family:${SANS};font-size:14px;line-height:1.6;color:${C.body};white-space:pre-wrap">${esc(reason)}</div>`
        : "") +
      p("Profilinizi yeniləyib yenidən müraciət edə bilərsiniz.") +
      button(loginUrl, "Profilə keç"),
  });
  await sendMail(to, `${B.name} · müraciətiniz haqqında`, `${title}\n\nTəəssüf ki, müraciətiniz təsdiqlənmədi.${reason ? `\n\n${reason}` : ""}\n\nProfilinizi yeniləyib yenidən müraciət edə bilərsiniz: ${loginUrl}`, html);
}

/* ---------- applications ---------- */

export async function sendApplyCodeEmail(to: string, code: string, formTitle: string) {
  await loadBrand();
  const title = "Müraciət üçün e-poçtunuzu təsdiqləyin";
  const intro = `«${esc(formTitle)}» müraciətini davam etdirmək üçün aşağıdakı kodu daxil edin.`;
  const html = layout({
    preheader: `Kodunuz: ${code}. 10 dəqiqə etibarlıdır.`,
    command: `${B.cli} apply --verify`,
    title,
    content:
      p(intro) +
      codeBoxes(code) +
      p(`Kod <strong style="color:${C.text}">10 dəqiqə</strong> ərzində etibarlıdır. Onu heç kimlə paylaşmayın.`) +
      `<p style="margin:18px 0 0;padding-top:16px;border-top:1px solid ${C.border};font-family:${SANS};font-size:13px;line-height:1.6;color:${C.muted}">Müraciət etməmisinizsə, bu e-poçtu sadəcə nəzərə almayın.</p>`,
  });
  const text = `${title}\n\n«${formTitle}» müraciəti üçün kod: ${code}\n\nKod 10 dəqiqə ərzində etibarlıdır.\n\n${B.footer}`;
  await sendMail(to, `${code} · müraciət təsdiq kodu`, text, html);
}

export async function sendApplicationReceivedEmail(to: string, formTitle: string, link: string, canEdit: boolean) {
  await loadBrand();
  const title = "Müraciətiniz qəbul edildi";
  const html = layout({
    preheader: `«${formTitle}» müraciətiniz bizə çatdı.`,
    command: `${B.cli} apply --submit`,
    title,
    content:
      p(`«${esc(formTitle)}» üçün müraciətiniz bizə çatdı. Təşəkkür edirik!`) +
      p("Komandamız müraciətləri nəzərdən keçirəndən sonra nəticə barədə bu ünvana e-poçt göndərəcəyik.") +
      (canEdit ? p("Müraciətlər bağlanana qədər cavablarınızı dəyişə bilərsiniz:") + button(link, "Müraciətimə bax") : ""),
  });
  const text = `${title}\n\n«${formTitle}» üçün müraciətiniz bizə çatdı. Nəticə barədə sizə e-poçt göndərəcəyik.${canEdit ? `\n\nCavablarınızı dəyişmək üçün: ${link}` : ""}\n\n${B.footer}`;
  await sendMail(to, `${formTitle} · müraciətiniz qəbul edildi`, text, html);
}

export async function sendDecisionEmail(
  to: string,
  opts: { status: "ACCEPTED" | "WAITLISTED" | "REJECTED"; kind: "STUDENT" | "TEAM"; formTitle: string; name: string },
) {
  await loadBrand();
  const hello = opts.name ? `Salam, ${esc(opts.name)}!` : "Salam!";
  const registerUrl = `${env.appUrl}/register`;
  let title: string;
  let subject: string;
  let content: string;
  let text: string;
  if (opts.status === "ACCEPTED") {
    title = "Təbriklər, qəbul olundunuz!";
    subject = `${opts.formTitle} · qəbul olundunuz`;
    if (opts.kind === "STUDENT") {
      content =
        p(hello) +
        p(`«${esc(opts.formTitle)}» üçün müraciətiniz <strong style="color:${C.text}">qəbul olundu</strong>. Sizi aramızda görməyə şadıq!`) +
        p("Növbəti addım: müraciət etdiyiniz bu e-poçtla platformada qeydiyyatdan keçin. Hesabınız avtomatik təsdiqlənəcək.") +
        button(registerUrl, "Qeydiyyatdan keç");
      text = `${title}\n\n«${opts.formTitle}» üçün müraciətiniz qəbul olundu.\nBu e-poçtla qeydiyyatdan keçin: ${registerUrl}`;
    } else {
      content =
        p(hello) +
        p(`«${esc(opts.formTitle)}» üçün müraciətiniz <strong style="color:${C.text}">qəbul olundu</strong>. Komandaya xoş gəlmisiniz!`) +
        p("Tezliklə növbəti addımlar və hesabınız barədə sizinlə əlaqə saxlayacağıq.");
      text = `${title}\n\n«${opts.formTitle}» üçün müraciətiniz qəbul olundu. Tezliklə sizinlə əlaqə saxlayacağıq.`;
    }
  } else if (opts.status === "WAITLISTED") {
    title = "Gözləmə siyahısındasınız";
    subject = `${opts.formTitle} · müraciətinizin nəticəsi`;
    content =
      p(hello) +
      p(`«${esc(opts.formTitle)}» üçün müraciətiniz bəyənildi, lakin yerlər məhduddur. Sizi <strong style="color:${C.text}">gözləmə siyahısına</strong> əlavə etdik.`) +
      p("Yer açılan kimi bu ünvana yazacağıq.");
    text = `${title}\n\n«${opts.formTitle}» üçün sizi gözləmə siyahısına əlavə etdik. Yer açılan kimi yazacağıq.`;
  } else {
    title = "Müraciətiniz haqqında";
    subject = `${opts.formTitle} · müraciətinizin nəticəsi`;
    content =
      p(hello) +
      p(`«${esc(opts.formTitle)}» üçün göstərdiyiniz maraq üçün təşəkkür edirik. Təəssüf ki, bu dəfə sizi seçə bilmədik.`) +
      p("Müraciətlərin sayı çox idi və qərar asan olmadı. Növbəti mövsümdə yenidən müraciət etməyinizi gözləyirik!");
    text = `${title}\n\n«${opts.formTitle}» üçün təəssüf ki, bu dəfə sizi seçə bilmədik. Növbəti mövsümdə yenidən müraciət edin!`;
  }
  const html = layout({ preheader: title, command: `${B.cli} apply --status`, title, content });
  await sendMail(to, subject, `${text}\n\n${B.footer}`, html);
}
