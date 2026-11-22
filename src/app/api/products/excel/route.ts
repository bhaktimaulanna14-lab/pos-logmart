import { NextResponse, NextRequest } from "next/server";
import { db } from "@/db";
import { products, categories } from "@/db/schema";
import { eq, like, or, and, asc } from "drizzle-orm";
import { requireSession, errorResponse } from "@/lib/api-auth";
import { generateExcelBuffer, generateExcelFilename } from "@/lib/excel-helper";

// Unduh daftar stok barang (Excel). Filter sama dengan GET /api/products: ?q=, ?categoryId=, ?active=false.
// Khusus manajer karena berisi harga modal.
export async function GET(request: NextRequest) {
  try {
    const auth = await requireSession("manajer");
    if (auth.error) return auth.error;

    const searchParams = request.nextUrl.searchParams;
    const q = searchParams.get("q");
    const categoryId = searchParams.get("categoryId");
    const isActive = searchParams.get("active") !== "false";

    const conditions = [eq(products.isActive, isActive)];
    if (q) conditions.push(or(like(products.name, `%${q}%`), eq(products.barcode, q))!);
    if (categoryId) conditions.push(eq(products.categoryId, categoryId));

    const rows = await db
      .select({
        barcode: products.barcode,
        name: products.name,
        categoryName: categories.name,
        cost: products.cost,
        price: products.price,
        stockQty: products.stockQty,
        minStock: products.minStock,
        isActive: products.isActive,
      })
      .from(products)
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .where(and(...conditions))
      .orderBy(asc(categories.name), asc(products.name));

    const columns = [
      { header: "Barcode", key: "barcode", width: 18 },
      { header: "Nama Barang", key: "name", width: 38 },
      { header: "Kategori", key: "categoryName", width: 20 },
      { header: "Harga Modal (Rp)", key: "cost", width: 16 },
      { header: "Harga Jual (Rp)", key: "price", width: 16 },
      { header: "Stok", key: "stockQty", width: 8 },
      { header: "Stok Minimum", key: "minStock", width: 13 },
      { header: "Status Stok", key: "stockStatus", width: 14 },
      { header: "Nilai Stok (Rp)", key: "stockValue", width: 18 },
      { header: "Status Barang", key: "active", width: 14 },
    ];

    const data = rows.map((r) => ({
      barcode: r.barcode,
      name: r.name,
      categoryName: r.categoryName ?? "-",
      cost: r.cost,
      price: r.price,
      stockQty: r.stockQty,
      minStock: r.minStock,
      stockStatus: r.stockQty < 0 ? "Minus" : r.stockQty === 0 ? "Habis" : r.stockQty <= r.minStock ? "Menipis" : "Aman",
      // Stok minus tidak dihitung sebagai nilai negatif.
      stockValue: Math.max(r.stockQty, 0) * r.cost,
      active: r.isActive ? "Aktif" : "Nonaktif",
    }));

    const totalValue = data.reduce((sum, r) => sum + r.stockValue, 0);
    const totalQty = data.reduce((sum, r) => sum + Math.max(r.stockQty, 0), 0);
    data.push({
      barcode: "",
      name: `TOTAL (${rows.length} barang)`,
      categoryName: "",
      cost: null as unknown as number,
      price: null as unknown as number,
      stockQty: totalQty,
      minStock: null as unknown as number,
      stockStatus: "",
      stockValue: totalValue,
      active: "",
    });

    const buffer = await generateExcelBuffer("Stok Barang", columns, data);
    const filename = generateExcelFilename("Stok_Barang");

    return new NextResponse(buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    return errorResponse(error, "Gagal membuat Excel stok barang", "Products Excel error:");
  }
}
