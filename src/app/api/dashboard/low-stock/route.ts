import { NextResponse, NextRequest } from "next/server";
import { db } from "@/db";
import { products } from "@/db/schema";
import { and, eq, lte, sql, asc } from "drizzle-orm";
import { requireSession, errorResponse } from "@/lib/api-auth";

// Barang aktif dengan stok <= stok minimum. `total` = jumlah seluruh barang yang menipis.
export async function GET(request: NextRequest) {
  try {
    const auth = await requireSession();
    if (auth.error) return auth.error;

    const limit = Math.min(Math.max(Number(request.nextUrl.searchParams.get("limit")) || 6, 1), 500);
    const isLow = and(eq(products.isActive, true), lte(products.stockQty, products.minStock));

    const [items, totalRow] = await Promise.all([
      db
        .select({ id: products.id, name: products.name, stock: products.stockQty, min: products.minStock })
        .from(products)
        .where(isLow)
        .orderBy(asc(sql`${products.stockQty} - ${products.minStock}`), asc(products.name))
        .limit(limit),
      db.select({ n: sql<number>`count(*)` }).from(products).where(isLow).get(),
    ]);

    return NextResponse.json({ success: true, data: items, total: Number(totalRow?.n ?? 0) });
  } catch (error) {
    return errorResponse(error, "Gagal mengambil data stok", "Low stock API error:");
  }
}
