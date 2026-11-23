/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { db } from "@/db";
import { categories, products, purchaseOrders, purchaseOrderItems, returns, stockMovements, transactions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { randomUUID as uuidv4 } from "crypto";
import categoryMap from "./category-map.json";
import { consumeBatches } from "@/lib/batches";

// Nama kategori lama/beda ejaan dari Excel diarahkan ke kategori baku agar tidak muncul kategori dobel lagi.
const normCat = (s: string) => s.trim().replace(/\s+/g, " ").toUpperCase();
const categoryAlias = new Map(Object.entries(categoryMap).flatMap(([t, olds]) => [t, ...olds].map((o) => [normCat(o), t] as const)));
const canonicalCategory = (name: string) => categoryAlias.get(normCat(name)) ?? name;

export function importCategories(tx: any, rows: Record<string, unknown>[]) {
  let added = 0;
  for (const row of rows) {
    const name = canonicalCategory(String(row["Nama"] || "").trim());
    const desc = String(row["Keterangan"] || "").trim();
    
    if (!name) continue;

    const existing = tx.select().from(categories).where(eq(categories.name, name)).limit(1).all();
    
    if (existing.length === 0) {
      tx.insert(categories).values({
        id: uuidv4(),
        name,
        description: desc
      }).run();
      added++;
    }
  }
  return { added, updated: 0 };
}

export function importProducts(tx: any, rows: Record<string, unknown>[]) {
  let added = 0;
  let updated = 0;

  const allCats = tx.select().from(categories).all();
  const catMap = new Map<string, any>();
  for (const c of allCats) {
    catMap.set(c.name.toLowerCase().replace(/\s+/g, ''), c);
  }

  for (const row of rows) {
    const barcode = String(row["SKU/Barcode"] || "").trim();
    const name = String(row["Nama"] || "").trim();
    const catName = canonicalCategory(String(row["Kategori"] || "").trim());
    const price = Number(row["Harga"]) || 0;
    const cost = row["Modal"] ? Number(row["Modal"]) : 0;
    const stockQty = row["Stok"] ? Number(row["Stok"]) : 0;
    
    if (!barcode || !name) continue;

    const catKey = catName.toLowerCase().replace(/\s+/g, '');
    let catId = "";
    if (catKey && catMap.has(catKey)) {
      catId = catMap.get(catKey).id;
    } else if (catKey) {
      catId = uuidv4();
      const newCat = { id: catId, name: catName, description: "" };
      tx.insert(categories).values(newCat).run();
      catMap.set(catKey, newCat);
    } else {
      continue; // Requires category
    }
    
    const existing = tx.select().from(products).where(eq(products.barcode, barcode)).limit(1).all();
    let productId = "";
    let oldStock = 0;
    if (existing.length > 0) {
      productId = existing[0].id;
      oldStock = existing[0].stockQty || 0;
      tx.update(products).set({
        name,
        categoryId: catId,
        price,
        cost,
        stockQty,
      }).where(eq(products.id, productId)).run();
      updated++;
    } else {
      productId = uuidv4();
      tx.insert(products).values({
        id: productId,
        barcode,
        name,
        categoryId: catId,
        price,
        cost,
        stockQty,
      }).run();
      added++;
    }
    
    const diff = stockQty - oldStock;
    if (diff < 0) consumeBatches(tx, productId, -diff);
    if (diff !== 0) {
      tx.insert(stockMovements).values({
        id: uuidv4(),
        productId,
        type: "penyesuaian",
        qtyChange: diff,
        referenceId: "import-" + Date.now(),
      }).run();
    }
  }
  return { added, updated };
}

export function importPurchaseOrders(tx: any, rows: Record<string, unknown>[], userId: string) {
  let added = 0;
  
  const poMap = new Map<string, any>();
  for (const row of rows) {
    const poNumber = String(row["Nomor PO"] || "").trim();
    if (!poNumber) continue;

    if (!poMap.has(poNumber)) {
      let dateStr = new Date().toISOString();
      const rawDate = row["Tanggal"];
      if (rawDate) {
        if (rawDate instanceof Date) {
          dateStr = rawDate.toISOString();
        } else {
          dateStr = String(rawDate);
        }
      }

      poMap.set(poNumber, {
        supplier: String(row["Pemasok"] || "Unknown").trim(),
        date: dateStr,
        items: []
      });
    }
    
    const barcode = String(row["SKU/Barcode"] || "").trim();
    if (barcode) {
      poMap.get(poNumber).items.push({
        barcode,
        qty: Number(row["Jumlah"]) || 0
      });
    }
  }
  
  for (const [poNumber, data] of poMap.entries()) {
    const existing = tx.select().from(purchaseOrders).where(eq(purchaseOrders.poNumber, poNumber)).limit(1).all();
    if (existing.length === 0) {
      const poId = uuidv4();
      tx.insert(purchaseOrders).values({
        id: poId,
        poNumber,
        supplierName: data.supplier,
        orderDate: data.date,
        status: "dipesan",
        createdBy: userId,
      }).run();
      added++;
      
      for (const item of data.items) {
        if (item.qty <= 0) continue;
        const prod = tx.select().from(products).where(eq(products.barcode, item.barcode)).limit(1).all();
        if (prod.length > 0) {
          tx.insert(purchaseOrderItems).values({
            id: uuidv4(),
            purchaseOrderId: poId,
            productId: prod[0].id,
            quantity: item.qty
          }).run();
        }
      }
    }
  }
  
  return { added, updated: 0 };
}

/**
 * Impor retur sebagai PENGAJUAN (status "pending") — stok baru berubah setelah disetujui di menu Retur,
 * sama seperti retur yang dibuat lewat form. Retur pembelian disimpan di tabel returns dengan
 * penanda "[SUPPLIER] <nama>" agar bisa disetujui/ditolak dari menu Retur.
 * Kolom "Referensi": nomor transaksi (TRX-...) untuk retur penjualan, nama supplier untuk retur pembelian.
 */
export function importReturns(tx: any, rows: Record<string, unknown>[], _userId: string) {
  let added = 0;

  for (const row of rows) {
    const jenis = String(row["Jenis Retur"] || "").trim().toLowerCase();
    const barcode = String(row["SKU/Barcode"] || "").trim();
    const qty = Number(row["Jumlah"]) || 0;
    const ref = row["Referensi"] ? String(row["Referensi"]).trim() : "";

    if (!barcode || qty <= 0) continue;

    const prod = tx.select().from(products).where(eq(products.barcode, barcode)).limit(1).all();
    if (prod.length === 0) continue;

    let transactionId: string | null = null;
    let reason = "Impor data retur";
    if (jenis === "pembelian") {
      reason = `[SUPPLIER] ${ref || "Tanpa nama"} | Impor data retur`;
    } else if (ref) {
      const trx = tx.select({ id: transactions.id }).from(transactions).where(eq(transactions.transactionNumber, ref)).limit(1).all();
      if (trx.length > 0) transactionId = trx[0].id;
      else reason = `Impor data retur (ref: ${ref})`;
    }

    tx.insert(returns).values({
      id: uuidv4(),
      returnNumber: `RTR-${Date.now()}-${added}`,
      transactionId,
      productId: prod[0].id,
      quantity: qty,
      reason,
      status: "pending",
      createdAt: new Date().toISOString(),
    }).run();
    added++;
  }

  return { added, updated: 0 };
}
