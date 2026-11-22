"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  TrendingUp, TrendingDown, DollarSign, Package, Calendar, Download, Loader2, Receipt, ChevronRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

type Preset = "hariIni" | "7hari" | "bulanIni" | "tahunIni";
const PRESETS: { key: Preset; label: string }[] = [
  { key: "hariIni", label: "Hari Ini" },
  { key: "7hari", label: "7 Hari Terakhir" },
  { key: "bulanIni", label: "Bulan Ini" },
  { key: "tahunIni", label: "Tahun Ini" },
];

type SalesData = {
  period: { label: string };
  summary: {
    totalRevenue: number;
    totalTransactions: number;
    avgTransaction: number;
    revenueChangePct: number | null;
    transactionsChangePct: number | null;
  };
  chartData: { key: string; name: string; sales: number; count: number }[];
};
type TopProduct = { productId: string; name: string; qty: number; revenue: number };
type ShiftSummary = { shiftType: string; shifts: number; totalSales: number; totalTransactions: number };
type MovingItem = { productId: string; name: string; qty: number; perDay: number; stock?: number };
type AttendanceRow = { userId: string; userName: string; totalShifts: number; totalWorkMs: number; avgWorkMs: number; openShifts: number };

const rp = (n: number) => `Rp ${Math.round(n || 0).toLocaleString("id-ID")}`;
const compactRp = (n: number) =>
  n >= 1_000_000 ? `Rp ${(n / 1_000_000).toLocaleString("id-ID", { maximumFractionDigits: 1 })}jt`
  : n >= 1_000 ? `Rp ${Math.round(n / 1_000).toLocaleString("id-ID")}rb`
  : `Rp ${n}`;

function formatMs(ms: number) {
  const totalMins = Math.floor(ms / 60000);
  const hours = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  if (hours === 0 && mins === 0) return "-";
  return `${hours} jam ${mins} menit`;
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  const json = await res.json();
  if (!json.success) throw new Error(json.message || "Gagal memuat data");
  return json as T;
}

function ChangeBadge({ pct }: { pct: number | null | undefined }) {
  if (pct === null || pct === undefined) {
    return <p className="text-xs text-slate-500 mt-1">Tidak ada data periode sebelumnya</p>;
  }
  const up = pct >= 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <p className={`text-xs font-medium flex items-center mt-1 ${up ? "text-brand-green" : "text-red-600"}`}>
      <Icon className="w-3 h-3 mr-1" />
      {up ? "+" : ""}{pct.toLocaleString("id-ID")}% dari periode sebelumnya
    </p>
  );
}

