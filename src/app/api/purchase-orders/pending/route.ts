import { NextResponse } from "next/server";
import { db } from "@/db";
import { purchaseOrders } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireSession } from "@/lib/api-auth";

export async function GET() {
  try {
    const auth = await requireSession("manajer");
    if (auth.error) return auth.error;

    const results = await db
      .select({
        id: purchaseOrders.id,
        poNumber: purchaseOrders.poNumber,
        supplierName: purchaseOrders.supplierName,
        orderDate: purchaseOrders.orderDate,
        status: purchaseOrders.status,
      })
      .from(purchaseOrders)
      .where(eq(purchaseOrders.status, "dipesan"));

    return NextResponse.json({ success: true, data: results });
  } catch (error) {
    console.error("GET pending PO API error:", error);
    return NextResponse.json(
      { success: false, message: "Gagal mengambil daftar PO" },
      { status: 500 }
    );
  }
}
