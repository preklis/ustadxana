import { NextResponse, type NextRequest } from "next/server";

// just checks the cookie exists, real validation happens server side
const PUBLIC = ["/login", "/register", "/forgot-password", "/verify", "/apply", "/api/theme", "/api/theme-assets"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isPublic = pathname === "/" || PUBLIC.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const hasSession = req.cookies.has("bc_session");
  if (!isPublic && !hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = pathname !== "/dashboard" ? `?next=${encodeURIComponent(pathname)}` : "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|svg|ico|webp)$).*)"],
};
