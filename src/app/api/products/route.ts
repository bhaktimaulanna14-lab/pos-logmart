import { NextResponse, NextRequest } from "next/server";
import { db } from "@/db";
import { products, categories, stockMovements } from "@/db/schema";
import { randomUUID } from "crypto";
import { requireSession, toInt, ApiError, errorResponse } from "@/lib/api-auth";
import { eq, like, or, and, sql, asc } from "drizzle-orm";

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

    // Pagination opsional: ?page=1&pageSize=50. Tanpa `page` = semua (perilaku lama).
    const pageParam = searchParams.get("page");
    const page = Math.max(1, Number(pageParam) || 1);
    const pageSize = Math.min(Math.max(Number(searchParams.get("pageSize")) || 50, 1), 200);
    const where = and(...conditions);

    const totalRow = await db
      .select({ n: sql<number>`count(*)` })
      .from(products)
      .where(where)
      .get();

    const query = db
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
      .where(where)
      .orderBy(asc(products.name));

    const results = pageParam ? await query.limit(pageSize).offset((page - 1) * pageSize) : await query;

    return NextResponse.json({
      success: true,
      data: results,
      total: Number(totalRow?.n ?? 0),
      page: pageParam ? page : 1,
      pageSize: pageParam ? pageSize : results.length,
    });
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
    const auth = await requireSession("manajer");
    if (auth.error) return auth.error;

    const body = await request.json();
    const barcode = String(body.barcode ?? "").trim();
    const name = String(body.name ?? "").trim();
    const { categoryId } = body;

    if (!barcode || !name || !categoryId) {
      throw new ApiError(400, "Barcode, nama, dan kategori wajib diisi");
    }

    const price = toInt(body.price, 0);
    const cost = toInt(body.cost, 0);
    const stockQty = toInt(body.stockQty ?? 0, 0);
    const minStock = toInt(body.minStock ?? 0, 0);
    if (price === null || cost === null) throw new ApiError(400, "Harga jual dan harga modal harus angka 0 atau lebih");
    if (stockQty === null || minStock === null) throw new ApiError(400, "Stok dan stok minimum harus angka 0 atau lebih");

    const category = await db.select({ id: categories.id }).from(categories).where(eq(categories.id, categoryId)).get();
    if (!category) throw new ApiError(400, "Kategori tidak ditemukan");

    const duplicate = await db.select({ id: products.id }).from(products).where(eq(products.barcode, barcode)).get();
    if (duplicate) throw new ApiError(409, `Barcode "${barcode}" sudah dipakai barang lain`);

    const newProduct = {
      id: "prod-" + randomUUID().substring(0, 8),
      barcode,
      name,
      categoryId,
      price,
      cost,
      stockQty,
      minStock,
      isActive: true,
    };

    db.transaction((tx) => {
      tx.insert(products).values(newProduct).run();
      if (stockQty > 0) {
        tx.insert(stockMovements).values({
          id: randomUUID(),
          productId: newProduct.id,
          type: "penyesuaian",
          qtyChange: stockQty,
          referenceId: "stok-awal",
        }).run();
      }
    });

    return NextResponse.json({ success: true, data: newProduct });
  } catch (error) {
    return errorResponse(error, "Gagal membuat produk", "POST product API error:");
  }
}
