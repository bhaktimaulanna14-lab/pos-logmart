"use client";

import { Clock, CreditCard, ShoppingCart, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatRupiah } from "@/lib/format";
import type { CartItem, PricingLine } from "../types";

/** Kolom kanan Kasir: isi keranjang, total setelah promo, tombol simpan pending dan bayar. */
export function CartPanel({
  cart, lines, subtotal, discountTotal, total, isPricing, pendingCount,
  onChangeQty, onClear, onShowPending, onSavePending, onPay,
}: {
  cart: CartItem[];
  lines: Record<string, PricingLine>;
  subtotal: number;
  discountTotal: number;
  total: number;
  isPricing: boolean;
  pendingCount: number;
  onChangeQty: (id: string, delta: number) => void;
  onClear: () => void;
  onShowPending: () => void;
  onSavePending: () => void;
  onPay: () => void;
}) {
  const isEmpty = cart.length === 0;

  return (
    <div className="w-full md:w-[400px] flex flex-col bg-white shrink-0 h-[45vh] md:h-auto border-t md:border-t-0">
      <div className="p-4 border-b flex items-center justify-between font-semibold text-lg bg-slate-50">
        <div className="flex items-center gap-2">
          <ShoppingCart className="w-5 h-5" />
          Keranjang ({cart.length})
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline" size="sm"
            className="text-orange-600 hover:text-orange-700 hover:bg-orange-50 border-orange-200"
            onClick={onShowPending}
          >
            <Clock className="w-4 h-4 mr-1" />
            Tertahan ({pendingCount})
          </Button>
          <Button
            variant="ghost" size="sm" className="text-red-500 hover:text-red-600 px-2"
            aria-label="Kosongkan keranjang"
            onClick={onClear} disabled={isEmpty}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 bg-slate-50/30">
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center h-full text-sm text-slate-400">Keranjang masih kosong</div>
        ) : (
          <div className="space-y-3">
            {cart.map((item) => (
              <CartLine key={item.id} item={item} line={lines[item.id]} onChangeQty={onChangeQty} />
            ))}
          </div>
        )}
      </div>

      <div className="p-4 border-t bg-white shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
        <div className="flex justify-between items-center mb-2 text-slate-600">
          <span>Subtotal</span>
          <span>{formatRupiah(subtotal)}</span>
        </div>
        <div className="flex justify-between items-center mb-4 text-slate-600">
          <span>Diskon promo</span>
          <span className={discountTotal > 0 ? "text-brand-green font-medium" : ""}>
            {discountTotal > 0 ? `- ${formatRupiah(discountTotal)}` : "Rp 0"}
          </span>
        </div>
        <div className="flex justify-between items-end mb-4">
          <span className="font-semibold text-lg">Total</span>
          <span className="text-3xl font-bold text-brand-green">{formatRupiah(total)}</span>
        </div>

        <div className="flex gap-2 w-full mb-2">
          <Button
            variant="outline"
            className="flex-1 border-orange-200 text-orange-600 hover:bg-orange-50 hover:text-orange-700 h-12"
            disabled={isEmpty}
            onClick={onSavePending}
          >
            <Clock className="w-5 h-5 mr-2" /> Simpan Pending
          </Button>
        </div>

        {/* Tunggu harga promo dari server agar total yang dibayar sama dengan yang tercatat. */}
        <Button size="lg" className="w-full h-14 text-lg font-bold gap-2" disabled={isEmpty || isPricing} onClick={onPay}>
          <CreditCard className="w-6 h-6" />
          Bayar Sekarang
        </Button>
      </div>
    </div>
  );
}

function CartLine({ item, line, onChangeQty }: { item: CartItem; line?: PricingLine; onChangeQty: (id: string, delta: number) => void }) {
  const lineTotal = item.price * item.qty;
  return (
    <div className="flex flex-col gap-2 p-3 bg-white border rounded-lg shadow-sm">
      <div className="flex justify-between items-start">
        <div className="font-medium text-sm leading-tight pr-2">{item.name}</div>
        <div className="font-semibold text-right shrink-0">
          {line?.discount ? (
            <>
              <div className="text-xs text-slate-400 line-through font-normal">{formatRupiah(lineTotal)}</div>
              <div className="text-brand-green">{formatRupiah(lineTotal - line.discount)}</div>
            </>
          ) : (
            formatRupiah(lineTotal)
          )}
        </div>
      </div>
      {line?.promotionName && (
        <div className="text-xs rounded bg-brand-orange-light/10 text-orange-800 px-2 py-1">
          🏷 {line.promotionName} · {line.promotionNote}
        </div>
      )}
      <div className="flex justify-between items-center mt-1">
        <div className="text-xs text-slate-500">{formatRupiah(item.price)}</div>
        <div className="flex items-center gap-2 bg-slate-100 rounded-md p-0.5">
          <Button
            variant="ghost" size="sm" className="h-8 w-8 md:h-6 md:w-6 rounded p-0 text-lg md:text-sm"
            aria-label={`Kurangi ${item.name}`}
            onClick={() => onChangeQty(item.id, -1)}
          >-</Button>
          <span className="text-sm font-medium w-6 text-center">{item.qty}</span>
          <Button
            variant="ghost" size="sm" className="h-8 w-8 md:h-6 md:w-6 rounded p-0 text-lg md:text-sm"
            aria-label={`Tambah ${item.name}`}
            onClick={() => onChangeQty(item.id, 1)}
            disabled={item.qty >= item.stock}
          >+</Button>
        </div>
      </div>
    </div>
  );
}
