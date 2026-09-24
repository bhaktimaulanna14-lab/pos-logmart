import { NextResponse, NextRequest } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { verifyPassword } from "@/lib/auth-helper";
import { encrypt } from "@/lib/session";
import { cookies } from "next/headers";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json({ success: false, message: "Username dan password wajib diisi" }, { status: 400 });
    }

    const result = await db
      .select()
      .from(users)
      .where(eq(users.username, username))
      .limit(1);

    if (result.length === 0) {
      return NextResponse.json({ success: false, message: "Username atau password salah" }, { status: 401 });
    }

    const user = result[0];
    
    // Verify password hash
    const isValid = await verifyPassword(password, user.passwordHash || "");
    if (!isValid) {
      return NextResponse.json({ success: false, message: "Username atau password salah" }, { status: 401 });
    }

    // Terbitkan token JWT
    const sessionPayload = {
      id: user.id,
      name: user.name,
      username: user.username,
      role: user.role
    };
    const sessionToken = await encrypt(sessionPayload);

    // Pasang cookie httpOnly
    const cookieStore = await cookies();
    const isHttps = request.headers.get("x-forwarded-proto") === "https";
    cookieStore.set("pos_session", sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production" || isHttps,
      sameSite: "lax",
      maxAge: 60 * 60 * 8, // 8 hours
      path: "/",
    });

    return NextResponse.json({ 
      success: true, 
      data: sessionPayload 
    });
  } catch (error) {
    console.error("Login API error:", error);
    return NextResponse.json(
      { success: false, message: "Terjadi kesalahan pada server" },
      { status: 500 }
    );
  }
}
