import { NextResponse, NextRequest } from "next/server";
import { db } from "@/db";
import { purchaseOrders, purchaseOrderItems, products } from "@/db/schema";
import { randomUUID } from "crypto";
import { inArray } from "drizzle-orm";
import { requireSession, toInt, ApiError, errorResponse } from "@/lib/api-auth";

export async function POST(request: NextRequest) {
  try {
    const auth = await requireSession("manajer");
    if (auth.error) return auth.error;
    const { session } = auth;

    const body = await request.json();
    const { supplierName, items, notes, orderDate } = body;

    if (!String(supplierName || "").trim() || !Array.isArray(items) || items.length === 0 || !orderDate) {
      throw new ApiError(400, "Data tidak lengkap");
    }

    // Gabungkan barang yang sama dan pastikan qty valid.
    const qtyByProduct = new Map<string, number>();
    for (const item of items) {
      const qty = toInt(item?.qty, 1);
      if (!item?.productId || qty === null) throw new ApiError(400, "Jumlah pesanan harus bilangan bulat lebih dari 0");
      qtyByProduct.set(item.productId, (qtyByProduct.get(item.productId) ?? 0) + qty);
    }

    const poId = randomUUID();
    const poNumber = `PO-${Date.now().toString().slice(-6)}`;

    db.transaction((tx) => {
      const found = tx
        .select({ id: products.id })
        .from(products)
        .where(inArray(products.id, [...qtyByProduct.keys()]))
        .all();
      if (found.length !== qtyByProduct.size) throw new ApiError(400, "Ada barang yang tidak ditemukan");

      tx.insert(purchaseOrders).values({
        id: poId,
        poNumber,
        supplierName: String(supplierName).trim(),
        orderDate,
        status: "dipesan",
        createdBy: session.id,
        notes: notes || null,
      }).run();

      for (const [productId, qty] of qtyByProduct) {
        tx.insert(purchaseOrderItems).values({
          id: randomUUID(),
          purchaseOrderId: poId,
          productId,
          quantity: qty,
          receivedQty: 0,
        }).run();
      }
    });

    return NextResponse.json({ success: true, message: "PO berhasil dibuat", data: { id: poId, poNumber } });
  } catch (error) {
    return errorResponse(error, "Gagal membuat PO", "POST purchase order error:");
  }
}

export async function GET() {
  try {
    const results = await db.select().from(purchaseOrders);
    return NextResponse.json({ success: true, data: results });
  } catch (error) {
    console.error("GET PO error:", error);
    return NextResponse.json(
      { success: false, message: "Gagal mengambil daftar PO" },
      { status: 500 }
    );
  }
}
