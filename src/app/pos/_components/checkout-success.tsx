"use client";

import { CheckCircle, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { ReceiptData } from "@/components/ReceiptModal";
import { formatRupiah } from "@/lib/format";

/** Layar setelah pembayaran berhasil: ringkasan, cetak struk, mulai transaksi baru. */
export function CheckoutSuccess({ receipt, onPrint, onNewTransaction }: { receipt: ReceiptData | null; onPrint: () => void; onNewTransaction: () => void }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6">
      <Card className="max-w-md w-full">
        <CardContent className="pt-6 flex flex-col items-center text-center gap-6">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
            <CheckCircle className="w-10 h-10 text-green-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Transaksi Berhasil!</h2>
            {receipt && (
              <p className="text-slate-500 mt-2 text-sm">
                No: {receipt.id} | {new Date(receipt.time).toLocaleTimeString("id-ID")}
              </p>
            )}
          </div>

          {receipt && (
            <div className="w-full bg-slate-50 p-4 rounded-lg text-left text-sm space-y-2">
              <div className="flex justify-between font-bold text-base border-b pb-2 mb-2">
                <span>Total Transaksi</span>
                <span>{formatRupiah(receipt.total)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Metode</span>
                <span className="capitalize">{receipt.paymentMethod}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Bayar</span>
                <span>{formatRupiah(receipt.cashReceived)}</span>
              </div>
              {receipt.change > 0 && (
                <div className="flex justify-between font-semibold text-green-700 pt-2 border-t mt-2">
                  <span>Kembalian</span>
                  <span>{formatRupiah(receipt.change)}</span>
                </div>
              )}
            </div>
          )}

          <div className="w-full flex gap-3">
            <Button variant="outline" className="flex-1" onClick={onPrint} disabled={!receipt}>
              <Printer className="w-4 h-4 mr-2" />
              Cetak Struk
            </Button>
            <Button className="flex-1" onClick={onNewTransaction}>Transaksi Baru</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
