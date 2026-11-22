/* eslint-disable */
// @ts-nocheck
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Download, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export default function StockMovementsReportPage() {
  const [movementsData, setMovementsData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    fetchMovements();
  }, []);

  const fetchMovements = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/reports/stock-movements');
      const json = await res.json();
      if (json.success) {
        setMovementsData(json.data.allMovements || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = () => {
    window.location.href = "/api/reports/stock-movements/excel";
  };

  const getBadgeVariant = (type: string, change: number) => {
    if (type === "penerimaan" || change > 0) return "bg-green-100 text-green-800";
    if (type === "penjualan") return "bg-brand-green/15 text-brand-green-dark";
    if (type === "retur") return "bg-brand-orange-light/15 text-orange-800";
    return "bg-slate-100 text-slate-800";
  };

  return (
    <div className="p-6 md:p-10 space-y-6 max-w-6xl mx-auto bg-slate-50 min-h-screen">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild>
          <Link href="/reports">
            <ArrowLeft className="w-4 h-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            Laporan Pergerakan Stok
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Riwayat keluar masuk barang berdasarkan penerimaan, penjualan, dan retur.
          </p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center bg-white p-4 rounded-xl border shadow-sm gap-4">
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2 w-full md:w-auto">
            <Filter className="w-4 h-4" />
            Filter
          </Button>
        </div>
        <Button 
          variant="outline" 
          className="gap-2 text-green-700 border-green-200 hover:bg-green-50 w-full md:w-auto"
          onClick={handleDownload}
          disabled={isDownloading}
        >
          <Download className="w-4 h-4 shrink-0" />
          <span className="truncate">{isDownloading ? "Memproses..." : "Unduh Excel"}</span>
        </Button>
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block bg-white border rounded-xl shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50">
            <TableRow>
              <TableHead>Waktu</TableHead>
              <TableHead>Nama Barang</TableHead>
              <TableHead>Jenis</TableHead>
              <TableHead>Perubahan</TableHead>
              <TableHead>Referensi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8">Memuat data...</TableCell>
              </TableRow>
            ) : movementsData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8">Tidak ada data pergerakan stok.</TableCell>
              </TableRow>
            ) : (
              movementsData.map((mov) => (
                <TableRow key={mov.id}>
                  <TableCell>{new Date(mov.date).toLocaleString("id-ID")}</TableCell>
                  <TableCell className="font-medium">{mov.name}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={getBadgeVariant(mov.type, mov.qtyChange)}>
                      {mov.type.toUpperCase()}
                    </Badge>
                  </TableCell>
                  <TableCell className={mov.qtyChange > 0 ? "text-green-600 font-medium" : "text-red-600 font-medium"}>
                    {mov.qtyChange > 0 ? `+${mov.qtyChange}` : mov.qtyChange}
                  </TableCell>
                  <TableCell>{mov.referenceId || "-"}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden flex flex-col gap-3 pb-8">
        {isLoading ? (
          <div className="text-center py-8 text-slate-500 border rounded-xl bg-white shadow-sm">Memuat data...</div>
        ) : movementsData.length === 0 ? (
          <div className="text-center py-8 text-slate-500 border rounded-xl bg-white shadow-sm">Tidak ada data pergerakan stok.</div>
        ) : (
          movementsData.map((mov) => (
            <div key={mov.id} className="bg-white border rounded-xl p-4 shadow-sm flex flex-col gap-3">
              <div className="flex justify-between items-start">
                <div className="font-bold text-slate-900 leading-tight pr-2">{mov.name}</div>
                <Badge variant="secondary" className={`${getBadgeVariant(mov.type, mov.qtyChange)} text-[10px] px-1.5 py-0 shrink-0`}>
                  {mov.type.toUpperCase()}
                </Badge>
              </div>
              
              <div className="grid grid-cols-2 gap-2 text-sm pt-2 border-t border-slate-100">
                <div>
                  <div className="text-xs text-slate-400">Waktu</div>
                  <div className="font-medium text-slate-700">{new Date(mov.date).toLocaleString("id-ID")}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-400">Perubahan</div>
                  <div className={`font-bold ${mov.qtyChange > 0 ? "text-green-600" : "text-red-600"}`}>
                    {mov.qtyChange > 0 ? `+${mov.qtyChange}` : mov.qtyChange}
                  </div>
                </div>
              </div>

              {mov.referenceId && (
                <div className="pt-2 border-t border-slate-100">
                  <div className="text-xs text-slate-400">Referensi</div>
                  <div className="font-medium text-slate-700 text-xs truncate">{mov.referenceId}</div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
