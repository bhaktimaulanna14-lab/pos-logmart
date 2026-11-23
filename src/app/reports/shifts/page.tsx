/* eslint-disable */
// @ts-nocheck
"use client";

import { formatRupiah } from "@/lib/format";
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

export default function ShiftsReportPage() {
  const [shiftsData, setShiftsData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    fetchShifts();
  }, []);

  const fetchShifts = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/reports/shifts');
      const json = await res.json();
      if (json.success) {
        setShiftsData(json.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = () => {
    window.location.href = "/api/reports/shifts/excel";
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
            Laporan Rekap Shift
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Riwayat buka/tutup shift kasir dan pendapatan.
          </p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center bg-white p-4 rounded-xl border shadow-sm gap-4">
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2 w-full md:w-auto">
            <Filter className="w-4 h-4" />
            Filter Status
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
              <TableHead>Nama Kasir</TableHead>
              <TableHead>Waktu Buka</TableHead>
              <TableHead>Waktu Tutup</TableHead>
              <TableHead className="text-right">Modal Awal</TableHead>
              <TableHead className="text-right">Uang Akhir</TableHead>
              <TableHead className="text-center">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">Memuat data...</TableCell>
              </TableRow>
            ) : shiftsData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">Tidak ada data shift.</TableCell>
              </TableRow>
            ) : (
              shiftsData.map((shift) => (
                <TableRow key={shift.id}>
                  <TableCell className="font-medium">{shift.userName}</TableCell>
                  <TableCell>{new Date(shift.openAt).toLocaleString("id-ID")}</TableCell>
                  <TableCell>{shift.closeAt ? new Date(shift.closeAt).toLocaleString("id-ID") : "-"}</TableCell>
                  <TableCell className="text-right">{formatRupiah(shift.openingCash)}</TableCell>
                  <TableCell className="text-right">{formatRupiah(shift.closingCash || 0)}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant="secondary" className={shift.status === "aktif" ? "bg-green-100 text-green-800" : "bg-slate-100 text-slate-800"}>
                      {shift.status.toUpperCase()}
                    </Badge>
                  </TableCell>
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
        ) : shiftsData.length === 0 ? (
          <div className="text-center py-8 text-slate-500 border rounded-xl bg-white shadow-sm">Tidak ada data shift.</div>
        ) : (
          shiftsData.map((shift) => (
            <div key={shift.id} className="bg-white border rounded-xl p-4 shadow-sm flex flex-col gap-3">
              <div className="flex justify-between items-start">
                <div className="font-bold text-slate-900 text-lg leading-none">{shift.userName}</div>
                <Badge variant="secondary" className={shift.status === "aktif" ? "bg-green-100 text-green-800 text-[10px] px-1.5 py-0" : "bg-slate-100 text-slate-800 text-[10px] px-1.5 py-0"}>
                  {shift.status.toUpperCase()}
                </Badge>
              </div>
              
              <div className="grid grid-cols-2 gap-2 text-sm pt-2 border-t border-slate-100">
                <div>
                  <div className="text-xs text-slate-400">Waktu Buka</div>
                  <div className="font-medium text-slate-700">{new Date(shift.openAt).toLocaleString("id-ID")}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-400">Waktu Tutup</div>
                  <div className="font-medium text-slate-700">{shift.closeAt ? new Date(shift.closeAt).toLocaleString("id-ID") : "-"}</div>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-2 text-sm pt-2 border-t border-slate-100">
                <div>
                  <div className="text-xs text-slate-400">Modal Awal</div>
                  <div className="font-bold text-slate-700">{formatRupiah(shift.openingCash)}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-400">Uang Akhir</div>
                  <div className="font-bold text-brand-green">{formatRupiah(shift.closingCash || 0)}</div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
