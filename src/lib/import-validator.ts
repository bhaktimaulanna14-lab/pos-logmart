import { db } from "@/db";
import { products } from "@/db/schema";

export interface ValidationError {
  row: number;
  message: string;
}

type Row = Record<string, unknown>;

const isNonNegativeInt = (v: unknown) => v !== undefined && v !== null && v !== "" && Number.isInteger(Number(v)) && Number(v) >= 0;
const isPositiveInt = (v: unknown) => isNonNegativeInt(v) && Number(v) > 0;

/** Validasi satu baris (tanpa akses database). */
export function validateImportRow(entity: string, rowNumber: number, rowData: Row): ValidationError[] {
  const errors: ValidationError[] = [];
  const err = (message: string) => errors.push({ row: rowNumber, message });

  if (entity === "products") {
    if (!rowData["SKU/Barcode"]) err("SKU/Barcode wajib diisi");
    if (!rowData["Nama"]) err("Nama produk wajib diisi");
    if (!rowData["Kategori"]) err("Kategori wajib diisi");
    if (!isNonNegativeInt(rowData["Harga"])) err("Harga harus berupa angka bulat 0 atau lebih");
    if (rowData["Modal"] !== undefined && rowData["Modal"] !== "" && !isNonNegativeInt(rowData["Modal"])) err("Modal harus berupa angka bulat 0 atau lebih");
    if (rowData["Stok"] !== undefined && rowData["Stok"] !== "" && !isNonNegativeInt(rowData["Stok"])) err("Stok harus berupa angka bulat 0 atau lebih");
  } else if (entity === "categories") {
    if (!rowData["Nama"]) err("Nama kategori wajib diisi");
  } else if (entity === "purchase-orders") {
    if (!rowData["Nomor PO"]) err("Nomor PO wajib diisi");
    if (!rowData["SKU/Barcode"]) err("SKU/Barcode wajib diisi");
    if (!isPositiveInt(rowData["Jumlah"])) err("Jumlah harus bilangan bulat lebih dari 0");
  } else if (entity === "returns") {
    if (!rowData["SKU/Barcode"]) err("SKU/Barcode wajib diisi");
    if (!isPositiveInt(rowData["Jumlah"])) err("Jumlah harus bilangan bulat lebih dari 0");
    const jenis = String(rowData["Jenis Retur"] ?? "").trim().toLowerCase();
    if (jenis !== "penjualan" && jenis !== "pembelian") err("Jenis Retur wajib diisi: Penjualan atau Pembelian");
  } else {
    err(`Jenis data impor "${entity}" tidak dikenal`);
  }

  return errors;
}

/**
 * Validasi seluruh file, termasuk pengecekan barcode ke database untuk PO & retur.
 * Dipakai oleh PRATINJAU dan SIMPAN agar aturannya selalu sama.
 */
export function validateImportRows(entity: string, rows: Row[]): { perRow: ValidationError[][]; all: ValidationError[] } {
  let knownBarcodes: Set<string> | null = null;
  if (entity === "purchase-orders" || entity === "returns") {
    knownBarcodes = new Set(db.select({ barcode: products.barcode }).from(products).all().map((p) => p.barcode));
  }

  const perRow = rows.map((row, index) => {
    const rowNumber = index + 2; // baris 1 = header
    const errors = validateImportRow(entity, rowNumber, row);
    const sku = String(row["SKU/Barcode"] ?? "").trim();
    if (knownBarcodes && sku && !knownBarcodes.has(sku)) {
      errors.push({ row: rowNumber, message: `Barang dengan barcode '${sku}' tidak ditemukan di database` });
    }
    return errors;
  });

  return { perRow, all: perRow.flat() };
}
