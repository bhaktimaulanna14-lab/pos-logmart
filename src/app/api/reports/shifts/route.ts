/* eslint-disable */
// @ts-nocheck
import { NextResponse, NextRequest } from "next/server";
import { db } from "@/db";
import { shifts, transactions, users } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    // Get all shifts (for simplicity, we just fetch all and aggregate in memory for prototype)
    const allShifts = await db
      .select({
        id: shifts.id,
        status: shifts.status,
        openAt: shifts.openAt,
        closeAt: shifts.closeAt,
        openingCash: shifts.openingCash,
        closingCash: shifts.closingCash,
        userName: users.name,
      })
      .from(shifts)
      .innerJoin(users, eq(shifts.userId, users.id))
      .orderBy(desc(shifts.openAt));

    const shiftIds = allShifts.map(s => s.id);
    
    // Get all transactions for these shifts
    const allTrxs = await db
      .select({
        shiftId: transactions.shiftId,
        totalAmount: transactions.totalAmount,
      })
      .from(transactions);

    const formattedData = allShifts.map(shift => {
      const shiftTrxs = allTrxs.filter(t => t.shiftId === shift.id);
      const totalSales = shiftTrxs.reduce((sum, t) => sum + t.totalAmount, 0);
      const totalTransactions = shiftTrxs.length;

      // Determine Shift Pagi / Malam based on openAt hour
      const openDate = new Date(shift.openAt);
      const hour = openDate.getHours();
      const shiftType = (hour >= 6 && hour < 15) ? "Shift Pagi" : "Shift Malam";

      return {
        id: shift.id,
        shiftType,
        userName: shift.userName,
        openAt: shift.openAt,
        closeAt: shift.closeAt,
        openingCash: shift.openingCash,
        closingCash: shift.closingCash,
        totalSales,
        totalTransactions,
        status: shift.status
      };
    });

    return NextResponse.json({ success: true, data: formattedData });
  } catch (error) {
    console.error("GET shift report API error:", error);
    return NextResponse.json(
      { success: false, message: "Gagal mengambil data laporan shift" },
      { status: 500 }
    );
  }
}
