import { NextResponse, NextRequest } from "next/server";
import { db } from "@/db";
import { returns, products, stockMovements, users, transactions, transactionItems } from "@/db/schema";
import { eq, desc, like, and, or, sql } from "drizzle-orm";
import { randomUUID } from "crypto";
import { consumeBatches } from "@/lib/batches";
import { requireSession, toInt, ApiError, errorResponse } from "@/lib/api-auth";

// GET: List all returns
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const q = searchParams.get("q");
    const status = searchParams.get("status");

    const conditions = [];

    if (q) {
      conditions.push(
        like(returns.returnNumber, `%${q}%`)
      );
    }

    if (status && status !== "semua") {
      conditions.push(eq(returns.status, status));
    }

    const results = await db
      .select({
        id: returns.id,
        returnNumber: returns.returnNumber,
        transactionId: returns.transactionId,
        productId: returns.productId,
        productName: products.name,
        quantity: returns.quantity,
        reason: returns.reason,
        status: returns.status,
        processedBy: returns.processedBy,
        processedByName: users.name,
        createdAt: returns.createdAt,
        processedAt: returns.processedAt,
      })
      .from(returns)
      .leftJoin(products, eq(returns.productId, products.id))
      .leftJoin(users, eq(returns.processedBy, users.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(returns.createdAt));

    const mappedResults = results.map(row => {
      let supplierName = null;
      let cleanReason = row.reason;
      if (row.reason && row.reason.startsWith("[SUPPLIER]")) {
        const parts = row.reason.split(" | ");
        supplierName = parts[0].replace("[SUPPLIER] ", "").trim();
        cleanReason = parts.length > 1 ? parts.slice(1).join(" | ") : row.reason;
      }
      return {
        ...row,
        supplierName,
        reason: cleanReason,
        returnType: supplierName ? "pembelian" : "penjualan"
      };
    });

    return NextResponse.json({ success: true, data: mappedResults });
  } catch (error) {
    console.error("GET returns API error:", error);
    return NextResponse.json(
      { success: false, message: "Gagal mengambil data retur" },
      { status: 500 }
    );
  }
}

// POST: Ajukan retur (status pending). Stok baru berubah saat disetujui (PATCH).
export async function POST(request: NextRequest) {
  try {
    const auth = await requireSession("manajer");
    if (auth.error) return auth.error;

    const body = await request.json();
    const { transactionId, supplierName, productId, reason } = body;
    const quantity = toInt(body.quantity, 1);

    if (!productId || !String(reason || "").trim()) {
      throw new ApiError(400, "Data retur tidak lengkap (barang dan alasan wajib diisi)");
    }
    if (quantity === null) {
      throw new ApiError(400, "Jumlah retur harus bilangan bulat lebih dari 0");
    }

    const product = await db.select().from(products).where(eq(products.id, productId)).get();
    if (!product) throw new ApiError(404, "Barang tidak ditemukan");

    let linkedTransactionId: string | null = null;
    if (supplierName) {
      // Retur ke supplier: stok harus cukup untuk dikembalikan.
      if (product.stockQty < quantity) {
        throw new ApiError(400, `Stok "${product.name}" tidak cukup untuk diretur (tersisa ${product.stockQty})`);
      }
    } else if (transactionId) {
      // Retur pelanggan: transaksi boleh diisi dengan nomor (TRX-...) atau ID internal.
      const trx = await db
        .select({ id: transactions.id, voidedAt: transactions.voidedAt })
        .from(transactions)
        .where(or(eq(transactions.id, transactionId), eq(transactions.transactionNumber, String(transactionId).trim())))
        .get();
      if (!trx) throw new ApiError(404, `Transaksi "${transactionId}" tidak ditemukan`);
      if (trx.voidedAt) throw new ApiError(400, "Transaksi ini sudah dibatalkan, tidak bisa diretur");

      const sold = await db
        .select({ qty: sql<number>`coalesce(sum(${transactionItems.quantity}), 0)` })
        .from(transactionItems)
        .where(and(eq(transactionItems.transactionId, trx.id), eq(transactionItems.productId, productId)))
        .get();
      const alreadyReturned = await db
        .select({ qty: sql<number>`coalesce(sum(${returns.quantity}), 0)` })
        .from(returns)
        .where(and(eq(returns.transactionId, trx.id), eq(returns.productId, productId), sql`${returns.status} != 'ditolak'`))
        .get();
      const soldQty = Number(sold?.qty ?? 0);
      if (soldQty === 0) throw new ApiError(400, "Barang ini tidak ada di transaksi tersebut");
      const remaining = soldQty - Number(alreadyReturned?.qty ?? 0);
      if (quantity > remaining) {
        throw new ApiError(400, `Jumlah retur melebihi jumlah yang dibeli (bisa diretur: ${remaining})`);
      }
      linkedTransactionId = trx.id;
    }

    const returnId = randomUUID();
    const returnNumber = "RTR-" + Date.now();

    // Info supplier disimpan di kolom reason (skema retur pelanggan tidak punya kolom supplier).
    const finalReason = supplierName ? `[SUPPLIER] ${supplierName} | ${reason}` : reason;

    await db.insert(returns).values({
      id: returnId,
      returnNumber,
      transactionId: linkedTransactionId,
      productId,
      quantity,
      reason: finalReason,
      status: "pending",
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      data: { id: returnId, returnNumber, status: "pending" },
      message: "Retur berhasil diajukan",
    });
  } catch (error) {
    return errorResponse(error, "Gagal membuat retur", "POST returns API error:");
  }
}

