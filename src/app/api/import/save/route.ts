import { NextResponse } from "next/server";
import { parseExcelBuffer } from "@/lib/excel-helper";
import { validateImportRow, ValidationError } from "@/lib/import-validator";
import { getSession } from "@/lib/session";
import { db } from "@/db";

import { importCategories, importProducts, importPurchaseOrders, importReturns } from "@/lib/import-repository";

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
    const rows = await parseExcelBuffer(buffer);
    if (rows.length === 0) {
      return NextResponse.json({ error: "File is empty or has no valid rows" }, { status: 400 });
    }

    const previewErrors: ValidationError[] = [];

    rows.forEach((row, index) => {
      const rowNumber = index + 2; 
      const rowErrors = validateImportRow(entity, rowNumber, row);
      if (rowErrors.length > 0) {
        previewErrors.push(...rowErrors);
      }
    });

    if (previewErrors.length > 0) {
      return NextResponse.json({
        success: false,
        error: "Validation failed",
        errors: previewErrors
      }, { status: 400 });
    }

    let result = { added: 0, updated: 0 };

    db.transaction((tx) => {
      if (entity === "categories") {
        result = importCategories(tx, rows);
      } else if (entity === "products") {
        result = importProducts(tx, rows);
      } else if (entity === "purchase-orders") {
        result = importPurchaseOrders(tx, rows, session.id);
      } else if (entity === "returns") {
        result = importReturns(tx, rows, session.id);
      }
    });

    return NextResponse.json({
      success: true,
      summary: {
        added: result.added,
        updated: result.updated,
        failed: 0
      }
    });

  } catch (error: unknown) {
    console.error("Save import error:", error);
    return NextResponse.json(
      { error: (error as Error).message || "Failed to process excel file" },
      { status: 500 }
    );
  }
}