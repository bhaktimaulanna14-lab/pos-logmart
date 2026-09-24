/* eslint-disable */
// @ts-nocheck
import { NextResponse } from "next/server";
import { db } from "@/db";
import { transactions, shifts } from "@/db/schema";
import { sql } from "drizzle-orm";

export async function GET() {
  try {
    // 1. Get today's total sales
    const todaySalesResult = await db
      .select({ total: sql<number>`SUM(total_amount)` })
      .from(transactions)
      .where(sql`date(transaction_time) = date('now')`);
    const todaySales = todaySalesResult[0]?.total || 0;

    // 2. Get today's transaction count
    const txCountResult = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(transactions)
      .where(sql`date(transaction_time) = date('now')`);
    const todayTransactions = txCountResult[0]?.count || 0;

    // 3. Get total active cash in open shifts
    const activeCashResult = await db
      .select({ totalCash: sql<number>`SUM(opening_cash)` })
      .from(shifts)
      .where(sql`status = 'buka'`);
    const activeCash = activeCashResult[0]?.totalCash || 0;

    // 4. Get this month's total sales
    const monthlySalesResult = await db
      .select({ total: sql<number>`SUM(total_amount)` })
      .from(transactions)
      .where(sql`strftime('%Y-%m', transaction_time) = strftime('%Y-%m', 'now')`);
    const monthlySales = monthlySalesResult[0]?.total || 0;

    // 5. Get this month's transaction count
    const monthlyTxCountResult = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(transactions)
      .where(sql`strftime('%Y-%m', transaction_time) = strftime('%Y-%m', 'now')`);
    const monthlyTransactions = monthlyTxCountResult[0]?.count || 0;

    return NextResponse.json({
      success: true,
      data: {
        todaySales,
        todayTransactions,
        activeCash,
        monthlySales,
        monthlyTransactions,
        
        _fallback: {
          todaySales: 2450000,
          todayTransactions: 142,
          activeCash: 1100000,
        },
      },
    });
  } catch (error) {
    console.error("Dashboard summary API error:", error);
    return NextResponse.json(
      { success: false, message: "Gagal mengambil data rekap" },
      { status: 500 }
    );
  }
}
