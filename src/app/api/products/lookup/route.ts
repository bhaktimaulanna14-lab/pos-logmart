/* eslint-disable */
// @ts-nocheck
import { NextResponse, NextRequest } from "next/server";
import { db } from "@/db";
import { products } from "@/db/schema";
import { like, or, eq } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get("q");

    if (!query) {
      return NextResponse.json({ success: true, data: [] });
    }

    const results = await db
      .select({
        id: products.id,
        barcode: products.barcode,
        name: products.name,
        price: products.price,
        stock: products.stockQty,
      })
      .from(products)
      .where(
        or(
          eq(products.barcode, query),
          like(products.name, `%${query}%`)
        )
      )
      .limit(10);

    return NextResponse.json({ success: true, data: results });
  } catch (error) {
    console.error("Product lookup API error:", error);
    return NextResponse.json(
      { success: false, message: "Gagal mencari barang" },
      { status: 500 }
    );
  }
}
