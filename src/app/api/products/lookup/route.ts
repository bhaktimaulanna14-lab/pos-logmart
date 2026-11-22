import { NextResponse, NextRequest } from "next/server";
import { db } from "@/db";
import { products } from "@/db/schema";
import { like, or, eq, and } from "drizzle-orm";
import { requireSession } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireSession();
    if (auth.error) return auth.error;

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
        and(
          eq(products.isActive, true),
          or(
            eq(products.barcode, query),
            like(products.name, `%${query}%`)
          )
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
