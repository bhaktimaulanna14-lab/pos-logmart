import { NextResponse, NextRequest } from "next/server";
import { db } from "@/db";
import { shifts } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getSession } from "@/lib/session";

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { closingCash, shiftId } = body;
    const userId = session.id;

    if (closingCash === undefined) {
      return NextResponse.json({ success: false, message: "Kas penutupan diperlukan" }, { status: 400 });
    }

    // Find open shift
    const conditions = [eq(shifts.status, "buka")];
    if (shiftId) {
      conditions.push(eq(shifts.id, shiftId));
    } else {
      conditions.push(eq(shifts.userId, userId));
    }

    const openShifts = await db
      .select()
      .from(shifts)
      .where(and(...conditions));

    if (openShifts.length === 0) {
      return NextResponse.json({ success: false, message: "Tidak ada shift terbuka yang ditemukan" }, { status: 404 });
    }

    const currentShift = openShifts[0];

    await db
      .update(shifts)
      .set({
        closeAt: new Date().toISOString(),
        closingCash: Number(closingCash),
        status: "tutup",
      })
      .where(eq(shifts.id, currentShift.id));

    return NextResponse.json({ success: true, message: "Shift berhasil ditutup" });
  } catch (error) {
    console.error("Close shift API error:", error);
    return NextResponse.json(
      { success: false, message: "Gagal menutup shift" },
      { status: 500 }
    );
  }
}
