/**
 * Jadikan 0 semua stok barang yang minus (data lama), dicatat sebagai "penyesuaian" di riwayat stok.
 * Setelah ini jalankan `node scripts/migrate-2026-11.js <db>` agar pengaman DB (trigger stok >= 0) terpasang.
 *
 *   node scripts/zero-negative-stock.js sqlite.db           (pratinjau)
 *   node scripts/zero-negative-stock.js sqlite.db --apply   (terapkan)
 *
 * Backup dulu. Aman dijalankan ulang.
 */
const Database = require("better-sqlite3");
const { randomUUID } = require("crypto");

const file = process.argv[2];
if (!file) {
  console.error("Pakai: node scripts/zero-negative-stock.js <file-database> [--apply]");
  process.exit(1);
}
const apply = process.argv.includes("--apply");
const db = new Database(file, { fileMustExist: true });

const rows = db.prepare("select id, barcode, name, stock_qty from products where stock_qty < 0 order by stock_qty").all();
for (const r of rows) console.log(`${r.barcode}  ${r.name}: ${r.stock_qty} -> 0`);
console.log(`${rows.length} barang stok minus.`);

if (apply && rows.length) {
  db.transaction(() => {
    // created_at dibiarkan default DB (CURRENT_TIMESTAMP, "YYYY-MM-DD HH:MM:SS") agar cocok dengan filter laporan.
    const move = db.prepare("insert into stock_movements (id, product_id, type, qty_change, reference_id) values (?, ?, 'penyesuaian', ?, 'nolkan-stok-minus')");
    for (const r of rows) {
      db.prepare("update products set stock_qty = 0 where id = ?").run(r.id);
      move.run(randomUUID(), r.id, -r.stock_qty);
    }
    const left = db.prepare("select count(*) n from products where stock_qty < 0").get().n;
    if (left !== 0) throw new Error(`Masih ada ${left} stok minus`);
  })();
  console.log("Selesai: stok minus dijadikan 0.");
} else if (!apply) {
  console.log("Pratinjau saja. Tambahkan --apply untuk menerapkan.");
}
