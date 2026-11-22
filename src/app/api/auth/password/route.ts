import { NextResponse, NextRequest } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { hashPassword, verifyPassword } from "@/lib/auth-helper";
import { requireSession, ApiError, errorResponse } from "@/lib/api-auth";
import { MIN_PASSWORD_LENGTH } from "@/lib/user-validation";

// Ganti password sendiri (semua peran). Wajib memasukkan password lama.
export async function PUT(request: NextRequest) {
  try {
    const auth = await requireSession();
    if (auth.error) return auth.error;
    const { session } = auth;

    const { currentPassword, newPassword } = await request.json();
    if (!currentPassword || !newPassword) throw new ApiError(400, "Password lama dan password baru wajib diisi");
    if (String(newPassword).length < MIN_PASSWORD_LENGTH) {
      throw new ApiError(400, `Password baru minimal ${MIN_PASSWORD_LENGTH} karakter`);
    }
    if (currentPassword === newPassword) throw new ApiError(400, "Password baru harus berbeda dari password lama");

    const user = await db.select().from(users).where(eq(users.id, session.id)).get();
    if (!user || !user.isActive) throw new ApiError(401, "Akun tidak ditemukan atau nonaktif");

    const ok = await verifyPassword(String(currentPassword), user.passwordHash);
    if (!ok) throw new ApiError(400, "Password lama salah");

    await db.update(users).set({ passwordHash: await hashPassword(String(newPassword)) }).where(eq(users.id, session.id));
    return NextResponse.json({ success: true, message: "Password berhasil diganti" });
  } catch (error) {
    return errorResponse(error, "Gagal mengganti password", "Change password API error:");
  }
}
