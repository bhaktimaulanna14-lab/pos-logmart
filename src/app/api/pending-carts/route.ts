import { NextResponse, NextRequest } from "next/server";
import { db } from "@/db";
import { pendingCarts, pendingCartItems, products } from "@/db/schema";
import { eq, inArray, desc } from "drizzle-orm";
import { randomUUID } from "crypto";
import { requireSession, toInt, ApiError, errorResponse } from "@/lib/api-auth";

// Simpan keranjang yang ditahan (pending) milik kasir yang sedang login.
export async function POST(request: NextRequest) {
  try {
    const auth = await requireSession("kasir");
    if (auth.error) return auth.error;
    const { session } = auth;

    const body = await request.json();
    const { customerName, items } = body;

    if (!Array.isArray(items) || items.length === 0) {
      throw new ApiError(400, "Keranjang kosong");
    }

    const qtyByProduct = new Map<string, number>();
    for (const item of items) {
      const qty = toInt(item?.qty, 1);
      if (!item?.id || qty === null) throw new ApiError(400, "Jumlah barang tidak valid");
      qtyByProduct.set(item.id, (qtyByProduct.get(item.id) ?? 0) + qty);
    }

    const cartId = "PND-" + randomUUID().substring(0, 8).toUpperCase();

    db.transaction((tx) => {
      // Harga diambil dari database, bukan dari client.
      const rows = tx
        .select({ id: products.id, price: products.price })
        .from(products)
        .where(inArray(products.id, [...qtyByProduct.keys()]))
        .all();
      const priceMap = new Map(rows.map((r) => [r.id, r.price]));

      let totalAmount = 0;
      const lines = [];
      for (const [productId, qty] of qtyByProduct) {
        const price = priceMap.get(productId);
        if (price === undefined) throw new ApiError(400, "Ada barang yang tidak ditemukan");
        totalAmount += price * qty;
        lines.push({ productId, qty, price });
      }

      tx.insert(pendingCarts).values({
        id: cartId,
        userId: session.id,
        customerName: String(customerName || "").trim() || "Tanpa Nama",
        totalAmount,
        createdAt: new Date().toISOString(),
      }).run();

      for (const line of lines) {
        tx.insert(pendingCartItems).values({
          id: randomUUID(),
          pendingCartId: cartId,
          productId: line.productId,
          quantity: line.qty,
          price: line.price,
          subtotal: line.price * line.qty,
        }).run();
      }
    });

    return NextResponse.json({ success: true, data: { id: cartId, message: "Keranjang berhasil dipending" } });
  } catch (error) {
    return errorResponse(error, "Gagal menyimpan keranjang pending", "Save pending cart API error:");
  }
}

// Daftar keranjang pending milik kasir yang sedang login, dengan harga & stok terkini.
export async function GET() {
  try {
    const auth = await requireSession("kasir");
    if (auth.error) return auth.error;
    const { session } = auth;

    const carts = await db
      .select()
      .from(pendingCarts)
      .where(eq(pendingCarts.userId, session.id))
      .orderBy(desc(pendingCarts.createdAt));

    const cartsWithItems = await Promise.all(
      carts.map(async (cart) => {
        const items = await db
          .select({
            id: pendingCartItems.productId,
            qty: pendingCartItems.quantity,
            price: products.price,
            name: products.name,
            barcode: products.barcode,
            stock: products.stockQty,
          })
          .from(pendingCartItems)
          .innerJoin(products, eq(pendingCartItems.productId, products.id))
          .where(eq(pendingCartItems.pendingCartId, cart.id));

        return {
          id: cart.id,
          name: cart.customerName,
          time: cart.createdAt,
          total: items.reduce((sum, i) => sum + i.price * i.qty, 0),
          items,
        };
      })
    );

    return NextResponse.json({ success: true, data: cartsWithItems });
  } catch (error) {
    return errorResponse(error, "Gagal mengambil daftar keranjang pending", "Get pending carts API error:");
  }
}
