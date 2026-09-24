/* eslint-disable */
// @ts-nocheck
import { getSession } from "@/lib/session";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { transactions, shifts, users } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { generateExcelBuffer, generateExcelFilename } from "@/lib/excel-helper";

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    const role = session?.role;
    if (role !== "manajer" && role !== "admin") {
      return NextResponse.json({ success: false, message: "Akses ditolak" }, { status: 403 });
    }

    // Ambil data transaksi
    const salesData = await db
      .select({
        id: transactions.id,
        transactionNumber: transactions.transactionNumber,
        totalAmount: transactions.totalAmount,
        paymentMethod: transactions.paymentMethod,
        transactionTime: transactions.transactionTime,
        cashierName: users.name,
      })
      .from(transactions)
      .leftJoin(users, eq(transactions.userId, users.id))
      .orderBy(desc(transactions.transactionTime))
      .limit(1000); // Batasi untuk menghindari file terlalu besar

    // Format for Excel
    const columns = [
      { header: "No. Transaksi", key: "transactionNumber", width: 20 },
      { header: "Waktu Transaksi", key: "transactionTime", width: 25 },
      { header: "Kasir", key: "cashierName", width: 25 },
      { header: "Metode Pembayaran", key: "paymentMethod", width: 20 },
      { header: "Total Penjualan (Rp)", key: "totalAmount", width: 20 },
    ];

    const data = salesData.map(s => ({
      transactionNumber: s.transactionNumber,
      transactionTime: new Date(s.transactionTime).toLocaleString("id-ID"),
      cashierName: s.cashierName || "-",
      paymentMethod: s.paymentMethod.toUpperCase(),
      totalAmount: s.totalAmount,
    }));

    const buffer = await generateExcelBuffer("Laporan Penjualan", columns, data);
    const filename = generateExcelFilename("Laporan_Penjualan");

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Sales Excel error:", error);
    return NextResponse.json(
      { success: false, message: "Gagal membuat Excel" },
      { status: 500 }
    );
  }
}
