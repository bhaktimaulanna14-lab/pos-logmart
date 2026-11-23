"use client";

import { useState, useEffect } from "react";
import { Search, Calendar, Eye, Printer, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ReceiptModal } from "@/components/ReceiptModal";
import { useSession } from "@/hooks/useSession";

type TransactionRow = {
  id: string;
  transactionNumber: string;
  transactionTime: string;
  totalAmount: number;
  paymentMethod: string;
  shiftId: string;
  cashierId: string;
  cashierName: string | null;
  voidedAt: string | null;
};

/** Detail transaksi dari GET /api/transactions/[nomor]. `id` = nomor transaksi. */
type TransactionDetail = {
  id: string;
  time: string;
  cashier: string;
  total: number;
  paymentMethod: string;
  cashReceived: number;
  change: number;
  cashierId: string;
  voidedAt: string | null;
  voidReason: string | null;
  items: { id: string; name: string; qty: number; price: number }[];
};

const PAGE_SIZE = 50;
/** Tanggal hari ini dalam WIB (YYYY-MM-DD). */
const todayWib = () => new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);

export default function TransactionsPage() {
  const { user } = useSession();
  const [reloadKey, setReloadKey] = useState(0);
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterDate, setFilterDate] = useState(todayWib()); // "" = semua tanggal
  const [filterCashier, setFilterCashier] = useState("Semua");
  const [page, setPage] = useState(1);

  const [transactionsData, setTransactionsData] = useState<TransactionRow[]>([]);
  const [total, setTotal] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);
  const [cashiers, setCashiers] = useState<{ id: string; name: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Debounce kolom cari nomor struk.
  useEffect(() => {
    const t = setTimeout(() => {
      setSearchTerm(searchInput.trim());
      setPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Filter & pagination dikerjakan di server — tidak lagi mengunduh semua transaksi.
  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
    if (searchTerm) params.set("q", searchTerm);
    if (filterDate) params.set("date", filterDate);
    if (filterCashier !== "Semua") params.set("cashierId", filterCashier);

    fetch(`/api/transactions?${params.toString()}`)
      .then((res) => res.json())
      .then((json) => {
        if (cancelled || !json.success) return;
        setTransactionsData(json.data);
        setTotal(json.total ?? json.data.length);
        setTotalAmount(json.totalAmount ?? 0);
        if (json.cashiers) setCashiers(json.cashiers);
      })
      .catch((err) => console.error(err))
      .finally(() => !cancelled && setIsLoading(false));
    return () => {
      cancelled = true;
    };
  }, [page, searchTerm, filterDate, filterCashier, reloadKey]);

  const [selectedTrx, setSelectedTrx] = useState<TransactionDetail | null>(null);
  const [showReceipt, setShowReceipt] = useState(false);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  const filteredData = transactionsData;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const fetchTransactionDetail = async (trxNumber: string, action: "detail" | "print") => {
    setIsLoadingDetail(true);
    try {
      const res = await fetch(`/api/transactions/${trxNumber}`);
      const json = await res.json();
      if (json.success) {
        setSelectedTrx(json.data);
        if (action === "print") {
          setShowReceipt(true);
        }
      } else {
        alert("Gagal memuat detail transaksi");
      }
    } catch (e) {
      console.error(e);
      alert("Terjadi kesalahan jaringan");
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const [isVoiding, setIsVoiding] = useState(false);
  // Kasir yang shift-nya buka boleh membatalkan transaksi selama shift transaksi itu masih buka (dicek ulang di server).
  const handleVoid = async () => {
    if (!selectedTrx) return;
    const reason = window.prompt(`Batalkan ${selectedTrx.id}? Stok akan dikembalikan dan uang Rp ${selectedTrx.total.toLocaleString("id-ID")} dikembalikan ke pelanggan.

Alasan pembatalan:`);
    if (reason === null) return;
    setIsVoiding(true);
    try {
      const res = await fetch(`/api/transactions/${selectedTrx.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const json = await res.json();
      if (!json.success) return alert(json.message || "Gagal membatalkan transaksi");
      setSelectedTrx(null);
      setReloadKey((k) => k + 1);
    } catch {
      alert("Terjadi kesalahan jaringan");
    } finally {
      setIsVoiding(false);
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleString("id-ID", {
      day: "numeric", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit"
    });
  };

  return (
    <div className="p-6 md:p-10 space-y-6 max-w-6xl mx-auto bg-slate-50 min-h-full">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">
              Riwayat Transaksi
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Cari dan cetak ulang struk penjualan.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl border shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Cari nomor struk..."
              className="pl-9"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <label className="flex items-center gap-2 rounded-md border px-3 h-10 text-sm bg-white">
              <Calendar className="w-4 h-4 text-slate-500" />
              <span className="sr-only">Tanggal</span>
              <input
                type="date"
                className="outline-none bg-transparent"
                value={filterDate}
                onChange={(e) => {
                  setFilterDate(e.target.value);
                  setPage(1);
                }}
              />
            </label>
            <Button
              variant={filterDate ? "outline" : "default"}
              className="h-10"
              onClick={() => {
                setFilterDate(filterDate ? "" : todayWib());
                setPage(1);
              }}
            >
              {filterDate ? "Semua Tanggal" : "Hari Ini"}
            </Button>
            <select
              className="flex h-10 w-full md:w-auto items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              value={filterCashier}
              onChange={(e) => {
                setFilterCashier(e.target.value);
                setPage(1);
              }}
            >
              <option value="Semua">Semua Kasir</option>
              {cashiers.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="text-sm text-slate-600">
          {isLoading ? "Memuat..." : (
            <>
              <span className="font-semibold">{total.toLocaleString("id-ID")}</span> transaksi
              {filterDate ? ` pada ${new Date(filterDate + "T00:00:00").toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}` : ""}
              {" · "}total <span className="font-semibold">Rp {totalAmount.toLocaleString("id-ID")}</span>
            </>
          )}
        </div>

        {/* Desktop Table */}
        <div className="hidden md:block rounded-md border overflow-hidden bg-white">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-100 text-slate-600 font-medium border-b">
              <tr>
                <th className="px-4 py-3">Waktu</th>
                <th className="px-4 py-3">No. Struk</th>
                <th className="px-4 py-3">Kasir</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3 text-center">Pembayaran</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-muted-foreground" />
                    Memuat data...
                  </td>
                </tr>
              ) : filteredData.length > 0 ? (
                filteredData.map((trx) => (
                  <tr key={trx.id} className="border-b last:border-0 hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap text-slate-600">{formatDate(trx.transactionTime)}</td>
                    <td className="px-4 py-3 font-medium text-slate-900">{trx.transactionNumber}{trx.voidedAt && <Badge variant="destructive" className="ml-2">Dibatalkan</Badge>}</td>
                    <td className="px-4 py-3 text-slate-600">{trx.cashierName || "-"}</td>
                    <td className={`px-4 py-3 font-semibold text-right ${trx.voidedAt ? "line-through text-slate-400" : ""}`}>Rp {(trx.totalAmount || 0).toLocaleString("id-ID")}</td>
                    <td className="px-4 py-3 text-center">
                      <Badge variant={trx.paymentMethod?.toLowerCase() === "tunai" ? "outline" : "secondary"} className="capitalize">
                        {trx.paymentMethod || "Tunai"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-8 px-2 text-brand-green hover:text-brand-green hover:bg-brand-green/10"
                        onClick={() => fetchTransactionDetail(trx.transactionNumber, "detail")}
                        disabled={isLoadingDetail}
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        Detail
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-8 px-2 text-slate-600 hover:bg-slate-100"
                        onClick={() => fetchTransactionDetail(trx.transactionNumber, "print")}
                        disabled={isLoadingDetail}
                      >
                        <Printer className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    Tidak ada transaksi ditemukan.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards */}
        <div className="md:hidden flex flex-col gap-3 pb-4">
          {isLoading ? (
            <div className="px-4 py-8 text-center text-slate-500 border rounded-lg bg-slate-50">
              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-muted-foreground" />
              Memuat data...
            </div>
          ) : filteredData.length > 0 ? (
            filteredData.map((trx) => (
              <div key={trx.id} className="bg-white border rounded-lg p-4 shadow-sm flex flex-col gap-3">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-bold text-slate-900">{trx.transactionNumber}{trx.voidedAt && <Badge variant="destructive" className="ml-2">Dibatalkan</Badge>}</div>
                    <div className="text-xs text-slate-500">{formatDate(trx.transactionTime)}</div>
                  </div>
                  <Badge variant={trx.paymentMethod?.toLowerCase() === "tunai" ? "outline" : "secondary"} className="capitalize text-[10px] px-1.5 py-0">
                    {trx.paymentMethod || "Tunai"}
                  </Badge>
                </div>
                
                <div className="grid grid-cols-2 gap-2 text-sm border-y py-2 border-slate-100">
                  <div>
                    <div className="text-xs text-slate-400">Kasir</div>
                    <div className="font-medium text-slate-700">{trx.cashierName || "-"}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-slate-400">Total</div>
                    <div className="font-bold text-brand-orange">Rp {(trx.totalAmount || 0).toLocaleString("id-ID")}</div>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="h-8 text-brand-green border-brand-green/30 hover:bg-brand-green/10"
                    onClick={() => fetchTransactionDetail(trx.transactionNumber, "detail")}
                    disabled={isLoadingDetail}
                  >
                    <Eye className="w-4 h-4 mr-1" />
                    Detail
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="h-8 text-slate-600"
                    onClick={() => fetchTransactionDetail(trx.transactionNumber, "print")}
                    disabled={isLoadingDetail}
                  >
                    <Printer className="w-4 h-4 mr-1" />
                    Struk
                  </Button>
                </div>
              </div>
            ))
          ) : (
            <div className="px-4 py-8 text-center text-slate-500 border rounded-lg bg-slate-50">
              Tidak ada transaksi ditemukan.
            </div>
          )}
        </div>

        {total > PAGE_SIZE && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 text-sm text-slate-600">
            <div>
              Menampilkan {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} dari {total.toLocaleString("id-ID")}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1 || isLoading} onClick={() => setPage((p) => p - 1)}>‹ Sebelumnya</Button>
              <span className="px-2 whitespace-nowrap">Hal. {page} / {totalPages}</span>
              <Button variant="outline" size="sm" disabled={page >= totalPages || isLoading} onClick={() => setPage((p) => p + 1)}>Berikutnya ›</Button>
            </div>
          </div>
        )}
      </div>

      <Dialog open={!!selectedTrx && !showReceipt} onOpenChange={(open) => !open && setSelectedTrx(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Detail Transaksi</DialogTitle>
          </DialogHeader>
          
          {selectedTrx && (
            <div className="space-y-4 pt-4">
              <div className="flex justify-between border-b pb-4">
                <div>
                  <div className="font-semibold">{selectedTrx.id}{selectedTrx.voidedAt && <Badge variant="destructive" className="ml-2">Dibatalkan</Badge>}</div>
                  <div className="text-sm text-slate-500">{formatDate(selectedTrx.time)}</div>
                </div>
                <div className="text-right">
                  <Badge variant={selectedTrx.paymentMethod?.toLowerCase() === "tunai" ? "outline" : "secondary"} className="capitalize">
                    {selectedTrx.paymentMethod}
                  </Badge>
                  <div className="text-sm text-slate-500 mt-1">Kasir: {selectedTrx.cashier}</div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="font-semibold text-sm">Daftar Barang</div>
                {selectedTrx.items && selectedTrx.items.length > 0 ? (
                  <div className="space-y-2 max-h-[200px] overflow-y-auto">
                    {selectedTrx.items.map((item, i: number) => (
                      <div key={i} className="flex justify-between text-sm">
                        <span>{item.name} <span className="text-slate-500">x{item.qty}</span></span>
                        <span>Rp {(item.qty * item.price).toLocaleString("id-ID")}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-slate-500 italic">Detail barang tidak tersedia pada data ini.</div>
                )}
              </div>

              <div className="border-t pt-4 space-y-1 text-sm">
                <div className="flex justify-between items-center text-slate-500">
                  <span>Dibayar</span>
                  <span>Rp {(selectedTrx.cashReceived || 0).toLocaleString("id-ID")}</span>
                </div>
                <div className="flex justify-between items-center text-slate-500">
                  <span>Kembalian</span>
                  <span>Rp {(selectedTrx.change || 0).toLocaleString("id-ID")}</span>
                </div>
                <div className="flex justify-between items-center font-bold text-lg pt-2 border-t">
                  <span>Total</span>
                  <span>Rp {(selectedTrx.total || 0).toLocaleString("id-ID")}</span>
                </div>
              </div>
              
              {selectedTrx.voidedAt && (
                <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-800">
                  Dibatalkan {formatDate(selectedTrx.voidedAt)}. Alasan: {selectedTrx.voidReason || "-"}
                </div>
              )}

              <div className="flex flex-wrap justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setSelectedTrx(null)}>Tutup</Button>
                {!selectedTrx.voidedAt && user?.role === "kasir" && (
                  <Button variant="destructive" className="gap-2" disabled={isVoiding} onClick={handleVoid}>
                    {isVoiding ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />} Batalkan
                  </Button>
                )}
                <Button className="gap-2" onClick={() => setShowReceipt(true)}>
                  <Printer className="w-4 h-4" /> Cetak Struk
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      
      {/* Print Receipt Modal */}
      <ReceiptModal 
        isOpen={showReceipt} 
        onClose={() => {
          setShowReceipt(false);
          setSelectedTrx(null); // Clear selected trx when modal closes
        }} 
        transactionId={selectedTrx?.id /* detail API mengembalikan nomor transaksi di field `id` */}
      />
    </div>
  );
}
