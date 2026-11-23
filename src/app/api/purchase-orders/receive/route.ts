import { NextResponse, NextRequest } from "next/server";
import { db } from "@/db";
import { purchaseOrders, purchaseOrderItems, products, stockMovements } from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { randomUUID } from "crypto";
import { addBatch, isValidDate } from "@/lib/batches";
import { requireSession, toInt, ApiError, errorResponse } from "@/lib/api-auth";

// Terima barang dari sebuah PO dan tambahkan stok — semuanya dalam satu transaksi.
// receivedItems: { productId, qty, expiryDate?, cost? }[]  (qty 0 = barang itu tidak datang; expiryDate YYYY-MM-DD opsional;
// cost = harga modal per item dari supplier, opsional — bila diisi menjadi harga modal barang yang baru)
export async function POST(request: NextRequest) {
  try {
    const auth = await requireSession("manajer");
    if (auth.error) return auth.error;

    const body = await request.json();
    const { poId, receivedItems } = body;

    if (!poId || !Array.isArray(receivedItems) || receivedItems.length === 0) {
      throw new ApiError(400, "Data tidak lengkap");
    }

    const qtyByProduct = new Map<string, number>();
    const batches: { productId: string; qty: number; expiryDate: string }[] = [];
    const costByProduct = new Map<string, number>();
    for (const item of receivedItems) {
      const qty = toInt(item?.qty, 0);
      if (!item?.productId || qty === null) throw new ApiError(400, "Jumlah diterima harus bilangan bulat 0 atau lebih");
      if (item.expiryDate && !isValidDate(item.expiryDate)) throw new ApiError(400, "Tanggal kadaluarsa tidak valid");
      if (item.cost !== undefined && item.cost !== null && item.cost !== "") {
        const cost = toInt(item.cost, 0);
        if (cost === null) throw new ApiError(400, "Harga modal harus angka bulat 0 atau lebih");
        if (qty > 0) costByProduct.set(item.productId, cost);
      }
      qtyByProduct.set(item.productId, (qtyByProduct.get(item.productId) ?? 0) + qty);
      if (item.expiryDate && qty > 0) batches.push({ productId: item.productId, qty, expiryDate: item.expiryDate });
    }
    if ([...qtyByProduct.values()].every((q) => q === 0)) {
      throw new ApiError(400, "Isi jumlah diterima minimal untuk satu barang");
    }

    db.transaction((tx) => {
      const po = tx.select().from(purchaseOrders).where(eq(purchaseOrders.id, poId)).get();
      if (!po) throw new ApiError(404, "PO tidak ditemukan");
      if (po.status !== "dipesan") {
        throw new ApiError(400, `PO ini sudah berstatus "${po.status}" dan tidak bisa diterima lagi`);
      }

      const poItems = tx.select().from(purchaseOrderItems).where(eq(purchaseOrderItems.purchaseOrderId, poId)).all();
      const itemByProduct = new Map(poItems.map((i) => [i.productId, i]));

      for (const [productId, qty] of qtyByProduct) {
        const poItem = itemByProduct.get(productId);
        if (!poItem) throw new ApiError(400, "Ada barang yang tidak termasuk dalam PO ini");
        const remaining = poItem.quantity - poItem.receivedQty;
        if (qty > remaining) {
          throw new ApiError(400, `Jumlah diterima melebihi pesanan (sisa pesanan ${remaining})`);
        }
        if (qty === 0) continue;

        tx.update(purchaseOrderItems)
          .set({ receivedQty: sql`${purchaseOrderItems.receivedQty} + ${qty}`, ...(costByProduct.has(productId) ? { unitCost: costByProduct.get(productId) } : {}) })
          .where(and(eq(purchaseOrderItems.purchaseOrderId, poId), eq(purchaseOrderItems.productId, productId)))
          .run();

        tx.update(products)
          .set({ stockQty: sql`${products.stockQty} + ${qty}`, ...(costByProduct.has(productId) ? { cost: costByProduct.get(productId) } : {}) })
          .where(eq(products.id, productId))
          .run();

        tx.insert(stockMovements).values({
          id: randomUUID(),
          productId,
          type: "penerimaan",
          qtyChange: qty,
          referenceId: poId,
        }).run();
      }

      for (const b of batches) addBatch(tx, b.productId, b.expiryDate, b.qty, "po", poId);

      tx.update(purchaseOrders)
        .set({ status: "diterima", receivedAt: new Date().toISOString() })
        .where(eq(purchaseOrders.id, poId))
        .run();
    });

    return NextResponse.json({ success: true, message: "PO berhasil diterima dan stok diupdate" });
  } catch (error) {
    return errorResponse(error, "Gagal memproses penerimaan PO", "Receive PO API error:");
  }
}
