/* eslint-disable */
// @ts-nocheck
import { NextResponse, NextRequest } from "next/server";
import { db } from "@/db";
import { transactions, transactionItems, products } from "@/db/schema";
import { eq, gte, lte, and } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const period = searchParams.get("period") || "7hari";
    
    const now = new Date();
    let startDate = new Date();
    
    if (period === "bulanIni") {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    } else {
      startDate.setDate(startDate.getDate() - 7);
    }
    
    const startIso = startDate.toISOString();
    const endIso = now.toISOString();

    // Get transactions within period
    const trxs = await db
      .select({ id: transactions.id })
      .from(transactions)
      .where(and(
        gte(transactions.createdAt, startIso),
        lte(transactions.createdAt, endIso)
      ));

    if (trxs.length === 0) {
      return NextResponse.json({ success: true, data: [] });
    }

    const trxIds = trxs.map(t => t.id);

    // Join transaction items with products to get top selling
    const items = await db
      .select({
        productId: transactionItems.productId,
        qty: transactionItems.quantity,
        price: transactionItems.priceAtTransaction,
        name: products.name,
      })
      .from(transactionItems)
      .innerJoin(products, eq(transactionItems.productId, products.id));
      
    // Filter items belonging to the fetched transactions (simulate IN clause)
    // NOTE: For a real app, do an actual SQL IN query, but this works for prototype SQLite
    // wait, we can't easily filter if we didn't fetch trxId, let's fetch trxId
    const itemsWithTrx = await db
      .select({
        trxId: transactionItems.transactionId,
        productId: transactionItems.productId,
        qty: transactionItems.quantity,
        price: transactionItems.priceAtTransaction,
        name: products.name,
      })
      .from(transactionItems)
      .innerJoin(products, eq(transactionItems.productId, products.id));

    const validItems = itemsWithTrx.filter(item => trxIds.includes(item.trxId));

    // Aggregate
    const aggregated = validItems.reduce((acc: any, item) => {
      if (!acc[item.productId]) {
        acc[item.productId] = { name: item.name, qty: 0, revenue: 0 };
      }
      acc[item.productId].qty += item.qty;
      acc[item.productId].revenue += (item.qty * item.price);
      return acc;
    }, {});

    const topProducts = Object.values(aggregated)
      .sort((a: any, b: any) => b.qty - a.qty)
      .slice(0, 5); // top 5

    return NextResponse.json({ success: true, data: topProducts });
  } catch (error) {
    console.error("GET top products API error:", error);
    return NextResponse.json(
      { success: false, message: "Gagal mengambil data produk terlaris" },
      { status: 500 }
    );
  }
}
