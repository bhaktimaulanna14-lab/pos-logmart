import { getSession } from "@/lib/session";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { transactions, users } from "@/db/schema";
import { eq, desc, and, gte, lt, isNull } from "drizzle-orm";
import { resolvePeriod } from "@/lib/report-period";
import { generateExcelBuffer, generateExcelFilename } from "@/lib/excel-helper";

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    const role = session?.role;
    if (role !== "manajer" && role !== "admin") {
      return NextResponse.json({ success: false, message: "Akses ditolak" }, { status: 403 });
    }

    // Periode sama dengan halaman Laporan (?period= atau ?startDate=&endDate=, WIB).
    const period = resolvePeriod(request.nextUrl.searchParams);

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
      .where(and(gte(transactions.transactionTime, period.startIso), lt(transactions.transactionTime, period.endIso), isNull(transactions.voidedAt)))
      .orderBy(desc(transactions.transactionTime))
      .limit(20000); // pengaman ukuran file

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

    return new NextResponse(buffer as unknown as BodyInit, {
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
