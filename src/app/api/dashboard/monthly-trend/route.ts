/* eslint-disable */
// @ts-nocheck
import { NextResponse } from "next/server";
import { db } from "@/db";
import { transactions } from "@/db/schema";
import { sql } from "drizzle-orm";

export async function GET() {
  try {
    // Get sales per month for the last 6 months
    const results = await db
      .select({
        month: sql<string>`strftime('%Y-%m', transaction_time)`,
        sales: sql<number>`SUM(total_amount)`,
      })
      .from(transactions)
      .where(
        sql`transaction_time >= date('now', '-6 months')`
      )
      .groupBy(sql`strftime('%Y-%m', transaction_time)`)
      .orderBy(sql`strftime('%Y-%m', transaction_time) ASC`);

    // Format month label to Indonesian short month names
    const monthNames: Record<string, string> = {
      "01": "Jan", "02": "Feb", "03": "Mar", "04": "Apr",
      "05": "Mei", "06": "Jun", "07": "Jul", "08": "Agu",
      "09": "Sep", "10": "Okt", "11": "Nov", "12": "Des",
    };

    const formattedData = results.map((row) => {
      const [, month] = (row.month || "").split("-");
      const label = monthNames[month] || row.month;
      return { month: label, sales: row.sales || 0 };
    });

    // If no real data, return empty (frontend will show placeholder)
    return NextResponse.json({ success: true, data: formattedData });
  } catch (error) {
    console.error("Monthly trend API error:", error);
    return NextResponse.json(
      { success: false, message: "Gagal mengambil data tren bulanan" },
      { status: 500 }
    );
  }
}
