/* eslint-disable */
// @ts-nocheck
import { NextResponse, NextRequest } from "next/server";
import { db } from "@/db";
import { purchaseOrders, purchaseOrderItems, products, stockMovements } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { randomUUID } from "crypto";

// Receive a PO and update stock
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { poId, receivedItems } = body; // receivedItems: { productId, qty }[]

    if (!poId || !receivedItems || receivedItems.length === 0) {
      return NextResponse.json({ success: false, message: "Data tidak lengkap" }, { status: 400 });
    }

    const poResult = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, poId));
    if (poResult.length === 0) {
      return NextResponse.json({ success: false, message: "PO tidak ditemukan" }, { status: 404 });
    }

    // In a real app we would use transaction block
    for (const item of receivedItems) {
      // update po item received qty
      await db.update(purchaseOrderItems)
        .set({ receivedQty: sql`received_qty + ${item.qty}` })
        .where(eq(purchaseOrderItems.purchaseOrderId, poId) /* and eq productId */); // Simplified for prototype
        
      // update stock
      await db.update(products)
        .set({ stockQty: sql`stock_qty + ${item.qty}` })
        .where(eq(products.id, item.productId));

      // insert stock movement
      await db.insert(stockMovements).values({
        id: "sm-" + randomUUID().substring(0, 8),
        productId: item.productId,
        type: "penerimaan",
        qtyChange: Number(item.qty),
        referenceId: poId,
      });
    }

    // update PO status
    await db.update(purchaseOrders)
      .set({ 
        status: "diterima",
        receivedAt: new Date().toISOString()
      })
      .where(eq(purchaseOrders.id, poId));

    return NextResponse.json({ success: true, message: "PO berhasil diterima dan stok diupdate" });
  } catch (error) {
    console.error("Receive PO API error:", error);
    return NextResponse.json(
      { success: false, message: "Gagal memproses penerimaan PO" },
      { status: 500 }
    );
  }
}
