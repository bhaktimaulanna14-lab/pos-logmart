"use client";

import { useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatRupiah } from "@/lib/format";
import type { PendingCart } from "../types";

type DialogProps = { open: boolean; onOpenChange: (open: boolean) => void };

/** Simpan keranjang sekarang untuk dilanjutkan nanti (mis. pelanggan mengambil barang lagi). */
export function SavePendingDialog({ open, onOpenChange, onSave }: DialogProps & { onSave: (customerName: string) => Promise<boolean> }) {
  const [customerName, setCustomerName] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      if (await onSave(customerName || "Tanpa Nama")) {
        setCustomerName("");
        onOpenChange(false);
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Simpan Keranjang (Pending)</DialogTitle>
            <DialogDescription>Simpan keranjang ini untuk dilanjutkan nanti.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-6">
            <div className="grid gap-2">
              <Label htmlFor="pending_name">Nama Pelanggan (Opsional)</Label>
              <Input
                id="pending_name" placeholder="Contoh: Pak Budi"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Simpan Pending
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Daftar keranjang tertahan: lanjutkan ke kasir atau hapus. */
export function PendingListDialog({
  open, onOpenChange, carts, onRestore, onDelete,
}: DialogProps & { carts: PendingCart[]; onRestore: (cart: PendingCart) => void; onDelete: (id: string) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Daftar Keranjang Tertahan</DialogTitle>
          <DialogDescription>Pilih keranjang untuk dilanjutkan atau hapus.</DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-3 max-h-[60vh] overflow-auto">
          {carts.length === 0 ? (
            <div className="text-center text-slate-500 py-8">Tidak ada keranjang tertahan saat ini.</div>
          ) : (
            carts.map((p) => (
              <div key={p.id} className="flex justify-between items-center bg-slate-50 p-3 rounded-lg border">
                <div>
                  <div className="font-semibold text-slate-800">{p.name}</div>
                  <div className="text-xs text-slate-500 flex gap-2">
                    <span>{new Date(p.time).toLocaleTimeString("id-ID")}</span>
                    <span>•</span>
                    <span>{p.items.length} item</span>
                    <span>•</span>
                    <span className="font-medium text-slate-700">{formatRupiah(p.total)}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="icon" aria-label={`Hapus keranjang ${p.name}`}
                    className="text-red-500 hover:text-red-600 hover:bg-red-50"
                    onClick={() => onDelete(p.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => onRestore(p)}>Lanjutkan</Button>
                </div>
              </div>
            ))
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Tutup</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
