// Format angka dan tanggal untuk tampilan (bahasa Indonesia). Pakai ini, jangan menulis format sendiri per halaman.

/** 15000 → "Rp 15.000". Kosong dihitung 0. */
export const formatRupiah = (n: number | null | undefined) =>
  `Rp ${Math.round(n || 0).toLocaleString("id-ID")}`;

/** Untuk ruang sempit (sumbu grafik, kartu di HP): 1250000 → "Rp 1,3jt", 15000 → "Rp 15rb". */
export const formatRupiahSingkat = (n: number) =>
  n >= 1_000_000 ? `Rp ${(n / 1_000_000).toLocaleString("id-ID", { maximumFractionDigits: 1 })}jt`
  : n >= 1_000 ? `Rp ${Math.round(n / 1_000).toLocaleString("id-ID")}rb`
  : `Rp ${n}`;

/** "2026-11-23..." → "23 November 2026". */
export const formatTanggal = (iso: string) =>
  new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });

/** "2026-11-23T10:06:17Z" → "23 Nov 2026, 17.06" (jam lokal). Kosong → "-". */
export const formatTanggalJam = (iso: string | null | undefined) =>
  iso
    ? new Date(iso).toLocaleString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : "-";
