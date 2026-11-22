/* eslint-disable */
// @ts-nocheck
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSession } from "@/hooks/useSession";
import { 
  TrendingUp,
  Receipt,
  Wallet,
  AlertTriangle,
  BarChart3,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useRouter } from "next/navigation";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

type MonthlyData = { month: string; sales: number };

export default function Home() {
  const router = useRouter();
  const [role, setRole] = useState("");
  const [username, setUsername] = useState("");

  const [summary, setSummary] = useState({
    todaySales: 0,
    todayTransactions: 0,
    activeCash: 0,
    monthlySales: 0,
    monthlyTransactions: 0,
  });
  const [lowStockItems, setLowStockItems] = useState<{name: string, stock: number, min: number}[]>([]);
  const [chartData, setChartData] = useState<MonthlyData[]>([]);

  const { user, loading } = useSession();

  useEffect(() => {
    if (user) {
      setRole(user.role);
      setUsername(user.username);
    }
  }, [user]);

  useEffect(() => {
    fetch("/api/dashboard/summary")
      .then((res) => res.json())
      .then((json) => {
        if (json.success) {
          const d = json.data;
          const fb = d._fallback || {};
          setSummary({
            todaySales: d.todaySales || fb.todaySales || 0,
            todayTransactions: d.todayTransactions || fb.todayTransactions || 0,
            activeCash: d.activeCash || fb.activeCash || 0,
            monthlySales: d.monthlySales || 0,
            monthlyTransactions: d.monthlyTransactions || 0,
          });
        }
      })
      .catch((err) => console.error(err));

    fetch("/api/dashboard/low-stock")
      .then((res) => res.json())
      .then((json) => {
        if (json.success) {
          setLowStockItems(json.data.length > 0 ? json.data : (json._fallback || []));
        }
      })
      .catch((err) => console.error(err));

    fetch("/api/dashboard/monthly-trend")
      .then((res) => res.json())
      .then((json) => {
        if (json.success && Array.isArray(json.data)) {
          setChartData(json.data);
        }
      })
      .catch((err) => console.error("Chart data error:", err));
  }, [router]);

  const formatRupiah = (value: number) => {
    if (value >= 1000000) return `Rp ${(value / 1000000).toFixed(1)}jt`;
    if (value >= 1000) return `Rp ${(value / 1000).toFixed(0)}rb`;
    return `Rp ${value}`;
  };

  if (!role) return null;

  return (
    <div className="p-4 md:p-8 space-y-6 md:space-y-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="border-b pb-4 md:pb-6">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900">
          Selamat Datang, <span className="text-brand-green capitalize">{username}</span>
        </h1>
        <p className="text-sm md:text-base text-muted-foreground mt-1">
          Dashboard ringkasan penjualan Logmart Trowono
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        <Card className="border-l-4 border-l-brand-green">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Penjualan Hari Ini</CardTitle>
            <TrendingUp className="h-4 w-4 text-brand-green" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              <span className="md:hidden">{formatRupiah(summary.todaySales)}</span>
              <span className="hidden md:inline">Rp {summary.todaySales.toLocaleString("id-ID")}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">{summary.todayTransactions} transaksi hari ini</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-brand-orange-light">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Transaksi Hari Ini</CardTitle>
            <Receipt className="h-4 w-4 text-brand-orange" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.todayTransactions}</div>
            <p className="text-xs text-muted-foreground mt-1">Struk berhasil dicetak</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-brand-green-light">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Penjualan Bulan Ini</CardTitle>
            <Wallet className="h-4 w-4 text-brand-green-light" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              <span className="md:hidden">{formatRupiah(summary.monthlySales)}</span>
              <span className="hidden md:inline">Rp {summary.monthlySales.toLocaleString("id-ID")}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">{summary.monthlyTransactions} transaksi bulan ini</p>
          </CardContent>
        </Card>
      </div>

      {/* Sales Trend Chart */}
      <div className="bg-white rounded-xl border shadow-sm p-6">
        <div className="flex items-center gap-2 mb-6">
          <BarChart3 className="w-5 h-5 text-brand-green" />
          <h2 className="text-lg font-semibold text-slate-800">Tren Penjualan 6 Bulan Terakhir</h2>
        </div>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
              <defs><linearGradient id="brandGreenBar" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#8DC63F" /><stop offset="100%" stopColor="#009245" /></linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e8efe3" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={formatRupiah} tick={{ fontSize: 11 }} width={70} />
              <Tooltip
                formatter={(value: number) => [`Rp ${value.toLocaleString("id-ID")}`, "Penjualan"]}
                labelStyle={{ fontWeight: "bold" }}
              />
              <Bar dataKey="sales" fill="url(#brandGreenBar)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[280px] flex items-center justify-center text-slate-400 text-sm border border-dashed rounded-lg">
            Belum ada data transaksi untuk ditampilkan
          </div>
        )}
      </div>

      {/* Stok Menipis (Hanya Manajer) */}
      {role === "manajer" && lowStockItems.length > 0 && (
        <div>
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            Peringatan Stok Menipis
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {lowStockItems.map((item, i) => (
              <Link href="/products" key={i} className="block transition-transform active:scale-95">
                <Card className="border-amber-200 bg-amber-50/30 hover:border-amber-400">
                  <CardContent className="p-4 flex flex-col gap-2">
                    <div className="font-semibold text-slate-800 line-clamp-1">{item.name}</div>
                    <div className="flex items-center justify-between mt-auto">
                      <div className="text-sm">
                        Stok: <span className="font-bold text-red-600">{item.stock}</span> / {item.min}
                      </div>
                      <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Segera Restock</Badge>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
