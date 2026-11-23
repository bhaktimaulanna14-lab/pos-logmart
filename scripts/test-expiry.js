/**
 * Uji end-to-end fitur kadaluarsa (batch + FIFO) lewat API. KHUSUS LOKAL, jangan ke produksi.
 *
 * Persiapan (sekali):
 *   1. Salin database ke sqlite-prod.db (hapus dulu sqlite-prod.db-wal / -shm lama bila ada).
 *   2. node scripts/migrate-2026-11.js sqlite-prod.db
 *   3. node scripts/seed-test-users.js sqlite-prod.db
 *   4. node scripts/dev-prod-copy.js            (server lokal di http://localhost:3000)
 * Jalankan:
 *   node scripts/test-expiry.js sqlite-prod.db
 *
 * File database dibutuhkan untuk menyiapkan kasus stok minus (API tidak mengizinkan stok negatif).
 * Keluar dengan kode 1 bila ada cek yang gagal.
 */
const Database = require("better-sqlite3");

const file = process.argv[2];
if (!file || file === "sqlite.db") {
  console.error("Beri nama file database salinan yang dipakai server lokal, contoh: node scripts/test-expiry.js sqlite-prod.db");
  process.exit(1);
}
const base = "http://localhost:3000";
const results = [];
const check = (name, ok, detail) => results.push({ ok: !!ok, name, detail });

