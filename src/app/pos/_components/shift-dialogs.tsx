"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatRupiah } from "@/lib/format";
import type { Shift, ShiftSummary } from "../types";

type DialogProps = { open: boolean; onOpenChange: (open: boolean) => void };

/** Buka shift: kasir mengisi uang modal awal di laci. */
export function OpenShiftDialog({ open, onOpenChange, onOpened }: DialogProps & { onOpened: () => Promise<void> }) {
  const [openingCash, setOpeningCash] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const res = await fetch("/api/shifts/open", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ openingCash: Number(openingCash) }),
      });
      const json = await res.json();
      if (!json.success) return alert(json.message ?? "Gagal membuka shift");
      onOpenChange(false);
      setOpeningCash("");
      await onOpened();
    } catch (e) {
      console.error(e);
      alert("Terjadi kesalahan jaringan");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Buka Shift Baru</DialogTitle>
            <DialogDescription>Masukkan jumlah uang modal awal di laci kasir.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-6">
            <div className="grid gap-2">
              <Label htmlFor="opening_cash">Uang Modal Awal (Rp)</Label>
              <Input
                id="opening_cash" type="number" placeholder="Contoh: 150000"
                required value={openingCash}
                onChange={(e) => setOpeningCash(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Buka Shift
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Tutup shift: tampilkan rekap, kasir mengisi uang yang benar-benar ada di laci. */
export function CloseShiftDialog({
  open, onOpenChange, shift, summary, onClosed,
}: DialogProps & { shift: Shift | null; summary: ShiftSummary | null; onClosed: () => Promise<void> }) {
  const [actualCash, setActualCash] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const openingCash = shift?.openingCash ?? 0;
  const expectedCash = openingCash + (summary?.totalCash ?? 0);
  const difference = Number(actualCash) - expectedCash;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shift) return;
    setIsSaving(true);
    try {
      const res = await fetch("/api/shifts/close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ closingCash: Number(actualCash), shiftId: shift.id }),
      });
      const json = await res.json();
      if (!json.success) return alert(json.message ?? "Gagal menutup shift");
      onOpenChange(false);
      setActualCash("");
      await onClosed();
    } catch (e) {
      console.error(e);
      alert("Terjadi kesalahan jaringan");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Tutup Shift Kasir</DialogTitle>
            <DialogDescription>Rekap penjualan selama shift Anda.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="bg-slate-50 p-4 rounded-lg space-y-3 text-sm">
              <SummaryRow label="Uang Modal Awal:" value={formatRupiah(openingCash)} />
              <SummaryRow label="Total Penjualan Tunai:" value={formatRupiah(summary?.totalCash ?? 0)} />
              <SummaryRow label="Total Penjualan Debit/QRIS:" value={formatRupiah(summary?.totalNonCash ?? 0)} />
              <SummaryRow label="Jumlah Transaksi:" value={`${summary?.txCount ?? 0} transaksi`} />
              <div className="border-t pt-2 flex justify-between items-center font-bold text-slate-800 text-base">
                <span>Ekspektasi Uang di Laci:</span>
                <span>{formatRupiah(expectedCash)}</span>
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="actual_cash">Uang Aktual di Laci (Hitung Manual)</Label>
              <Input
                id="actual_cash" type="number"
                placeholder="Masukkan jumlah uang aktual"
                required value={actualCash}
                onChange={(e) => setActualCash(e.target.value)}
                className="h-12 text-lg"
              />
              {actualCash && (
                <div className={`text-sm mt-1 flex items-center justify-between font-medium ${difference === 0 ? "text-green-600" : difference > 0 ? "text-brand-green" : "text-red-600"}`}>
                  <span>Selisih:</span>
                  <span>{difference > 0 ? "+" : ""}{formatRupiah(difference)}</span>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
            <Button type="submit" variant="destructive" disabled={isSaving}>
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Tutup Shift
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-slate-500">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}
