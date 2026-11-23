import { NextResponse, NextRequest } from "next/server";
import { db } from "@/db";
import { transactions, transactionItems, products } from "@/db/schema";
import { and, eq, gte, isNull, lt, sql, desc } from "drizzle-orm";
import { requireSession, errorResponse } from "@/lib/api-auth";
import { resolvePeriod } from "@/lib/report-period";

// Barang terlaris pada periode terpilih — diagregasi langsung di SQL.
export async function GET(request: NextRequest) {
  try {
    const auth = await requireSession("manajer");
    if (auth.error) return auth.error;

    const params = request.nextUrl.searchParams;
    const period = resolvePeriod(params);
    const limit = Math.min(Math.max(Number(params.get("limit")) || 5, 1), 50);

    const qty = sql<number>`sum(${transactionItems.quantity})`;
    const rows = await db
      .select({
        productId: products.id,
        name: products.name,
        barcode: products.barcode,
        qty,
        revenue: sql<number>`sum(${transactionItems.subtotal})`,
      })
      .from(transactionItems)
      .innerJoin(transactions, eq(transactionItems.transactionId, transactions.id))
      .innerJoin(products, eq(transactionItems.productId, products.id))
      .where(and(gte(transactions.transactionTime, period.startIso), lt(transactions.transactionTime, period.endIso), isNull(transactions.voidedAt)))
      .groupBy(products.id)
      .orderBy(desc(qty))
      .limit(limit);

    return NextResponse.json({
      success: true,
      data: rows.map((r) => ({ ...r, qty: Number(r.qty), revenue: Number(r.revenue) })),
    });
  } catch (error) {
    return errorResponse(error, "Gagal mengambil data produk terlaris", "GET top products API error:");
  }
}
