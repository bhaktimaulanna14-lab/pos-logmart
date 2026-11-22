import { eq } from "drizzle-orm";
import { db } from "@/db";
import { categories, products } from "@/db/schema";
import { ApiError, toInt } from "@/lib/api-auth";
import { PROMO_TYPES, type PromoType } from "@/lib/promotions";

const isYmd = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);

/** Validasi & normalisasi data promo dari body request (dipakai POST dan PUT). */
export function validatePromotionInput(body: Record<string, unknown>) {
  const name = String(body.name ?? "").trim();
  if (!name) throw new ApiError(400, "Nama promo wajib diisi");
  if (name.length > 80) throw new ApiError(400, "Nama promo terlalu panjang (maks. 80 karakter)");

  const type = body.type as PromoType;
  if (!PROMO_TYPES.includes(type)) throw new ApiError(400, "Jenis promo tidak valid");

  const targetType = body.targetType;
  if (targetType !== "produk" && targetType !== "kategori") throw new ApiError(400, "Target promo harus barang atau kategori");

  let productId: string | null = null;
  let categoryId: string | null = null;
  let targetPrice: number | null = null;
  if (targetType === "produk") {
    const p = db.select({ id: products.id, price: products.price }).from(products).where(eq(products.id, String(body.productId ?? ""))).get();
    if (!p) throw new ApiError(400, "Pilih barang untuk promo ini");
    productId = p.id;
    targetPrice = p.price;
  } else {
    const c = db.select({ id: categories.id }).from(categories).where(eq(categories.id, String(body.categoryId ?? ""))).get();
    if (!c) throw new ApiError(400, "Pilih kategori untuk promo ini");
    categoryId = c.id;
  }

  const value = toInt(body.value, 0);
  const minQty = toInt(body.minQty ?? 1, 1);
  if (value === null) throw new ApiError(400, "Nilai promo harus angka bulat");
  if (minQty === null) throw new ApiError(400, "Jumlah minimal harus angka bulat 1 atau lebih");

  if (type === "persen" && (value < 1 || value > 100)) throw new ApiError(400, "Diskon persen harus antara 1 dan 100");
  if (type === "nominal" && value < 1) throw new ApiError(400, "Potongan harus lebih dari 0");
  if (type === "grosir") {
    if (minQty < 2) throw new ApiError(400, "Harga grosir butuh jumlah minimal 2 atau lebih");
    if (value < 1) throw new ApiError(400, "Harga grosir harus lebih dari 0");
    if (targetPrice !== null && value >= targetPrice) {
      throw new ApiError(400, `Harga grosir harus lebih murah dari harga normal (Rp ${targetPrice.toLocaleString("id-ID")})`);
    }
  }
  if (type === "beli_gratis" && value < 1) throw new ApiError(400, "Jumlah gratis minimal 1");

  if (!isYmd(body.startDate) || !isYmd(body.endDate)) throw new ApiError(400, "Tanggal mulai dan selesai wajib diisi");
  if (body.endDate < body.startDate) throw new ApiError(400, "Tanggal selesai tidak boleh sebelum tanggal mulai");

  return {
    name,
    type,
    targetType: targetType as "produk" | "kategori",
    productId,
    categoryId,
    value,
    minQty: type === "grosir" || type === "beli_gratis" ? minQty : 1,
    startDate: body.startDate,
    endDate: body.endDate,
    isActive: body.isActive === undefined ? true : Boolean(body.isActive),
  };
}
