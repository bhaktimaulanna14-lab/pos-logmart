/**
 * Periode laporan dalam zona waktu toko (WIB, UTC+7).
 *
 * Query string yang didukung:
 *   ?period=hariIni | 7hari | bulanIni | tahunIni      (default: 7hari)
 *   ?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD           (kustom, tanggal WIB, inklusif)
 *
 * Kolom tanggal di DB disimpan dalam UTC dengan dua format:
 *   - transactions.transaction_time, shifts.open_at : ISO  "2026-11-22T02:44:08.162Z"
 *   - stock_movements.created_at (CURRENT_TIMESTAMP)  : SQL  "2026-11-22 02:44:08"
 */

export const STORE_UTC_OFFSET_HOURS = 7;
const OFFSET_MS = STORE_UTC_OFFSET_HOURS * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export type PeriodKey = "hariIni" | "7hari" | "bulanIni" | "tahunIni" | "kustom";

export type ReportPeriod = {
  key: PeriodKey;
  label: string;
  /** Awal periode (inklusif), UTC. */
  start: Date;
  /** Akhir periode (eksklusif), UTC. */
  end: Date;
  startIso: string;
  endIso: string;
  /** Format "YYYY-MM-DD HH:MM:SS" untuk kolom CURRENT_TIMESTAMP. */
  startSql: string;
  endSql: string;
  /** Daftar tanggal WIB (YYYY-MM-DD) di dalam periode, untuk sumbu grafik harian. */
  days: string[];
  /** true bila periode panjang sehingga grafik sebaiknya per bulan. */
  groupByMonth: boolean;
};

/** Tanggal kalender WIB (YYYY-MM-DD) untuk sebuah waktu UTC. */
export function toStoreDate(value: string | Date): string {
  const d = typeof value === "string" ? new Date(value.includes("T") ? value : value.replace(" ", "T") + "Z") : value;
  return new Date(d.getTime() + OFFSET_MS).toISOString().slice(0, 10);
}

/** Awal hari WIB (00:00 WIB) untuk tanggal YYYY-MM-DD, sebagai Date UTC. */
function storeDayStart(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d) - OFFSET_MS);
}

const toSql = (d: Date) => d.toISOString().slice(0, 19).replace("T", " ");
const isYmd = (s: string | null): s is string => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);

export function resolvePeriod(params: URLSearchParams, now = new Date()): ReportPeriod {
  const today = toStoreDate(now);
  const [ty, tm] = today.split("-").map(Number);
  const startDate = params.get("startDate");
  const endDate = params.get("endDate");

  let key = (params.get("period") as PeriodKey) || "7hari";
  let startYmd: string;
  let endYmd: string; // inklusif

  if (isYmd(startDate) && isYmd(endDate)) {
    key = "kustom";
    [startYmd, endYmd] = startDate <= endDate ? [startDate, endDate] : [endDate, startDate];
  } else if (key === "hariIni") {
    startYmd = endYmd = today;
  } else if (key === "bulanIni") {
    startYmd = `${ty}-${String(tm).padStart(2, "0")}-01`;
    endYmd = today;
  } else if (key === "tahunIni") {
    startYmd = `${ty}-01-01`;
    endYmd = today;
  } else {
    key = "7hari";
    startYmd = toStoreDate(new Date(storeDayStart(today).getTime() - 6 * DAY_MS));
    endYmd = today;
  }

  const start = storeDayStart(startYmd);
  const end = new Date(storeDayStart(endYmd).getTime() + DAY_MS);

  const days: string[] = [];
  for (let t = start.getTime(); t < end.getTime() && days.length < 400; t += DAY_MS) {
    days.push(toStoreDate(new Date(t)));
  }

  const labels: Record<PeriodKey, string> = {
    hariIni: "Hari Ini",
    "7hari": "7 Hari Terakhir",
    bulanIni: "Bulan Ini",
    tahunIni: "Tahun Ini",
    kustom: `${startYmd} s/d ${endYmd}`,
  };

  return {
    key,
    label: labels[key],
    start,
    end,
    startIso: start.toISOString(),
    endIso: end.toISOString(),
    startSql: toSql(start),
    endSql: toSql(end),
    days,
    groupByMonth: days.length > 62,
  };
}

/** Periode sebelumnya dengan panjang sama (untuk perbandingan "dari periode lalu"). */
export function previousPeriod(p: ReportPeriod): { startIso: string; endIso: string } {
  const len = p.end.getTime() - p.start.getTime();
  return { startIso: new Date(p.start.getTime() - len).toISOString(), endIso: p.startIso };
}
