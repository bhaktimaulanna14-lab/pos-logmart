/* eslint-disable */
// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { shifts, users } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { generateExcelBuffer, generateExcelFilename } from "@/lib/excel-helper";
import { requireSession } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireSession("manajer");
    if (auth.error) return auth.error;

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

    const columns = [
      { header: "Nama Kasir", key: "userName", width: 25 },
      { header: "Waktu Buka", key: "openAt", width: 25 },
      { header: "Waktu Tutup", key: "closeAt", width: 25 },
      { header: "Modal Awal (Rp)", key: "openingCash", width: 20 },
      { header: "Uang Akhir (Rp)", key: "closingCash", width: 20 },
      { header: "Status", key: "status", width: 15 },
    ];

    const data = allShifts.map(s => ({
      userName: s.userName,
      openAt: new Date(s.openAt).toLocaleString("id-ID"),
      closeAt: s.closeAt ? new Date(s.closeAt).toLocaleString("id-ID") : "-",
      openingCash: s.openingCash,
      closingCash: s.closingCash || 0,
      status: s.status.toUpperCase(),
    }));

    const buffer = await generateExcelBuffer("Rekap Shift Kasir", columns, data);
    const filename = generateExcelFilename("Laporan_Rekap_Shift");

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Export Shifts Excel error:", error);
    return NextResponse.json(
      { success: false, message: "Gagal membuat laporan Excel rekap shift" },
      { status: 500 }
    );
  }
}
