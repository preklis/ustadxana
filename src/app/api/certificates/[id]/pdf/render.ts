import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, degrees, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";

// standard pdf fonts cant encode az letters (ə ğ ı İ ş) so we embed noto from assets/fonts.
 // docker image has to copy assets/ next to server.js
const FONT_DIR = path.join(process.cwd(), "assets", "fonts");

let fontCache: Promise<Record<"sans" | "sansBold" | "serifBold" | "serifItalic", Uint8Array>> | null = null;
function loadFonts() {
  fontCache ??= (async () => {
    const [sans, sansBold, serifBold, serifItalic] = await Promise.all(
      ["NotoSans_400Regular.ttf", "NotoSans_700Bold.ttf", "NotoSerif_700Bold.ttf", "NotoSerif_400Regular_Italic.ttf"].map(
        async (f) => new Uint8Array(await readFile(path.join(FONT_DIR, f))),
      ),
    );
    return { sans, sansBold, serifBold, serifItalic };
  })().catch((e) => {
    fontCache = null;
    throw e;
  });
  return fontCache;
}

export type CertificatePdfTexts = {
  brand: string;
  seasonName: string;
  title: string;
  presentedTo: string;
  holderName: string;
  description: string;
  issuedLabel: string;
  issuedDate: string;
  signatureLabel: string;
  codeLabel: string;
  code: string;
  verifyUrl: string;
  revoked?: string;
  // for case mapping (az i -> İ)
  locale?: string;
};

const BRAND = rgb(0x21 / 255, 0x47 / 255, 0xee / 255);
const BRAND_DARK = rgb(0x1c / 255, 0x2c / 255, 0x8b / 255);
const GOLD = rgb(0.76, 0.6, 0.25);
const INK = rgb(0.09, 0.11, 0.16);
const MUTED = rgb(0.42, 0.45, 0.5);

function centered(page: PDFPage, text: string, font: PDFFont, size: number, y: number, color = INK, spacing = 0) {
  const width = font.widthOfTextAtSize(text, size) + spacing * Math.max(0, text.length - 1);
  const x = (page.getWidth() - width) / 2;
  if (!spacing) {
    page.drawText(text, { x, y, size, font, color });
    return;
  }
  let cx = x;
  for (const ch of text) {
    page.drawText(ch, { x: cx, y, size, font, color });
    cx += font.widthOfTextAtSize(ch, size) + spacing;
  }
}

