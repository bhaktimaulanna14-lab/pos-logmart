/* eslint-disable */
// @ts-nocheck
import { NextResponse, NextRequest } from "next/server";
import { db } from "@/db";
import { transactions } from "@/db/schema";
import { gte, lte, and } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const period = searchParams.get("period") || "7hari"; // 7hari, bulanIni
    
    const now = new Date();
    let startDate = new Date();
    
    if (period === "bulanIni") {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    } else {
      // 7hari
      startDate.setDate(startDate.getDate() - 7);
    }
    
    const startIso = startDate.toISOString();
    const endIso = now.toISOString();

    const trxs = await db
      .select({
        id: transactions.id,
        totalAmount: transactions.totalAmount,
        createdAt: transactions.createdAt,
      })
      .from(transactions)
      .where(and(
        gte(transactions.createdAt, startIso),
        lte(transactions.createdAt, endIso)
      ));

    // Aggregate by day
    const aggregated = trxs.reduce((acc: any, trx) => {
      const date = trx.createdAt.split("T")[0];
      if (!acc[date]) {
        acc[date] = { date, totalSales: 0, count: 0 };
      }
      acc[date].totalSales += trx.totalAmount;
      acc[date].count += 1;
      return acc;
    }, {});

    const chartData = Object.values(aggregated).sort((a: any, b: any) => a.date.localeCompare(b.date));
    
    const totalRevenue = trxs.reduce((sum, trx) => sum + trx.totalAmount, 0);
    const totalTransactions = trxs.length;

    return NextResponse.json({ 
      success: true, 
      data: {
        summary: {
          totalRevenue,
          totalTransactions,
          avgTransaction: totalTransactions > 0 ? Math.floor(totalRevenue / totalTransactions) : 0,
        },
        chartData
      }
    });
  } catch (error) {
    console.error("GET sales report API error:", error);
    return NextResponse.json(
      { success: false, message: "Gagal mengambil data laporan penjualan" },
      { status: 500 }
    );
  }
}
