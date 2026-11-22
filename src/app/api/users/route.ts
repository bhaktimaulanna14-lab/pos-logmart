import { NextResponse, NextRequest } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { hashPassword } from "@/lib/auth-helper";
import { requireSession, ApiError, errorResponse } from "@/lib/api-auth";
import { validateUserInput } from "@/lib/user-validation";

// Daftar pengguna (tanpa hash password).
export async function GET() {
  try {
    const auth = await requireSession("manajer");
    if (auth.error) return auth.error;

    const results = await db
      .select({
        id: users.id,
        name: users.name,
        username: users.username,
        role: users.role,
        isActive: users.isActive,
        createdAt: users.createdAt,
      })
      .from(users)
      .orderBy(users.name);

    return NextResponse.json({ success: true, data: results });
  } catch (error) {
    return errorResponse(error, "Gagal mengambil daftar pengguna", "GET users API error:");
  }
}

// Tambah pengguna baru.
export async function POST(request: NextRequest) {
  try {
    const auth = await requireSession("manajer");
    if (auth.error) return auth.error;

    const body = await request.json();
    const input = validateUserInput(body, { requirePassword: true });

    const existing = await db.select({ id: users.id }).from(users).where(eq(users.username, input.username!)).get();
    if (existing) throw new ApiError(409, `Username "${input.username}" sudah dipakai`);

    const newUser = {
      id: "user-" + randomUUID().substring(0, 8),
      name: input.name!,
      username: input.username!,
      passwordHash: await hashPassword(input.password!),
      role: input.role!,
      isActive: true,
    };
    await db.insert(users).values(newUser);

    return NextResponse.json({
      success: true,
      data: { id: newUser.id, name: newUser.name, username: newUser.username, role: newUser.role, isActive: true },
    });
  } catch (error) {
    return errorResponse(error, "Gagal membuat pengguna", "POST user API error:");
  }
}
