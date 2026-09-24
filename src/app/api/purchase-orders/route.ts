/* eslint-disable */
// @ts-nocheck
import { NextResponse, NextRequest } from "next/server";
import { db } from "@/db";
import { purchaseOrders, purchaseOrderItems } from "@/db/schema";
import { randomUUID } from "crypto";
import { sql } from "drizzle-orm";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { supplierName, items, notes, orderDate, createdBy = "user-admin-1" } = body;

    if (!supplierName || !items || !Array.isArray(items) || items.length === 0 || !orderDate) {
      return NextResponse.json({ success: false, message: "Data tidak lengkap" }, { status: 400 });
    }

    const poId = randomUUID();
    const poNumber = `PO-${Date.now().toString().slice(-6)}`;

    // Insert PO
    await db.insert(purchaseOrders).values({
      id: poId,
      poNumber: poNumber,
      supplierName: supplierName,
      orderDate: orderDate,
      status: "dipesan",
      createdBy: createdBy,
      notes: notes || null,
    });

    // Insert items
    for (const item of items) {
      await db.insert(purchaseOrderItems).values({
        id: randomUUID(),
        purchaseOrderId: poId,
        productId: item.productId,
        quantity: item.qty,
        receivedQty: 0
      });
    }

    return NextResponse.json({ success: true, message: "PO berhasil dibuat" });
  } catch (error) {
    console.error("POST purchase order error:", error);
    return NextResponse.json(
      { success: false, message: "Gagal membuat PO" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
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
