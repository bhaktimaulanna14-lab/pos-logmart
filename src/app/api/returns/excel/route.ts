/* eslint-disable */
// @ts-nocheck
import { getSession } from "@/lib/session";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { returns, products, users } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { generateExcelBuffer, generateExcelFilename } from "@/lib/excel-helper";

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    const role = session?.role;
    if (role !== "manajer" && role !== "admin") {
      return NextResponse.json({ success: false, message: "Akses ditolak" }, { status: 403 });
    }

    // Ambil data retur
    const returnsData = await db
      .select({
        returnNumber: returns.returnNumber,
        transactionId: returns.transactionId,
        productName: products.name,
        quantity: returns.quantity,
        reason: returns.reason,
        status: returns.status,
        createdAt: returns.createdAt,
        processedAt: returns.processedAt,
        processedByName: users.name,
      })
      .from(returns)
      .leftJoin(products, eq(returns.productId, products.id))
      .leftJoin(users, eq(returns.processedBy, users.id))
      .orderBy(desc(returns.createdAt));

    // Format for Excel
    const columns = [
      { header: "Nomor Retur", key: "returnNumber", width: 20 },
      { header: "Tanggal Retur", key: "createdAt", width: 20 },
      { header: "No Transaksi", key: "transactionId", width: 20 },
      { header: "Nama Barang", key: "productName", width: 30 },
      { header: "Qty", key: "quantity", width: 10 },
      { header: "Alasan", key: "reason", width: 40 },
      { header: "Status", key: "status", width: 15 },
      { header: "Tgl Diproses", key: "processedAt", width: 20 },
      { header: "Diproses Oleh", key: "processedByName", width: 20 },
    ];

    const data = returnsData.map(r => ({
      returnNumber: r.returnNumber,
      createdAt: new Date(r.createdAt).toLocaleDateString("id-ID"),
      transactionId: r.transactionId || "-",
      productName: r.productName,
      quantity: r.quantity,
      reason: r.reason,
      status: r.status.toUpperCase(),
      processedAt: r.processedAt ? new Date(r.processedAt).toLocaleDateString("id-ID") : "-",
      processedByName: r.processedByName || "-",
    }));

    const buffer = await generateExcelBuffer("Laporan Retur", columns, data);
    const filename = generateExcelFilename("Laporan_Retur");

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Returns Excel error:", error);
    return NextResponse.json(
      { success: false, message: "Gagal membuat Excel" },
      { status: 500 }
    );
  }
}
