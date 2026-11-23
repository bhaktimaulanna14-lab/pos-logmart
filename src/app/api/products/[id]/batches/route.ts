import { NextResponse, NextRequest } from "next/server";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { productBatches, products } from "@/db/schema";
import { requireSession, toInt, ApiError, errorResponse } from "@/lib/api-auth";
import { addBatch, isValidDate } from "@/lib/batches";

type Params = { params: Promise<{ id: string }> };

// Daftar stok bertanggal kadaluarsa sebuah barang.
export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const auth = await requireSession("manajer");
    if (auth.error) return auth.error;
    const id = (await params).id;
    const product = await db.select({ stockQty: products.stockQty }).from(products).where(eq(products.id, id)).get();
    if (!product) throw new ApiError(404, "Produk tidak ditemukan");
    const batches = await db
      .select({ id: productBatches.id, expiryDate: productBatches.expiryDate, qty: productBatches.remainingQty, source: productBatches.source })
      .from(productBatches)
      .where(eq(productBatches.productId, id))
      .orderBy(asc(productBatches.expiryDate));
    return NextResponse.json({ success: true, data: { stockQty: product.stockQty, batches } });
  } catch (error) {
    return errorResponse(error, "Gagal mengambil data kadaluarsa", "GET batches API error:");
  }
}

// Ganti seluruh daftar stok bertanggal: body { batches: [{ expiryDate: "YYYY-MM-DD", qty }] }.
export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const auth = await requireSession("manajer");
    if (auth.error) return auth.error;
    const id = (await params).id;
    const body = await request.json().catch(() => ({}));
    if (!Array.isArray(body?.batches)) throw new ApiError(400, "Data kadaluarsa tidak valid");

    const rows = body.batches.map((b: { expiryDate?: unknown; qty?: unknown }) => {
      const qty = toInt(b?.qty, 1);
      if (!isValidDate(b?.expiryDate)) throw new ApiError(400, "Tanggal kadaluarsa tidak valid");
      if (qty === null) throw new ApiError(400, "Jumlah harus bilangan bulat 1 atau lebih");
      return { expiryDate: b.expiryDate as string, qty };
    });
    const total = rows.reduce((s: number, r: { qty: number }) => s + r.qty, 0);

    db.transaction((tx) => {
      const product = tx.select({ stockQty: products.stockQty }).from(products).where(eq(products.id, id)).get();
      if (!product) throw new ApiError(404, "Produk tidak ditemukan");
      if (total > product.stockQty) {
        throw new ApiError(400, `Jumlah bertanggal (${total}) melebihi stok barang (${product.stockQty})`);
      }
      tx.delete(productBatches).where(eq(productBatches.productId, id)).run();
      for (const r of rows) addBatch(tx, id, r.expiryDate, r.qty, "manual");
    });

    return NextResponse.json({ success: true, message: "Data kadaluarsa disimpan" });
  } catch (error) {
    return errorResponse(error, "Gagal menyimpan data kadaluarsa", "PUT batches API error:");
  }
}