export default function ReportsPage() {
  const [preset, setPreset] = useState<Preset>("7hari");
  const [showCustomDate, setShowCustomDate] = useState(false);
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  const [sales, setSales] = useState<SalesData | null>(null);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [shiftSummary, setShiftSummary] = useState<ShiftSummary[]>([]);
  const [moving, setMoving] = useState<{ fastMoving: MovingItem[]; slowMoving: MovingItem[] }>({ fastMoving: [], slowMoving: [] });
  const [attendance, setAttendance] = useState<AttendanceRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Query periode yang sama untuk semua API & unduhan Excel.
  const customReady = !!(showCustomDate && customStart && customEnd);
  const query = useMemo(
    () => (customReady ? `startDate=${customStart}&endDate=${customEnd}` : `period=${preset}`),
    [customReady, customStart, customEnd, preset]
  );

  useEffect(() => {
    if (showCustomDate && !customReady) return; // tunggu kedua tanggal kustom terisi
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    Promise.all([
      getJson<{ data: SalesData }>(`/api/reports/sales?${query}`),
      getJson<{ data: TopProduct[] }>(`/api/reports/top-products?${query}&limit=5`),
      getJson<{ summary: ShiftSummary[] }>(`/api/reports/shifts?${query}`),
      getJson<{ data: { fastMoving: MovingItem[]; slowMoving: MovingItem[] } }>(`/api/reports/stock-movements?${query}`),
      getJson<{ data: AttendanceRow[] }>(`/api/reports/attendance?${query}`),
    ])
      .then(([s, t, sh, mv, at]) => {
        if (cancelled) return;
        setSales(s.data);
        setTopProducts(t.data);
        setShiftSummary(sh.summary);
        setMoving({ fastMoving: mv.data.fastMoving, slowMoving: mv.data.slowMoving });
        setAttendance(at.data);
      })
      .catch((e) => !cancelled && setError(e.message || "Gagal memuat laporan"))
      .finally(() => !cancelled && setIsLoading(false));

    return () => {
      cancelled = true;
    };
  }, [query, showCustomDate, customReady]);

  const download = (path: string) => {
    window.location.href = `${path}?${query}`;
  };

  const periodLabel = sales?.period.label ?? PRESETS.find((p) => p.key === preset)?.label;
  const summary = sales?.summary;
  const isMonthly = !!sales?.chartData[0] && sales.chartData[0].key.length === 7;

  return (
    <div className="p-6 md:p-10 space-y-8 max-w-6xl mx-auto bg-slate-50">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Laporan Penjualan</h1>
          <p className="text-muted-foreground mt-1 text-sm">Tinjauan performa dan analitik toko Logmart Trowono.</p>
        </div>
        <div className="flex gap-4 text-sm">
          <Link href="/reports/shifts" className="inline-flex items-center gap-1 text-brand-green hover:underline">
            Detail Shift <ChevronRight className="w-4 h-4" />
          </Link>
          <Link href="/reports/stock-movements" className="inline-flex items-center gap-1 text-brand-green hover:underline">
            Pergerakan Stok <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {/* Filter periode */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-4 rounded-xl border shadow-sm gap-4">
        <div className="flex gap-2 overflow-x-auto w-full md:w-auto pb-2 md:pb-0">
          {PRESETS.map((p) => (
            <Button
              key={p.key}
              variant={!showCustomDate && preset === p.key ? "default" : "outline"}
              onClick={() => {
                setPreset(p.key);
                setShowCustomDate(false);
              }}
              size="sm"
              className="whitespace-nowrap shrink-0"
            >
              {p.label}
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 w-full md:w-auto items-center">
          {showCustomDate && (
            <div className="flex items-center gap-2">
              <input type="date" aria-label="Tanggal mulai" className="border rounded px-2 py-1 text-sm" value={customStart} onChange={(e) => setCustomStart(e.target.value)} />
              <span className="text-muted-foreground text-sm">-</span>
              <input type="date" aria-label="Tanggal akhir" className="border rounded px-2 py-1 text-sm" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} />
            </div>
          )}
          <Button variant={showCustomDate ? "default" : "outline"} size="sm" className="gap-2 shrink-0" onClick={() => setShowCustomDate(!showCustomDate)}>
            <Calendar className="w-4 h-4 shrink-0" />
            Kustom
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2 text-brand-green hover:bg-brand-green/5 border-brand-green/30"
            onClick={() => download("/api/reports/sales/excel")}
            disabled={showCustomDate && !customReady}
          >
            <Download className="w-4 h-4 shrink-0" />
            Unduh Lap. Penjualan
          </Button>
        </div>
      </div>

      {showCustomDate && !customReady && (
        <p className="text-sm text-slate-500 -mt-4">Pilih tanggal mulai dan tanggal akhir untuk menampilkan laporan kustom.</p>
      )}
      {error && <div className="p-3 rounded-md border border-red-200 bg-red-50 text-sm text-red-700">{error}</div>}

      {/* Ringkasan */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-l-4 border-l-brand-green">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Pendapatan</CardTitle>
            <DollarSign className="h-4 w-4 text-brand-green" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isLoading ? "…" : rp(summary?.totalRevenue ?? 0)}</div>
            {!isLoading && <ChangeBadge pct={summary?.revenueChangePct} />}
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-brand-orange-light">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Transaksi</CardTitle>
            <Receipt className="h-4 w-4 text-brand-orange" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isLoading ? "…" : (summary?.totalTransactions ?? 0).toLocaleString("id-ID")}</div>
            {!isLoading && <ChangeBadge pct={summary?.transactionsChangePct} />}
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-brand-green-light">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rata-rata Penjualan</CardTitle>
            <TrendingUp className="h-4 w-4 text-brand-green-light" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isLoading ? "…" : rp(summary?.avgTransaction ?? 0)}</div>
            <p className="text-xs text-slate-500 font-medium mt-1">Per transaksi</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Grafik Penjualan ({periodLabel})</CardTitle>
            <CardDescription>Pendapatan {isMonthly ? "bulanan" : "harian"} selama periode terpilih (WIB).</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            {isLoading ? (
              <div className="h-full flex items-center justify-center text-slate-400"><Loader2 className="w-6 h-6 animate-spin" /></div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={sales?.chartData ?? []}>
                  <defs>
                    <linearGradient id="brandOrangeBar" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#F7931E" />
                      <stop offset="100%" stopColor="#F15A24" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tickFormatter={compactRp} tick={{ fontSize: 12 }} width={80} />
                  <Tooltip formatter={(value) => [rp(Number(value)), "Pendapatan"]} cursor={{ fill: "rgba(0,0,0,0.05)" }} />
                  <Bar dataKey="sales" fill="url(#brandOrangeBar)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div>
              <CardTitle>Barang Terlaris</CardTitle>
              <CardDescription>Berdasarkan kuantitas terjual.</CardDescription>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="text-brand-green hover:bg-brand-green/5"
              title="Unduh Produk Terlaris"
              onClick={() => download("/api/reports/top-products/excel")}
            >
              <Download className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            {topProducts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 text-center text-muted-foreground">
                <Package className="w-8 h-8 mb-2 text-slate-300" />
                <span>{isLoading ? "Memuat..." : "Belum ada penjualan pada periode ini"}</span>
              </div>
            ) : (
              <ol className="space-y-3">
                {topProducts.map((p, i) => (
                  <li key={p.productId} className="flex items-center gap-3">
                    <span className="w-6 h-6 shrink-0 rounded-full bg-brand-green/10 text-brand-green text-xs font-bold flex items-center justify-center">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">{p.name}</div>
                      <div className="text-xs text-slate-500">{rp(p.revenue)}</div>
                    </div>
                    <span className="text-sm font-semibold">{p.qty.toLocaleString("id-ID")}</span>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Performa Shift Kasir</CardTitle>
            <CardDescription>Shift Pagi dibuka 06.00–14.59 WIB, sisanya Shift Malam.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {(shiftSummary.length
                ? shiftSummary
                : [
                    { shiftType: "Shift Pagi", shifts: 0, totalSales: 0, totalTransactions: 0 },
                    { shiftType: "Shift Malam", shifts: 0, totalSales: 0, totalTransactions: 0 },
                  ]
              ).map((s) => {
                const pagi = s.shiftType === "Shift Pagi";
                return (
                  <div
                    key={s.shiftType}
                    className={`flex justify-between items-center p-4 rounded-lg border ${pagi ? "bg-brand-green/5 border-brand-green/30" : "bg-brand-orange-light/5 border-brand-orange-light/30"}`}
                  >
                    <div>
                      <div className={`font-semibold ${pagi ? "text-brand-green-dark" : "text-orange-900"}`}>{s.shiftType}</div>
                      <div className={`text-sm ${pagi ? "text-brand-green" : "text-brand-orange"}`}>{s.shifts} shift</div>
                    </div>
                    <div className="text-right">
                      <div className={`font-bold text-lg ${pagi ? "text-brand-green-dark" : "text-orange-900"}`}>{rp(s.totalSales)}</div>
                      <div className={`text-xs ${pagi ? "text-brand-green" : "text-brand-orange"}`}>{s.totalTransactions.toLocaleString("id-ID")} transaksi</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pergerakan Barang</CardTitle>
            <CardDescription>Rata-rata terjual per hari pada periode ini.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2 border-b pb-3">
                <div className="font-semibold text-brand-green">Cepat Terjual (Fast-Moving)</div>
                {moving.fastMoving.length === 0 ? (
                  <div className="text-sm text-slate-500">{isLoading ? "Memuat..." : "Belum ada penjualan."}</div>
                ) : (
                  moving.fastMoving.map((m) => (
                    <div key={m.productId} className="flex justify-between gap-2 text-sm">
                      <span className="truncate">{m.name}</span>
                      <span className="font-medium shrink-0">{m.perDay.toLocaleString("id-ID")} / hari</span>
                    </div>
                  ))
                )}
              </div>
              <div className="space-y-2 pt-1">
                <div className="font-semibold text-red-700">Lambat Terjual (Slow-Moving)</div>
                <p className="text-xs text-slate-500">Barang aktif yang masih ada stok dengan penjualan paling sedikit.</p>
                {moving.slowMoving.map((m) => (
                  <div key={m.productId} className="flex justify-between gap-2 text-sm">
                    <span className="truncate">{m.name}</span>
                    <span className="font-medium shrink-0">{m.perDay.toLocaleString("id-ID")} / hari · stok {m.stock}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Rekap absensi (dari buka/tutup shift) */}
      <div className="pt-6 border-t mt-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">Rekap Absensi Kasir</h2>
            <p className="text-muted-foreground text-sm mt-1">
              Jam kerja kasir dari buka–tutup shift ({periodLabel}). Shift yang masih berjalan dihitung sampai sekarang.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-2 text-brand-green hover:bg-brand-green/5 border-brand-green/30"
            onClick={() => download("/api/reports/attendance/excel")}
            disabled={showCustomDate && !customReady}
          >
            <Download className="w-4 h-4 shrink-0" />
            Unduh Rekap Absensi
          </Button>
        </div>

        <Card>
          <CardHeader className="bg-slate-50 border-b">
            <CardTitle className="text-lg">Daftar Kehadiran Kasir</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b">
                  <tr>
                    <th className="px-6 py-4 font-medium">Nama Kasir</th>
                    <th className="px-6 py-4 font-medium">Total Shift</th>
                    <th className="px-6 py-4 font-medium">Total Jam Kerja</th>
                    <th className="px-6 py-4 font-medium">Rata-rata/Shift</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {attendance.length === 0 ? (
                    <tr>
                      <td className="px-6 py-4 text-center text-muted-foreground" colSpan={4}>
                        {isLoading ? "Memuat..." : "Tidak ada data absensi untuk periode ini"}
                      </td>
                    </tr>
                  ) : (
                    attendance.map((item) => (
                      <tr key={item.userId} className="hover:bg-slate-50/50">
                        <td className="px-6 py-4 font-medium text-slate-900">{item.userName}</td>
                        <td className="px-6 py-4">
                          {item.totalShifts} shift
                          {item.openShifts > 0 && (
                            <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-brand-green/10 px-2 py-0.5 text-xs text-brand-green">
                              <span className="w-1.5 h-1.5 rounded-full bg-brand-green animate-pulse" /> sedang berjalan
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4">{formatMs(item.totalWorkMs)}</td>
                        <td className="px-6 py-4">{formatMs(item.avgWorkMs)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
