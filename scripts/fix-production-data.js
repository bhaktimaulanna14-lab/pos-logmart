/**
 * Perbaikan data lama (ISSUES.md B19) — jalankan SEKALI setelah versi baru di-deploy.
 *
 * 1. transactions.user_id diisi dengan PEMILIK SHIFT tempat transaksi terjadi.
 *    Dulu checkout memakai user "user-kasir-1" (Budi) untuk semua transaksi; pemilik toko
 *    mengonfirmasi bahwa kasir yang membuka shift = kasir yang melayani transaksi di shift itu.
 * 2. Melaporkan barang dengan stok minus (tidak diubah otomatis — perlu stok opname).
 *
 * Pemakaian:
 *   node scripts/fix-production-data.js sqlite.db            # PRATINJAU saja, tidak mengubah apa pun
 *   node scripts/fix-production-data.js sqlite.db --apply    # terapkan perubahan
 *
 * WAJIB backup dulu (database memakai WAL, jadi jangan sekadar cp):
 *   sqlite3 sqlite.db ".backup sqlite-backup-$(date +%F).db"
 */
const Database = require("better-sqlite3");

const file = process.argv[2];
const apply = process.argv.includes("--apply");
if (!file) {
  console.error("Pakai: node scripts/fix-production-data.js <file-database> [--apply]");
  process.exit(1);
}

const db = new Database(file, { fileMustExist: true });

const users = new Map(db.prepare("select id, name from users").all().map((u) => [u.id, u.name]));
const nameOf = (id) => users.get(id) ?? id;

// --- 1. Kasir pada transaksi ---------------------------------------------------------
const mismatched = db
  .prepare(
    `select s.user_id as shiftOwner, t.user_id as currentUser, count(*) as n, sum(t.total_amount) as amount
     from transactions t join shifts s on s.id = t.shift_id
     where t.user_id != s.user_id
     group by s.user_id, t.user_id
     order by n desc`
  )
  .all();

const totalMismatched = mismatched.reduce((a, r) => a + r.n, 0);
console.log("== 1. Transaksi yang kasirnya berbeda dari pemilik shift ==");
if (totalMismatched === 0) {
  console.log("   Tidak ada. Data kasir sudah benar.");
} else {
  for (const r of mismatched) {
    console.log(
      `   ${String(r.n).padStart(5)} transaksi (Rp ${Number(r.amount).toLocaleString("id-ID")}): ` +
        `tercatat "${nameOf(r.currentUser)}" → akan diubah ke "${nameOf(r.shiftOwner)}"`
    );
  }
  console.log(`   Total: ${totalMismatched} transaksi`);
}

// --- 2. Stok minus ---------------------------------------------------------------------
const negative = db
  .prepare("select barcode, name, stock_qty as stock from products where stock_qty < 0 order by stock_qty asc")
  .all();
console.log(`\n== 2. Barang dengan stok minus: ${negative.length} ==`);
for (const p of negative.slice(0, 20)) console.log(`   ${String(p.stock).padStart(6)}  ${p.barcode}  ${p.name}`);
if (negative.length > 20) console.log(`   ... dan ${negative.length - 20} lainnya`);
if (negative.length) {
  console.log("   → Tidak diubah otomatis. Lakukan stok opname, lalu koreksi stok lewat menu Manajemen Barang");
  console.log("     (perubahan stok di form barang tercatat sebagai 'penyesuaian').");
}

// --- Terapkan ---------------------------------------------------------------------------
if (!apply) {
  console.log("\nMode PRATINJAU — tidak ada yang diubah. Tambahkan --apply untuk menerapkan perbaikan no. 1.");
  process.exit(0);
}

const result = db.transaction(() =>
  db
    .prepare(
      `update transactions
       set user_id = (select s.user_id from shifts s where s.id = transactions.shift_id)
       where user_id != (select s.user_id from shifts s where s.id = transactions.shift_id)`
    )
    .run()
)();

const remaining = db
  .prepare("select count(*) as n from transactions t join shifts s on s.id = t.shift_id where t.user_id != s.user_id")
  .get().n;
console.log(`\nDITERAPKAN: ${result.changes} transaksi diperbarui. Sisa yang tidak cocok: ${remaining}.`);
