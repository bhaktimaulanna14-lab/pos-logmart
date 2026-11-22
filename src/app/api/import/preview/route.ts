import { NextResponse } from "next/server";
import { parseExcelBuffer } from "@/lib/excel-helper";
import { validateImportRows, ValidationError } from "@/lib/import-validator";
import { getSession } from "@/lib/session";

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== "manajer") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const entity = formData.get("entity") as string | null;

    if (!file || !entity) {
      return NextResponse.json({ error: "File and entity are required" }, { status: 400 });
    }

    if (!file.name.endsWith(".xlsx")) {
      return NextResponse.json({ error: "Invalid file format. Only .xlsx is supported." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    
    // Parse
    const rows = await parseExcelBuffer(buffer);
    if (rows.length === 0) {
      return NextResponse.json({ error: "File is empty or has no valid rows" }, { status: 400 });
    }

    // Validate
    const previewData: Record<string, unknown>[] = [];
    const previewErrors: ValidationError[] = [];

    // Aturan validasi yang sama persis dengan saat simpan (termasuk cek barcode ke database).
    const validation = validateImportRows(entity, rows);
    previewErrors.push(...validation.all);

    rows.forEach((row, index) => {
      // ExcelJS row numbering starts at 1, but header is 1, so data starts at 2
      const rowNumber = index + 2;
      const rowErrors = validation.perRow[index];
      const skuVal = String(row["SKU/Barcode"] || "").trim();

      // Format preview item depending on entity
      let name = "";
      const sku = skuVal || "-";
      let price = 0;

      if (entity === "products") {
        name = String(row["Nama"] || "-");
        price = row["Harga"] ? Number(row["Harga"]) : 0;
      } else if (entity === "categories") {
        name = String(row["Nama"] || "-");
      } else if (entity === "purchase-orders") {
        name = String(row["Nomor PO"] || "-");
      } else if (entity === "returns") {
        name = String(row["Jenis Retur"] || "-");
      }

      previewData.push({
        row: rowNumber,
        name,
        sku,
        price,
        valid: rowErrors.length === 0,
        originalData: row
      });
    });

    return NextResponse.json({
      success: true,
      data: previewData,
      errors: previewErrors
    });

  } catch (error: unknown) {
    console.error("Preview import error:", error);
    return NextResponse.json(
      { error: (error as Error).message || "Failed to process excel file" },
      { status: 500 }
    );
  }
}