/* eslint-disable */
// @ts-nocheck
import { NextResponse, NextRequest } from "next/server";
import { db } from "@/db";
import { categories } from "@/db/schema";
import { eq } from "drizzle-orm";

// PUT update category
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const id = (await params).id;
    const body = await request.json();
    const { name, description } = body;

    if (!name) {
      return NextResponse.json({ success: false, message: "Nama kategori wajib diisi" }, { status: 400 });
    }

    await db
      .update(categories)
      .set({
        name,
        description: description || null,
      })
      .where(eq(categories.id, id));

    return NextResponse.json({ success: true, message: "Kategori berhasil diperbarui" });
  } catch (error) {
    console.error("PUT category API error:", error);
    return NextResponse.json(
      { success: false, message: "Gagal memperbarui kategori" },
      { status: 500 }
    );
  }
}

// DELETE category
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const id = (await params).id;

    // Ideally, check if category is used in products before deleting.
    // For this prototype, we'll just delete.
    await db.delete(categories).where(eq(categories.id, id));

    return NextResponse.json({ success: true, message: "Kategori berhasil dihapus" });
  } catch (error) {
    console.error("DELETE category API error:", error);
    return NextResponse.json(
      { success: false, message: "Gagal menghapus kategori. Mungkin sedang digunakan oleh produk." },
      { status: 500 }
    );
  }
}
