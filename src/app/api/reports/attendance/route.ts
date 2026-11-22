import { NextResponse, NextRequest } from "next/server";
import { requireSession, errorResponse } from "@/lib/api-auth";
import { resolvePeriod } from "@/lib/report-period";
import { getAttendance } from "@/lib/attendance";

// Rekap absensi kasir (dari buka/tutup shift) untuk periode terpilih.
// ?period=hariIni|7hari|bulanIni|tahunIni atau ?startDate=&endDate= (WIB).
export async function GET(request: NextRequest) {
  try {
    const auth = await requireSession("manajer");
    if (auth.error) return auth.error;

    const period = resolvePeriod(request.nextUrl.searchParams);
    const data = await getAttendance(period);

    return NextResponse.json({ success: true, period: { key: period.key, label: period.label }, data });
  } catch (error) {
    return errorResponse(error, "Gagal mengambil rekap absensi", "Attendance API error:");
  }
}
