import { NextResponse, NextRequest } from "next/server";
import { db } from "@/db";
import { categories, products } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { requireSession, ApiError, errorResponse } from "@/lib/api-auth";

type Params = { params: Promise<{ id: string }> };

// PUT update category
export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const auth = await requireSession("manajer");
    if (auth.error) return auth.error;

    const id = (await params).id;
    const { name, description } = await request.json();

    if (!String(name || "").trim()) throw new ApiError(400, "Nama kategori wajib diisi");

    const result = db
      .update(categories)
      .set({ name: String(name).trim(), description: description || null })
      .where(eq(categories.id, id))
      .run();
    if (result.changes === 0) throw new ApiError(404, "Kategori tidak ditemukan");

    return NextResponse.json({ success: true, message: "Kategori berhasil diperbarui" });
  } catch (error) {
    return errorResponse(error, "Gagal memperbarui kategori", "PUT category API error:");
  }
}

// DELETE category (ditolak bila masih dipakai barang)
export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const auth = await requireSession("manajer");
    if (auth.error) return auth.error;

    const id = (await params).id;

    const used = db
      .select({ n: sql<number>`count(*)` })
      .from(products)
      .where(eq(products.categoryId, id))
      .get();
    if (Number(used?.n ?? 0) > 0) {
      throw new ApiError(409, `Kategori masih dipakai oleh ${used?.n} barang. Pindahkan barangnya dulu.`);
    }

    const result = db.delete(categories).where(eq(categories.id, id)).run();
    if (result.changes === 0) throw new ApiError(404, "Kategori tidak ditemukan");

    return NextResponse.json({ success: true, message: "Kategori berhasil dihapus" });
  } catch (error) {
    return errorResponse(error, "Gagal menghapus kategori", "DELETE category API error:");
  }
}
