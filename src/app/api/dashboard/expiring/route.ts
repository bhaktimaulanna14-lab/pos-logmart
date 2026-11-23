import { NextResponse, NextRequest } from "next/server";
import { db } from "@/db";
import { productBatches, products } from "@/db/schema";
import { and, eq, lte, sql, asc } from "drizzle-orm";
import { requireSession, errorResponse } from "@/lib/api-auth";
import { storeDatePlus } from "@/lib/batches";

// Stok barang aktif yang sudah/akan kadaluarsa dalam 30 hari. `total` = jumlah seluruh batch tersebut.
export async function GET(request: NextRequest) {
  try {
    const auth = await requireSession();
    if (auth.error) return auth.error;

    const limit = Math.min(Math.max(Number(request.nextUrl.searchParams.get("limit")) || 6, 1), 500);
    const isExpiring = and(eq(products.isActive, true), lte(productBatches.expiryDate, storeDatePlus(30)));

    const [items, totalRow] = await Promise.all([
      db
        .select({ id: productBatches.id, productId: products.id, name: products.name, expiryDate: productBatches.expiryDate, qty: productBatches.remainingQty })
        .from(productBatches)
        .innerJoin(products, eq(productBatches.productId, products.id))
        .where(isExpiring)
        .orderBy(asc(productBatches.expiryDate), asc(products.name))
        .limit(limit),
      db.select({ n: sql<number>`count(*)` }).from(productBatches).innerJoin(products, eq(productBatches.productId, products.id)).where(isExpiring).get(),
    ]);

    return NextResponse.json({ success: true, data: items, today: storeDatePlus(0), total: Number(totalRow?.n ?? 0) });
  } catch (error) {
    return errorResponse(error, "Gagal mengambil data kadaluarsa", "Expiring API error:");
  }
}
