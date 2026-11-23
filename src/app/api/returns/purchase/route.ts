import { NextResponse, NextRequest } from "next/server";
import { db } from "@/db";
import { purchaseReturns, products, stockMovements } from "@/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { randomUUID } from "crypto";
import { consumeBatches } from "@/lib/batches";
import { requireSession, toInt, ApiError, errorResponse } from "@/lib/api-auth";

export async function GET() {
  try {
    const list = await db
      .select({
        id: purchaseReturns.id,
        returnNumber: purchaseReturns.returnNumber,
        supplierName: purchaseReturns.supplierName,
        productId: purchaseReturns.productId,
        productName: products.name,
        quantity: purchaseReturns.quantity,
        reason: purchaseReturns.reason,
        status: purchaseReturns.status,
        createdAt: purchaseReturns.createdAt,
      })
      .from(purchaseReturns)
      .innerJoin(products, eq(purchaseReturns.productId, products.id))
      .orderBy(desc(purchaseReturns.createdAt));

    return NextResponse.json({ success: true, data: list });
  } catch (error) {
    console.error("GET purchase returns error:", error);
    return NextResponse.json(
      { success: false, message: "Gagal mengambil data retur pembelian" },
      { status: 500 }
    );
  }
}

// Retur ke supplier: langsung disetujui, stok berkurang — semuanya dalam satu transaksi sinkron.
export async function POST(request: NextRequest) {
  try {
    const auth = await requireSession("manajer");
    if (auth.error) return auth.error;
    const { session } = auth;

    // items: [{ productId, quantity }] — banyak barang sekaligus ke satu supplier dengan satu alasan.
    const body = await request.json();
    const supplierName = String(body.supplierName || "").trim();
    const reason = String(body.reason || "").trim();
    if (!supplierName || !reason || !Array.isArray(body.items) || body.items.length === 0) {
      throw new ApiError(400, "Data tidak lengkap (supplier, barang, dan alasan wajib diisi)");
    }
    const qtyByProduct = new Map<string, number>();
    for (const item of body.items) {
      const qty = toInt(item?.quantity, 1);
      if (!item?.productId || qty === null) throw new ApiError(400, "Jumlah harus bilangan bulat lebih dari 0");
      qtyByProduct.set(item.productId, (qtyByProduct.get(item.productId) ?? 0) + qty);
    }

    const baseNum = `RTP-${Date.now().toString().slice(-6)}`;
    const now = new Date().toISOString();

    db.transaction((tx) => {
      let n = 0;
      for (const [productId, qtyNum] of qtyByProduct) {
        const prod = tx
          .select({ name: products.name, stockQty: products.stockQty })
          .from(products)
          .where(eq(products.id, productId))
          .get();
        if (!prod) throw new ApiError(404, "Produk tidak ditemukan");
        if (prod.stockQty < qtyNum) {
          throw new ApiError(400, `Stok "${prod.name}" tidak mencukupi untuk retur (tersisa ${prod.stockQty})`);
        }
        // Satu baris per barang; nomor retur unik per baris, berawalan sama.
        const returnNum = qtyByProduct.size > 1 ? `${baseNum}-${++n}` : baseNum;

        tx.insert(purchaseReturns).values({
          id: randomUUID(),
          returnNumber: returnNum,
          supplierName,
          productId,
          quantity: qtyNum,
          reason,
          status: "disetujui",
          processedBy: session.id,
          processedAt: now,
        }).run();

        tx.update(products)
          .set({ stockQty: sql`${products.stockQty} - ${qtyNum}` })
          .where(eq(products.id, productId))
          .run();
        consumeBatches(tx, productId, qtyNum);

        tx.insert(stockMovements).values({
          id: randomUUID(),
          productId,
          type: "retur",
          qtyChange: -qtyNum,
          referenceId: returnNum,
        }).run();
      }
    });

    return NextResponse.json({ success: true, message: "Retur pembelian berhasil disimpan" });
  } catch (error) {
    return errorResponse(error, "Gagal menyimpan retur pembelian", "POST purchase returns error:");
  }
}
