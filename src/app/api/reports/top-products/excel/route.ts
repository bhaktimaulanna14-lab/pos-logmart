import { getSession } from "@/lib/session";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { products, transactionItems, transactions } from "@/db/schema";
import { eq, sql, desc, and, gte, lt, isNull } from "drizzle-orm";
import { resolvePeriod } from "@/lib/report-period";
import { generateExcelBuffer, generateExcelFilename } from "@/lib/excel-helper";

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    const role = session?.role;
    if (role !== "manajer" && role !== "admin") {
      return NextResponse.json({ success: false, message: "Akses ditolak" }, { status: 403 });
    }

    const period = resolvePeriod(request.nextUrl.searchParams);

    // Query aggregated data: group by product, sum quantity, sum subtotal
    const topProducts = await db
      .select({
        id: products.id,
        name: products.name,
        barcode: products.barcode,
        totalSold: sql<number>`SUM(${transactionItems.quantity})`,
        totalRevenue: sql<number>`SUM(${transactionItems.subtotal})`,
      })
      .from(transactionItems)
      .innerJoin(transactions, eq(transactionItems.transactionId, transactions.id))
      .innerJoin(products, eq(transactionItems.productId, products.id))
      .where(and(gte(transactions.transactionTime, period.startIso), lt(transactions.transactionTime, period.endIso), isNull(transactions.voidedAt)))
      .groupBy(products.id)
      .orderBy(desc(sql`SUM(${transactionItems.quantity})`))
      .limit(50); // top 50

    // Format for Excel
    const columns = [
      { header: "Barcode", key: "barcode", width: 20 },
      { header: "Nama Barang", key: "name", width: 30 },
      { header: "Total Terjual", key: "totalSold", width: 15 },
      { header: "Total Pendapatan (Rp)", key: "totalRevenue", width: 25 },
    ];

    const data = topProducts.map(p => ({
      barcode: p.barcode,
      name: p.name,
      totalSold: p.totalSold || 0,
      totalRevenue: p.totalRevenue || 0,
    }));

    const buffer = await generateExcelBuffer("Produk Terlaris", columns, data);
    const filename = generateExcelFilename("Produk_Terlaris");

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Top products Excel error:", error);
    return NextResponse.json(
      { success: false, message: "Gagal membuat Excel" },
      { status: 500 }
    );
  }
}
