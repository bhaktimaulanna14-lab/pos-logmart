import { getSession } from "@/lib/session";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { purchaseOrders, purchaseOrderItems, products, users } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { generateExcelBuffer, generateExcelFilename } from "@/lib/excel-helper";

export async function GET() {
  try {
    const session = await getSession();
    const role = session?.role;
    if (role !== "manajer" && role !== "admin") {
      return NextResponse.json({ success: false, message: "Akses ditolak" }, { status: 403 });
    }

    // Ambil data PO items
    const poData = await db
      .select({
        poNumber: purchaseOrders.poNumber,
        supplierName: purchaseOrders.supplierName,
        orderDate: purchaseOrders.orderDate,
        status: purchaseOrders.status,
        receivedAt: purchaseOrders.receivedAt,
        productName: products.name,
        orderedQty: purchaseOrderItems.quantity,
        receivedQty: purchaseOrderItems.receivedQty,
        createdBy: users.name,
      })
      .from(purchaseOrderItems)
      .innerJoin(purchaseOrders, eq(purchaseOrderItems.purchaseOrderId, purchaseOrders.id))
      .innerJoin(products, eq(purchaseOrderItems.productId, products.id))
      .leftJoin(users, eq(purchaseOrders.createdBy, users.id))
      .orderBy(desc(purchaseOrders.orderDate));

    // Format for Excel
    const columns = [
      { header: "Nomor PO", key: "poNumber", width: 20 },
      { header: "Tanggal Pesan", key: "orderDate", width: 20 },
      { header: "Supplier", key: "supplierName", width: 30 },
      { header: "Status", key: "status", width: 15 },
      { header: "Tanggal Terima", key: "receivedAt", width: 20 },
      { header: "Nama Barang", key: "productName", width: 30 },
      { header: "Qty Pesan", key: "orderedQty", width: 15 },
      { header: "Qty Terima", key: "receivedQty", width: 15 },
      { header: "Dibuat Oleh", key: "createdBy", width: 20 },
    ];

    const data = poData.map(po => ({
      poNumber: po.poNumber,
      orderDate: new Date(po.orderDate).toLocaleDateString("id-ID"),
      supplierName: po.supplierName,
      status: po.status.toUpperCase(),
      receivedAt: po.receivedAt ? new Date(po.receivedAt).toLocaleDateString("id-ID") : "-",
      productName: po.productName,
      orderedQty: po.orderedQty,
      receivedQty: po.receivedQty,
      createdBy: po.createdBy || "-",
    }));

    const buffer = await generateExcelBuffer("Laporan Penerimaan PO", columns, data);
    const filename = generateExcelFilename("Penerimaan_PO");

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("PO Excel error:", error);
    return NextResponse.json(
      { success: false, message: "Gagal membuat Excel" },
      { status: 500 }
    );
  }
}
