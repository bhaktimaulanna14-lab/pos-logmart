import { NextResponse } from "next/server";
import { db } from "@/db";
import { transactions, shifts } from "@/db/schema";
import { and, eq, gte, lt, sql } from "drizzle-orm";
import { requireSession, errorResponse } from "@/lib/api-auth";
import { resolvePeriod } from "@/lib/report-period";

// Ringkasan beranda. "Hari ini" dan "bulan ini" mengikuti kalender WIB.
export async function GET() {
  try {
    const auth = await requireSession();
    if (auth.error) return auth.error;

    const today = resolvePeriod(new URLSearchParams("period=hariIni"));
    const month = resolvePeriod(new URLSearchParams("period=bulanIni"));

    const sumIn = (startIso: string, endIso: string) =>
      db
        .select({
          total: sql<number>`coalesce(sum(${transactions.totalAmount}), 0)`,
          count: sql<number>`count(*)`,
        })
        .from(transactions)
        .where(and(gte(transactions.transactionTime, startIso), lt(transactions.transactionTime, endIso)))
        .get();

    const [todayRow, monthRow] = await Promise.all([sumIn(today.startIso, today.endIso), sumIn(month.startIso, month.endIso)]);

    const cashRow = await db
      .select({ totalCash: sql<number>`coalesce(sum(${shifts.openingCash}), 0)` })
      .from(shifts)
      .where(eq(shifts.status, "buka"))
      .get();

    return NextResponse.json({
      success: true,
      data: {
        todaySales: Number(todayRow?.total ?? 0),
        todayTransactions: Number(todayRow?.count ?? 0),
        activeCash: Number(cashRow?.totalCash ?? 0),
        monthlySales: Number(monthRow?.total ?? 0),
        monthlyTransactions: Number(monthRow?.count ?? 0),
      },
    });
  } catch (error) {
    return errorResponse(error, "Gagal mengambil data rekap", "Dashboard summary API error:");
  }
}
