/**
 * Tambah akun uji KHUSUS LOKAL ke database salinan (mis. sqlite-prod.db).
 * Jangan dijalankan ke database produksi.
 *
 *   node scripts/seed-test-users.js sqlite-prod.db
 *
 * Akun uji (password hanya untuk pengujian lokal):
 *   uji-manajer / uji-lokal-123  (role manajer)
 *   uji-kasir   / uji-lokal-123  (role kasir)
 */
const Database = require("better-sqlite3");
const bcrypt = require("bcryptjs");

const file = process.argv[2];
if (!file || file === "sqlite.db") {
  console.error("Beri nama file database salinan, contoh: node scripts/seed-test-users.js sqlite-prod.db");
  process.exit(1);
}

const db = new Database(file);
const hash = bcrypt.hashSync("uji-lokal-123", 10);
const now = new Date().toISOString();
const upsert = db.prepare(
  `INSERT INTO users (id, name, username, password_hash, role, is_active, created_at)
   VALUES (?, ?, ?, ?, ?, 1, ?)
   ON CONFLICT(id) DO UPDATE SET password_hash = excluded.password_hash, is_active = 1`
);
upsert.run("user-uji-manajer", "Uji Manajer (lokal)", "uji-manajer", hash, "manajer", now);
upsert.run("user-uji-kasir", "Uji Kasir (lokal)", "uji-kasir", hash, "kasir", now);
console.log("Akun uji ditambahkan ke", file);
