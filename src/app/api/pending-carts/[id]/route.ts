import { NextResponse, NextRequest } from "next/server";
import { db } from "@/db";
import { pendingCarts, pendingCartItems, products } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { requireSession, ApiError, errorResponse } from "@/lib/api-auth";

type Params = { params: Promise<{ id: string }> };

// Ambil satu keranjang pending (hanya milik kasir yang login), dengan harga & stok terkini.
export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const auth = await requireSession("kasir");
    if (auth.error) return auth.error;
    const { session } = auth;
    const id = (await params).id;

    const cart = await db
      .select()
      .from(pendingCarts)
      .where(and(eq(pendingCarts.id, id), eq(pendingCarts.userId, session.id)))
      .get();
    if (!cart) throw new ApiError(404, "Keranjang tidak ditemukan");

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
      .where(eq(pendingCartItems.pendingCartId, id));

    return NextResponse.json({
      success: true,
      data: {
        id: cart.id,
        name: cart.customerName,
        time: cart.createdAt,
        total: items.reduce((sum, i) => sum + i.price * i.qty, 0),
        items,
      },
    });
  } catch (error) {
    return errorResponse(error, "Gagal mengambil keranjang", "Get pending cart error:");
  }
}

// Hapus keranjang pending milik kasir yang login.
export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const auth = await requireSession("kasir");
    if (auth.error) return auth.error;
    const { session } = auth;
    const id = (await params).id;

    const deleted = db.transaction((tx) => {
      const cart = tx
        .select({ id: pendingCarts.id })
        .from(pendingCarts)
        .where(and(eq(pendingCarts.id, id), eq(pendingCarts.userId, session.id)))
        .get();
      if (!cart) return false;
      tx.delete(pendingCartItems).where(eq(pendingCartItems.pendingCartId, id)).run();
      tx.delete(pendingCarts).where(eq(pendingCarts.id, id)).run();
      return true;
    });
    if (!deleted) throw new ApiError(404, "Keranjang tidak ditemukan");

    return NextResponse.json({ success: true, message: "Keranjang dihapus" });
  } catch (error) {
    return errorResponse(error, "Gagal menghapus keranjang", "Delete pending cart error:");
  }
}
