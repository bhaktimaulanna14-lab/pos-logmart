// Helper tampilan tanggal kadaluarsa di browser (tanggal toko = WIB, UTC+7).

const WIB_MS = 7 * 3_600_000;

/** Tanggal WIB hari ini + `days` hari (YYYY-MM-DD). */
export const todayWib = (days = 0) => new Date(Date.now() + WIB_MS + days * 86_400_000).toISOString().slice(0, 10);

export const formatExpiry = (date: string) =>
  new Date(date + "T00:00:00").toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });

/** Warna tanda kadaluarsa: merah = sudah lewat, kuning = ≤30 hari, abu-abu = masih lama. */
export function expiryClass(date: string) {
  if (date < todayWib()) return "text-red-700 bg-red-50 border-red-200";
  if (date <= todayWib(30)) return "text-amber-700 bg-amber-50 border-amber-200";
  return "text-slate-600 bg-slate-50 border-slate-200";
}
