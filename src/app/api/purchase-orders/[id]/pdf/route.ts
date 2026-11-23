import { NextResponse, NextRequest } from "next/server";
import PDFDocument from "pdfkit";
import { eq, asc } from "drizzle-orm";
import { db } from "@/db";
import { purchaseOrders, purchaseOrderItems, products, users } from "@/db/schema";
import { requireSession, ApiError, errorResponse } from "@/lib/api-auth";
import { STORE_INFO } from "@/lib/print-receipt";

const STATUS_LABEL: Record<string, string> = { dipesan: "Dipesan", diterima: "Diterima", dibatalkan: "DIBATALKAN" };

// Dokumen PO (A4) untuk diserahkan ke supplier: daftar barang + jumlah pesanan, tanpa harga modal.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireSession("manajer");
    if (auth.error) return auth.error;

    const id = (await params).id;
    const po = await db
      .select({
        poNumber: purchaseOrders.poNumber,
        supplierName: purchaseOrders.supplierName,
        orderDate: purchaseOrders.orderDate,
        status: purchaseOrders.status,
        notes: purchaseOrders.notes,
        createdByName: users.name,
      })
      .from(purchaseOrders)
      .leftJoin(users, eq(purchaseOrders.createdBy, users.id))
      .where(eq(purchaseOrders.id, id))
      .get();
    if (!po) throw new ApiError(404, "PO tidak ditemukan");

    const items = await db
      .select({ barcode: products.barcode, name: products.name, quantity: purchaseOrderItems.quantity })
      .from(purchaseOrderItems)
      .innerJoin(products, eq(purchaseOrderItems.productId, products.id))
      .where(eq(purchaseOrderItems.purchaseOrderId, id))
      .orderBy(asc(products.name));

    const doc = new PDFDocument({ size: "A4", margin: 40 });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    const done = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));

    const left = 40;
    const width = doc.page.width - 80;
    const fmtDate = (d: string) =>
      new Date(d).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" });

    // Kop toko
    doc.font("Helvetica-Bold").fontSize(16).text(STORE_INFO.name, left, 40);
    doc.font("Helvetica").fontSize(9).text(`${STORE_INFO.address}  ·  ${STORE_INFO.phone}`);
    doc.moveTo(left, doc.y + 6).lineTo(left + width, doc.y + 6).stroke();

    doc.moveDown(1.5).font("Helvetica-Bold").fontSize(14).text("PESANAN PEMBELIAN (PURCHASE ORDER)", { align: "center" });
    doc.moveDown(0.8).fontSize(10);
    const info: [string, string][] = [
      ["No. PO", po.poNumber],
      ["Tanggal", fmtDate(po.orderDate)],
      ["Kepada (Supplier)", po.supplierName],
      ["Status", STATUS_LABEL[po.status] ?? po.status],
    ];
    for (const [label, value] of info) {
      const y = doc.y;
      doc.font("Helvetica").text(label, left, y, { width: 110 });
      doc.font("Helvetica-Bold").text(`: ${value}`, left + 110, y, { width: width - 110 });
    }

    // Tabel barang
    const cols = [
      { title: "No", w: 30, align: "center" as const },
      { title: "Barcode", w: 120, align: "left" as const },
      { title: "Nama Barang", w: width - 30 - 120 - 70, align: "left" as const },
      { title: "Jumlah", w: 70, align: "right" as const },
    ];
    const drawRow = (cells: string[], bold: boolean) => {
      doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(10);
      const heights = cells.map((c, i) => doc.heightOfString(c, { width: cols[i].w - 10 }));
      const h = Math.max(...heights) + 8;
      if (doc.y + h > doc.page.height - 60) doc.addPage();
      const y = doc.y;
      let x = left;
      cells.forEach((c, i) => {
        doc.rect(x, y, cols[i].w, h).stroke();
        doc.text(c, x + 5, y + 4, { width: cols[i].w - 10, align: cols[i].align });
        x += cols[i].w;
      });
      doc.x = left;
      doc.y = y + h;
    };

    doc.moveDown(1);
    drawRow(cols.map((c) => c.title), true);
    items.forEach((it, i) => drawRow([String(i + 1), it.barcode, it.name, it.quantity.toLocaleString("id-ID")], false));
    const totalQty = items.reduce((s, it) => s + it.quantity, 0);
    drawRow(["", "", `Total (${items.length} jenis barang)`, totalQty.toLocaleString("id-ID")], true);

    if (po.notes) {
      doc.moveDown(1).font("Helvetica-Bold").text("Catatan:", left).font("Helvetica").text(po.notes, { width });
    }

    // Tanda tangan
    if (doc.y + 110 > doc.page.height - 40) doc.addPage();
    const signY = doc.y + 30;
    const half = width / 2;
    doc.font("Helvetica").fontSize(10);
    doc.text("Pemesan,", left, signY, { width: half, align: "center" });
    doc.text("Supplier,", left + half, signY, { width: half, align: "center" });
    doc.text(`( ${po.createdByName ?? "................"} )`, left, signY + 70, { width: half, align: "center" });
    doc.text(`( ${po.supplierName} )`, left + half, signY + 70, { width: half, align: "center" });

    doc.end();
    const pdf = await done;

    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${po.poNumber.replace(/[^\w.-]/g, "_")}.pdf"`,
      },
    });
  } catch (error) {
    return errorResponse(error, "Gagal membuat PDF PO", "PO PDF error:");
  }
}
