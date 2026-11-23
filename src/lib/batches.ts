import { randomUUID } from "crypto";
import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { productBatches } from "@/db/schema";
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

/** Kurangi stok bertanggal secara FIFO (kadaluarsa terdekat dulu). Dipanggil di setiap pengurangan stok. */
export function consumeBatches(tx: Tx, productId: string, qty: number) {
  let left = qty;
  if (left <= 0) return;
  const batches = tx.select().from(productBatches).where(eq(productBatches.productId, productId))
    .orderBy(asc(productBatches.expiryDate), asc(productBatches.createdAt)).all();
  for (const b of batches) {
    if (left <= 0) break;
    const take = Math.min(b.remainingQty, left);
    left -= take;
    if (take === b.remainingQty) tx.delete(productBatches).where(eq(productBatches.id, b.id)).run();
    else tx.update(productBatches).set({ remainingQty: b.remainingQty - take }).where(eq(productBatches.id, b.id)).run();
  }
}

/** Tambah stok bertanggal; digabung ke batch bertanggal sama bila sudah ada. */
export function addBatch(tx: Tx, productId: string, expiryDate: string, qty: number, source: "manual" | "po", referenceId: string | null = null) {
  if (qty <= 0) return;
  const same = tx.select({ id: productBatches.id }).from(productBatches)
    .where(and(eq(productBatches.productId, productId), eq(productBatches.expiryDate, expiryDate))).get();
  if (same) {
    tx.update(productBatches).set({ remainingQty: sql`${productBatches.remainingQty} + ${qty}` }).where(eq(productBatches.id, same.id)).run();
  } else {
    tx.insert(productBatches).values({ id: randomUUID(), productId, expiryDate, remainingQty: qty, source, referenceId }).run();
  }
}
