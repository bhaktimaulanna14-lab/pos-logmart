import { NextResponse, NextRequest } from "next/server";
import { db } from "@/db";
import { requireSession, toInt, ApiError, errorResponse } from "@/lib/api-auth";
import { priceCart } from "@/lib/promotions";

// Pratinjau harga keranjang (termasuk promo aktif) untuk layar kasir.
// Perhitungan sama persis dengan saat checkout (POST /api/transactions).
export async function POST(request: NextRequest) {
  try {
    const auth = await requireSession();
    if (auth.error) return auth.error;

    const { items } = await request.json();
    if (!Array.isArray(items)) throw new ApiError(400, "Format keranjang tidak valid");

    const qtyByProduct = new Map<string, number>();
    for (const item of items) {
      const qty = toInt(item?.qty, 1);
      if (!item?.id || qty === null) continue;
      qtyByProduct.set(item.id, (qtyByProduct.get(item.id) ?? 0) + qty);
    }

    const priced = priceCart(db, qtyByProduct);
    return NextResponse.json({
      success: true,
      data: {
        lines: priced.lines.map((l) => ({
          id: l.productId,
          qty: l.qty,
          price: l.price,
          discount: l.discount,
          subtotal: l.subtotal,
          promotionName: l.promotionName,
          promotionNote: l.promotionNote,
        })),
        grossTotal: priced.grossTotal,
        discountTotal: priced.discountTotal,
        total: priced.total,
      },
    });
  } catch (error) {
    return errorResponse(error, "Gagal menghitung harga keranjang", "Checkout preview error:");
  }
}