async function login(username) {
  const r = await fetch(base + "/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password: "uji-lokal-123" }),
  });
  return (r.headers.get("set-cookie") || "").split(";")[0];
}
function client(cookie) {
  const call = async (method, url, body) => {
    const r = await fetch(base + url, { method, headers: { cookie, ...(body ? { "Content-Type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined });
    let json = null;
    try { json = await r.json(); } catch {}
    return { status: r.status, json };
  };
  return { get: (u) => call("GET", u), post: (u, b) => call("POST", u, b), put: (u, b) => call("PUT", u, b), patch: (u, b) => call("PATCH", u, b) };
}

(async () => {
  const mgr = client(await login("uji-manajer"));
  const kasir = client(await login("uji-kasir"));
  const pick = new Database(file, { readonly: true });
  const [P, Q] = pick.prepare("select id, barcode from products where is_active = 1 and stock_qty >= 10 order by name limit 2").all();
  pick.close();
  if (!P || !Q) throw new Error("Butuh minimal 2 barang aktif dengan stok >= 10 di database uji");

  const batchesOf = async (id) => (await mgr.get(`/api/products/${id}/batches`)).json.data;
  const bstr = async (id = P.id) => (await batchesOf(id)).batches.map((b) => `${b.expiryDate}:${b.qty}:${b.source}`).join(",");
  const stock = async () => (await batchesOf(P.id)).stockQty;
  const s0 = await stock();

  // Validasi input
  let r = await mgr.put(`/api/products/${P.id}/batches`, { batches: [{ expiryDate: "2030-01-01", qty: s0 + 1 }] });
  check("total > stok ditolak", r.status === 400, r.json?.message);
  r = await mgr.put(`/api/products/${P.id}/batches`, { batches: [{ expiryDate: "2030-02-30", qty: 1 }] });
  check("tanggal 30 Feb ditolak", r.status === 400, r.json?.message);
  r = await kasir.put(`/api/products/${P.id}/batches`, { batches: [] });
  check("kasir tidak boleh ubah kadaluarsa", r.status === 403, r.status);
  r = await mgr.put(`/api/products/${P.id}/batches`, { batches: [{ expiryDate: "2099-12-31", qty: 3 }, { expiryDate: "2020-01-01", qty: 2 }] });
  check("simpan batch manual", r.status === 200, r.json?.message);
  check("batch urut tanggal", (await bstr()) === "2020-01-01:2:manual,2099-12-31:3:manual", await bstr());

  // Tampilan peringatan
  const lk = (await kasir.get("/api/products/lookup?q=" + encodeURIComponent(P.barcode))).json.data.find((p) => p.id === P.id);
  check("lookup kasir berisi nearestExpiry", lk?.nearestExpiry === "2020-01-01", lk?.nearestExpiry);
  const soon = (await mgr.get("/api/products?page=1&pageSize=200&expiry=soon")).json;
  check("filter expiry=soon memuat barang", soon.data.some((p) => p.id === P.id) && soon.data.every((p) => p.nearestExpiry), soon.total);
  const exp = (await mgr.get("/api/dashboard/expiring?limit=500")).json;
  check("dashboard memuat batch kadaluarsa", exp.data.some((b) => b.productId === P.id && b.expiryDate === "2020-01-01"), exp.total);

  // FIFO pada penjualan, pembatalan, koreksi stok
  await kasir.post("/api/shifts/open", { openingCash: 100000 });
  const shift = (await kasir.get("/api/shifts/active")).json.data;
  r = await kasir.post("/api/transactions", { items: [{ id: P.id, qty: 3 }], paymentMethod: "tunai", cashReceived: 1000000 });
  check("checkout 3 pcs", r.json?.success, r.json?.message);
  check("FIFO: tanggal terdekat habis dulu", (await bstr()) === "2099-12-31:2:manual", await bstr());
  r = await kasir.patch(`/api/transactions/${r.json.data.id}`, { reason: "uji batal" });
  check("batalkan transaksi", r.status === 200, r.json?.message);
  check("pembatalan mengembalikan tanggal yang terpakai", (await bstr()) === "2020-01-01:2:manual,2099-12-31:3:manual" && (await stock()) === s0, `${await bstr()} stok ${await stock()}`);
  r = await mgr.put(`/api/products/${P.id}`, { stockQty: s0 - 1 });
  check("koreksi stok turun 1", r.status === 200, r.json?.message);
  check("batch ikut berkurang (FIFO)", (await bstr()) === "2020-01-01:1:manual,2099-12-31:3:manual", await bstr());

  // Penerimaan PO + retur ke supplier
  r = await mgr.post("/api/purchase-orders", { supplierName: "Uji Supplier", orderDate: "2026-11-23", items: [{ productId: P.id, qty: 5 }] });
  const poId = r.json?.data?.id;
  check("buat PO", poId, r.json?.message);
  r = await mgr.post("/api/purchase-orders/receive", { poId, receivedItems: [{ productId: P.id, qty: 5, expiryDate: "2030-13-01" }] });
  check("terima PO dengan bulan 13 ditolak", r.status === 400, r.json?.message);
  r = await mgr.post("/api/purchase-orders/receive", { poId, receivedItems: [{ productId: P.id, qty: 5, expiryDate: "2030-06-01" }] });
  check("terima PO + kadaluarsa", r.status === 200, r.json?.message);
  check("batch PO tercatat", (await bstr()) === "2020-01-01:1:manual,2030-06-01:5:po,2099-12-31:3:manual", await bstr());
  r = await mgr.post("/api/returns/purchase", { supplierName: "Uji Supplier", productId: P.id, quantity: 2, reason: "rusak" });
  check("retur ke supplier", r.status === 200, r.json?.message);
  check("retur memakai FIFO", (await bstr()) === "2030-06-01:4:po,2099-12-31:3:manual", await bstr());

  // Stok minus: batch tidak boleh melebihi stok setelah barang diterima
  const raw = new Database(file);
  raw.prepare("update products set stock_qty = -5 where id = ?").run(Q.id);
  raw.prepare("delete from product_batches where product_id = ?").run(Q.id);
  raw.close();
  r = await mgr.post("/api/purchase-orders", { supplierName: "Uji Supplier", orderDate: "2026-11-23", items: [{ productId: Q.id, qty: 10 }] });
  r = await mgr.post("/api/purchase-orders/receive", { poId: r.json?.data?.id, receivedItems: [{ productId: Q.id, qty: 10, expiryDate: "2030-06-01" }] });
  const q = await batchesOf(Q.id);
  check("stok minus: batch dibatasi ke stok", q.stockQty === 5 && (await bstr(Q.id)) === "2030-06-01:5:po", `stok ${q.stockQty}, batch ${await bstr(Q.id)}`);

  await kasir.post("/api/shifts/close", { closingCash: 100000, shiftId: shift.id });
  for (const x of results) console.log(x.ok ? "PASS" : "FAIL", x.name, x.ok ? "" : JSON.stringify(x.detail));
  const failed = results.filter((x) => !x.ok).length;
  console.log(`${results.length - failed}/${results.length} lulus`);
  process.exit(failed ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
