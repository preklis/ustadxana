import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { getCurrentUser } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { getI18n } from "@/i18n/server";
import { renderCertificatePdf } from "./render";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user || user.status !== "ACTIVE") return new NextResponse("Unauthorized", { status: 401 });

  const cert = await db.certificate.findUnique({ where: { id }, include: { season: { select: { name: true } } } });
  if (!cert) return new NextResponse("Not found", { status: 404 });
  const manager = can(user, "MANAGE_CERTIFICATES");
  const holder = cert.holderId === user.id;
  // revoked: holders lose access, managers still get the watermarked pdf
  if (!manager && !(holder && !cert.revokedAt)) return new NextResponse("Not found", { status: 404 });

  const { t, locale } = await getI18n();
  const tag = locale === "az" ? "az-Latn-AZ" : "en-GB";
  const issuedDate = new Intl.DateTimeFormat(tag, { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Baku" }).format(cert.issuedAt);
  const description = cert.trackName
    ? t(`certificates.pdf.description.${cert.type}`, { track: cert.trackName, season: cert.season.name })
    : t(`certificates.pdf.descriptionNoTrack.${cert.type}`, { season: cert.season.name });

  let bytes: Uint8Array;
  try {
    bytes = await renderCertificatePdf({
      brand: t("common.appName"),
      seasonName: cert.season.name,
      title: t(`certificates.titles.${cert.type}`),
      presentedTo: t("certificates.pdf.presentedTo"),
      holderName: cert.holderName,
      description,
      issuedLabel: t("certificates.pdf.issued"),
      issuedDate,
      signatureLabel: t("certificates.pdf.signature"),
      codeLabel: t("certificates.pdf.code"),
      code: cert.code,
      verifyUrl: `${env.appUrl}/verify/${cert.code}`,
      revoked: cert.revokedAt ? t("certificates.pdf.revoked") : undefined,
      locale: tag,
    });
  } catch (e) {
    console.error("[certificate pdf] render failed", e);
    return new NextResponse("PDF generation failed", { status: 500 });
  }

  const base = `${t("common.appName")}-${cert.holderName}-${t(`certificates.types.${cert.type}`)}`.replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "");
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(bytes.byteLength),
      "Content-Disposition": `inline; filename="certificate-${cert.code}.pdf"; filename*=UTF-8''${encodeURIComponent(base)}.pdf`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
