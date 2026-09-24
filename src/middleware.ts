import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { decrypt } from "@/lib/session";

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Lewati resource statis dan api login
  if (path.startsWith("/_next") || path.startsWith("/api/auth/login") || path === "/login") {
    return NextResponse.next();
  }

  const cookie = request.cookies.get("pos_session")?.value;
  const session = cookie ? await decrypt(cookie) : null;

  // Jika bukan halaman login dan tidak punya sesi valid, redirect ke login
  if (!session) {
    if (path.startsWith("/api/")) {
      return NextResponse.json({ success: false, message: "Akses ditolak. Sesi tidak valid." }, { status: 401 });
    }
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    return NextResponse.redirect(loginUrl);
  }

  // Proteksi role (manajer saja)
  const isManagerRoute = 
    path.startsWith("/users") || 
    path.startsWith("/reports") || 
    path.startsWith("/purchase-orders") ||
    path.startsWith("/api/users") || 
    path.startsWith("/api/reports") || 
    path.startsWith("/api/purchase-orders");

  if (isManagerRoute && session.role !== "manajer") {
    if (path.startsWith("/api/")) {
      return NextResponse.json({ success: false, message: "Akses ditolak. Memerlukan peran manajer." }, { status: 403 });
    }
    const homeUrl = request.nextUrl.clone();
    homeUrl.pathname = "/";
    return NextResponse.redirect(homeUrl);
  }

  // teruskan request dengan set header user (optional)
  const response = NextResponse.next();
  response.headers.set("x-user-role", session.role);
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
