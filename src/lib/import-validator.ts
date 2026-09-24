export interface ValidationError {
  row: number;
  message: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function validateImportRow(entity: string, rowNumber: number, rowData: any): ValidationError[] {
  const errors: ValidationError[] = [];
  
  if (entity === 'products') {
    if (!rowData['SKU/Barcode']) errors.push({ row: rowNumber, message: "SKU/Barcode wajib diisi" });
    if (!rowData['Nama']) errors.push({ row: rowNumber, message: "Nama produk wajib diisi" });
    if (!rowData['Kategori']) errors.push({ row: rowNumber, message: "Kategori wajib diisi" });
    if (rowData['Harga'] === undefined || isNaN(Number(rowData['Harga'])) || Number(rowData['Harga']) < 0) {
      errors.push({ row: rowNumber, message: "Harga harus berupa angka positif" });
    }
  } else if (entity === 'categories') {
    if (!rowData['Nama']) errors.push({ row: rowNumber, message: "Nama kategori wajib diisi" });
  } else if (entity === 'purchase-orders') {
    if (!rowData['Nomor PO']) errors.push({ row: rowNumber, message: "Nomor PO wajib diisi" });
    if (!rowData['SKU/Barcode']) errors.push({ row: rowNumber, message: "SKU/Barcode wajib diisi" });
    if (!rowData['Jumlah'] || isNaN(Number(rowData['Jumlah'])) || Number(rowData['Jumlah']) <= 0) {
      errors.push({ row: rowNumber, message: "Jumlah harus lebih dari 0" });
    }
  } else if (entity === 'returns') {
    if (!rowData['SKU/Barcode']) errors.push({ row: rowNumber, message: "SKU/Barcode wajib diisi" });
    if (!rowData['Jumlah'] || isNaN(Number(rowData['Jumlah'])) || Number(rowData['Jumlah']) <= 0) {
      errors.push({ row: rowNumber, message: "Jumlah harus lebih dari 0" });
    }
    if (!rowData['Jenis Retur']) errors.push({ row: rowNumber, message: "Jenis Retur wajib diisi (Penjualan/Pembelian)" });
  }
  
  return errors;
}