/* eslint-disable */
// @ts-nocheck
import { NextResponse, NextRequest } from "next/server";
import { db } from "@/db";
import { transactions, transactionItems, products, users, shifts, stockMovements, returns } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { randomUUID } from "crypto";
import { requireSession, ApiError, errorResponse } from "@/lib/api-auth";
import { addBatch, type BatchUsage } from "@/lib/batches";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireSession();
    if (auth.error) return auth.error;

    const trxId = (await params).id;
    
    // Find transaction
    const trxResult = await db
      .select({
        transaction: transactions,
        cashierName: users.name
      })
      .from(transactions)
      .leftJoin(users, eq(transactions.userId, users.id))
      .where(eq(transactions.transactionNumber, trxId))
      .limit(1);
      
    if (trxResult.length === 0) {
      return NextResponse.json({ success: false, message: "Transaksi tidak ditemukan" }, { status: 404 });
    }
    
    const transaction = trxResult[0].transaction;
    const cashierName = trxResult[0].cashierName;
    
    // Get items
    const itemsResult = await db
      .select({
        id: transactionItems.id,
        productId: transactionItems.productId,
        name: products.name,
        quantity: transactionItems.quantity,
        price: transactionItems.price,
        discount: transactionItems.discount,
        promotionName: transactionItems.promotionName,
        subtotal: transactionItems.subtotal,
      })
      .from(transactionItems)
      .innerJoin(products, eq(transactionItems.productId, products.id))
      .where(eq(transactionItems.transactionId, transaction.id));
      
    return NextResponse.json({
      success: true,
      data: {
        id: transaction.transactionNumber, // for frontend compatibility
        time: transaction.transactionTime,
        cashier: cashierName || transaction.userId,
        total: transaction.totalAmount,
        paymentMethod: transaction.paymentMethod,
        cashReceived: transaction.cashReceived,
        change: transaction.changeAmount,
        shiftId: transaction.shiftId,
        cashierId: transaction.userId,
        voidedAt: transaction.voidedAt,
        voidReason: transaction.voidReason,
        items: itemsResult.map(item => ({
          id: item.productId,
          name: item.name,
          qty: item.quantity,
          price: item.price,
          discount: item.discount,
          promotionName: item.promotionName,
        })),
        discount: itemsResult.reduce((sum, i) => sum + (i.discount || 0), 0)
      }
    });
  } catch (error) {
    console.error("Get transaction details API error:", error);
    return NextResponse.json(
      { success: false, message: "Gagal mengambil data transaksi" },
      { status: 500 }
    );
  }
}

/**
 * Batalkan transaksi (PATCH /api/transactions/[nomor], body { reason }).
 * Hanya kasir pemilik transaksi, selama shift tempat transaksi itu dibuat masih buka,
 * agar uang bisa langsung dikembalikan dari laci dan setoran shift tetap cocok.
 * Data tidak dihapus: transaksi ditandai batal dan stok dikembalikan (jejak "pembatalan").
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireSession("kasir");
    if (auth.error) return auth.error;
    const { session } = auth;

    const trxNumber = (await params).id;
    const body = await request.json().catch(() => ({}));
    const reason = String(body?.reason ?? "").trim();
    if (reason.length < 3) throw new ApiError(400, "Alasan pembatalan wajib diisi");
    if (reason.length > 200) throw new ApiError(400, "Alasan terlalu panjang (maks. 200 karakter)");

    db.transaction((tx) => {
      const trx = tx
        .select({ id: transactions.id, userId: transactions.userId, voidedAt: transactions.voidedAt, shiftStatus: shifts.status })
        .from(transactions)
        .innerJoin(shifts, eq(transactions.shiftId, shifts.id))
        .where(eq(transactions.transactionNumber, trxNumber))
        .get();
      if (!trx) throw new ApiError(404, "Transaksi tidak ditemukan");
      if (trx.userId !== session.id) throw new ApiError(403, "Hanya kasir yang melayani transaksi ini yang boleh membatalkannya");
      if (trx.voidedAt) throw new ApiError(400, "Transaksi ini sudah dibatalkan");
      if (trx.shiftStatus !== "buka") throw new ApiError(400, "Shift transaksi ini sudah ditutup. Gunakan menu Retur.");
      const hasReturn = tx
        .select({ id: returns.id })
        .from(returns)
        .where(and(eq(returns.transactionId, trx.id), sql`${returns.status} != 'ditolak'`))
        .get();
      if (hasReturn) throw new ApiError(400, "Transaksi ini sudah punya retur, tidak bisa dibatalkan");

      // Syarat voidedAt IS NULL mencegah pembatalan ganda bila ada dua request bersamaan.
      const updated = tx
        .update(transactions)
        .set({ voidedAt: new Date().toISOString(), voidedBy: session.id, voidReason: reason })
        .where(and(eq(transactions.id, trx.id), sql`${transactions.voidedAt} is null`))
        .run();
      if (updated.changes !== 1) throw new ApiError(400, "Transaksi ini sudah dibatalkan");

      const items = tx
        .select({ productId: transactionItems.productId, quantity: transactionItems.quantity, batchUsage: transactionItems.batchUsage })
        .from(transactionItems)
        .where(eq(transactionItems.transactionId, trx.id))
        .all();
      for (const item of items) {
        tx.update(products)
          .set({ stockQty: sql`${products.stockQty} + ${item.quantity}` })
          .where(eq(products.id, item.productId))
          .run();
        // Kembalikan tanggal kadaluarsa yang terpakai saat dijual (transaksi lama tanpa catatan: kembali tanpa tanggal).
        const usage: BatchUsage[] = item.batchUsage ? JSON.parse(item.batchUsage) : [];
        for (const u of usage) addBatch(tx, item.productId, u.expiryDate, u.qty, u.source, trx.id);
        tx.insert(stockMovements).values({
          id: randomUUID(),
          productId: item.productId,
          type: "pembatalan",
          qtyChange: item.quantity,
          referenceId: trx.id,
        }).run();
      }
    });

    return NextResponse.json({ success: true, message: "Transaksi dibatalkan, stok dikembalikan" });
  } catch (error) {
    return errorResponse(error, "Gagal membatalkan transaksi", "Void transaction API error:");
  }
}
