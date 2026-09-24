/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { db } from "@/db";
import { categories, products, purchaseOrders, purchaseOrderItems, returns, purchaseReturns, stockMovements } from "@/db/schema";
import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

export function importCategories(tx: any, rows: Record<string, unknown>[]) {
  let added = 0;
  for (const row of rows) {
    const name = String(row["Nama"] || "").trim();
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
    const catName = String(row["Kategori"] || "").trim();
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

export function importReturns(tx: any, rows: Record<string, unknown>[], userId: string) {
  let added = 0;
  
  for (const row of rows) {
    const jenis = String(row["Jenis Retur"] || "").trim();
    const barcode = String(row["SKU/Barcode"] || "").trim();
    const qty = Number(row["Jumlah"]) || 0;
    const ref = row["Referensi"] ? String(row["Referensi"]).trim() : null;
    
    if (!barcode || qty <= 0) continue;

    const prod = tx.select().from(products).where(eq(products.barcode, barcode)).limit(1).all();
    if (prod.length === 0) continue;
    
    if (jenis.toLowerCase() === "pembelian") {
      tx.insert(purchaseReturns).values({
        id: uuidv4(),
        returnNumber: `RTRP-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        supplierName: ref || "Unknown",
        productId: prod[0].id,
        quantity: qty,
        reason: "Impor data retur",
        status: "disetujui",
        processedBy: userId
      }).run();
      added++;
    } else {
      tx.insert(returns).values({
        id: uuidv4(),
        returnNumber: `RTR-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        transactionId: null, // cannot map ref strictly
        productId: prod[0].id,
        quantity: qty,
        reason: "Impor data retur",
        status: "disetujui",
        processedBy: userId
      }).run();
      added++;
    }
  }
  
  return { added, updated: 0 };
}