"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useConfirm } from "@/components/confirm-dialog";
import { formatRupiah } from "@/lib/format";
import { todayWib } from "@/lib/expiry";
import type { RecentTrx } from "../types";

/**
 * Daftar transaksi hari ini untuk dibatalkan.
 * Server hanya mengizinkan selama shift transaksi itu masih buka (uang bisa langsung dikembalikan dari laci).
 */
export function VoidDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [confirm, confirmDialog] = useConfirm();
  const [transactions, setTransactions] = useState<RecentTrx[]>([]);
  const [voidingNumber, setVoidingNumber] = useState<string | null>(null);

  // Muat ulang daftar setiap kali dialog dibuka.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetch(`/api/transactions?date=${todayWib()}&page=1&pageSize=50`)
      .then((res) => res.json())
      .then((json) => { if (!cancelled && json.success) setTransactions(json.data); })
      .catch((e) => console.error("VoidDialog:", e));
    return () => {
      cancelled = true;
      setTransactions([]);
    };
  }, [open]);

  const handleVoid = async (t: RecentTrx) => {
    const reason = await confirm({
      title: `Batalkan ${t.transactionNumber}?`,
      description: `Stok dikembalikan dan uang ${formatRupiah(t.totalAmount)} dikembalikan ke pelanggan.`,
      reasonLabel: "Alasan pembatalan",
      confirmLabel: "Batalkan transaksi",
      destructive: true,
    });
    if (reason === null) return;
    setVoidingNumber(t.transactionNumber);
    try {
      const res = await fetch(`/api/transactions/${t.transactionNumber}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const json = await res.json();
      if (!json.success) return alert(json.message || "Gagal membatalkan transaksi");
      setTransactions((list) => list.map((x) => (x.id === t.id ? { ...x, voidedAt: new Date().toISOString() } : x)));
    } catch {
      alert("Terjadi kesalahan jaringan");
    } finally {
      setVoidingNumber(null);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Batalkan Transaksi</DialogTitle>
            <DialogDescription>Transaksi hari ini. Hanya bisa dibatalkan selama shift transaksi itu masih buka.</DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-2 max-h-[60vh] overflow-auto">
            {transactions.length === 0 ? (
              <div className="text-center text-slate-500 py-8">Belum ada transaksi hari ini.</div>
            ) : (
              transactions.map((t) => (
                <div key={t.id} className="flex justify-between items-center bg-slate-50 p-3 rounded-lg border">
                  <div>
                    <div className="font-semibold text-slate-800">{t.transactionNumber}</div>
                    <div className="text-xs text-slate-500">
                      {new Date(t.transactionTime).toLocaleTimeString("id-ID")} • {t.cashierName ?? "-"} • <span className="font-medium text-slate-700">{formatRupiah(t.totalAmount)}</span>
                    </div>
                  </div>
                  {t.voidedAt ? (
                    <span className="text-xs font-semibold text-red-600">Dibatalkan</span>
                  ) : (
                    <Button variant="destructive" size="sm" disabled={voidingNumber !== null} onClick={() => handleVoid(t)}>
                      {voidingNumber === t.transactionNumber ? <Loader2 className="w-4 h-4 animate-spin" /> : "Batalkan"}
                    </Button>
                  )}
                </div>
              ))
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Tutup</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {confirmDialog}
    </>
  );
}
