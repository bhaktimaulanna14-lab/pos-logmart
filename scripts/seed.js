/**
 * Logmart POS — Comprehensive Seed Script
 * Idempoten: hapus semua data lama → isi ulang.
 * Jalankan: node scripts/seed.js
 */

const b = require("better-sqlite3");
const db = b("./sqlite.db");
const crypto = require("crypto");

function uuid() {
  return crypto.randomUUID();
}

// ---------------------------------------------------------------------------
// Simple password hash (menggunakan bcryptjs agar sesuai backend)
// ---------------------------------------------------------------------------
const bcrypt = require("bcryptjs");
function hashPass(plain) {
  const salt = bcrypt.genSaltSync(10);
  return bcrypt.hashSync(plain, salt);
}

// ---------------------------------------------------------------------------
// Helpers untuk tanggal relatif
// ---------------------------------------------------------------------------
function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

function isoAgo(n, hour = 10) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

// ---------------------------------------------------------------------------
// Bersihkan semua data (urutan harus memperhatikan FK)
// ---------------------------------------------------------------------------
console.log("🗑  Membersihkan data lama...");
db.exec(`
  DELETE FROM stock_movements;
  DELETE FROM returns;
  DELETE FROM transaction_items;
  DELETE FROM transactions;
  DELETE FROM pending_cart_items;
  DELETE FROM pending_carts;
  DELETE FROM purchase_order_items;
  DELETE FROM purchase_orders;
  DELETE FROM shifts;
  DELETE FROM products;
  DELETE FROM categories;
  DELETE FROM users;
`);
console.log("   ✓ Selesai bersihkan");

// ---------------------------------------------------------------------------
// 1. USERS
// ---------------------------------------------------------------------------
console.log("👤 Menanam users...");
const ADMIN_ID = "user-admin-1";
const KASIR_ID = "user-kasir-1";
const KASIR2_ID = "user-kasir-2";

db.prepare(
  `INSERT INTO users (id, name, username, password_hash, role, is_active, created_at) VALUES (?, ?, ?, ?, ?, 1, ?)`
).run(ADMIN_ID, "Ahmad Fauzi (Admin)", "admin", hashPass("admin123"), "manajer", isoAgo(60));

db.prepare(
  `INSERT INTO users (id, name, username, password_hash, role, is_active, created_at) VALUES (?, ?, ?, ?, ?, 1, ?)`
).run(KASIR_ID, "Budi Santoso", "kasir1", hashPass("kasir123"), "kasir", isoAgo(60));

db.prepare(
  `INSERT INTO users (id, name, username, password_hash, role, is_active, created_at) VALUES (?, ?, ?, ?, ?, 1, ?)`
).run(KASIR2_ID, "Siti Rahayu", "kasir2", hashPass("kasir123"), "kasir", isoAgo(30));
console.log("   ✓ 3 users");

// ---------------------------------------------------------------------------
// 2. CATEGORIES
// ---------------------------------------------------------------------------
console.log("🏷  Menanam categories...");
const cats = [
  { id: "cat-sembako", name: "Sembako", description: "Bahan kebutuhan pokok" },
  { id: "cat-minuman", name: "Minuman", description: "Minuman ringan & kemasan" },
  { id: "cat-snack", name: "Snack & Makanan Ringan", description: "Camilan & keripik" },
  { id: "cat-kebersihan", name: "Produk Kebersihan", description: "Sabun, sampo, deterjen" },
  { id: "cat-rokok", name: "Rokok", description: "Rokok & tembakau" },
];
const insCategory = db.prepare(
  `INSERT INTO categories (id, name, description) VALUES (?, ?, ?)`
);
cats.forEach((c) => insCategory.run(c.id, c.name, c.description));
console.log(`   ✓ ${cats.length} categories`);

// ---------------------------------------------------------------------------
// 3. PRODUCTS (≥ 15, beberapa stok menipis)
// ---------------------------------------------------------------------------
console.log("📦 Menanam products...");
const products = [];
const insProd = db.prepare(
  `INSERT INTO products (id, barcode, name, category_id, price, cost, stock_qty, min_stock, is_active, created_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`
);
products.forEach((p) => insProd.run(p.id, p.barcode, p.name, p.catId, p.price, p.cost, p.stock, p.minStock, isoAgo(60)));
console.log(`   ✓ ${products.length} products (${products.filter(p => p.stock < p.minStock).length} stok menipis)`);

// Data contoh lain (Shifts, PO, Transactions, Returns) dihapus untuk deploy.
// ---------------------------------------------------------------------------
// DONE
// ---------------------------------------------------------------------------
console.log("\n✅ Seed selesai!\n");
console.log("Data yang telah ditanam:");
console.log("  👤 Users      : admin, kasir1, kasir2");
console.log("  🏷  Categories : 5 kategori");
console.log("\nCredential login demo:");
console.log("  Admin   → username: admin   | password: admin123");
console.log("  Kasir   → username: kasir1  | password: kasir123");

db.close();
