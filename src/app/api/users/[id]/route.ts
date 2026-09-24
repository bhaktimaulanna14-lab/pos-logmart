/* eslint-disable */
// @ts-nocheck
import { NextResponse, NextRequest } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const id = (await params).id;

    // Ideally soft-delete, or hard-delete if no transactions
    await db.delete(users).where(eq(users.id, id));

    return NextResponse.json({ success: true, message: "Pengguna berhasil dihapus" });
  } catch (error) {
    console.error("DELETE user API error:", error);
    return NextResponse.json(
      { success: false, message: "Gagal menghapus pengguna. Mungkin terkait transaksi." },
      { status: 500 }
    );
  }
}
