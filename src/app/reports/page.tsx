/* eslint-disable */
// @ts-nocheck
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, TrendingUp, DollarSign, Package, Calendar, Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from "recharts";

const dataChartWeekly = [
  { name: "Sen", sales: 0 },
  { name: "Sel", sales: 0 },
  { name: "Rab", sales: 0 },
  { name: "Kam", sales: 0 },
  { name: "Jum", sales: 0 },
  { name: "Sab", sales: 0 },
  { name: "Min", sales: 0 },
];

const dataChartMonthly = [
  { name: "Minggu 1", sales: 0 },
  { name: "Minggu 2", sales: 0 },
  { name: "Minggu 3", sales: 0 },
  { name: "Minggu 4", sales: 0 },
];

export default function ReportsPage() {
  const [dateRange, setDateRange] = useState("7 Hari Terakhir");
  const [showCustomDate, setShowCustomDate] = useState(false);
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  
  const dataChart = dateRange === "Bulan Ini" || dateRange === "Tahun Ini" 
    ? dataChartMonthly 
    : dataChartWeekly;

  const totalSales = 0;
  const totalTx = 0;
  const avgSales = 0;
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = () => {
    setIsDownloading(true);
    setTimeout(() => {
      alert("Laporan Excel berhasil diunduh (Simulasi)");
      setIsDownloading(false);
    }, 2000);
  };

  const displayDateRange = showCustomDate && customStart && customEnd 
    ? `${customStart} s/d ${customEnd}`
    : dateRange;

  const [attendanceData, setAttendanceData] = useState<any[]>([]);

  useEffect(() => {
    let url = "/api/reports/attendance";
    if (showCustomDate && customStart && customEnd) {
      url += `?startDate=${customStart}&endDate=${customEnd}`;
    }
    fetch(url)
      .then(res => res.json())
      .then(res => {
        if (res.success) setAttendanceData(res.data);
      })
      .catch(err => console.error("Failed to fetch attendance", err));
  }, [dateRange, showCustomDate, customStart, customEnd]);

  const formatMs = (ms: number) => {
    const totalMins = Math.floor(ms / 60000);
    const hours = Math.floor(totalMins / 60);
    const mins = totalMins % 60;
    if (hours === 0 && mins === 0) return "-";
    return `${hours} jam ${mins} menit`;
  };

  return (
    <div className="p-6 md:p-10 space-y-8 max-w-6xl mx-auto bg-slate-50">
      <div className="flex items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            Laporan Penjualan
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Tinjauan performa dan analitik toko Logmart Trowono.
          </p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-4 rounded-xl border shadow-sm gap-4">
        <div className="flex gap-2 overflow-x-auto w-full md:w-auto pb-2 md:pb-0 hide-scrollbar" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          {["Hari Ini", "7 Hari Terakhir", "Bulan Ini", "Tahun Ini"].map((range) => (
            <Button 
              key={range} 
              variant={dateRange === range ? "default" : "outline"}
              onClick={() => {
                setDateRange(range);
                setShowCustomDate(false);
              }}
              size="sm"
              className="whitespace-nowrap shrink-0"
            >
              {range}
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 w-full md:w-auto items-center">
          {showCustomDate && (
            <div className="flex items-center gap-2">
              <input type="date" className="border rounded px-2 py-1 text-sm" value={customStart} onChange={e => setCustomStart(e.target.value)} />
              <span className="text-muted-foreground text-sm">-</span>
              <input type="date" className="border rounded px-2 py-1 text-sm" value={customEnd} onChange={e => setCustomEnd(e.target.value)} />
            </div>
          )}
          <Button 
            variant={showCustomDate ? "default" : "outline"}
            size="sm" 
            className="flex-1 md:flex-none gap-2 shrink-0"
            onClick={() => setShowCustomDate(!showCustomDate)}
          >
            <Calendar className="w-4 h-4 shrink-0" />
            <span className="truncate">Kustom</span>
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            className="flex-1 md:flex-none gap-2 text-green-700 hover:text-green-800 hover:bg-green-50 border-green-200" 
            onClick={handleDownload}
            disabled={isDownloading}
          >
            <Download className="w-4 h-4 shrink-0" />
            <span className="truncate">{isDownloading ? "Memproses..." : "Unduh Lap. Penjualan"}</span>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Pendapatan
            </CardTitle>
            <DollarSign className="h-4 w-4 text-slate-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Rp {totalSales.toLocaleString("id-ID")}</div>
            <p className="text-xs text-green-600 font-medium flex items-center mt-1">
              <TrendingUp className="w-3 h-3 mr-1" />
              +12.5% dari periode lalu
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Transaksi
            </CardTitle>
            <Package className="h-4 w-4 text-slate-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalTx.toLocaleString("id-ID")}</div>
            <p className="text-xs text-green-600 font-medium flex items-center mt-1">
              <TrendingUp className="w-3 h-3 mr-1" />
              +5% dari periode lalu
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Rata-rata Penjualan
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-slate-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Rp {avgSales.toLocaleString("id-ID")}</div>
            <p className="text-xs text-slate-500 font-medium mt-1">
              Per transaksi
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Grafik Penjualan ({displayDateRange})</CardTitle>
            <CardDescription>
              Tren pendapatan harian selama periode terpilih.
            </CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dataChart}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis 
                  dataKey="name" 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12 }}
                  dy={10}
                />
                <YAxis 
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(val) => `Rp ${val / 1000000}M`}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip 
                  formatter={(value: number) => [`Rp ${value.toLocaleString("id-ID")}`, "Pendapatan"]}
                  cursor={{ fill: "rgba(0,0,0,0.05)" }}
                />
                <Bar dataKey="sales" fill="#0f172a" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
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
              className="text-green-700 hover:text-green-800 hover:bg-green-50"
              title="Unduh Produk Terlaris"
              onClick={handleDownload}
            >
              <Download className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[]}
              {/* Empty state for now since DB is empty */}
              <div className="flex flex-col items-center justify-center py-6 text-center text-muted-foreground">
                <Package className="w-8 h-8 mb-2 text-slate-300" />
                <span>Belum ada data penjualan</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Performa Shift Kasir</CardTitle>
            <CardDescription>Perbandingan penjualan harian per shift.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center bg-blue-50/50 p-4 rounded-lg border border-blue-100">
                <div>
                  <div className="font-semibold text-blue-900">Shift Pagi</div>
                  <div className="text-sm text-blue-700">07:00 - 15:00</div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-lg text-blue-950">Rp 0</div>
                  <div className="text-xs text-blue-600">0 transaksi</div>
                </div>
              </div>
              <div className="flex justify-between items-center bg-indigo-50/50 p-4 rounded-lg border border-indigo-100">
                <div>
                  <div className="font-semibold text-indigo-900">Shift Malam</div>
                  <div className="text-sm text-indigo-700">15:00 - 23:00</div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-lg text-indigo-950">Rp 0</div>
                  <div className="text-xs text-indigo-600">0 transaksi</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pergerakan Barang</CardTitle>
            <CardDescription>Indikator perputaran stok barang.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2 border-b pb-3">
                <div className="font-semibold text-green-700 flex items-center">
                  Cepat Terjual (Fast-Moving)
                </div>
                <div className="flex justify-between text-sm">
                  <span>Indomie Goreng</span>
                  <span className="font-medium">102 / hari</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Telur Ayam 1kg</span>
                  <span className="font-medium">85 / hari</span>
                </div>
              </div>
              <div className="space-y-2 pt-1">
                <div className="font-semibold text-red-700 flex items-center">
                  Lambat Terjual (Slow-Moving)
                </div>
                <div className="flex justify-between text-sm">
                  <span>Pewangi Ruangan</span>
                  <span className="font-medium">2 / hari</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Semir Sepatu Hitam</span>
                  <span className="font-medium">1 / hari</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* REKAP ABSENSI KASIR SECTION */}
      <div className="pt-6 border-t mt-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">Rekap Absensi Kasir</h2>
            <p className="text-muted-foreground text-sm mt-1">Laporan jam kerja kasir berdasarkan aktivitas shift ({displayDateRange}).</p>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            className="flex-1 md:flex-none gap-2 text-green-700 hover:text-green-800 hover:bg-green-50 border-green-200" 
            onClick={() => {
              const url = new URL("/api/reports/attendance/excel", window.location.origin);
              if (showCustomDate && customStart) url.searchParams.set("startDate", customStart);
              if (showCustomDate && customEnd) url.searchParams.set("endDate", customEnd);
              
              window.location.href = url.toString();
            }}
          >
            <Download className="w-4 h-4 shrink-0" />
            <span className="truncate">Unduh Rekap Absensi</span>
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
                  {attendanceData.length === 0 ? (
                    <tr className="hover:bg-slate-50/50">
                      <td className="px-6 py-4 text-center text-muted-foreground" colSpan={4}>Tidak ada data absensi untuk periode ini</td>
                    </tr>
                  ) : (
                    attendanceData.map((item, i) => (
                      <tr key={i} className="hover:bg-slate-50/50">
                        <td className="px-6 py-4 font-medium text-slate-900">{item.userName}</td>
                        <td className="px-6 py-4">{item.totalShifts} shift</td>
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
