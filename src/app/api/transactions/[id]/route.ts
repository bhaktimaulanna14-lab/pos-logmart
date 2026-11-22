/* eslint-disable */
// @ts-nocheck
import { NextResponse, NextRequest } from "next/server";
import { db } from "@/db";
import { transactions, transactionItems, products, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireSession } from "@/lib/api-auth";

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
