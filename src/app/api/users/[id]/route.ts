import { NextResponse, NextRequest } from "next/server";
import { db } from "@/db";
import { users, shifts } from "@/db/schema";
import { and, eq, ne, sql } from "drizzle-orm";
import { hashPassword } from "@/lib/auth-helper";
import { requireSession, ApiError, errorResponse } from "@/lib/api-auth";
import { validateUserInput } from "@/lib/user-validation";

type Params = { params: Promise<{ id: string }> };

/** Jumlah manajer aktif selain user `excludeId`. */
function otherActiveManagers(excludeId: string): number {
  const row = db
    .select({ n: sql<number>`count(*)` })
    .from(users)
    .where(and(eq(users.role, "manajer"), eq(users.isActive, true), ne(users.id, excludeId)))
    .get();
  return Number(row?.n ?? 0);
}

// Edit pengguna: nama, username, peran, status aktif, dan/atau reset password.
export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const auth = await requireSession("manajer");
    if (auth.error) return auth.error;
    const { session } = auth;

    const id = (await params).id;
    const input = validateUserInput(await request.json());

    const target = await db.select().from(users).where(eq(users.id, id)).get();
    if (!target) throw new ApiError(404, "Pengguna tidak ditemukan");

    const isSelf = id === session.id;
    if (isSelf && input.isActive === false) throw new ApiError(400, "Anda tidak bisa menonaktifkan akun Anda sendiri");
    if (isSelf && input.role && input.role !== "manajer") throw new ApiError(400, "Anda tidak bisa menurunkan peran akun Anda sendiri");

    const losesManager =
      target.role === "manajer" && target.isActive &&
      ((input.role && input.role !== "manajer") || input.isActive === false);
    if (losesManager && otherActiveManagers(id) === 0) {
      throw new ApiError(400, "Harus selalu ada minimal satu manajer aktif");
    }

    if (input.username && input.username !== target.username) {
      const taken = await db.select({ id: users.id }).from(users).where(and(eq(users.username, input.username), ne(users.id, id))).get();
      if (taken) throw new ApiError(409, `Username "${input.username}" sudah dipakai`);
    }

    // Kasir yang dinonaktifkan tidak boleh punya shift yang masih terbuka.
    if (input.isActive === false) {
      const open = await db.select({ id: shifts.id }).from(shifts).where(and(eq(shifts.userId, id), eq(shifts.status, "buka"))).get();
      if (open) throw new ApiError(400, "Pengguna ini masih punya shift terbuka. Tutup shift-nya dulu.");
    }

    const update: Partial<typeof users.$inferInsert> = {};
    if (input.name) update.name = input.name;
    if (input.username) update.username = input.username;
    if (input.role) update.role = input.role;
    if (input.isActive !== undefined) update.isActive = input.isActive;
    if (input.password) update.passwordHash = await hashPassword(input.password);

    if (Object.keys(update).length === 0) throw new ApiError(400, "Tidak ada perubahan");

    await db.update(users).set(update).where(eq(users.id, id));

    return NextResponse.json({ success: true, message: "Pengguna berhasil diperbarui" });
  } catch (error) {
    return errorResponse(error, "Gagal memperbarui pengguna", "PUT user API error:");
  }
}

// "Hapus" = nonaktifkan, agar riwayat transaksi & shift pengguna tetap utuh.
export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const auth = await requireSession("manajer");
    if (auth.error) return auth.error;
    const { session } = auth;

    const id = (await params).id;
    if (id === session.id) throw new ApiError(400, "Anda tidak bisa menonaktifkan akun Anda sendiri");

    const target = await db.select().from(users).where(eq(users.id, id)).get();
    if (!target) throw new ApiError(404, "Pengguna tidak ditemukan");
    if (target.role === "manajer" && target.isActive && otherActiveManagers(id) === 0) {
      throw new ApiError(400, "Harus selalu ada minimal satu manajer aktif");
    }
    const open = await db.select({ id: shifts.id }).from(shifts).where(and(eq(shifts.userId, id), eq(shifts.status, "buka"))).get();
    if (open) throw new ApiError(400, "Pengguna ini masih punya shift terbuka. Tutup shift-nya dulu.");

    await db.update(users).set({ isActive: false }).where(eq(users.id, id));
    return NextResponse.json({ success: true, message: "Pengguna dinonaktifkan" });
  } catch (error) {
    return errorResponse(error, "Gagal menonaktifkan pengguna", "DELETE user API error:");
  }
}
