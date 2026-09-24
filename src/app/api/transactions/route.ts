/* eslint-disable */
// @ts-nocheck
import { getSession } from "@/lib/session";
import { NextResponse, NextRequest } from "next/server";
import { db } from "@/db";
import { transactions, transactionItems, products, stockMovements, shifts, users } from "@/db/schema";
import { eq, sql, like, and, or, desc } from "drizzle-orm";
import { randomUUID } from "crypto";

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

    // Join to get cashier name
    const results = await db
      .select({
        id: transactions.id,
        transactionNumber: transactions.transactionNumber,
        transactionTime: transactions.transactionTime,
        totalAmount: transactions.totalAmount,
        paymentMethod: transactions.paymentMethod,
        shiftId: transactions.shiftId,
        cashierName: users.name,
      })
      .from(transactions)
      .leftJoin(users, eq(transactions.userId, users.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(transactions.transactionTime));

    return NextResponse.json({ success: true, data: results });
  } catch (error) {
    console.error("GET transactions API error:", error);
    return NextResponse.json(
      { success: false, message: "Gagal mengambil riwayat transaksi" },
      { status: 500 }
    );
  }
}
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { items, paymentMethod, cashReceived, userId = "user-kasir-1" } = body;

    if (!items || items.length === 0) {
      return NextResponse.json({ success: false, message: "Keranjang kosong" }, { status: 400 });
    }

    // Wrap in a transaction ideally, but better-sqlite3 with drizzle-orm supports basic transactions
    // For prototype simplicity we will just execute sequentially
    
    // 1. Get active shift
    const activeShifts = await db.select().from(shifts).where(eq(shifts.status, "buka")).limit(1);
    const shiftId = activeShifts.length > 0 ? activeShifts[0].id : "SHIFT-001";
    
    const trxNumber = "TRX-" + Date.now();
    const trxId = randomUUID();
    
    let totalAmount = 0;
    
    const trxItemsToInsert = [];
    const stockMovementsToInsert = [];
    
    for (const item of items) {
      const subtotal = item.price * item.qty;
      totalAmount += subtotal;
      
      trxItemsToInsert.push({
        id: randomUUID(),
        transactionId: trxId,
        productId: item.id,
        quantity: item.qty,
        price: item.price,
        subtotal: subtotal
      });
      
      stockMovementsToInsert.push({
        id: randomUUID(),
        productId: item.id,
        type: "penjualan",
        qtyChange: -item.qty,
        referenceId: trxId
      });
      
      // Update stock
      await db.update(products)
        .set({ stockQty: sql`stock_qty - ${item.qty}` })
        .where(eq(products.id, item.id));
    }
    
    const actualCashReceived = paymentMethod === "tunai" ? Number(cashReceived) : totalAmount;
    const changeAmount = paymentMethod === "tunai" ? actualCashReceived - totalAmount : 0;
    
    const newTransaction = {
      id: trxId,
      transactionNumber: trxNumber,
      shiftId: shiftId,
      userId: userId,
      totalAmount,
      paymentMethod,
      cashReceived: actualCashReceived,
      changeAmount,
      transactionTime: new Date().toISOString()
    };
    
    await db.insert(transactions).values(newTransaction);
    
    for (const ti of trxItemsToInsert) {
      await db.insert(transactionItems).values(ti);
    }
    for (const sm of stockMovementsToInsert) {
      await db.insert(stockMovements).values(sm);
    }

    return NextResponse.json({ 
      success: true, 
      data: {
        id: trxNumber,
        time: new Date().toLocaleTimeString("id-ID"),
        total: totalAmount,
        change: changeAmount
      }
    });
  } catch (error) {
    console.error("Save transaction API error:", error);
    return NextResponse.json(
      { success: false, message: "Gagal menyimpan transaksi" },
      { status: 500 }
    );
  }
}
