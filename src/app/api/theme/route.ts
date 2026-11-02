import { NextResponse } from "next/server";
import { getThemeRecord } from "@/lib/theme/server";

export const dynamic = "force-dynamic";

// open tabs poll this and refresh when an admin saves a new theme
export async function GET() {
  const { version } = await getThemeRecord();
  return NextResponse.json({ version }, { headers: { "Cache-Control": "no-store" } });
}
