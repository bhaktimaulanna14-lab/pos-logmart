/* eslint-disable */
// @ts-nocheck
import { NextResponse, NextRequest } from "next/server";
import { db } from "@/db";
import { pendingCarts, pendingCartItems, products } from "@/db/schema";
import { sql } from "drizzle-orm";
import { randomUUID } from "crypto";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { customerName, totalAmount, items, userId = "user-1" } = body;

    if (!items || items.length === 0) {
      return NextResponse.json({ success: false, message: "Keranjang kosong" }, { status: 400 });
    }

    const cartId = "PND-" + randomUUID().substring(0, 8).toUpperCase();

    const newPendingCart = {
      id: cartId,
      userId: userId,
      customerName: customerName || "Tanpa Nama",
      totalAmount: totalAmount,
    };

    await db.insert(pendingCarts).values(newPendingCart);

    const itemsToInsert = items.map((item: any) => ({
      id: randomUUID(),
      pendingCartId: cartId,
      productId: item.id,
      quantity: item.qty,
      price: item.price,
      subtotal: item.price * item.qty,
    }));

    for (const item of itemsToInsert) {
      await db.insert(pendingCartItems).values(item);
    }

    return NextResponse.json({ 
      success: true, 
      data: {
        id: cartId,
        message: "Keranjang berhasil dipending"
      }
    });
  } catch (error) {
    console.error("Save pending cart API error:", error);
    return NextResponse.json(
      { success: false, message: "Gagal menyimpan keranjang pending" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const carts = await db.select().from(pendingCarts);
    
    // For each cart, fetch its items and product details
    const cartsWithItems = await Promise.all(
      carts.map(async (cart) => {
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
        .where(sql`${pendingCartItems.pendingCartId} = ${cart.id}`);

        return {
          id: cart.id,
          name: cart.customerName,
          time: cart.createdAt,
          total: cart.totalAmount,
          items: items
        };
      })
    );

    return NextResponse.json({ success: true, data: cartsWithItems });
  } catch (error) {
    console.error("Get pending carts API error:", error);
    return NextResponse.json(
      { success: false, message: "Gagal mengambil daftar keranjang pending" },
      { status: 500 }
    );
  }
}
