import { randomUUID } from "crypto";
import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { productBatches, products } from "@/db/schema";
import { toStoreDate } from "@/lib/report-period";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export const isValidDate = (s: unknown): s is string => {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + "T00:00:00Z");
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
};

/** Tanggal (WIB) hari ini + `days` hari, format YYYY-MM-DD. */
export const storeDatePlus = (days: number) => toStoreDate(new Date(Date.now() + days * 86_400_000));

/** Kadaluarsa terdekat dari stok bertanggal sebuah produk (null bila tidak ada). */
// Kolom ditulis lengkap: tanpa join, drizzle hanya menulis "id", yang di dalam subquery terbaca sebagai product_batches.id.
export const nearestExpirySql = sql<string | null>`(select min(pb.expiry_date) from product_batches pb where pb.product_id = "products"."id")`;

export type BatchUsage = { expiryDate: string; qty: number; source: "manual" | "po" };

/**
 * Kurangi stok bertanggal secara FIFO (kadaluarsa terdekat dulu). Dipanggil di setiap pengurangan stok.
 * Mengembalikan tanggal yang terpakai (disimpan penjualan agar pembatalan bisa mengembalikannya).
 */
export function consumeBatches(tx: Tx, productId: string, qty: number): BatchUsage[] {
  let left = qty;
  const used: BatchUsage[] = [];
  if (left <= 0) return used;
  const batches = tx.select().from(productBatches).where(eq(productBatches.productId, productId))
    .orderBy(asc(productBatches.expiryDate), asc(productBatches.createdAt)).all();
  for (const b of batches) {
    if (left <= 0) break;
    const take = Math.min(b.remainingQty, left);
    left -= take;
    used.push({ expiryDate: b.expiryDate, qty: take, source: b.source === "po" ? "po" : "manual" });
    if (take === b.remainingQty) tx.delete(productBatches).where(eq(productBatches.id, b.id)).run();
    else tx.update(productBatches).set({ remainingQty: b.remainingQty - take }).where(eq(productBatches.id, b.id)).run();
  }
  return used;
}

/**
 * Tambah stok bertanggal; digabung ke batch bertanggal sama bila sudah ada.
 * Dipanggil SETELAH stok produk diperbarui. Jumlahnya dibatasi agar total batch tidak melebihi stok
 * (mis. stok −5 lalu terima 10 → stok 5, yang dicatat bertanggal hanya 5).
 */
export function addBatch(tx: Tx, productId: string, expiryDate: string, qty: number, source: "manual" | "po", referenceId: string | null = null) {
  const room = tx.select({
    n: sql<number>`max(${products.stockQty}, 0) - coalesce((select sum(remaining_qty) from product_batches where product_id = ${productId}), 0)`,
  }).from(products).where(eq(products.id, productId)).get();
  qty = Math.min(qty, Number(room?.n ?? 0));
  if (qty <= 0) return;
  const same = tx.select({ id: productBatches.id }).from(productBatches)
    .where(and(eq(productBatches.productId, productId), eq(productBatches.expiryDate, expiryDate))).get();
  if (same) {
    tx.update(productBatches).set({ remainingQty: sql`${productBatches.remainingQty} + ${qty}` }).where(eq(productBatches.id, same.id)).run();
  } else {
    tx.insert(productBatches).values({ id: randomUUID(), productId, expiryDate, remainingQty: qty, source, referenceId }).run();
  }
}
