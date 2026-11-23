import { NextResponse, NextRequest } from "next/server";
import { db } from "@/db";
import { transactions } from "@/db/schema";
import { and, gte, isNull, lt, sql } from "drizzle-orm";
import { requireSession, errorResponse } from "@/lib/api-auth";
import { resolvePeriod, previousPeriod, toStoreDate } from "@/lib/report-period";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const DAYS = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

// Ringkasan penjualan + data grafik untuk periode terpilih (WIB).
export async function GET(request: NextRequest) {
  try {
    const auth = await requireSession("manajer");
    if (auth.error) return auth.error;

    const period = resolvePeriod(request.nextUrl.searchParams);

    const trxs = await db
      .select({ totalAmount: transactions.totalAmount, transactionTime: transactions.transactionTime })
      .from(transactions)
      .where(and(gte(transactions.transactionTime, period.startIso), lt(transactions.transactionTime, period.endIso), isNull(transactions.voidedAt)));

    const prev = previousPeriod(period);
    const prevRow = await db
      .select({
        revenue: sql<number>`coalesce(sum(${transactions.totalAmount}), 0)`,
        count: sql<number>`count(*)`,
      })
      .from(transactions)
      .where(and(gte(transactions.transactionTime, prev.startIso), lt(transactions.transactionTime, prev.endIso), isNull(transactions.voidedAt)))
      .get();

    // Kelompokkan per hari (atau per bulan untuk periode panjang) dalam WIB.
    const buckets = new Map<string, { key: string; name: string; sales: number; count: number }>();
    if (period.groupByMonth) {
      for (const day of period.days) {
        const key = day.slice(0, 7);
        if (!buckets.has(key)) buckets.set(key, { key, name: `${MONTHS[Number(key.slice(5, 7)) - 1]} ${key.slice(2, 4)}`, sales: 0, count: 0 });
      }
    } else {
      for (const day of period.days) {
        const d = new Date(day + "T00:00:00Z");
        const name = period.days.length <= 7 ? `${DAYS[d.getUTCDay()]} ${Number(day.slice(8))}` : `${Number(day.slice(8))}/${Number(day.slice(5, 7))}`;
        buckets.set(day, { key: day, name, sales: 0, count: 0 });
      }
    }

    let totalRevenue = 0;
    for (const t of trxs) {
      totalRevenue += t.totalAmount;
      const day = toStoreDate(t.transactionTime);
      const bucket = buckets.get(period.groupByMonth ? day.slice(0, 7) : day);
      if (bucket) {
        bucket.sales += t.totalAmount;
        bucket.count += 1;
      }
    }

    const totalTransactions = trxs.length;
    const prevRevenue = Number(prevRow?.revenue ?? 0);
    const prevCount = Number(prevRow?.count ?? 0);
    const pctChange = (now: number, before: number) => (before > 0 ? Math.round(((now - before) / before) * 1000) / 10 : null);

    return NextResponse.json({
      success: true,
      data: {
        period: { key: period.key, label: period.label, start: period.startIso, end: period.endIso },
        summary: {
          totalRevenue,
          totalTransactions,
          avgTransaction: totalTransactions > 0 ? Math.round(totalRevenue / totalTransactions) : 0,
          revenueChangePct: pctChange(totalRevenue, prevRevenue),
          transactionsChangePct: pctChange(totalTransactions, prevCount),
        },
        chartData: [...buckets.values()],
      },
    });
  } catch (error) {
    return errorResponse(error, "Gagal mengambil data laporan penjualan", "GET sales report API error:");
  }
}
