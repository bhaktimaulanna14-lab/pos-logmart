import { getSession } from "@/lib/session";
import { NextResponse, NextRequest } from "next/server";
import { db } from "@/db";
import { transactions, transactionItems, products, stockMovements, shifts, users } from "@/db/schema";
import { eq, sql, like, and, desc, inArray, gte, lt } from "drizzle-orm";
import { resolvePeriod } from "@/lib/report-period";
import { priceCart } from "@/lib/promotions";
import { consumeBatches } from "@/lib/batches";
import { randomUUID } from "crypto";
import { requireSession, toInt, ApiError, errorResponse } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  try {
    // Basic authorization check (Prototype)
    const session = await getSession();
    const role = session?.role;
    // if role is kasir, they can only view their own transactions?
    // for now we just verify they are authenticated
    if (role === "guest") {
      return NextResponse.json({ success: false, message: "Akses ditolak" }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const q = searchParams.get("q"); // trx number
    const cashierId = searchParams.get("cashierId");
    const shiftId = searchParams.get("shiftId");
    // Filter tanggal (WIB): ?date=YYYY-MM-DD, atau ?startDate=&endDate=, atau ?period=
    const date = searchParams.get("date");
    const hasDateFilter = !!(date || searchParams.get("startDate") || searchParams.get("period"));
    const periodParams = new URLSearchParams(searchParams);
    if (date) {
      periodParams.set("startDate", date);
      periodParams.set("endDate", date);
    }

    const conditions = [];

    if (q) {
      conditions.push(like(transactions.transactionNumber, `%${q}%`));
    }

    if (cashierId && cashierId !== "Semua") {
      conditions.push(eq(transactions.userId, cashierId));
    }

    if (shiftId) {
      conditions.push(eq(transactions.shiftId, shiftId));
    }

    let dateRange = null;
    if (hasDateFilter) {
      const period = resolvePeriod(periodParams);
      dateRange = and(gte(transactions.transactionTime, period.startIso), lt(transactions.transactionTime, period.endIso));
      conditions.push(dateRange);
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    // Pagination opsional: ?page=1&pageSize=50. Tanpa `page` = semua hasil filter (dipakai ringkasan shift di POS).
    const pageParam = searchParams.get("page");
    const page = Math.max(1, Number(pageParam) || 1);
    const pageSize = Math.min(Math.max(Number(searchParams.get("pageSize")) || 50, 1), 200);

    const totalRow = await db
      .select({
        n: sql<number>`count(*)`,
        amount: sql<number>`coalesce(sum(case when ${transactions.voidedAt} is null then ${transactions.totalAmount} else 0 end), 0)`,
      })
      .from(transactions)
      .where(where)
      .get();

    // Join to get cashier name
    const query = db
      .select({
        id: transactions.id,
        transactionNumber: transactions.transactionNumber,
        transactionTime: transactions.transactionTime,
        totalAmount: transactions.totalAmount,
        paymentMethod: transactions.paymentMethod,
        shiftId: transactions.shiftId,
        cashierId: transactions.userId,
        cashierName: users.name,
        voidedAt: transactions.voidedAt,
      })
      .from(transactions)
      .leftJoin(users, eq(transactions.userId, users.id))
      .where(where)
      .orderBy(desc(transactions.transactionTime));

    const results = pageParam ? await query.limit(pageSize).offset((page - 1) * pageSize) : await query;

    // Daftar kasir yang bertransaksi pada rentang tanggal ini (untuk filter "Kasir").
    const cashiers = pageParam
      ? await db
          .selectDistinct({ id: users.id, name: users.name })
          .from(transactions)
          .innerJoin(users, eq(transactions.userId, users.id))
          .where(dateRange ?? undefined)
          .orderBy(users.name)
      : undefined;

    return NextResponse.json({
      success: true,
      data: results,
      total: Number(totalRow?.n ?? 0),
      totalAmount: Number(totalRow?.amount ?? 0),
      page,
      pageSize: pageParam ? pageSize : results.length,
      cashiers,
    });
  } catch (error) {
    console.error("GET transactions API error:", error);
    return NextResponse.json(
      { success: false, message: "Gagal mengambil riwayat transaksi" },
      { status: 500 }
    );
  }
}
const PAYMENT_METHODS = ["tunai", "debit", "qris"];

export async function POST(request: NextRequest) {
  try {
    // Hanya kasir yang boleh checkout; identitas diambil dari sesi, bukan dari body.
    const auth = await requireSession("kasir");
    if (auth.error) return auth.error;
    const { session } = auth;

    const body = await request.json();
    const { items, paymentMethod, cashReceived } = body;

    if (!Array.isArray(items) || items.length === 0) {
      throw new ApiError(400, "Keranjang kosong");
    }
    if (!PAYMENT_METHODS.includes(paymentMethod)) {
      throw new ApiError(400, "Metode pembayaran tidak valid");
    }

    // Gabungkan qty per produk; harga TIDAK diambil dari client.
    const qtyByProduct = new Map<string, number>();
    for (const item of items) {
      const qty = toInt(item?.qty, 1);
      if (!item?.id || qty === null) {
        throw new ApiError(400, "Jumlah barang harus bilangan bulat lebih dari 0");
      }
      qtyByProduct.set(item.id, (qtyByProduct.get(item.id) ?? 0) + qty);
    }

    const trxNumber = "TRX-" + Date.now();
    const trxId = randomUUID();
    const now = new Date().toISOString();

    // Semua tulis dalam satu transaksi SQLite (sinkron): gagal di tengah = tidak ada yang tersimpan.
    const result = db.transaction((tx) => {
      const shift = tx
        .select({ id: shifts.id })
        .from(shifts)
        .where(and(eq(shifts.userId, session.id), eq(shifts.status, "buka")))
        .get();
      if (!shift) throw new ApiError(400, "Buka shift terlebih dahulu sebelum bertransaksi");

      // Harga dari database + promo aktif hari ini (dihitung di server, tidak percaya client).
      const priced = priceCart(tx, qtyByProduct);
      if (priced.missing.length) throw new ApiError(400, "Ada barang yang tidak ditemukan atau sudah tidak aktif");
      for (const l of priced.lines) {
        if (!l.isActive) throw new ApiError(400, "Ada barang yang tidak ditemukan atau sudah tidak aktif");
        if (l.stock < l.qty) throw new ApiError(400, `Stok "${l.name}" tidak cukup (tersisa ${l.stock})`);
      }
      const lines = priced.lines;
      const totalAmount = priced.total;

      let actualCashReceived = totalAmount;
      let changeAmount = 0;
      if (paymentMethod === "tunai") {
        const cash = toInt(cashReceived, 0);
        if (cash === null || cash < totalAmount) throw new ApiError(400, "Uang diterima kurang dari total belanja");
        actualCashReceived = cash;
        changeAmount = cash - totalAmount;
      }

      tx.insert(transactions).values({
        id: trxId,
        transactionNumber: trxNumber,
        shiftId: shift.id,
        userId: session.id,
        totalAmount,
        paymentMethod,
        cashReceived: actualCashReceived,
        changeAmount,
        transactionTime: now,
      }).run();

      for (const line of lines) {
        tx.insert(transactionItems).values({
          id: randomUUID(),
          transactionId: trxId,
          productId: line.productId,
          quantity: line.qty,
          price: line.price,
          discount: line.discount,
          promotionId: line.promotionId,
          promotionName: line.promotionName,
          subtotal: line.subtotal,
        }).run();
        tx.update(products)
          .set({ stockQty: sql`${products.stockQty} - ${line.qty}` })
          .where(eq(products.id, line.productId))
          .run();
        consumeBatches(tx, line.productId, line.qty);
        tx.insert(stockMovements).values({
          id: randomUUID(),
          productId: line.productId,
          type: "penjualan",
          qtyChange: -line.qty,
          referenceId: trxId,
        }).run();
      }

      return { totalAmount, changeAmount, discountTotal: priced.discountTotal };
    });

    return NextResponse.json({
      success: true,
      data: {
        id: trxNumber,
        time: new Date(now).toLocaleTimeString("id-ID"),
        total: result.totalAmount,
        discount: result.discountTotal,
        change: result.changeAmount,
      },
    });
  } catch (error) {
    return errorResponse(error, "Gagal menyimpan transaksi", "Save transaction API error:");
  }
}
