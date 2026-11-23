/**
 * Migrasi AMAN untuk database produksi yang sudah berisi data (versi perbaikan Nov 2026).
 *
 * JANGAN pakai `npx drizzle-kit push` pada database produksi: pada database lama ia mendeteksi
 * kolom baru `transaction_items.discount` sebagai "data loss" dan akan menjalankan
 * `delete from transaction_items` bila dikonfirmasi — seluruh rincian transaksi hilang.
 *
 * Skrip ini hanya MENAMBAH (tabel/kolom/index), tidak pernah menghapus data,
 * dan aman dijalankan berulang (idempoten).
 *
 *   node scripts/migrate-2026-11.js sqlite.db
 *
 * Backup dulu:  sqlite3 sqlite.db ".backup sqlite-backup-$(date +%F).db"
 */
const Database = require("better-sqlite3");

const file = process.argv[2];
if (!file) {
  console.error("Pakai: node scripts/migrate-2026-11.js <file-database>");
  process.exit(1);
}
const db = new Database(file, { fileMustExist: true });

const hasTable = (name) => !!db.prepare("select 1 from sqlite_master where type='table' and name=?").get(name);
const hasColumn = (table, col) => db.prepare(`pragma table_info(${table})`).all().some((c) => c.name === col);
const steps = [];
const run = (label, sql) => {
  db.exec(sql);
  steps.push(label);
};

db.transaction(() => {
  // 1. Tabel retur pembelian (ada di skema, tapi mungkin belum ada di database lama)
  if (!hasTable("purchase_returns")) {
    run("buat tabel purchase_returns", `
      CREATE TABLE purchase_returns (
        id text PRIMARY KEY NOT NULL,
        return_number text NOT NULL,
        supplier_name text NOT NULL,
        product_id text NOT NULL REFERENCES products(id),
        quantity integer NOT NULL,
        reason text NOT NULL,
        status text DEFAULT 'pending' NOT NULL,
        processed_by text REFERENCES users(id),
        created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
        processed_at text
      )`);
  }

  // 2. Tabel promo
  if (!hasTable("promotions")) {
    run("buat tabel promotions", `
      CREATE TABLE promotions (
        id text PRIMARY KEY NOT NULL,
        name text NOT NULL,
        type text NOT NULL,
        target_type text NOT NULL,
        product_id text REFERENCES products(id),
        category_id text REFERENCES categories(id),
        value integer NOT NULL,
        min_qty integer DEFAULT 1 NOT NULL,
        start_date text NOT NULL,
        end_date text NOT NULL,
        is_active integer DEFAULT true NOT NULL,
        created_by text REFERENCES users(id),
        created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL
      )`);
  }

  // 3. Kolom diskon promo di rincian transaksi (data lama otomatis diskon 0)
  if (!hasColumn("transaction_items", "discount")) run("tambah kolom transaction_items.discount", "ALTER TABLE transaction_items ADD discount integer DEFAULT 0 NOT NULL");
  if (!hasColumn("transaction_items", "promotion_id")) run("tambah kolom transaction_items.promotion_id", "ALTER TABLE transaction_items ADD promotion_id text");
  if (!hasColumn("transaction_items", "promotion_name")) run("tambah kolom transaction_items.promotion_name", "ALTER TABLE transaction_items ADD promotion_name text");

  // 3b. Pembatalan transaksi oleh kasir (data lama otomatis tidak batal)
  if (!hasColumn("transactions", "voided_at")) run("tambah kolom transactions.voided_at", "ALTER TABLE transactions ADD voided_at text");
  if (!hasColumn("transactions", "voided_by")) run("tambah kolom transactions.voided_by", "ALTER TABLE transactions ADD voided_by text REFERENCES users(id)");
  if (!hasColumn("transactions", "void_reason")) run("tambah kolom transactions.void_reason", "ALTER TABLE transactions ADD void_reason text");

  // 3c. Tanggal kadaluarsa per batch stok
  if (!hasTable("product_batches")) {
    run("buat tabel product_batches", `
      CREATE TABLE product_batches (
        id text PRIMARY KEY NOT NULL,
        product_id text NOT NULL REFERENCES products(id),
        expiry_date text NOT NULL,
        remaining_qty integer NOT NULL,
        source text NOT NULL,
        reference_id text,
        created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL
      )`);
  }

  // 3d. Catat stok bertanggal yang terpakai per item, agar pembatalan bisa mengembalikan tanggalnya
  if (!hasColumn("transaction_items", "batch_usage")) run("tambah kolom transaction_items.batch_usage", "ALTER TABLE transaction_items ADD batch_usage text");

  // 4. Index (mempercepat laporan, pencarian, dan kasir)
  const indexes = [
    "CREATE UNIQUE INDEX IF NOT EXISTS purchase_returns_return_number_unique ON purchase_returns (return_number)",
    "CREATE INDEX IF NOT EXISTS products_name_idx ON products (name)",
    "CREATE INDEX IF NOT EXISTS products_category_idx ON products (category_id)",
    "CREATE INDEX IF NOT EXISTS products_active_stock_idx ON products (is_active, stock_qty)",
    "CREATE INDEX IF NOT EXISTS shifts_user_status_idx ON shifts (user_id, status)",
    "CREATE INDEX IF NOT EXISTS shifts_open_at_idx ON shifts (open_at)",
    "CREATE INDEX IF NOT EXISTS stock_movements_product_time_idx ON stock_movements (product_id, created_at)",
    "CREATE INDEX IF NOT EXISTS stock_movements_type_time_idx ON stock_movements (type, created_at)",
    "CREATE INDEX IF NOT EXISTS transaction_items_trx_idx ON transaction_items (transaction_id)",
    "CREATE INDEX IF NOT EXISTS transaction_items_product_idx ON transaction_items (product_id)",
    "CREATE INDEX IF NOT EXISTS transactions_time_idx ON transactions (transaction_time)",
    "CREATE INDEX IF NOT EXISTS transactions_shift_idx ON transactions (shift_id)",
    "CREATE INDEX IF NOT EXISTS transactions_user_idx ON transactions (user_id)",
    "CREATE INDEX IF NOT EXISTS promotions_period_idx ON promotions (is_active, start_date, end_date)",
    "CREATE INDEX IF NOT EXISTS promotions_product_idx ON promotions (product_id)",
    "CREATE INDEX IF NOT EXISTS promotions_category_idx ON promotions (category_id)",
    "CREATE INDEX IF NOT EXISTS product_batches_product_expiry_idx ON product_batches (product_id, expiry_date)",
  ];
  const before = db.prepare("select count(*) n from sqlite_master where type='index'").get().n;
  for (const sql of indexes) db.exec(sql);
  const after = db.prepare("select count(*) n from sqlite_master where type='index'").get().n;
  if (after > before) steps.push(`buat ${after - before} index baru`);
})();

const counts = db.prepare("select (select count(*) from transactions) trx, (select count(*) from transaction_items) items").get();
console.log(steps.length ? "Selesai:\n - " + steps.join("\n - ") : "Tidak ada perubahan — database sudah versi terbaru.");
console.log(`Cek data: ${counts.trx} transaksi, ${counts.items} rincian barang (harus sama seperti sebelum migrasi).`);