function fitSize(text: string, font: PDFFont, size: number, maxWidth: number, min = 12) {
  let s = size;
  while (s > min && font.widthOfTextAtSize(text, s) > maxWidth) s -= 1;
  return s;
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (font.widthOfTextAtSize(next, size) > maxWidth && line) {
      lines.push(line);
      line = w;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

export async function renderCertificatePdf(t: CertificatePdfTexts): Promise<Uint8Array> {
  const fonts = await loadFonts();
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  doc.setTitle(`${t.title} — ${t.holderName}`);
  doc.setAuthor(t.brand);
  doc.setSubject(t.seasonName);
  doc.setCreator(t.brand);
  doc.setProducer(t.brand);

  const sans = await doc.embedFont(fonts.sans, { subset: false });
  const sansBold = await doc.embedFont(fonts.sansBold, { subset: false });
  const serifBold = await doc.embedFont(fonts.serifBold, { subset: false });
  const serifItalic = await doc.embedFont(fonts.serifItalic, { subset: false });

  // A4 landscape
  const page = doc.addPage([841.89, 595.28]);
  const W = page.getWidth();
  const H = page.getHeight();

  page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: rgb(1, 1, 1) });
  page.drawRectangle({ x: 0, y: H - 10, width: W, height: 10, color: BRAND });
  page.drawRectangle({ x: 0, y: 0, width: W, height: 10, color: BRAND });
  page.drawRectangle({ x: 24, y: 24, width: W - 48, height: H - 48, borderColor: BRAND_DARK, borderWidth: 1.6 });
  page.drawRectangle({ x: 32, y: 32, width: W - 64, height: H - 64, borderColor: GOLD, borderWidth: 0.6 });

  const corner = (cx: number, cy: number, dx: number, dy: number) => {
    page.drawLine({ start: { x: cx, y: cy }, end: { x: cx + 46 * dx, y: cy }, thickness: 2.4, color: GOLD });
    page.drawLine({ start: { x: cx, y: cy }, end: { x: cx, y: cy + 46 * dy }, thickness: 2.4, color: GOLD });
    page.drawCircle({ x: cx + 8 * dx, y: cy + 8 * dy, size: 2.2, color: GOLD });
  };
  corner(40, 40, 1, 1);
  corner(W - 40, 40, -1, 1);
  corner(40, H - 40, 1, -1);
  corner(W - 40, H - 40, -1, -1);

  const markSize = 34;
  const markX = W / 2 - markSize / 2;
  const markY = H - 100;
  page.drawRectangle({ x: markX, y: markY, width: markSize, height: markSize, color: BRAND });
  const bW = sansBold.widthOfTextAtSize("B", 20);
  page.drawText("B", { x: W / 2 - bW / 2, y: markY + 10, size: 20, font: sansBold, color: rgb(1, 1, 1) });

  centered(page, t.brand.toLocaleUpperCase(t.locale), sansBold, 13, H - 124, BRAND_DARK, 4);
  centered(page, t.seasonName, sans, 10.5, H - 141, MUTED, 0.5);

  const title = t.title.toLocaleUpperCase(t.locale);
  const titleSize = fitSize(title, serifBold, 30, W - 200, 18);
  centered(page, title, serifBold, titleSize, H - 196, INK, 1.5);

  const dy = H - 214;
  page.drawLine({ start: { x: W / 2 - 90, y: dy }, end: { x: W / 2 - 10, y: dy }, thickness: 0.8, color: GOLD });
  page.drawLine({ start: { x: W / 2 + 10, y: dy }, end: { x: W / 2 + 90, y: dy }, thickness: 0.8, color: GOLD });
  page.drawCircle({ x: W / 2, y: dy, size: 3, color: GOLD });

  centered(page, t.presentedTo, serifItalic, 14, H - 248, MUTED);

  const nameSize = fitSize(t.holderName, serifBold, 40, W - 180, 20);
  centered(page, t.holderName, serifBold, nameSize, H - 300, BRAND_DARK);
  page.drawLine({ start: { x: W / 2 - 220, y: H - 314 }, end: { x: W / 2 + 220, y: H - 314 }, thickness: 0.7, color: rgb(0.8, 0.82, 0.86) });

  const lines = wrap(t.description, sans, 13, W - 240).slice(0, 3);
  lines.forEach((l, i) => centered(page, l, sans, 13, H - 344 - i * 19, INK));

  // footer: date left, seal center, signature right
  const footY = 128;
  const colW = 190;
  const leftX = 110;
  const rightX = W - 110 - colW;

  const dateW = sansBold.widthOfTextAtSize(t.issuedDate, 13);
  page.drawText(t.issuedDate, { x: leftX + (colW - dateW) / 2, y: footY + 8, size: 13, font: sansBold, color: INK });
  page.drawLine({ start: { x: leftX, y: footY }, end: { x: leftX + colW, y: footY }, thickness: 0.8, color: MUTED });
  const dlW = sans.widthOfTextAtSize(t.issuedLabel, 10);
  page.drawText(t.issuedLabel, { x: leftX + (colW - dlW) / 2, y: footY - 15, size: 10, font: sans, color: MUTED });

  page.drawLine({ start: { x: rightX, y: footY }, end: { x: rightX + colW, y: footY }, thickness: 0.8, color: MUTED });
  const slW = sans.widthOfTextAtSize(t.signatureLabel, 10);
  page.drawText(t.signatureLabel, { x: rightX + (colW - slW) / 2, y: footY - 15, size: 10, font: sans, color: MUTED });

  const sealY = footY + 4;
  page.drawCircle({ x: W / 2, y: sealY, size: 38, color: GOLD, opacity: 0.12, borderColor: GOLD, borderWidth: 1.4 });
  page.drawCircle({ x: W / 2, y: sealY, size: 31, borderColor: GOLD, borderWidth: 0.6 });
  const sealText = t.brand.toLocaleUpperCase(t.locale);
  const sealSize = fitSize(sealText, sansBold, 9, 52, 6);
  centered(page, sealText, sansBold, sealSize, sealY - 3, GOLD);

  const codeLine = `${t.codeLabel}: ${t.code}`;
  centered(page, codeLine, sansBold, 9, 60, MUTED, 0.3);
  centered(page, t.verifyUrl, sans, 8.5, 47, BRAND);

  if (t.revoked) {
    const size = 72;
    const tw = sansBold.widthOfTextAtSize(t.revoked, size);
    page.drawText(t.revoked, {
      x: W / 2 - (tw / 2) * Math.cos(Math.PI / 9) + 20,
      y: H / 2 - (tw / 2) * Math.sin(Math.PI / 9),
      size,
      font: sansBold,
      color: rgb(0.85, 0.15, 0.15),
      opacity: 0.18,
      rotate: degrees(20),
    });
  }

  return doc.save();
}
