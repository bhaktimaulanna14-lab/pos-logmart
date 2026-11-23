import { NextResponse, NextRequest } from "next/server";
import { db } from "@/db";
import { purchaseOrders, purchaseOrderItems, products } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireSession } from "@/lib/api-auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireSession("manajer");
    if (auth.error) return auth.error;

    const id = (await params).id;
    
    // Find PO
    const poResult = await db
      .select()
      .from(purchaseOrders)
      .where(eq(purchaseOrders.id, id))
      .limit(1);
      
    if (poResult.length === 0) {
      return NextResponse.json({ success: false, message: "PO tidak ditemukan" }, { status: 404 });
    }
    
    const po = poResult[0];
    
    // Get PO items
    const itemsResult = await db
      .select({
        id: purchaseOrderItems.id,
        productId: purchaseOrderItems.productId,
        name: products.name,
        barcode: products.barcode,
        quantity: purchaseOrderItems.quantity,
        receivedQty: purchaseOrderItems.receivedQty,
        unitCost: purchaseOrderItems.unitCost,
        cost: products.cost,
      })
      .from(purchaseOrderItems)
      .innerJoin(products, eq(purchaseOrderItems.productId, products.id))
      .where(eq(purchaseOrderItems.purchaseOrderId, po.id));
      
    return NextResponse.json({
      success: true,
      data: {
        ...po,
        items: itemsResult
      }
    });
  } catch (error) {
    console.error("Get PO details API error:", error);
    return NextResponse.json(
      { success: false, message: "Gagal mengambil data detail PO" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireSession("manajer");
    if (auth.error) return auth.error;

    const id = (await params).id;
    const body = await request.json();

    if (body.action === 'cancel') {
      const poResult = await db
        .select()
        .from(purchaseOrders)
        .where(eq(purchaseOrders.id, id))
        .limit(1);

      if (poResult.length === 0) {
        return NextResponse.json({ success: false, message: "PO tidak ditemukan" }, { status: 404 });
      }

      if (poResult[0].status !== "dipesan") {
        return NextResponse.json({ success: false, message: "Hanya PO berstatus 'dipesan' yang dapat dibatalkan" }, { status: 400 });
      }

      await db
        .update(purchaseOrders)
        .set({ status: "dibatalkan" })
        .where(eq(purchaseOrders.id, id));

      return NextResponse.json({ success: true, message: "PO berhasil dibatalkan" });
    }

    return NextResponse.json({ success: false, message: "Aksi tidak dikenali" }, { status: 400 });
  } catch (error) {
    console.error("Patch PO API error:", error);
    return NextResponse.json(
      { success: false, message: "Gagal memproses PO" },
      { status: 500 }
    );
  }
}
