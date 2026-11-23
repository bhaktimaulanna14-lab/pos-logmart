import { NextResponse } from "next/server";
import { generateExcelBuffer, generateExcelFilename } from "@/lib/excel-helper";
import { getSession } from "@/lib/session";

export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== "manajer") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const entity = searchParams.get("entity");

    if (!entity) {
      return NextResponse.json({ error: "Entity is required" }, { status: 400 });
    }

    let columns: { header: string; key: string; width?: number }[] = [];
    let title = "";

    if (entity === "products") {
      title = "Template_Barang";
      columns = [
        { header: "SKU/Barcode", key: "sku", width: 20 },
        { header: "Nama", key: "name", width: 30 },
        { header: "Kategori", key: "category", width: 20 },
        { header: "Harga", key: "price", width: 15 },
        { header: "Modal", key: "cost", width: 15 },
        { header: "Stok", key: "stock", width: 10 },
        // Opsional. "2026-11-01" (seluruh stok) atau "2026-11-01 (2); 2026-12-10 (3)".
        { header: "Kadaluarsa", key: "expiry", width: 32 },
      ];
    } else if (entity === "categories") {
      title = "Template_Kategori";
      columns = [
        { header: "Nama", key: "name", width: 30 },
        { header: "Keterangan", key: "description", width: 40 },
      ];
    } else if (entity === "purchase-orders") {
      title = "Template_PO";
      columns = [
        { header: "Nomor PO", key: "po", width: 20 },
        { header: "Pemasok", key: "supplier", width: 30 },
        { header: "Tanggal", key: "date", width: 20 },
        { header: "SKU/Barcode", key: "sku", width: 20 },
        { header: "Jumlah", key: "qty", width: 10 },
      ];
    } else if (entity === "returns") {
      title = "Template_Retur";
      columns = [
        { header: "Jenis Retur", key: "type", width: 20 },
        { header: "Referensi", key: "ref", width: 20 },
        { header: "SKU/Barcode", key: "sku", width: 20 },
        { header: "Jumlah", key: "qty", width: 10 },
      ];
    } else {
      return NextResponse.json({ error: "Invalid entity" }, { status: 400 });
    }

    const buffer = await generateExcelBuffer(title, columns, []);
    const filename = generateExcelFilename(title);

    return new NextResponse(buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      },
    });
  } catch (error: unknown) {
    console.error("Download template error:", error);
    return NextResponse.json(
      { error: (error as Error).message || "Failed to generate template" },
      { status: 500 }
    );
  }
}