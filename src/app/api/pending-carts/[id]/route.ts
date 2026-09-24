/* eslint-disable */
// @ts-nocheck
import { NextResponse, NextRequest } from "next/server";
import { db } from "@/db";
import { pendingCarts, pendingCartItems, products } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const id = (await params).id;
    const cart = await db.select().from(pendingCarts).where(eq(pendingCarts.id, id)).get();

    if (!cart) {
      return NextResponse.json({ success: false, message: "Keranjang tidak ditemukan" }, { status: 404 });
    }

    const items = await db.select({
      id: pendingCartItems.productId,
      qty: pendingCartItems.quantity,
      price: pendingCartItems.price,
      name: products.name,
      barcode: products.barcode,
      stock: products.stockQty
    })
    .from(pendingCartItems)
    .innerJoin(products, sql`${pendingCartItems.productId} = ${products.id}`)
    .where(eq(pendingCartItems.pendingCartId, id));

    return NextResponse.json({ 
      success: true, 
      data: {
        id: cart.id,
        name: cart.customerName,
        time: cart.createdAt,
        total: cart.totalAmount,
        items: items
      } 
    });
  } catch (error) {
    console.error("Get pending cart error:", error);
    return NextResponse.json({ success: false, message: "Gagal mengambil keranjang" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const id = (await params).id;
    // SQLite with Drizzle ORM will handle cascading deletes if foreign key PRAGMA is enabled.
    // However, it's safer to delete items manually first.
    await db.delete(pendingCartItems).where(eq(pendingCartItems.pendingCartId, id));
    await db.delete(pendingCarts).where(eq(pendingCarts.id, id));

    return NextResponse.json({ success: true, message: "Keranjang dihapus" });
  } catch (error) {
    console.error("Delete pending cart error:", error);
    return NextResponse.json({ success: false, message: "Gagal menghapus keranjang" }, { status: 500 });
  }
}
