/**
 * Sederhanakan kategori barang: gabungkan kategori dobel/beda ejaan sesuai src/lib/category-map.json.
 * Produk & promo dipindah ke kategori baru, kategori lama yang kosong dihapus. Tidak ada data produk yang hilang.
 *
 *   node scripts/simplify-categories.js sqlite.db           # pratinjau saja
 *   node scripts/simplify-categories.js sqlite.db --apply   # jalankan
 *
 * Backup dulu. Aman dijalankan berulang (idempoten).
 */
const Database = require("better-sqlite3");
const map = require("../src/lib/category-map.json");

const file = process.argv[2];
const apply = process.argv.includes("--apply");
if (!file) {
  console.error("Pakai: node scripts/simplify-categories.js <file-database> [--apply]");
  process.exit(1);
}
const db = new Database(file, { fileMustExist: true });

const norm = (s) => String(s).trim().replace(/\s+/g, " ").toUpperCase();
const alias = new Map();
for (const [target, olds] of Object.entries(map)) {
  alias.set(norm(target), target);
  for (const o of olds) alias.set(norm(o), target);
}

const cats = db.prepare(`
  select c.id, c.name,
    (select count(*) from products p where p.category_id = c.id) n,
    (select count(*) from promotions pr where pr.category_id = c.id) promos
  from categories c`).all();

const groups = new Map();
const unmapped = [];
for (const c of cats) {
  const target = alias.get(norm(c.name));
  if (!target) unmapped.push(c);
  else groups.set(target, [...(groups.get(target) ?? []), c]);
}

console.log(`Kategori sekarang: ${cats.length}. Setelah dirapikan: ${groups.size}.\n`);
for (const [target, list] of groups) {
  const total = list.reduce((s, c) => s + c.n, 0);
  console.log(`${target} (${total} produk) <- ${list.map((c) => `${c.name} [${c.n}]`).join(", ")}`);
}
const blocking = unmapped.filter((c) => c.n > 0 || c.promos > 0);
if (unmapped.length) console.log(`\nTidak terpetakan: ${unmapped.map((c) => `${c.name} [${c.n} produk, ${c.promos} promo]`).join(", ")}`);
if (blocking.length) {
  console.error("\nBERHENTI: kategori di atas masih punya produk/promo. Tambahkan ke src/lib/category-map.json dulu.");
  process.exit(1);
}
const changes = cats.length - groups.size + [...groups].filter(([t, l]) => l.length === 1 && l[0].name !== t).length;
if (!changes) {
  console.log("\nTidak ada perubahan — kategori sudah rapi.");
  process.exit(0);
}
if (!apply) {
  console.log("\nPratinjau saja. Tambahkan --apply untuk menjalankan.");
  process.exit(0);
}

const productsBefore = db.prepare("select count(*) n from products").get().n;
db.transaction(() => {
  const moveProducts = db.prepare("update products set category_id = ? where category_id = ?");
  const movePromos = db.prepare("update promotions set category_id = ? where category_id = ?");
  const del = db.prepare("delete from categories where id = ?");
  for (const [target, list] of groups) {
    // Pertahankan id kategori dengan produk terbanyak agar perubahan sesedikit mungkin.
    const keep = [...list].sort((a, b) => b.n - a.n)[0];
    db.prepare("update categories set name = ? where id = ?").run(target, keep.id);
    for (const c of list) {
      if (c.id === keep.id) continue;
      moveProducts.run(keep.id, c.id);
      movePromos.run(keep.id, c.id);
      del.run(c.id);
    }
  }
  for (const c of unmapped) del.run(c.id);

  const after = db.prepare("select count(*) n from products").get().n;
  const orphans = db.prepare("select count(*) n from products where category_id not in (select id from categories)").get().n;
  const orphanPromos = db.prepare("select count(*) n from promotions where category_id is not null and category_id not in (select id from categories)").get().n;
  const catCount = db.prepare("select count(*) n from categories").get().n;
  if (after !== productsBefore || orphans || orphanPromos || catCount !== groups.size) {
    throw new Error(`Cek gagal (produk ${productsBefore}->${after}, yatim ${orphans}, promo yatim ${orphanPromos}, kategori ${catCount}); dibatalkan.`);
  }
})();
console.log(`\nSelesai: ${groups.size} kategori, ${productsBefore} produk tetap utuh.`);
