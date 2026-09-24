/* eslint-disable */
// @ts-nocheck
import { NextResponse, NextRequest } from "next/server";
import { db } from "@/db";
import { stockMovements, products } from "@/db/schema";
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

    const movements = await db
      .select({
        id: stockMovements.id,
        productId: stockMovements.productId,
        type: stockMovements.type,
        qtyChange: stockMovements.qtyChange,
        referenceId: stockMovements.referenceId,
        date: stockMovements.createdAt,
        name: products.name,
      })
      .from(stockMovements)
      .innerJoin(products, eq(stockMovements.productId, products.id))
      .where(and(
        gte(stockMovements.createdAt, startIso),
        lte(stockMovements.createdAt, endIso)
      ));

    // Aggregate qty change for fast/slow (penjualan only)
    const penjualanMovements = movements.filter(m => m.type === "penjualan");
    const aggregated = penjualanMovements.reduce((acc: any, mov) => {
      if (!acc[mov.productId]) {
        acc[mov.productId] = { name: mov.name, qty: 0 };
      }
      acc[mov.productId].qty += Math.abs(mov.qtyChange);
      return acc;
    }, {});

    const sorted = Object.values(aggregated).sort((a: any, b: any) => b.qty - a.qty);
    
    const fastMoving = sorted.slice(0, 5); // top 5
    const slowMoving = sorted.slice().reverse().slice(0, 5); // bottom 5

    // Sort all movements by time descending for table
    const allMovements = movements.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    return NextResponse.json({ 
      success: true, 
      data: {
        fastMoving,
        slowMoving,
        allMovements
      } 
    });
  } catch (error) {
    console.error("GET stock movements report API error:", error);
    return NextResponse.json(
      { success: false, message: "Gagal mengambil data pergerakan barang" },
      { status: 500 }
    );
  }
}
