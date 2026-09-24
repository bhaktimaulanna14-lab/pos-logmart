/* eslint-disable */
// @ts-nocheck
import { NextResponse, NextRequest } from "next/server";
import { db } from "@/db";
import { products } from "@/db/schema";
import { eq } from "drizzle-orm";

// PUT update product
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const id = (await params).id;
    const body = await request.json();
    const { barcode, name, categoryId, price, cost, stockQty, minStock, isActive } = body;

    const updateData: any = {};
    if (barcode !== undefined) updateData.barcode = barcode;
    if (name !== undefined) updateData.name = name;
    if (categoryId !== undefined) updateData.categoryId = categoryId;
    if (price !== undefined) updateData.price = Number(price);
    if (cost !== undefined) updateData.cost = Number(cost);
    if (stockQty !== undefined) updateData.stockQty = Number(stockQty);
    if (minStock !== undefined) updateData.minStock = Number(minStock);
    if (isActive !== undefined) updateData.isActive = isActive;

    if (Object.keys(updateData).length === 0) {
       return NextResponse.json({ success: false, message: "Tidak ada data untuk diupdate" }, { status: 400 });
    }

    await db
      .update(products)
      .set(updateData)
      .where(eq(products.id, id));

    return NextResponse.json({ success: true, message: "Produk berhasil diperbarui" });
  } catch (error) {
    console.error("PUT product API error:", error);
    return NextResponse.json(
      { success: false, message: "Gagal memperbarui produk" },
      { status: 500 }
    );
  }
}

// DELETE product (or soft delete)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const id = (await params).id;
    
    // We do soft delete for products so we don't break transaction history
    await db
      .update(products)
      .set({ isActive: false })
      .where(eq(products.id, id));

    return NextResponse.json({ success: true, message: "Produk berhasil dinonaktifkan" });
  } catch (error) {
    console.error("DELETE product API error:", error);
    return NextResponse.json(
      { success: false, message: "Gagal menonaktifkan produk" },
      { status: 500 }
    );
  }
}
