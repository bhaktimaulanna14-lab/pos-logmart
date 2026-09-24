/* eslint-disable */
// @ts-nocheck
import { NextResponse, NextRequest } from "next/server";
import { db } from "@/db";
import { returns, products, stockMovements, users } from "@/db/schema";
import { eq, desc, like, and, sql } from "drizzle-orm";
import { randomUUID } from "crypto";

// GET: List all returns
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const q = searchParams.get("q");
    const status = searchParams.get("status");

    const conditions = [];

    if (q) {
      conditions.push(
        like(returns.returnNumber, `%${q}%`)
      );
    }

    if (status && status !== "semua") {
      conditions.push(eq(returns.status, status));
    }

    const results = await db
      .select({
        id: returns.id,
        returnNumber: returns.returnNumber,
        transactionId: returns.transactionId,
        productId: returns.productId,
        productName: products.name,
        quantity: returns.quantity,
        reason: returns.reason,
        status: returns.status,
        processedBy: returns.processedBy,
        processedByName: users.name,
        createdAt: returns.createdAt,
        processedAt: returns.processedAt,
      })
      .from(returns)
      .leftJoin(products, eq(returns.productId, products.id))
      .leftJoin(users, eq(returns.processedBy, users.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(returns.createdAt));

    const mappedResults = results.map(row => {
      let supplierName = null;
      let cleanReason = row.reason;
      if (row.reason && row.reason.startsWith("[SUPPLIER]")) {
        const parts = row.reason.split(" | ");
        supplierName = parts[0].replace("[SUPPLIER] ", "").trim();
        cleanReason = parts.length > 1 ? parts.slice(1).join(" | ") : row.reason;
      }
      return {
        ...row,
        supplierName,
        reason: cleanReason,
        returnType: supplierName ? "pembelian" : "penjualan"
      };
    });

    return NextResponse.json({ success: true, data: mappedResults });
  } catch (error) {
    console.error("GET returns API error:", error);
    return NextResponse.json(
      { success: false, message: "Gagal mengambil data retur" },
      { status: 500 }
    );
  }
}

// POST: Create a new return + adjust stock
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { transactionId, supplierName, productId, quantity, reason, userId = "user-admin-1" } = body;

    if (!productId || !quantity || !reason) {
      return NextResponse.json(
        { success: false, message: "Data retur tidak lengkap" },
        { status: 400 }
      );
    }

    if (quantity <= 0) {
      return NextResponse.json(
        { success: false, message: "Jumlah retur harus lebih dari 0" },
        { status: 400 }
      );
    }

    // Verify product exists
    const productResult = await db
      .select()
      .from(products)
      .where(eq(products.id, productId))
      .limit(1);

    if (productResult.length === 0) {
      return NextResponse.json(
        { success: false, message: "Barang tidak ditemukan" },
        { status: 404 }
      );
    }

    const returnId = randomUUID();
    const returnNumber = "RTR-" + Date.now();
    
    // Store supplier return info in reason since schema cannot be changed
    const finalReason = supplierName ? `[SUPPLIER] ${supplierName} | ${reason}` : reason;

    // Insert return record
    await db.insert(returns).values({
      id: returnId,
      returnNumber,
      transactionId: transactionId || null,
      productId,
      quantity,
      reason: finalReason,
      status: "pending",
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      data: {
        id: returnId,
        returnNumber,
        status: "pending",
      },
      message: "Retur berhasil diajukan",
    });
  } catch (error) {
    console.error("POST returns API error:", error);
    return NextResponse.json(
      { success: false, message: "Gagal membuat retur" },
      { status: 500 }
    );
  }
}

// PATCH: Approve or reject a return
export async function PATCH(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const returnId = searchParams.get("id");
    
    const body = await request.json();
    const { status: action, userId = "user-admin-1" } = body;

    if (!returnId || !action) {
      return NextResponse.json(
        { success: false, message: "Data tidak lengkap" },
        { status: 400 }
      );
    }

    if (!["disetujui", "ditolak"].includes(action)) {
      return NextResponse.json(
        { success: false, message: "Aksi tidak valid" },
        { status: 400 }
      );
    }

    // Find the return
    const returnResult = await db
      .select()
      .from(returns)
      .where(eq(returns.id, returnId))
      .limit(1);

    if (returnResult.length === 0) {
      return NextResponse.json(
        { success: false, message: "Retur tidak ditemukan" },
        { status: 404 }
      );
    }

    const returnRecord = returnResult[0];

    if (returnRecord.status !== "pending") {
      return NextResponse.json(
        { success: false, message: "Retur sudah diproses sebelumnya" },
        { status: 400 }
      );
    }

    // Update return status
    await db
      .update(returns)
      .set({
        status: action,
        processedBy: userId,
        processedAt: new Date().toISOString(),
      })
      .where(eq(returns.id, returnId));

    // If approved, adjust stock
    if (action === "disetujui") {
      const isSupplierReturn = returnRecord.reason.startsWith("[SUPPLIER]");
      
      if (isSupplierReturn) {
        // Decrease product stock (returning back to supplier)
        await db
          .update(products)
          .set({ stockQty: sql`stock_qty - ${returnRecord.quantity}` })
          .where(eq(products.id, returnRecord.productId));

        // Record stock movement OUT
        await db.insert(stockMovements).values({
          id: randomUUID(),
          productId: returnRecord.productId,
          type: "retur",
          qtyChange: -returnRecord.quantity,
          referenceId: returnId,
        });
      } else {
        // Increase product stock (customer returning to us)
        await db
          .update(products)
          .set({ stockQty: sql`stock_qty + ${returnRecord.quantity}` })
          .where(eq(products.id, returnRecord.productId));

        // Record stock movement IN
        await db.insert(stockMovements).values({
          id: randomUUID(),
          productId: returnRecord.productId,
          type: "retur",
          qtyChange: returnRecord.quantity,
          referenceId: returnId,
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: action === "disetujui"
        ? "Retur disetujui, stok telah disesuaikan"
        : "Retur ditolak",
    });
  } catch (error) {
    console.error("PATCH returns API error:", error);
    return NextResponse.json(
      { success: false, message: "Gagal memproses retur" },
      { status: 500 }
    );
  }
}
