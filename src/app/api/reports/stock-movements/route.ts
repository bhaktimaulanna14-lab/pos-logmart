import { NextResponse, NextRequest } from "next/server";
import { db } from "@/db";
import { stockMovements, products } from "@/db/schema";
import { and, eq, gte, lt, sql, desc, asc, gt } from "drizzle-orm";
import { requireSession, errorResponse } from "@/lib/api-auth";
import { resolvePeriod } from "@/lib/report-period";

// Pergerakan stok + barang cepat/lambat terjual pada periode terpilih.
export async function GET(request: NextRequest) {
  try {
    const auth = await requireSession("manajer");
    if (auth.error) return auth.error;

    const period = resolvePeriod(request.nextUrl.searchParams);
    // stock_movements.created_at disimpan sebagai "YYYY-MM-DD HH:MM:SS" (UTC).
    const inPeriod = and(gte(stockMovements.createdAt, period.startSql), lt(stockMovements.createdAt, period.endSql));
    const dayCount = Math.max(period.days.length, 1);

    const soldQty = sql<number>`sum(-${stockMovements.qtyChange})`;
    const fastMoving = await db
      .select({ productId: products.id, name: products.name, qty: soldQty })
      .from(stockMovements)
      .innerJoin(products, eq(stockMovements.productId, products.id))
      .where(and(inPeriod, eq(stockMovements.type, "penjualan")))
      .groupBy(products.id)
      .orderBy(desc(soldQty))
      .limit(5);

    // Lambat terjual: barang aktif yang masih ada stok, dengan penjualan paling sedikit (termasuk 0).
    const soldInPeriod = sql<number>`coalesce((
      select sum(-sm.qty_change) from stock_movements sm
      where sm.product_id = ${products.id} and sm.type = 'penjualan'
        and sm.created_at >= ${period.startSql} and sm.created_at < ${period.endSql}
    ), 0)`;
    const slowMoving = await db
      .select({ productId: products.id, name: products.name, stock: products.stockQty, qty: soldInPeriod })
      .from(products)
      .where(and(eq(products.isActive, true), gt(products.stockQty, 0)))
      .orderBy(asc(soldInPeriod), desc(products.stockQty))
      .limit(5);

    const allMovements = await db
      .select({
        id: stockMovements.id,
        productId: stockMovements.productId,
        type: stockMovements.type,
        qtyChange: stockMovements.qtyChange,
        referenceId: stockMovements.referenceId,
        date: stockMovements.createdAt,
        name: products.name,
      })
      .from(stockMovements)
      .innerJoin(products, eq(stockMovements.productId, products.id))
      .where(inPeriod)
      .orderBy(desc(stockMovements.createdAt))
      .limit(500);

    const perDay = (q: number) => Math.round((Number(q) / dayCount) * 10) / 10;

    return NextResponse.json({
      success: true,
      data: {
        period: { key: period.key, label: period.label, days: dayCount },
        fastMoving: fastMoving.map((r) => ({ ...r, qty: Number(r.qty), perDay: perDay(r.qty) })),
        slowMoving: slowMoving.map((r) => ({ ...r, qty: Number(r.qty), perDay: perDay(r.qty) })),
        // created_at SQL (UTC) → ISO agar dibaca benar oleh browser.
        allMovements: allMovements.map((m) => ({ ...m, date: m.date.includes("T") ? m.date : m.date.replace(" ", "T") + "Z" })),
      },
    });
  } catch (error) {
    return errorResponse(error, "Gagal mengambil data pergerakan barang", "GET stock movements report API error:");
  }
}
