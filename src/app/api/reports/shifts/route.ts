import { NextResponse, NextRequest } from "next/server";
import { db } from "@/db";
import { shifts, transactions, users } from "@/db/schema";
import { and, eq, desc, gte, lt, sql } from "drizzle-orm";
import { requireSession, errorResponse } from "@/lib/api-auth";
import { resolvePeriod, STORE_UTC_OFFSET_HOURS } from "@/lib/report-period";

/** Jam buka shift dalam WIB menentukan Shift Pagi (06.00–14.59) atau Shift Malam. */
function shiftTypeOf(openAt: string) {
  const hour = (new Date(openAt).getUTCHours() + STORE_UTC_OFFSET_HOURS) % 24;
  return hour >= 6 && hour < 15 ? "Shift Pagi" : "Shift Malam";
}

// Rekap per shift. Tanpa parameter periode = semua shift (perilaku lama halaman Laporan Shift).
export async function GET(request: NextRequest) {
  try {
    const auth = await requireSession("manajer");
    if (auth.error) return auth.error;

    const params = request.nextUrl.searchParams;
    const filtered = params.has("period") || params.has("startDate");
    const period = filtered ? resolvePeriod(params) : null;

    const rows = await db
      .select({
        id: shifts.id,
        status: shifts.status,
        openAt: shifts.openAt,
        closeAt: shifts.closeAt,
        openingCash: shifts.openingCash,
        closingCash: shifts.closingCash,
        userName: users.name,
        totalSales: sql<number>`coalesce(sum(${transactions.totalAmount}), 0)`,
        totalTransactions: sql<number>`count(${transactions.id})`,
        cashSales: sql<number>`coalesce(sum(case when ${transactions.paymentMethod} = 'tunai' then ${transactions.totalAmount} else 0 end), 0)`,
      })
      .from(shifts)
      .innerJoin(users, eq(shifts.userId, users.id))
      .leftJoin(transactions, eq(transactions.shiftId, shifts.id))
      .where(period ? and(gte(shifts.openAt, period.startIso), lt(shifts.openAt, period.endIso)) : undefined)
      .groupBy(shifts.id)
      .orderBy(desc(shifts.openAt));

    const data = rows.map((s) => ({
      ...s,
      totalSales: Number(s.totalSales),
      totalTransactions: Number(s.totalTransactions),
      cashSales: Number(s.cashSales),
      shiftType: shiftTypeOf(s.openAt),
    }));

    // Ringkasan Pagi vs Malam untuk kartu "Performa Shift Kasir".
    const byType = ["Shift Pagi", "Shift Malam"].map((type) => {
      const list = data.filter((d) => d.shiftType === type);
      return {
        shiftType: type,
        shifts: list.length,
        totalSales: list.reduce((a, b) => a + b.totalSales, 0),
        totalTransactions: list.reduce((a, b) => a + b.totalTransactions, 0),
      };
    });

    return NextResponse.json({ success: true, data, summary: byType });
  } catch (error) {
    return errorResponse(error, "Gagal mengambil data laporan shift", "GET shift report API error:");
  }
}
