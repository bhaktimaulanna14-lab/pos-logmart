/* eslint-disable */
// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { stockMovements, products } from "@/db/schema";
import { eq, desc, and, gte, lte } from "drizzle-orm";
import { generateExcelBuffer, generateExcelFilename } from "@/lib/excel-helper";
import { requireSession } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireSession("manajer");
    if (auth.error) return auth.error;

    const searchParams = request.nextUrl.searchParams;
    const period = searchParams.get("period") || "7hari";
    
    const now = new Date();
    let startDate = new Date();
    
    if (period === "bulanIni") {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    } else {
      startDate.setDate(startDate.getDate() - 7);
    }
    
    const startIso = startDate.toISOString();
    const endIso = now.toISOString();

    const movements = await db
      .select({
        date: stockMovements.createdAt,
        productName: products.name,
        type: stockMovements.type,
        qtyChange: stockMovements.qtyChange,
        referenceId: stockMovements.referenceId,
      })
      .from(stockMovements)
      .leftJoin(products, eq(stockMovements.productId, products.id))
      .where(and(
        gte(stockMovements.createdAt, startIso),
        lte(stockMovements.createdAt, endIso)
      ))
      .orderBy(desc(stockMovements.createdAt));

    const columns = [
      { header: "Waktu", key: "date", width: 20 },
      { header: "Nama Barang", key: "productName", width: 30 },
      { header: "Jenis", key: "type", width: 15 },
      { header: "Perubahan", key: "qtyChange", width: 15 },
      { header: "Referensi", key: "referenceId", width: 25 },
    ];

    const data = movements.map(mov => ({
      date: new Date(mov.date).toLocaleString("id-ID"),
      productName: mov.productName || "-",
      type: mov.type.toUpperCase(),
      qtyChange: mov.qtyChange > 0 ? `+${mov.qtyChange}` : mov.qtyChange,
      referenceId: mov.referenceId || "-",
    }));

    const buffer = await generateExcelBuffer("Pergerakan Stok", columns, data);
    const filename = generateExcelFilename("Laporan_Pergerakan_Stok");

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Export Stock Movements Excel error:", error);
    return NextResponse.json(
      { success: false, message: "Gagal membuat laporan Excel pergerakan stok" },
      { status: 500 }
    );
  }
}
