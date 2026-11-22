/* eslint-disable */
// @ts-nocheck
import { NextResponse, NextRequest } from "next/server";
import { db } from "@/db";
import { returns, products, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireSession } from "@/lib/api-auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireSession("manajer");
    if (auth.error) return auth.error;

    const returnId = (await params).id;

    const result = await db
      .select({
        id: returns.id,
        returnNumber: returns.returnNumber,
        transactionId: returns.transactionId,
        productId: returns.productId,
        productName: products.name,
        quantity: returns.quantity,
        reason: returns.reason,
        status: returns.status,
        processedBy: returns.processedBy,
        processedByName: users.name,
        createdAt: returns.createdAt,
        processedAt: returns.processedAt,
      })
      .from(returns)
      .leftJoin(products, eq(returns.productId, products.id))
      .leftJoin(users, eq(returns.processedBy, users.id))
      .where(eq(returns.id, returnId))
      .limit(1);

    if (result.length === 0) {
      return NextResponse.json(
        { success: false, message: "Retur tidak ditemukan" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: result[0] });
  } catch (error) {
    console.error("GET return detail API error:", error);
    return NextResponse.json(
      { success: false, message: "Gagal mengambil detail retur" },
      { status: 500 }
    );
  }
}
