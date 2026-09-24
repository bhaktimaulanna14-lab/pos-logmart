/* eslint-disable */
// @ts-nocheck
import { NextResponse } from "next/server";
import { db } from "@/db";
import { products } from "@/db/schema";
import { sql } from "drizzle-orm";

export async function GET() {
  try {
    const lowStockItems = await db
      .select({
        id: products.id,
        name: products.name,
        stock: products.stockQty,
        min: products.minStock,
      })
      .from(products)
      .where(sql`stock_qty <= min_stock AND is_active = 1`)
      .limit(6);

    return NextResponse.json({
      success: true,
      data: lowStockItems,
      
      _fallback: [
        { name: "Minyak Goreng Bimoli 2L", stock: 3, min: 10 },
        { name: "Indomie Goreng", stock: 12, min: 40 },
        { name: "Beras Rojolele 5kg", stock: 2, min: 5 },
        { name: "Gula Pasir Gulaku 1kg", stock: 4, min: 15 },
      ]
    });
  } catch (error) {
    console.error("Low stock API error:", error);
    return NextResponse.json(
      { success: false, message: "Gagal mengambil data stok" },
      { status: 500 }
    );
  }
}