// PATCH: Setujui atau tolak retur — update status + stok dalam satu transaksi.
export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireSession("manajer");
    if (auth.error) return auth.error;
    const { session } = auth;

    const returnId = request.nextUrl.searchParams.get("id");
    const body = await request.json();
    const action = body.status;

    if (!returnId || !action) throw new ApiError(400, "Data tidak lengkap");
    if (!["disetujui", "ditolak"].includes(action)) throw new ApiError(400, "Aksi tidak valid");

    db.transaction((tx) => {
      const returnRecord = tx.select().from(returns).where(eq(returns.id, returnId)).get();
      if (!returnRecord) throw new ApiError(404, "Retur tidak ditemukan");
      if (returnRecord.status !== "pending") throw new ApiError(400, "Retur sudah diproses sebelumnya");

      if (action === "disetujui") {
        const isSupplierReturn = returnRecord.reason.startsWith("[SUPPLIER]");
        // Retur ke supplier mengurangi stok; retur pelanggan menambah stok.
        const qtyChange = isSupplierReturn ? -returnRecord.quantity : returnRecord.quantity;

        if (isSupplierReturn) {
          const product = tx.select({ stockQty: products.stockQty, name: products.name }).from(products).where(eq(products.id, returnRecord.productId)).get();
          if (!product || product.stockQty < returnRecord.quantity) {
            throw new ApiError(400, `Stok "${product?.name ?? "barang"}" tidak cukup untuk retur ke supplier (tersisa ${product?.stockQty ?? 0})`);
          }
        }

        tx.update(products)
          .set({ stockQty: sql`${products.stockQty} + ${qtyChange}` })
          .where(eq(products.id, returnRecord.productId))
          .run();
        if (qtyChange < 0) consumeBatches(tx, returnRecord.productId, -qtyChange);

        tx.insert(stockMovements).values({
          id: randomUUID(),
          productId: returnRecord.productId,
          type: "retur",
          qtyChange,
          referenceId: returnId,
        }).run();
      }

      tx.update(returns)
        .set({ status: action, processedBy: session.id, processedAt: new Date().toISOString() })
        .where(eq(returns.id, returnId))
        .run();
    });

    return NextResponse.json({
      success: true,
      message: action === "disetujui" ? "Retur disetujui, stok telah disesuaikan" : "Retur ditolak",
    });
  } catch (error) {
    return errorResponse(error, "Gagal memproses retur", "PATCH returns API error:");
  }
}
