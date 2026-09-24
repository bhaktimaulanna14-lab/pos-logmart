import { getSession } from "@/lib/session";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { shifts, users } from "@/db/schema";
import { eq, and, gte, lte } from "drizzle-orm";
import { generateExcelBuffer, generateExcelFilename } from "@/lib/excel-helper";

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    const role = session?.role;
    if (role !== "manajer" && role !== "admin") {
      return NextResponse.json({ success: false, message: "Akses ditolak" }, { status: 403 });
    }

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
        rekapMap.set(s.userId, { userName: s.userName, totalShifts: 0, totalWorkMs: 0 });
      }
      
      const record = rekapMap.get(s.userId);
      record.totalShifts += 1;
      record.totalWorkMs += durationMs;
    }

    const formatMsToHoursAndMinutes = (ms: number) => {
      const totalMins = Math.floor(ms / 60000);
      const hours = Math.floor(totalMins / 60);
      const mins = totalMins % 60;
      return `${hours} jam ${mins} menit`;
    };

    const data = Array.from(rekapMap.values()).map(r => {
      const avgMs = r.totalShifts > 0 ? Math.floor(r.totalWorkMs / r.totalShifts) : 0;
      return {
        userName: r.userName,
        totalShifts: r.totalShifts,
        totalWorkTime: formatMsToHoursAndMinutes(r.totalWorkMs),
        avgWorkTime: formatMsToHoursAndMinutes(avgMs),
      };
    });

    const columns = [
      { header: "Nama Kasir", key: "userName", width: 25 },
      { header: "Total Shift", key: "totalShifts", width: 15 },
      { header: "Total Jam Kerja", key: "totalWorkTime", width: 25 },
      { header: "Rata-rata/Shift", key: "avgWorkTime", width: 25 },
    ];

    const buffer = await generateExcelBuffer("Laporan Absensi", columns, data);
    const filename = generateExcelFilename("Laporan_Absensi");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return new NextResponse(buffer as any, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Attendance Excel error:", error);
    return NextResponse.json(
      { success: false, message: "Gagal membuat Excel Absensi" },
      { status: 500 }
    );
  }
}
