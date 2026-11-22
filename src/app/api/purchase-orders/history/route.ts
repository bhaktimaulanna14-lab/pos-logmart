/* eslint-disable */
// @ts-nocheck
import { NextResponse, NextRequest } from "next/server";
import { db } from "@/db";
import { purchaseOrders, purchaseOrderItems, products } from "@/db/schema";
import { eq, like, or, desc, and } from "drizzle-orm";
import { requireSession } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireSession("manajer");
    if (auth.error) return auth.error;

    const searchParams = request.nextUrl.searchParams;
    const q = searchParams.get("q");

    const conditions = [];
    conditions.push(eq(purchaseOrders.status, "diterima"));

    if (q) {
      conditions.push(
        or(
          like(purchaseOrders.poNumber, `%${q}%`),
          like(purchaseOrders.supplierName, `%${q}%`)
        )
      );
    }

    const pos = await db
      .select()
      .from(purchaseOrders)
      .where(and(...conditions))
      .orderBy(desc(purchaseOrders.receivedAt));

    // Get all items for these POs and group them
    const allPoItems = await db
      .select({
        poId: purchaseOrderItems.purchaseOrderId,
        id: purchaseOrderItems.id,
        productId: purchaseOrderItems.productId,
        name: products.name,
        barcode: products.barcode,
        quantity: purchaseOrderItems.quantity,
        receivedQty: purchaseOrderItems.receivedQty,
      })
      .from(purchaseOrderItems)
      .innerJoin(products, eq(purchaseOrderItems.productId, products.id));

    const formattedData = pos.map((po) => {
      return {
        ...po,
        items: allPoItems.filter((item) => item.poId === po.id),
      };
    });

    return NextResponse.json({ success: true, data: formattedData });
  } catch (error) {
    console.error("GET PO history API error:", error);
    return NextResponse.json(
      { success: false, message: "Gagal mengambil riwayat PO" },
      { status: 500 }
    );
  }
}
