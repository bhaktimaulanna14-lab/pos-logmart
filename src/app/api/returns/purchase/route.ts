/* eslint-disable */
// @ts-nocheck
import { NextResponse, NextRequest } from "next/server";
import { db } from "@/db";
import { purchaseReturns, products, users, stockMovements } from "@/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { randomUUID } from "crypto";

export async function GET(request: NextRequest) {
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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { supplierName, productId, quantity, reason, createdBy = "user-admin-1" } = body;

    if (!supplierName || !productId || !quantity || !reason) {
      return NextResponse.json({ success: false, message: "Data tidak lengkap" }, { status: 400 });
    }

    const qtyNum = parseInt(quantity);
    if (isNaN(qtyNum) || qtyNum <= 0) {
      return NextResponse.json({ success: false, message: "Jumlah harus lebih besar dari 0" }, { status: 400 });
    }

    // Check product exists
    const prod = await db.select().from(products).where(eq(products.id, productId)).limit(1);
    if (prod.length === 0) {
      return NextResponse.json({ success: false, message: "Produk tidak ditemukan" }, { status: 404 });
    }

    if (prod[0].stock < qtyNum) {
      return NextResponse.json({ success: false, message: "Stok tidak mencukupi untuk retur" }, { status: 400 });
    }

    const retId = randomUUID();
    const returnNum = `RTP-${Date.now().toString().slice(-6)}`;

    // Begin transaction for return creation + stock movement
    await db.transaction(async (tx) => {
      await tx.insert(purchaseReturns).values({
        id: retId,
        returnNumber: returnNum,
        supplierName,
        productId,
        quantity: qtyNum,
        reason,
        status: "disetujui",
        processedBy: createdBy,
        processedAt: sql`CURRENT_TIMESTAMP`,
      });

      // Decrease stock
      await tx
        .update(products)
        .set({ stock: sql`${products.stock} - ${qtyNum}` })
        .where(eq(products.id, productId));

      // Record stock movement
      await tx.insert(stockMovements).values({
        id: randomUUID(),
        productId: productId,
        type: "retur",
        qtyChange: -qtyNum,
        referenceId: returnNum,
      });
    });

    return NextResponse.json({ success: true, message: "Retur pembelian berhasil disimpan" });
  } catch (error) {
    console.error("POST purchase returns error:", error);
    return NextResponse.json(
      { success: false, message: "Gagal menyimpan retur pembelian" },
      { status: 500 }
    );
  }
}
