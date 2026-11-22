/**
 * Cetak struk ke printer thermal lewat iframe tersembunyi yang HANYA berisi struk.
 * Tidak memakai window.print() pada halaman aplikasi (dialog/layout membuat hasil cetak kosong).
 */

/** Lebar kertas printer struk toko (mm). Ganti di sini bila printer berubah (mis. 80). */
export const RECEIPT_WIDTH_MM = 58;
/** Area cetak efektif kertas 58 mm kira-kira 48 mm. */
const CONTENT_WIDTH_MM = RECEIPT_WIDTH_MM === 58 ? 48 : RECEIPT_WIDTH_MM - 8;

export const STORE_INFO = {
  name: "LOGMART TROWONO",
  address: "Jl. Trowono - Baron, Gunungkidul",
  phone: "Telp: 0812-3456-7890",
  footer: ["Terima Kasih", "Barang yang sudah dibeli tidak dapat ditukar/dikembalikan"],
};

export type PrintableReceipt = {
  id: string;
  time: string;
  cashier: string;
  items: { name: string; qty: number; price: number; discount?: number; promotionName?: string | null }[];
  total: number;
  discount?: number;
  paymentMethod: string;
  cashReceived: number;
  change: number;
};

const rp = (n: number) => (Number(n) || 0).toLocaleString("id-ID");

function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string)
  );
}

export function buildReceiptHtml(trx: PrintableReceipt): string {
  const row = (left: string, right: string, cls = "") =>
    `<div class="row ${cls}"><span>${left}</span><span>${right}</span></div>`;

  const items = trx.items
    .map(
      (item) => `
      <div class="item">
        <div class="name">${escapeHtml(item.name)}</div>
        ${row(`${item.qty} x ${rp(item.price)}`, rp(item.qty * item.price))}
        ${item.discount ? row(`  ${escapeHtml(item.promotionName || "Promo")}`, `-${rp(item.discount)}`) : ""}
      </div>`
    )
    .join("");

  return `<!doctype html>
<html lang="id"><head><meta charset="utf-8"><title>Struk ${escapeHtml(trx.id)}</title>
<style>
  @page { size: ${RECEIPT_WIDTH_MM}mm auto; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { background: #fff; color: #000; }
  body { width: ${RECEIPT_WIDTH_MM}mm; padding: 2mm ${(RECEIPT_WIDTH_MM - CONTENT_WIDTH_MM) / 2}mm 4mm;
         font-family: "Courier New", Courier, monospace; font-size: 9pt; line-height: 1.3; }
  .receipt { width: ${CONTENT_WIDTH_MM}mm; }
  .center { text-align: center; }
  .title { font-size: 11pt; font-weight: bold; }
  .sep { border-top: 1px dashed #000; margin: 1.5mm 0; }
  .row { display: flex; justify-content: space-between; gap: 2mm; }
  .row span:last-child { text-align: right; white-space: nowrap; }
  .item { margin-bottom: 1mm; }
  .name { word-break: break-word; }
  .total { font-weight: bold; font-size: 10pt; }
  .footer { margin-top: 2mm; }
</style></head>
<body><div class="receipt">
  <div class="center">
    <div class="title">${escapeHtml(STORE_INFO.name)}</div>
    <div>${escapeHtml(STORE_INFO.address)}</div>
    <div>${escapeHtml(STORE_INFO.phone)}</div>
  </div>
  <div class="sep"></div>
  <div>Tgl  : ${escapeHtml(new Date(trx.time).toLocaleString("id-ID"))}</div>
  <div>Kasir: ${escapeHtml(trx.cashier || "-")}</div>
  <div>No   : ${escapeHtml(trx.id)}</div>
  <div class="sep"></div>
  ${items}
  <div class="sep"></div>
  ${trx.discount ? row("Hemat promo", `-Rp ${rp(trx.discount)}`) : ""}
  ${row("Total", `Rp ${rp(trx.total)}`, "total")}
  ${row(escapeHtml(trx.paymentMethod?.toUpperCase?.() ?? ""), `Rp ${rp(trx.cashReceived)}`)}
  ${row("Kembali", `Rp ${rp(trx.change)}`)}
  <div class="sep"></div>
  <div class="center footer">${STORE_INFO.footer.map((l) => `<div>${escapeHtml(l)}</div>`).join("")}</div>
</div></body></html>`;
}

/** Cetak struk lewat iframe tersembunyi; iframe dihapus setelah dialog cetak ditutup. */
export function printReceipt(trx: PrintableReceipt): void {
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  document.body.appendChild(iframe);

  const cleanup = () => setTimeout(() => iframe.remove(), 500);
  iframe.onload = () => {
    const win = iframe.contentWindow;
    if (!win) return cleanup();
    win.onafterprint = cleanup;
    win.focus();
    win.print();
    // Cadangan bila onafterprint tidak terpanggil di browser tertentu.
    setTimeout(cleanup, 60_000);
  };
  iframe.srcdoc = buildReceiptHtml(trx);
}
