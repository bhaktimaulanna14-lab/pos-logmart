import { formatRupiah } from "@/lib/format";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import { useState, useEffect } from "react";
import { printReceipt } from "@/lib/print-receipt";

export type ReceiptData = {
  id: string;
  time: string;
  cashier: string;
  items: { id?: string; name: string; qty: number; price: number; discount?: number; promotionName?: string | null }[];
  total: number;
  discount?: number;
  paymentMethod: string;
  cashReceived: number;
  change: number;
};

interface ReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  transactionId?: string | null;
}

export function ReceiptModal({ isOpen, onClose, transactionId }: ReceiptModalProps) {
  const [transaction, setTransaction] = useState<ReceiptData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && transactionId) {
      setIsLoading(true);
      setError(null);
      setTransaction(null);
      
      fetch(`/api/transactions/${transactionId}`)
        .then((res) => res.json())
        .then((json) => {
          if (json.success) {
            setTransaction(json.data);
          } else {
            setError(json.message || "Gagal memuat data struk.");
          }
        })
        .catch((e) => {
          console.error(e);
          setError("Terjadi kesalahan jaringan.");
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [isOpen, transactionId]);

  // Cetak lewat iframe khusus struk (58 mm); lihat src/lib/print-receipt.ts.
  const handlePrint = () => {
    if (transaction) printReceipt(transaction);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[350px] print:w-[80mm] print:m-0 print:p-0 print:border-none print:shadow-none print:max-w-none print:h-auto overflow-hidden">
        
        {isLoading ? (
          <div className="p-8 text-center flex flex-col items-center justify-center space-y-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900"></div>
            <p className="text-sm text-slate-500">Memuat data struk...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-red-500 font-medium">
            {error}
          </div>
        ) : !transaction ? (
          <div className="p-8 text-center text-slate-500">
            Data transaksi tidak ditemukan.
          </div>
        ) : (
          <>
            <div className="receipt-content p-6 font-mono text-xs bg-white text-black print:p-0">
              {/* Header */}
              <div className="text-center mb-4">
                <h1 className="font-bold text-base">LOGMART TROWONO</h1>
                <p>Jl. Trowono - Baron, Gunungkidul</p>
                <p>Telp: 0812-3456-7890</p>
              </div>
              
              {/* Info */}
              <div className="border-b border-dashed border-slate-300 pb-2 mb-2">
                <div className="flex justify-between">
                  <span>Tgl: {new Date(transaction.time).toLocaleString("id-ID")}</span>
                  <span>Kasir: {transaction.cashier || "-"}</span>
                </div>
                <div className="flex justify-between">
                  <span>No : {transaction.id}</span>
                </div>
              </div>

              {/* Items */}
              <div className="border-b border-dashed border-slate-300 pb-2 mb-2">
                {transaction.items?.map((item, idx) => (
                  <div key={item.id || idx} className="mb-1">
                    <div>{item.name}</div>
                    <div className="flex justify-between">
                      <span>{item.qty} x {item.price.toLocaleString("id-ID")}</span>
                      <span>{(item.qty * item.price).toLocaleString("id-ID")}</span>
                    </div>
                    {!!item.discount && (
                      <div className="flex justify-between text-slate-600">
                        <span>&nbsp;&nbsp;{item.promotionName || "Promo"}</span>
                        <span>-{item.discount.toLocaleString("id-ID")}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div className="border-b border-dashed border-slate-300 pb-2 mb-2">
                {!!transaction.discount && (
                  <div className="flex justify-between">
                    <span>Hemat promo</span>
                    <span>-{formatRupiah(transaction.discount)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-sm">
                  <span>Total</span>
                  <span>{formatRupiah(transaction.total)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="capitalize">{transaction.paymentMethod}</span>
                  <span>{formatRupiah(transaction.cashReceived)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Kembali</span>
                  <span>{formatRupiah(transaction.change)}</span>
                </div>
              </div>

              {/* Footer */}
              <div className="text-center mt-4 pt-2">
                <p>Terima Kasih</p>
                <p>Barang yang sudah dibeli tidak dapat ditukar/dikembalikan</p>
              </div>
            </div>

            <DialogFooter className="sm:justify-between px-6 pb-6 pt-2 border-t print:hidden">
              <Button variant="outline" onClick={onClose}>
                Tutup
              </Button>
              <Button onClick={handlePrint}className="gap-2 bg-brand-green hover:bg-brand-green-dark text-white" disabled={isLoading || !transaction || !!error}>
                <Printer className="w-4 h-4" />
                Cetak Struk
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
