"use client";

import { useState, useEffect, useCallback } from "react";
import { Clock, Loader2, LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ReceiptModal, type ReceiptData } from "@/components/ReceiptModal";
import { useSession } from "@/hooks/useSession";
import { formatExpiry, todayWib } from "@/lib/expiry";
import type { CartItem, PaymentMethod, PendingCart, Product, Shift, ShiftSummary } from "./types";
import { useCartPricing } from "./use-cart-pricing";
import { CartPanel } from "./_components/cart-panel";
import { CheckoutSuccess } from "./_components/checkout-success";
import { PaymentDialog } from "./_components/payment-dialog";
import { PendingListDialog, SavePendingDialog } from "./_components/pending-dialogs";
import { ProductSearchPanel } from "./_components/product-search-panel";
import { CloseShiftDialog, OpenShiftDialog } from "./_components/shift-dialogs";
import { VoidDialog } from "./_components/void-dialog";

/**
 * Halaman Kasir. Alurnya: buka shift → cari/scan barang → keranjang → bayar → struk.
 * Halaman ini memegang shift, keranjang dan struk; tiap dialog memegang isiannya sendiri.
 */
export default function PosPage() {
  // Hanya kasir yang boleh membuka shift & checkout (manajer hanya melihat).
  const { user } = useSession();
  const isCashier = user?.role === "kasir";

  const [shift, setShift] = useState<Shift | null>(null);
  const [isLoadingShift, setIsLoadingShift] = useState(true);
  const [shiftSummary, setShiftSummary] = useState<ShiftSummary | null>(null);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [expiryWarning, setExpiryWarning] = useState("");
  const pricing = useCartPricing(cart);

  const [pendingCarts, setPendingCarts] = useState<PendingCart[]>([]);

  const [isCheckoutSuccess, setIsCheckoutSuccess] = useState(false);
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);

  // Dialog yang sedang terbuka.
  const [showOpenShift, setShowOpenShift] = useState(false);
  const [showCloseShift, setShowCloseShift] = useState(false);
  const [showVoid, setShowVoid] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [showSavePending, setShowSavePending] = useState(false);
  const [showPendingList, setShowPendingList] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);

  // ── Shift ──────────────────────────────────────────────────────────────────

  const fetchActiveShift = useCallback(async () => {
    setIsLoadingShift(true);
    try {
      const res = await fetch("/api/shifts/active");
      const json = await res.json();
      setShift(json.success && json.data ? json.data : null);
    } catch (e) {
      console.error("fetchActiveShift:", e);
      setShift(null);
    } finally {
      setIsLoadingShift(false);
    }
  }, []);

  useEffect(() => {
    fetchActiveShift();
  }, [fetchActiveShift]);

  // Rekap untuk dialog tutup shift, dihitung dari transaksi shift ini yang tidak dibatalkan.
  const fetchShiftSummary = async (shiftId: string) => {
    try {
      const res = await fetch(`/api/transactions?shiftId=${shiftId}`);
      const json = await res.json();
      if (!json.success) return;
      const txs: { totalAmount: number; paymentMethod: string; voidedAt: string | null }[] =
        json.data.filter((t: { voidedAt: string | null }) => !t.voidedAt);
      const sum = (list: typeof txs) => list.reduce((s, t) => s + t.totalAmount, 0);
      const totalCash = sum(txs.filter((t) => t.paymentMethod === "tunai"));
      const totalNonCash = sum(txs.filter((t) => t.paymentMethod !== "tunai"));
      setShiftSummary({ totalCash, totalNonCash, totalAll: totalCash + totalNonCash, txCount: txs.length });
    } catch (e) {
      console.error("fetchShiftSummary:", e);
    }
  };

  const openCloseShiftDialog = async () => {
    if (!shift) return;
    await fetchShiftSummary(shift.id);
    setShowCloseShift(true);
  };

  const afterShiftClosed = async () => {
    setShiftSummary(null);
    setCart([]);
    setPendingCarts([]);
    await fetchActiveShift();
  };

  // ── Keranjang ──────────────────────────────────────────────────────────────

  const addToCart = (product: Product) => {
    // Yang memblokir hanya stok sistem <= 0 (stok minimum cuma pengingat PO).
    if (product.stock <= 0) {
      alert(`Stok "${product.name}" di sistem ${product.stock}. Bila barangnya ada, minta manajer mengoreksi stok di Manajemen Barang.`);
      return;
    }
    // Peringatan saja (tidak memblokir): masih ada stok tercatat yang sudah lewat tanggal kadaluarsa.
    setExpiryWarning(product.nearestExpiry && product.nearestExpiry < todayWib()
      ? `${product.name}: ada stok kadaluarsa (${formatExpiry(product.nearestExpiry)}). Cek fisik barang sebelum dijual.`
      : "");
    setCart((prev) => {
      const existing = prev.find((i) => i.id === product.id);
      if (!existing) return [...prev, { ...product, qty: 1 }];
      if (existing.qty >= product.stock) return prev; // tidak melebihi stok
      return prev.map((i) => (i.id === product.id ? { ...i, qty: i.qty + 1 } : i));
    });
  };

  const changeQty = (id: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => (item.id === id ? { ...item, qty: item.qty + delta } : item))
        .filter((item) => item.qty > 0)
    );
  };

  // ── Keranjang tertahan (disimpan di server) ────────────────────────────────

  const fetchPendingCarts = useCallback(async () => {
    try {
      const res = await fetch("/api/pending-carts");
      const json = await res.json();
      if (json.success) setPendingCarts(json.data);
    } catch (e) {
      console.error("fetchPendingCarts:", e);
    }
  }, []);

  useEffect(() => {
    fetchPendingCarts();
  }, [fetchPendingCarts]);

  const savePending = async (customerName: string) => {
    if (cart.length === 0) return false;
    try {
      const res = await fetch("/api/pending-carts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerName, totalAmount: pricing.subtotal, items: cart }),
      });
      const json = await res.json();
      if (!json.success) {
        alert(json.message ?? "Gagal menyimpan pending");
        return false;
      }
      setCart([]);
      await fetchPendingCarts();
      return true;
    } catch (e) {
      console.error(e);
      alert("Terjadi kesalahan jaringan");
      return false;
    }
  };

  const restorePending = async (pendingCart: PendingCart) => {
    try {
      // Ambil dari server agar stok yang dipakai stok terbaru.
      const res = await fetch(`/api/pending-carts/${pendingCart.id}`);
      const json = await res.json();
      if (!json.success) return alert(json.message ?? "Gagal memuat keranjang");
      setCart(json.data.items);
      await fetch(`/api/pending-carts/${pendingCart.id}`, { method: "DELETE" });
      await fetchPendingCarts();
      setShowPendingList(false);
    } catch (e) {
      console.error(e);
      alert("Terjadi kesalahan jaringan");
    }
  };

  const deletePending = async (id: string) => {
    try {
      await fetch(`/api/pending-carts/${id}`, { method: "DELETE" });
      await fetchPendingCarts();
    } catch (e) {
      console.error(e);
    }
  };

  // ── Bayar ──────────────────────────────────────────────────────────────────

  const pay = async (paymentMethod: PaymentMethod, cashReceived: number) => {
    if (cart.length === 0) return false;
    try {
      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: cart, paymentMethod, cashReceived }),
      });
      const json = await res.json();
      if (!json.success) {
        alert(json.message ?? "Gagal menyimpan transaksi");
        return false;
      }
      setIsCheckoutSuccess(true);
      setShowPayment(false);
      await fetchReceipt(json.data.id); // data.id = nomor transaksi
      return true;
    } catch (e) {
      console.error(e);
      alert("Terjadi kesalahan jaringan");
      return false;
    }
  };

  const fetchReceipt = async (trxNumber: string) => {
    try {
      const res = await fetch(`/api/transactions/${trxNumber}`);
      const json = await res.json();
      if (json.success) setReceiptData(json.data);
    } catch (e) {
      console.error("fetchReceipt:", e);
    }
  };

  const startNewTransaction = () => {
    setCart([]);
    setIsCheckoutSuccess(false);
    setReceiptData(null);
    setShowReceipt(false);
  };

  // ── Tampilan ───────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <header className="flex items-center justify-between p-4 bg-white border-b shrink-0">
        <h1 className="text-xl font-bold text-slate-800">Kasir: Logmart Trowono</h1>
        <div className="flex items-center gap-4 text-sm font-medium">
          {shift ? (
            <>
              <div className="bg-green-100 text-green-800 px-3 py-1.5 rounded-full flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500" />
                Shift Aktif
              </div>
              <Button variant="outline" size="sm" className="h-8" onClick={() => setShowVoid(true)}>
                Batalkan Transaksi
              </Button>
              <Button variant="outline" size="sm" className="h-8" onClick={openCloseShiftDialog}>
                Tutup Shift
              </Button>
            </>
          ) : (
            <div className="bg-slate-100 text-slate-500 px-3 py-1.5 rounded-full flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-slate-400" />
              Shift Tutup
            </div>
          )}
          <div className="text-slate-500">{new Date().toLocaleDateString("id-ID")}</div>
        </div>
      </header>

      {isLoadingShift ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center text-slate-400 gap-3">
            <Loader2 className="w-8 h-8 animate-spin" />
            <p>Memeriksa status shift...</p>
          </div>
        </div>
      ) : !shift ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6">
          <div className="max-w-md w-full flex flex-col items-center text-center gap-6">
            <div className="w-20 h-20 bg-slate-200 rounded-full flex items-center justify-center">
              <LockKeyhole className="w-10 h-10 text-slate-500" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-800">Sistem Kasir Terkunci</h2>
              <p className="text-slate-500 mt-2">
                {isCashier
                  ? "Buka shift terlebih dahulu untuk mulai melayani transaksi."
                  : "Menu kasir hanya untuk akun kasir. Masuk dengan akun kasir untuk membuka shift dan melayani transaksi."}
              </p>
            </div>
            {isCashier && (
              <Button size="lg" className="w-full gap-2 text-lg h-12" onClick={() => setShowOpenShift(true)}>
                <Clock className="w-5 h-5" />
                Buka Shift Sekarang
              </Button>
            )}
          </div>
        </div>
      ) : isCheckoutSuccess ? (
        <CheckoutSuccess receipt={receiptData} onPrint={() => setShowReceipt(true)} onNewTransaction={startNewTransaction} />
      ) : (
        <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
          <ProductSearchPanel onPick={addToCart} warning={expiryWarning} onDismissWarning={() => setExpiryWarning("")} />
          <CartPanel
            cart={cart}
            lines={pricing.lines}
            subtotal={pricing.subtotal}
            discountTotal={pricing.discountTotal}
            total={pricing.total}
            isPricing={pricing.isPricing}
            pendingCount={pendingCarts.length}
            onChangeQty={changeQty}
            onClear={() => setCart([])}
            onShowPending={() => setShowPendingList(true)}
            onSavePending={() => setShowSavePending(true)}
            onPay={() => setShowPayment(true)}
          />
        </div>
      )}

      <OpenShiftDialog open={showOpenShift} onOpenChange={setShowOpenShift} onOpened={fetchActiveShift} />
      <CloseShiftDialog open={showCloseShift} onOpenChange={setShowCloseShift} shift={shift} summary={shiftSummary} onClosed={afterShiftClosed} />
      <VoidDialog open={showVoid} onOpenChange={setShowVoid} />
      <PaymentDialog open={showPayment} onOpenChange={setShowPayment} total={pricing.total} onPay={pay} />
      <SavePendingDialog open={showSavePending} onOpenChange={setShowSavePending} onSave={savePending} />
      <PendingListDialog
        open={showPendingList} onOpenChange={setShowPendingList}
        carts={pendingCarts} onRestore={restorePending} onDelete={deletePending}
      />
      <ReceiptModal isOpen={showReceipt} onClose={() => setShowReceipt(false)} transactionId={receiptData?.id} />
    </div>
  );
}
