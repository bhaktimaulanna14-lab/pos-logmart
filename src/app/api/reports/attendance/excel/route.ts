import { NextRequest, NextResponse } from "next/server";
import { generateExcelBuffer, generateExcelFilename } from "@/lib/excel-helper";
import { requireSession, errorResponse } from "@/lib/api-auth";
import { resolvePeriod } from "@/lib/report-period";
import { getAttendance, formatDuration } from "@/lib/attendance";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireSession("manajer");
    if (auth.error) return auth.error;

    const period = resolvePeriod(request.nextUrl.searchParams);
    const rows = await getAttendance(period);

    const columns = [
      { header: "Nama Kasir", key: "userName", width: 25 },
      { header: "Total Shift", key: "totalShifts", width: 12 },
      { header: "Shift Masih Buka", key: "openShifts", width: 16 },
      { header: "Total Jam Kerja", key: "totalWorkTime", width: 20 },
      { header: "Rata-rata/Shift", key: "avgWorkTime", width: 20 },
    ];
    const data = rows.map((r) => ({
      userName: r.userName,
      totalShifts: r.totalShifts,
      openShifts: r.openShifts,
      totalWorkTime: formatDuration(r.totalWorkMs),
      avgWorkTime: formatDuration(r.avgWorkMs),
    }));

    const sheetName = `Absensi ${period.label}`.replace(/[\\/*?:[\]]/g, "-").slice(0, 31);
    const buffer = await generateExcelBuffer(sheetName, columns, data);
    const filename = generateExcelFilename("Laporan_Absensi");

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    return errorResponse(error, "Gagal membuat Excel Absensi", "Attendance Excel error:");
  }
}
