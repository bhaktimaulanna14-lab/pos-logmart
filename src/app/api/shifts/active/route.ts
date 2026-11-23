import { NextResponse } from "next/server";
import { db } from "@/db";
import { shifts } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { getSession } from "@/lib/session";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, data: null });
    }

    // Find active shift for this user
    const activeShifts = await db
      .select()
      .from(shifts)
      .where(and(eq(shifts.status, 'buka'), eq(shifts.userId, session.id)))
      .limit(1);

    if (activeShifts.length > 0) {
      return NextResponse.json({ success: true, data: activeShifts[0] });
    }

    return NextResponse.json({ success: false, data: null });
  } catch (error) {
    console.error("Active shift API error:", error);
    return NextResponse.json(
      { success: false, message: "Gagal mengambil data shift aktif" },
      { status: 500 }
    );
  }
}
