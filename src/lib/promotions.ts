import { and, eq, gte, inArray, lte } from "drizzle-orm";
import { db } from "@/db";
import { products, promotions } from "@/db/schema";
import { toStoreDate } from "@/lib/report-period";

export const PROMO_TYPES = ["persen", "nominal", "grosir", "beli_gratis"] as const;
export type PromoType = (typeof PROMO_TYPES)[number];

export const PROMO_TYPE_LABEL: Record<PromoType, string> = {
  persen: "Diskon persen",
  nominal: "Potongan nominal",
  grosir: "Harga grosir",
  beli_gratis: "Beli X gratis Y",
};

export type Promotion = typeof promotions.$inferSelect;

export type PricedLine = {
  productId: string;
  name: string;
  qty: number;
  price: number;
  stock: number;
  isActive: boolean;
  discount: number;
  subtotal: number;
  promotionId: string | null;
  promotionName: string | null;
  /** Penjelasan singkat, mis. "Beli 2 gratis 1 (gratis 1)". */
  promotionNote: string | null;
};

/** Potongan (rupiah) yang diberikan satu promo untuk satu baris keranjang. 0 = tidak berlaku. */
export function discountFor(promo: Pick<Promotion, "type" | "value" | "minQty">, price: number, qty: number): { amount: number; note: string } {
  const value = promo.value;
  switch (promo.type as PromoType) {
    case "persen": {
      if (value <= 0) return { amount: 0, note: "" };
      const pct = Math.min(value, 100);
      return { amount: Math.round((price * qty * pct) / 100), note: `Diskon ${pct}%` };
    }
    case "nominal": {
      const per = Math.min(Math.max(value, 0), price);
      return { amount: per * qty, note: `Potong Rp ${per.toLocaleString("id-ID")}/item` };
    }
    case "grosir": {
      if (qty < promo.minQty || value >= price || value < 0) return { amount: 0, note: "" };
      return { amount: (price - value) * qty, note: `Grosir min. ${promo.minQty}: Rp ${value.toLocaleString("id-ID")}/item` };
    }
    case "beli_gratis": {
      const buy = Math.max(promo.minQty, 1);
      const free = Math.max(value, 1);
      const freeItems = Math.floor(qty / (buy + free)) * free;
      if (freeItems === 0) return { amount: 0, note: "" };
      return { amount: freeItems * price, note: `Beli ${buy} gratis ${free} (gratis ${freeItems})` };
    }
    default:
      return { amount: 0, note: "" };
  }
}

type DbOrTx = Pick<typeof db, "select">;

/** Promo aktif hari ini (WIB) untuk barang/kategori yang diberikan. */
export function activePromotionsFor(conn: DbOrTx, productIds: string[], categoryIds: string[], now = new Date()): Promotion[] {
  if (productIds.length === 0) return [];
  const today = toStoreDate(now);
  const rows = conn
    .select()
    .from(promotions)
    .where(and(eq(promotions.isActive, true), lte(promotions.startDate, today), gte(promotions.endDate, today)))
    .all();
  const pSet = new Set(productIds);
  const cSet = new Set(categoryIds);
  return rows.filter((p) =>
    p.targetType === "produk" ? !!p.productId && pSet.has(p.productId) : !!p.categoryId && cSet.has(p.categoryId)
  );
}

/**
 * Hitung harga keranjang di SERVER: harga dari database, promo terbaik per baris (tidak ditumpuk).
 * Bisa dipanggil di dalam db.transaction (berikan `tx`).
 */
export function priceCart(conn: DbOrTx, qtyByProduct: Map<string, number>, now = new Date()) {
  const ids = [...qtyByProduct.keys()];
  const rows = ids.length
    ? conn
        .select({
          id: products.id,
          name: products.name,
          price: products.price,
          stockQty: products.stockQty,
          isActive: products.isActive,
          categoryId: products.categoryId,
        })
        .from(products)
        .where(inArray(products.id, ids))
        .all()
    : [];
  const byId = new Map(rows.map((r) => [r.id, r]));
  const promos = activePromotionsFor(conn, ids, [...new Set(rows.map((r) => r.categoryId))], now);

  const lines: PricedLine[] = [];
  const missing: string[] = [];
  for (const [productId, qty] of qtyByProduct) {
    const p = byId.get(productId);
    if (!p) {
      missing.push(productId);
      continue;
    }
    const gross = p.price * qty;
    let best: { promo: Promotion; amount: number; note: string } | null = null;
    for (const promo of promos) {
      const applies = promo.targetType === "produk" ? promo.productId === p.id : promo.categoryId === p.categoryId;
      if (!applies) continue;
      const { amount, note } = discountFor(promo, p.price, qty);
      const capped = Math.min(amount, gross);
      if (capped > 0 && (!best || capped > best.amount)) best = { promo, amount: capped, note };
    }
    lines.push({
      productId,
      name: p.name,
      qty,
      price: p.price,
      stock: p.stockQty,
      isActive: p.isActive,
      discount: best?.amount ?? 0,
      subtotal: gross - (best?.amount ?? 0),
      promotionId: best?.promo.id ?? null,
      promotionName: best?.promo.name ?? null,
      promotionNote: best?.note ?? null,
    });
  }

  const grossTotal = lines.reduce((a, l) => a + l.price * l.qty, 0);
  const discountTotal = lines.reduce((a, l) => a + l.discount, 0);
  return { lines, missing, grossTotal, discountTotal, total: grossTotal - discountTotal };
}
