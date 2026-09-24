/* eslint-disable */
// @ts-nocheck
import { NextResponse, NextRequest } from "next/server";
import { db } from "@/db";
import { shifts } from "@/db/schema";
import { randomUUID } from "crypto";
import { eq, and } from "drizzle-orm";
import { getSession } from "@/lib/session";

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }
    if (session.role !== "kasir") {
      return NextResponse.json({ success: false, message: "Hanya role kasir yang dapat membuka shift (absen masuk)" }, { status: 403 });
    }

    const body = await request.json();
    const { openingCash } = body;
    const userId = session.id;

    if (openingCash === undefined) {
      return NextResponse.json({ success: false, message: "Modal awal diperlukan" }, { status: 400 });
    }

    const activeShifts = await db
      .select()
      .from(shifts)
      .where(and(eq(shifts.userId, userId), eq(shifts.status, "buka")))
      .limit(1);

    if (activeShifts.length > 0) {
      return NextResponse.json({ success: true, data: activeShifts[0], message: "Shift sudah terbuka" });
    }

    const shiftId = "SHIFT-" + randomUUID().substring(0, 8);
    
    const newShift = {
      id: shiftId,
      userId: userId,
      openAt: new Date().toISOString(),
      openingCash: Number(openingCash),
      status: "buka",
    };

    await db.insert(shifts).values(newShift);

    return NextResponse.json({ success: true, data: newShift });
  } catch (error) {
    console.error("Open shift API error:", error);
    return NextResponse.json(
      { success: false, message: "Gagal membuka shift" },
      { status: 500 }
    );
  }
}
