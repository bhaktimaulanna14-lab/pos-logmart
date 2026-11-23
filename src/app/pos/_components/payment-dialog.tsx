"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatRupiah } from "@/lib/format";
import type { PaymentMethod } from "../types";

const METHODS: PaymentMethod[] = ["tunai", "debit", "qris"];
const QUICK_CASH = [20000, 50000, 100000];

/** Pilih cara bayar; untuk tunai, isi uang diterima dan lihat kembaliannya. */
export function PaymentDialog({
  open, onOpenChange, total, onPay,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  total: number;
  /** Mengirim transaksi; true bila berhasil. */
  onPay: (method: PaymentMethod, cashReceived: number) => Promise<boolean>;
}) {
  const [method, setMethod] = useState<PaymentMethod>("tunai");
  const [cashReceived, setCashReceived] = useState("");
  const [isPaying, setIsPaying] = useState(false);

  const cash = Number(cashReceived);
  const cashIsShort = method === "tunai" && cash < total;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsPaying(true);
    try {
      // Non-tunai: uang diterima = total (tidak ada kembalian).
      if (await onPay(method, method === "tunai" ? cash : total)) {
        setMethod("tunai");
        setCashReceived("");
      }
    } finally {
      setIsPaying(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>Pembayaran</DialogTitle>
          <DialogDescription>
            Total tagihan: <span className="font-bold text-lg text-slate-900">{formatRupiah(total)}</span>
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-6 py-4">
          <div className="flex gap-2">
            {METHODS.map((m) => (
              <Button
                key={m} type="button"
                variant={method === m ? "default" : "outline"}
                className="flex-1 capitalize"
                onClick={() => { setMethod(m); setCashReceived(""); }}
              >
                {m}
              </Button>
            ))}
          </div>

          {method === "tunai" && (
            <div className="grid gap-2">
              <Label htmlFor="cash_received">Uang Diterima (Rp)</Label>
              <Input
                id="cash_received" type="number" autoFocus
                placeholder="Contoh: 50000"
                value={cashReceived}
                onChange={(e) => setCashReceived(e.target.value)}
                className="text-lg h-12"
              />

              {cash > 0 && (
                <div className={`mt-2 p-3 rounded-lg flex justify-between items-center ${cashIsShort ? "bg-red-50 text-red-800" : "bg-green-50 text-green-800"}`}>
                  <span className="font-medium">Kembalian:</span>
                  <span className="font-bold text-lg">{cashIsShort ? "Uang Kurang" : formatRupiah(cash - total)}</span>
                </div>
              )}

              <div className="flex flex-wrap gap-2 mt-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setCashReceived(total.toString())}>
                  Uang Pas
                </Button>
                {QUICK_CASH.filter((a) => a > total).map((amount) => (
                  <Button key={amount} type="button" variant="outline" size="sm" onClick={() => setCashReceived(amount.toString())}>
                    {formatRupiah(amount)}
                  </Button>
                ))}
              </div>
            </div>
          )}

          <DialogFooter className="mt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
            <Button type="submit" className="gap-2" disabled={isPaying || cashIsShort}>
              {isPaying ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Selesaikan Pembayaran
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
