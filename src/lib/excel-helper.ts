/* eslint-disable */
// @ts-nocheck
import ExcelJS from "exceljs";

/**
 * Helper untuk membuat dan menghasilkan buffer file Excel.
 * 
 * @param title Judul laporan
 * @param columns Definisi kolom (header & key)
 * @param data Array object data yang akan dimasukkan
 * @returns Buffer Excel
 */
export async function generateExcelBuffer(
  title: string,
  columns: { header: string; key: string; width?: number }[],
  data: any[]
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Logmart POS";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(title);

  // Set columns
  sheet.columns = columns;

  // Style header
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).alignment = { vertical: "middle", horizontal: "center" };

  // Add rows
  sheet.addRows(data);

  // Format as table (optional, for basic styling)
  // We can just rely on basic cell styling for now
  
  // Return buffer
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

/**
 * Format nama file Excel.
 * @param prefix Prefix laporan (contoh: "Laporan_Penjualan")
 * @returns String nama file dengan timestamp
 */
export function generateExcelFilename(prefix: string): string {
  const date = new Date();
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  
  return `${prefix}_${yyyy}${mm}${dd}_${hh}${min}.xlsx`;
}

/**
 * Helper untuk membaca buffer Excel dan mengembalikan array object.
 * Baris pertama dianggap sebagai header.
 *
 * @param buffer Buffer file Excel
 * @returns Array object mewakili baris data
 */
export async function parseExcelBuffer(buffer: Buffer | ArrayBuffer): Promise<any[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as Buffer);
  
  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new Error("Berkas Excel tidak memiliki sheet data.");
  }
  
  const results: any[] = [];
  const headers: string[] = [];
  
  // Baca header (baris 1)
  worksheet.getRow(1).eachCell((cell, colNumber) => {
    headers[colNumber] = cell.value?.toString().trim() || `column_${colNumber}`;
  });
  
  // Baca baris data (mulai baris 2)
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // Skip header
    
    const rowData: any = {};
    let hasValue = false;
    
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const header = headers[colNumber];
      if (header) {
        // exceljs bisa mengembalikan object untuk formula/rich text. Kita butuh nilai mentahnya.
        let val = cell.value;
        if (val !== null && typeof val === 'object' && 'result' in val) {
           val = (val as any).result;
        } else if (val !== null && typeof val === 'object' && 'text' in val) {
           val = (val as any).text;
        }
        
        rowData[header] = val;
        if (val !== null && val !== undefined && val !== '') {
          hasValue = true;
        }
      }
    });
    
    if (hasValue) {
      results.push(rowData);
    }
  });
  
  return results;
}
