import { NextResponse, NextRequest } from "next/server";
import { db } from "@/db";
import { products, categories, stockMovements } from "@/db/schema";
import { and, eq, ne } from "drizzle-orm";
import { randomUUID } from "crypto";
import { consumeBatches } from "@/lib/batches";
import { requireSession, toInt, ApiError, errorResponse } from "@/lib/api-auth";

type Params = { params: Promise<{ id: string }> };

// PUT update product. Perubahan stok dicatat sebagai pergerakan stok "penyesuaian".
export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const auth = await requireSession("manajer");
    if (auth.error) return auth.error;
    const { session } = auth;

    const id = (await params).id;
    const body = await request.json();

    const updateData: Partial<typeof products.$inferInsert> = {};

    if (body.barcode !== undefined) {
      const barcode = String(body.barcode).trim();
      if (!barcode) throw new ApiError(400, "Barcode tidak boleh kosong");
      const duplicate = await db
        .select({ id: products.id })
        .from(products)
        .where(and(eq(products.barcode, barcode), ne(products.id, id)))
        .get();
      if (duplicate) throw new ApiError(409, `Barcode "${barcode}" sudah dipakai barang lain`);
      updateData.barcode = barcode;
    }
    if (body.name !== undefined) {
      const name = String(body.name).trim();
      if (!name) throw new ApiError(400, "Nama barang tidak boleh kosong");
      updateData.name = name;
    }
    if (body.categoryId !== undefined) {
      const category = await db.select({ id: categories.id }).from(categories).where(eq(categories.id, body.categoryId)).get();
      if (!category) throw new ApiError(400, "Kategori tidak ditemukan");
      updateData.categoryId = body.categoryId;
    }
    for (const field of ["price", "cost", "minStock"] as const) {
      if (body[field] !== undefined) {
        const value = toInt(body[field], 0);
        if (value === null) throw new ApiError(400, "Harga, modal, dan stok minimum harus angka 0 atau lebih");
        updateData[field] = value;
      }
    }
    let newStock: number | null = null;
    if (body.stockQty !== undefined) {
      newStock = toInt(body.stockQty, 0);
      if (newStock === null) throw new ApiError(400, "Stok harus angka 0 atau lebih");
      updateData.stockQty = newStock;
    }
    if (body.isActive !== undefined) updateData.isActive = Boolean(body.isActive);

    if (Object.keys(updateData).length === 0) {
      throw new ApiError(400, "Tidak ada data untuk diupdate");
    }

    db.transaction((tx) => {
      const current = tx.select({ stockQty: products.stockQty }).from(products).where(eq(products.id, id)).get();
      if (!current) throw new ApiError(404, "Produk tidak ditemukan");

      tx.update(products).set(updateData).where(eq(products.id, id)).run();

      if (newStock !== null && newStock < current.stockQty) consumeBatches(tx, id, current.stockQty - newStock);
      if (newStock !== null && newStock !== current.stockQty) {
        tx.insert(stockMovements).values({
          id: randomUUID(),
          productId: id,
          type: "penyesuaian",
          qtyChange: newStock - current.stockQty,
          referenceId: `edit-manual:${session.id}`,
        }).run();
      }
    });

    return NextResponse.json({ success: true, message: "Produk berhasil diperbarui" });
  } catch (error) {
    return errorResponse(error, "Gagal memperbarui produk", "PUT product API error:");
  }
}

// DELETE product = nonaktifkan (soft delete) agar riwayat transaksi tetap utuh.
export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const auth = await requireSession("manajer");
    if (auth.error) return auth.error;

    const id = (await params).id;
    const result = db.update(products).set({ isActive: false }).where(eq(products.id, id)).run();
    if (result.changes === 0) throw new ApiError(404, "Produk tidak ditemukan");

    return NextResponse.json({ success: true, message: "Produk berhasil dinonaktifkan" });
  } catch (error) {
    return errorResponse(error, "Gagal menonaktifkan produk", "DELETE product API error:");
  }
}
