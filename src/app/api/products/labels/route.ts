import { getSession } from "@/lib/session";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { products } from "@/db/schema";
import { inArray } from "drizzle-orm";
import PDFDocument from "pdfkit";

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    const role = session?.role;
    // Manajer atau Kasir bisa cetak label? PRD bilang: "di manajemen barang (menu stok), manajer pilih satu/beberapa barang"
    if (role !== "manajer" && role !== "admin") {
      return NextResponse.json({ success: false, message: "Akses ditolak. Hanya Manajer yang dapat mencetak label harga." }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const idsParam = searchParams.get("ids");
    
    if (!idsParam) {
      return NextResponse.json({ success: false, message: "IDs required" }, { status: 400 });
    }

    const ids = idsParam.split(",").filter(Boolean);
    if (ids.length === 0) {
      return NextResponse.json({ success: false, message: "Invalid IDs" }, { status: 400 });
    }

    // Fetch products
    const productList = await db
      .select()
      .from(products)
      .where(inArray(products.id, ids));

    if (productList.length === 0) {
      return NextResponse.json({ success: false, message: "Products not found" }, { status: 404 });
    }

    // Create PDF
    // We'll create a simple PDF with labels (e.g., 3 labels per row)
    const doc = new PDFDocument({
      size: "A4",
      margin: 30,
    });

    const buffers: Buffer[] = [];
    doc.on("data", buffers.push.bind(buffers));
    
    // Wrap the doc.end() in a promise
    const pdfPromise = new Promise<Buffer>((resolve) => {
      doc.on("end", () => {
        resolve(Buffer.concat(buffers));
      });
    });

    // Draw labels
    const startX = 30;
    const startY = 30;
    const labelWidth = 170;
    const labelHeight = 80;
    const padding = 10;
    
    let currentX = startX;
    let currentY = startY;

    // Title
    doc.fontSize(16).text("Label Harga Barang", startX, startY);
    currentY += 40;

    for (let i = 0; i < productList.length; i++) {
      const product = productList[i];
      
      // Check page break
      if (currentY + labelHeight > doc.page.height - 30) {
        doc.addPage();
        currentX = startX;
        currentY = startY;
      }

      // Draw label box
      doc.rect(currentX, currentY, labelWidth, labelHeight).stroke();
      
      // Draw content
      doc.fontSize(12).font("Helvetica-Bold").text(
        product.name.substring(0, 20), 
        currentX + padding, 
        currentY + padding, 
        { width: labelWidth - padding * 2, align: "center" }
      );
      
      doc.fontSize(10).font("Helvetica").text(
        product.barcode,
        currentX + padding,
        currentY + padding + 20,
        { width: labelWidth - padding * 2, align: "center" }
      );
      
      doc.fontSize(14).font("Helvetica-Bold").text(
        `Rp ${product.price.toLocaleString("id-ID")}`,
        currentX + padding,
        currentY + padding + 40,
        { width: labelWidth - padding * 2, align: "center" }
      );

      // Move to next label position
      currentX += labelWidth + 10;
      if (currentX + labelWidth > doc.page.width - 30) {
        currentX = startX;
        currentY += labelHeight + 10;
      }
    }

    doc.end();
    
    const pdfBuffer = await pdfPromise;

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="label_harga.pdf"',
      },
    });

  } catch (error) {
    console.error("PDF generation error:", error);
    return NextResponse.json({ success: false, message: "Failed to generate PDF" }, { status: 500 });
  }
}
