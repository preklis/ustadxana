import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { normalizeTheme } from "@/lib/theme/config";
import { buildPackZip } from "@/lib/theme/packs";

// ?current=1 exports the pack with the admin's customizations baked in
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.status !== "ACTIVE" || !can(user, "MANAGE_APPEARANCE")) return new NextResponse("Forbidden", { status: 403 });
  const { id } = await params;
  const pack = await db.themePack.findUnique({ where: { id } });
  if (!pack) return new NextResponse("Not found", { status: 404 });
  const current = new URL(req.url).searchParams.get("current") === "1";
  const zip = await buildPackZip(pack, current && pack.custom ? normalizeTheme(pack.custom) : undefined);
  const name = `${pack.slug}-${pack.version}${current ? "-custom" : ""}.zip`;
  return new NextResponse(new Uint8Array(zip), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "no-store",
    },
  });
}
