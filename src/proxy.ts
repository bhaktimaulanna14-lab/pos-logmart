import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { decrypt } from "@/lib/session";

export async function proxy(request: NextRequest) {
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

  // Proteksi role (manajer saja). Route handler juga mengecek sendiri lewat requireSession().
  const managerPrefixes = [
    "/users", "/reports", "/purchase-orders", "/products", "/returns", "/import", "/promotions",
    "/api/users", "/api/reports", "/api/purchase-orders", "/api/returns", "/api/import", "/api/promotions",
  ];
  const matchesPrefix = (prefix: string) => path === prefix || path.startsWith(prefix + "/");
  // Kasir tetap boleh MEMBACA barang & kategori (dipakai menu Kasir), tapi tidak boleh mengubahnya.
  const isCatalogWrite =
    (matchesPrefix("/api/products") || matchesPrefix("/api/categories")) && request.method !== "GET";
  const isManagerRoute = managerPrefixes.some(matchesPrefix) || isCatalogWrite;

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
