import { NextResponse, NextRequest } from "next/server";
import { db } from "@/db";
import { promotions, products, categories, transactionItems } from "@/db/schema";
import { desc, eq, sql } from "drizzle-orm";
import { randomUUID } from "crypto";
import { requireSession, errorResponse } from "@/lib/api-auth";
import { validatePromotionInput } from "@/lib/promotion-validation";

// Daftar promo + nama target + berapa kali sudah dipakai.
export async function GET() {
  try {
    const auth = await requireSession("manajer");
    if (auth.error) return auth.error;

    const rows = await db
      .select({
        id: promotions.id,
        name: promotions.name,
        type: promotions.type,
        targetType: promotions.targetType,
        productId: promotions.productId,
        categoryId: promotions.categoryId,
        productName: products.name,
        productBarcode: products.barcode,
        productPrice: products.price,
        productStock: products.stockQty,
        categoryName: categories.name,
        value: promotions.value,
        minQty: promotions.minQty,
        startDate: promotions.startDate,
        endDate: promotions.endDate,
        isActive: promotions.isActive,
        createdAt: promotions.createdAt,
        usedCount: sql<number>`(select count(*) from ${transactionItems} where ${transactionItems.promotionId} = ${promotions.id})`,
        discountGiven: sql<number>`(select coalesce(sum(${transactionItems.discount}), 0) from ${transactionItems} where ${transactionItems.promotionId} = ${promotions.id})`,
      })
      .from(promotions)
      .leftJoin(products, eq(promotions.productId, products.id))
      .leftJoin(categories, eq(promotions.categoryId, categories.id))
      .orderBy(desc(promotions.createdAt));

    return NextResponse.json({
      success: true,
      data: rows.map((r) => ({ ...r, usedCount: Number(r.usedCount), discountGiven: Number(r.discountGiven) })),
    });
  } catch (error) {
    return errorResponse(error, "Gagal mengambil daftar promo", "GET promotions error:");
  }
}

// Buat promo baru.
export async function POST(request: NextRequest) {
  try {
    const auth = await requireSession("manajer");
    if (auth.error) return auth.error;

    const input = validatePromotionInput(await request.json());
    const id = "promo-" + randomUUID().substring(0, 8);
    await db.insert(promotions).values({ id, ...input, createdBy: auth.session.id, createdAt: new Date().toISOString() });

    return NextResponse.json({ success: true, data: { id }, message: "Promo berhasil dibuat" });
  } catch (error) {
    return errorResponse(error, "Gagal membuat promo", "POST promotion error:");
  }
}
