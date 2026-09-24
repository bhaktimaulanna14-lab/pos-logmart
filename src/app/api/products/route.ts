/* eslint-disable */
// @ts-nocheck
import { NextResponse, NextRequest } from "next/server";
import { db } from "@/db";
import { products, categories } from "@/db/schema";
import { randomUUID } from "crypto";
import { eq, like, or, and } from "drizzle-orm";

// GET all products with category name, supports search and filter
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const q = searchParams.get("q");
    const categoryId = searchParams.get("categoryId");
    
    // Default to active only unless specified
    const activeStr = searchParams.get("active");
    const isActive = activeStr === "false" ? false : true;

    const conditions = [];
    conditions.push(eq(products.isActive, isActive));

    if (q) {
      conditions.push(
        or(
          like(products.name, `%${q}%`),
          eq(products.barcode, q)
        )
      );
    }
    
    if (categoryId) {
      conditions.push(eq(products.categoryId, categoryId));
    }

    const results = await db
      .select({
        id: products.id,
        barcode: products.barcode,
        name: products.name,
        categoryId: products.categoryId,
        categoryName: categories.name,
        price: products.price,
        cost: products.cost,
        stockQty: products.stockQty,
        minStock: products.minStock,
        isActive: products.isActive,
      })
      .from(products)
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .where(and(...conditions));

    return NextResponse.json({ success: true, data: results });
  } catch (error) {
    console.error("GET products API error:", error);
    return NextResponse.json(
      { success: false, message: "Gagal mengambil data produk" },
      { status: 500 }
    );
  }
}

// POST new product
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { barcode, name, categoryId, price, cost, stockQty, minStock } = body;

    if (!barcode || !name || !categoryId || price === undefined || cost === undefined) {
      return NextResponse.json({ success: false, message: "Data produk tidak lengkap" }, { status: 400 });
    }

    const newProduct = {
      id: "prod-" + randomUUID().substring(0, 8),
      barcode,
      name,
      categoryId,
      price: Number(price),
      cost: Number(cost),
      stockQty: Number(stockQty || 0),
      minStock: Number(minStock || 0),
      isActive: true,
    };

    await db.insert(products).values(newProduct);

    return NextResponse.json({ success: true, data: newProduct });
  } catch (error) {
    console.error("POST product API error:", error);
    return NextResponse.json(
      { success: false, message: "Gagal membuat produk (Mungkin barcode sudah digunakan)" },
      { status: 500 }
    );
  }
}
