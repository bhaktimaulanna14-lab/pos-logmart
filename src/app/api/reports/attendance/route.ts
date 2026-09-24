import { NextResponse, NextRequest } from "next/server";
import { db } from "@/db";
import { shifts, users } from "@/db/schema";
import { eq, and, gte, lte } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const conditions: any[] = [eq(users.role, "kasir")];

    if (startDate) {
      conditions.push(gte(shifts.openAt, new Date(startDate).toISOString()));
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      conditions.push(lte(shifts.openAt, end.toISOString()));
    }

    const closedShifts = await db
      .select({
        id: shifts.id,
        openAt: shifts.openAt,
        closeAt: shifts.closeAt,
        userId: shifts.userId,
        userName: users.name,
      })
      .from(shifts)
      .innerJoin(users, eq(shifts.userId, users.id))
      .where(and(eq(shifts.status, "tutup"), ...conditions));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rekapMap = new Map<string, any>();

    for (const s of closedShifts) {
      if (!s.closeAt) continue;
      
      const openTime = new Date(s.openAt).getTime();
      const closeTime = new Date(s.closeAt).getTime();
      const durationMs = closeTime - openTime;
      
      if (!rekapMap.has(s.userId)) {
        rekapMap.set(s.userId, { userId: s.userId, userName: s.userName, totalShifts: 0, totalWorkMs: 0 });
      }
      
      const record = rekapMap.get(s.userId);
      record.totalShifts += 1;
      record.totalWorkMs += durationMs;
    }

    const data = Array.from(rekapMap.values()).map(r => ({
      userId: r.userId,
      userName: r.userName,
      totalShifts: r.totalShifts,
      totalWorkMs: r.totalWorkMs,
      avgWorkMs: r.totalShifts > 0 ? Math.floor(r.totalWorkMs / r.totalShifts) : 0
    }));

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("Attendance API error:", error);
    return NextResponse.json({ success: false, message: "Gagal mengambil rekap absensi" }, { status: 500 });
  }
}
