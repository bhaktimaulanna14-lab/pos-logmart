"use client";

import { useConfirm } from "@/components/confirm-dialog";
import { formatRupiah } from "@/lib/format";
import { useState, useEffect, useCallback, useRef } from "react";
import {
  Search, ScanLine, ShoppingCart, Trash2, CreditCard,
  LockKeyhole, Clock, CheckCircle, Printer, Loader2, X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { ReceiptModal } from "@/components/ReceiptModal";
import type { ReceiptData } from "@/components/ReceiptModal";
import { useSession } from "@/hooks/useSession";
import { formatExpiry, todayWib } from "@/lib/expiry";

// ─── Types ───────────────────────────────────────────────────────────────────

type Product = {
  id: string;
  barcode: string;
  name: string;
  price: number;
  stock: number;
  nearestExpiry?: string | null;
};

type CartItem = Product & { qty: number };

type Shift = {
  id: string;
  userId: string;
  openAt: string;
  openingCash: number;
  status: string;
};

type PendingCart = {
  id: string;
  name: string;
  time: string;
  total: number;
  items: CartItem[];
};

type ShiftSummary = {
  totalCash: number;
  totalNonCash: number;
  totalAll: number;
  txCount: number;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

// ─── Component ───────────────────────────────────────────────────────────────

export default function PosPage() {
  // Hanya kasir yang boleh membuka shift & checkout (manajer hanya melihat).
  const { user } = useSession();
  const isCashier = user?.role === "kasir";

  // Shift state
  const [confirm, confirmDialog] = useConfirm();
  const [shift, setShift] = useState<Shift | null>(null);
  const [isLoadingShift, setIsLoadingShift] = useState(true);
  const [showOpenShiftDialog, setShowOpenShiftDialog] = useState(false);
  const [openingCash, setOpeningCash] = useState("");
  const [isOpeningShift, setIsOpeningShift] = useState(false);

  // Close shift
  const [showCloseShiftDialog, setShowCloseShiftDialog] = useState(false);
  const [actualCash, setActualCash] = useState("");
  const [isClosingShift, setIsClosingShift] = useState(false);
  const [shiftSummary, setShiftSummary] = useState<ShiftSummary | null>(null);

  // Cart state (client-only; no need to persist per spec)
  const [cart, setCart] = useState<CartItem[]>([]);

  // Search/barcode state
  const [barcodeInput, setBarcodeInput] = useState("");
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [notFound, setNotFound] = useState(false);
  const [expiryWarning, setExpiryWarning] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Payment
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"tunai" | "debit" | "qris">("tunai");
  const [cashReceived, setCashReceived] = useState("");
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  // Post-checkout
  const [isCheckoutSuccess, setIsCheckoutSuccess] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);
  const [lastTrxNumber, setLastTrxNumber] = useState<string | null>(null);

  // Pending carts (persisted to DB)
  const [pendingCarts, setPendingCarts] = useState<PendingCart[]>([]);
  const [showPendingDialog, setShowPendingDialog] = useState(false);
  const [showSavePendingDialog, setShowSavePendingDialog] = useState(false);
  const [pendingCustomerName, setPendingCustomerName] = useState("");
  const [isSavingPending, setIsSavingPending] = useState(false);

  // Pembatalan transaksi hari ini (server mengizinkan selama shift transaksi masih buka)
  type RecentTrx = { id: string; transactionNumber: string; transactionTime: string; totalAmount: number; cashierName: string | null; voidedAt: string | null };
  const [showVoidDialog, setShowVoidDialog] = useState(false);
  const [recentTrx, setRecentTrx] = useState<RecentTrx[]>([]);
  const [voidingNumber, setVoidingNumber] = useState<string | null>(null);

  // ── Shift helpers ──────────────────────────────────────────────────────────

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

  const fetchShiftSummary = useCallback(async (shiftId: string) => {
    // We derive summary from the transactions endpoint for this shift
    try {
      const res = await fetch(`/api/transactions?shiftId=${shiftId}`);
      const json = await res.json();
      if (!json.success) return;
      const txs: { totalAmount: number; paymentMethod: string; voidedAt: string | null }[] = json.data.filter((t: { voidedAt: string | null }) => !t.voidedAt);
      const totalCash = txs
        .filter((t) => t.paymentMethod === "tunai")
        .reduce((s, t) => s + t.totalAmount, 0);
      const totalNonCash = txs
        .filter((t) => t.paymentMethod !== "tunai")
        .reduce((s, t) => s + t.totalAmount, 0);
      setShiftSummary({
        totalCash,
        totalNonCash,
        totalAll: totalCash + totalNonCash,
        txCount: txs.length,
      });
    } catch (e) {
      console.error("fetchShiftSummary:", e);
    }
  }, []);

  const handleOpenShift = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsOpeningShift(true);
    try {
      const res = await fetch("/api/shifts/open", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ openingCash: Number(openingCash) }),
      });
      const json = await res.json();
      if (json.success) {
        setShowOpenShiftDialog(false);
        setOpeningCash("");
        await fetchActiveShift();
      } else {
        alert(json.message ?? "Gagal membuka shift");
      }
    } catch (e) {
      console.error(e);
      alert("Terjadi kesalahan jaringan");
    } finally {
      setIsOpeningShift(false);
    }
  };

  const handleCloseShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shift) return;
    setIsClosingShift(true);
    try {
      const res = await fetch("/api/shifts/close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ closingCash: Number(actualCash), shiftId: shift.id }),
      });
      const json = await res.json();
      if (json.success) {
        setShowCloseShiftDialog(false);
        setActualCash("");
        setShiftSummary(null);
        setCart([]);
        setPendingCarts([]);
        await fetchActiveShift();
      } else {
        alert(json.message ?? "Gagal menutup shift");
      }
    } catch (e) {
      console.error(e);
      alert("Terjadi kesalahan jaringan");
    } finally {
      setIsClosingShift(false);
    }
  };

  // ── Pending carts helpers ──────────────────────────────────────────────────

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

  const handleSavePending = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) return;
    setIsSavingPending(true);
    try {
      const res = await fetch("/api/pending-carts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: pendingCustomerName || "Tanpa Nama",
          totalAmount: subtotal,
          items: cart,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setCart([]);
        setPendingCustomerName("");
        setShowSavePendingDialog(false);
        await fetchPendingCarts();
      } else {
        alert(json.message ?? "Gagal menyimpan pending");
      }
    } catch (e) {
      console.error(e);
      alert("Terjadi kesalahan jaringan");
    } finally {
      setIsSavingPending(false);
    }
  };

  const handleRestorePending = async (pendingCart: PendingCart) => {
    // Fetch from server to get fresh stock values
    try {
      const res = await fetch(`/api/pending-carts/${pendingCart.id}`);
      const json = await res.json();
      if (json.success) {
        setCart(json.data.items);
        // Delete from DB after restoring
        await fetch(`/api/pending-carts/${pendingCart.id}`, { method: "DELETE" });
        await fetchPendingCarts();
        setShowPendingDialog(false);
      } else {
        alert(json.message ?? "Gagal memuat keranjang");
      }
    } catch (e) {
      console.error(e);
      alert("Terjadi kesalahan jaringan");
    }
  };

  const handleDeletePending = async (id: string) => {
    try {
      await fetch(`/api/pending-carts/${id}`, { method: "DELETE" });
      await fetchPendingCarts();
    } catch (e) {
      console.error(e);
    }
  };

  // ── Barcode / search ───────────────────────────────────────────────────────

  const lookupProduct = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      setNotFound(false);
      return;
    }
    setIsSearching(true);
    setNotFound(false);
    try {
      const res = await fetch(`/api/products/lookup?q=${encodeURIComponent(query.trim())}`);
      const json = await res.json();
      const results: Product[] = json.success ? json.data : [];

      // Exact barcode match → auto-add
      const exact = results.find((p) => p.barcode === query.trim());
      if (exact) {
        addToCart(exact);
        setBarcodeInput("");
        setSearchResults([]);
        return;
      }

      setSearchResults(results);
      setNotFound(results.length === 0);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const handleBarcodeChange = (value: string) => {
    setBarcodeInput(value);
    if (!value) {
      setSearchResults([]);
      setNotFound(false);
      return;
    }
    // Debounce for name search; immediate for barcode-like input
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => lookupProduct(value), 300);
  };

  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    lookupProduct(barcodeInput);
  };

  // ── Cart ───────────────────────────────────────────────────────────────────

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
      if (existing) {
        if (existing.qty >= product.stock) return prev; // respect stock
        return prev.map((i) => i.id === product.id ? { ...i, qty: i.qty + 1 } : i);
      }
      return [...prev, { ...product, qty: 1 }];
    });
    setBarcodeInput("");
    setSearchResults([]);
    setNotFound(false);
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => item.id === id ? { ...item, qty: item.qty + delta } : item)
        .filter((item) => item.qty > 0)
    );
  };

  const clearCart = () => setCart([]);

  const subtotal = cart.reduce((sum, i) => sum + i.price * i.qty, 0);

  // Promo dihitung di server (sama persis dengan saat checkout) setiap keranjang berubah.
  const [pricing, setPricing] = useState<{
    key: string;
    discountTotal: number;
    total: number;
    lines: Record<string, { discount: number; promotionName: string | null; promotionNote: string | null }>;
  } | null>(null);
  const cartKey = cart.map((i) => `${i.id}:${i.qty}`).join(",");
  useEffect(() => {
    if (!cartKey) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const res = await fetch("/api/checkout/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: cartKey.split(",").map((s) => ({ id: s.split(":")[0], qty: Number(s.split(":")[1]) })) }),
        });
        const json = await res.json();
        if (!cancelled && json.success) {
          const lines: Record<string, { discount: number; promotionName: string | null; promotionNote: string | null }> = {};
          for (const l of json.data.lines) lines[l.id] = l;
          setPricing({ key: cartKey, discountTotal: json.data.discountTotal, total: json.data.total, lines });
        }
      } catch (e) {
        console.error("checkout preview:", e);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [cartKey]);
  const pricingFresh = pricing && pricing.key === cartKey ? pricing : null;
  const discountTotal = pricingFresh?.discountTotal ?? 0;
  const total = cart.length === 0 ? 0 : pricingFresh?.total ?? subtotal;
  const isPricing = cart.length > 0 && !pricingFresh;

  // ── Checkout ───────────────────────────────────────────────────────────────

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) return;
    setIsCheckingOut(true);
    try {
      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: cart,
          paymentMethod,
          cashReceived: paymentMethod === "tunai" ? Number(cashReceived) : total,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        alert(json.message ?? "Gagal menyimpan transaksi");
        return;
      }

      const trxNumber: string = json.data.id; // transactionNumber returned from API
      setLastTrxNumber(trxNumber);
      setIsCheckoutSuccess(true);
      setShowPaymentDialog(false);

      // Immediately fetch full receipt from server
      await fetchReceipt(trxNumber);
    } catch (e) {
      console.error(e);
      alert("Terjadi kesalahan jaringan");
    } finally {
      setIsCheckingOut(false);
    }
  };

  const fetchReceipt = async (trxNumber: string) => {
    try {
      const res = await fetch(`/api/transactions/${trxNumber}`);
      const json = await res.json();
      if (json.success) {
        setReceiptData(json.data);
      }
    } catch (e) {
      console.error("fetchReceipt:", e);
    }
  };

  const openVoidDialog = async () => {
    setShowVoidDialog(true);
    setRecentTrx([]);
    try {
      const res = await fetch(`/api/transactions?date=${todayWib()}&page=1&pageSize=50`);
      const json = await res.json();
      if (json.success) setRecentTrx(json.data);
    } catch (e) {
      console.error("openVoidDialog:", e);
    }
  };

  const handleVoidTrx = async (t: RecentTrx) => {
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
      setRecentTrx((list) => list.map((x) => (x.id === t.id ? { ...x, voidedAt: new Date().toISOString() } : x)));
    } catch {
      alert("Terjadi kesalahan jaringan");
    } finally {
      setVoidingNumber(null);
    }
  };

  const startNewTransaction = () => {
    setCart([]);
    setBarcodeInput("");
    setCashReceived("");
    setPaymentMethod("tunai");
    setIsCheckoutSuccess(false);
    setReceiptData(null);
    setLastTrxNumber(null);
    setShowReceipt(false);
    setSearchResults([]);
    setNotFound(false);
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Header */}
      <header className="flex items-center justify-between p-4 bg-white border-b shrink-0">
        <h1 className="text-xl font-bold text-slate-800">Kasir: Logmart Trowono</h1>
        <div className="flex items-center gap-4 text-sm font-medium">
          {shift ? (
            <>
              <div className="bg-green-100 text-green-800 px-3 py-1.5 rounded-full flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500" />
                Shift Aktif
              </div>
              <Button variant="outline" size="sm" className="h-8" onClick={openVoidDialog}>
                Batalkan Transaksi
              </Button>
              <Button
                variant="outline" size="sm" className="h-8"
                onClick={async () => {
                  await fetchShiftSummary(shift.id);
                  setShowCloseShiftDialog(true);
                }}
              >
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

      {/* Main */}
      {isLoadingShift ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center text-slate-400 gap-3">
            <Loader2 className="w-8 h-8 animate-spin" />
            <p>Memeriksa status shift...</p>
          </div>
        </div>

      ) : !shift ? (
        /* ── Shift closed screen ── */
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
              <Button size="lg" className="w-full gap-2 text-lg h-12" onClick={() => setShowOpenShiftDialog(true)}>
                <Clock className="w-5 h-5" />
                Buka Shift Sekarang
              </Button>
            )}
          </div>

          {/* Open shift dialog */}
          <Dialog open={showOpenShiftDialog} onOpenChange={setShowOpenShiftDialog}>
            <DialogContent className="sm:max-w-[425px]">
              <form onSubmit={handleOpenShift}>
                <DialogHeader>
                  <DialogTitle>Buka Shift Baru</DialogTitle>
                  <DialogDescription>
                    Masukkan jumlah uang modal awal di laci kasir.
                  </DialogDescription>
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
                  <Button type="button" variant="outline" onClick={() => setShowOpenShiftDialog(false)}>Batal</Button>
                  <Button type="submit" disabled={isOpeningShift}>
                    {isOpeningShift ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Buka Shift
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

      ) : isCheckoutSuccess ? (
        /* ── Checkout success screen ── */
        <div className="flex-1 flex flex-col items-center justify-center p-6">
          <Card className="max-w-md w-full">
            <CardContent className="pt-6 flex flex-col items-center text-center gap-6">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle className="w-10 h-10 text-green-600" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-800">Transaksi Berhasil!</h2>
                {receiptData && (
                  <p className="text-slate-500 mt-2 text-sm">
                    No: {receiptData.id} | {new Date(receiptData.time).toLocaleTimeString("id-ID")}
                  </p>
                )}
              </div>

              {receiptData && (
                <div className="w-full bg-slate-50 p-4 rounded-lg text-left text-sm space-y-2">
                  <div className="flex justify-between font-bold text-base border-b pb-2 mb-2">
                    <span>Total Transaksi</span>
                    <span>{formatRupiah(receiptData.total)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Metode</span>
                    <span className="capitalize">{receiptData.paymentMethod}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Bayar</span>
                    <span>{formatRupiah(receiptData.cashReceived)}</span>
                  </div>
                  {receiptData.change > 0 && (
                    <div className="flex justify-between font-semibold text-green-700 pt-2 border-t mt-2">
                      <span>Kembalian</span>
                      <span>{formatRupiah(receiptData.change)}</span>
                    </div>
                  )}
                </div>
              )}

              <div className="w-full flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setShowReceipt(true)}
                  disabled={!receiptData}>
                  <Printer className="w-4 h-4 mr-2" />
                  Cetak Struk
                </Button>
                <Button className="flex-1" onClick={startNewTransaction}>
                  Transaksi Baru
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

      ) : (
        /* 📱 Main POS screen 📱 */
        <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
          {/* Left: search + results */}
          <div className="flex-1 flex flex-col min-w-0 border-b md:border-b-0 md:border-r bg-slate-50/50 overflow-hidden">
            <div className="p-4 border-b bg-white shrink-0">
              <form onSubmit={handleBarcodeSubmit} className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <Input
                  autoFocus
                  placeholder="Cari nama barang atau scan barcode..."
                  className="pl-10 h-12 text-lg shadow-sm pr-10"
                  value={barcodeInput}
                  onChange={(e) => handleBarcodeChange(e.target.value)}
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {isSearching
                    ? <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
                    : <ScanLine className="w-5 h-5 text-slate-400" />
                  }
                </div>
              </form>
              {expiryWarning && (
                <div role="alert" className="mt-2 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  <span className="flex-1">{expiryWarning}</span>
                  <button type="button" aria-label="Tutup peringatan" className="font-bold" onClick={() => setExpiryWarning("")}>×</button>
                </div>
              )}
            </div>

            <div className="flex-1 overflow-auto p-4">
              {searchResults.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
                  {searchResults.map((product) => (
                    <Card
                      key={product.id}
                      className={`cursor-pointer hover:border-brand-green/60 hover:shadow-md transition-colors active:scale-95 ${product.stock <= 0 ? "opacity-50 cursor-not-allowed" : ""}`}
                      onClick={() => addToCart(product)}
                    >
                      <CardContent className="p-3 md:p-4 text-center flex flex-col h-full">
                        <div className="text-xs text-slate-400 mb-1">{product.barcode}</div>
                        <div className="font-semibold text-sm md:text-base leading-tight mb-2 flex-1">{product.name}</div>
                        <div className="text-brand-orange font-bold mb-2">{formatRupiah(product.price)}</div>
                        <div className="text-xs font-medium text-slate-500 bg-slate-100 rounded-full py-1">
                          Stok: {product.stock}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : notFound ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-2">
                  <X className="w-10 h-10 text-red-300" />
                  <p>Barang <strong>&ldquo;{barcodeInput}&rdquo;</strong> tidak ditemukan.</p>
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-4">
                  <PackagePlaceholder />
                  <p>Ketik nama barang atau scan barcode untuk mulai.</p>
                </div>
              )}
            </div>
          </div>

          {/* Right: cart */}
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
                  onClick={() => setShowPendingDialog(true)}
                >
                  <Clock className="w-4 h-4 mr-1" />
                  Tertahan ({pendingCarts.length})
                </Button>
                <Button
                  variant="ghost" size="sm" className="text-red-500 hover:text-red-600 px-2"
                  onClick={clearCart} disabled={cart.length === 0}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="flex-1 overflow-auto p-4 bg-slate-50/30">
              {cart.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-sm text-slate-400">
                  Keranjang masih kosong
                </div>
              ) : (
                <div className="space-y-3">
                  {cart.map((item) => (
                    <div key={item.id} className="flex flex-col gap-2 p-3 bg-white border rounded-lg shadow-sm">
                      <div className="flex justify-between items-start">
                        <div className="font-medium text-sm leading-tight pr-2">{item.name}</div>
                        <div className="font-semibold text-right shrink-0">
                          {pricingFresh?.lines[item.id]?.discount ? (
                            <>
                              <div className="text-xs text-slate-400 line-through font-normal">{formatRupiah(item.price * item.qty)}</div>
                              <div className="text-brand-green">{formatRupiah(item.price * item.qty - pricingFresh.lines[item.id].discount)}</div>
                            </>
                          ) : (
                            formatRupiah(item.price * item.qty)
                          )}
                        </div>
                      </div>
                      {pricingFresh?.lines[item.id]?.promotionName && (
                        <div className="text-xs rounded bg-brand-orange-light/10 text-orange-800 px-2 py-1">
                          🏷 {pricingFresh.lines[item.id].promotionName} · {pricingFresh.lines[item.id].promotionNote}
                        </div>
                      )}
                      <div className="flex justify-between items-center mt-1">
                        <div className="text-xs text-slate-500">{formatRupiah(item.price)}</div>
                        <div className="flex items-center gap-2 bg-slate-100 rounded-md p-0.5">
                          <Button
                            variant="ghost" size="sm" className="h-8 w-8 md:h-6 md:w-6 rounded p-0 text-lg md:text-sm"
                            onClick={() => updateQuantity(item.id, -1)}
                          >-</Button>
                          <span className="text-sm font-medium w-6 text-center">{item.qty}</span>
                          <Button
                            variant="ghost" size="sm" className="h-8 w-8 md:h-6 md:w-6 rounded p-0 text-lg md:text-sm"
                            onClick={() => updateQuantity(item.id, 1)}
                            disabled={item.qty >= item.stock}
                          >+</Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Checkout footer */}
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
                  disabled={cart.length === 0}
                  onClick={() => setShowSavePendingDialog(true)}
                >
                  <Clock className="w-5 h-5 mr-2" /> Simpan Pending
                </Button>
              </div>

              <Button
                size="lg"
                className="w-full h-14 text-lg font-bold gap-2"
                disabled={cart.length === 0 || isPricing}
                onClick={() => setShowPaymentDialog(true)}
              >
                <CreditCard className="w-6 h-6" />
                Bayar Sekarang
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Dialogs (always mounted) ──────────────────────────────────────── */}

      {/* Save Pending Dialog */}
      <Dialog open={showSavePendingDialog} onOpenChange={setShowSavePendingDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <form onSubmit={handleSavePending}>
            <DialogHeader>
              <DialogTitle>Simpan Keranjang (Pending)</DialogTitle>
              <DialogDescription>Simpan keranjang ini untuk dilanjutkan nanti.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-6">
              <div className="grid gap-2">
                <Label htmlFor="pending_name">Nama Pelanggan (Opsional)</Label>
                <Input
                  id="pending_name" placeholder="Contoh: Pak Budi"
                  value={pendingCustomerName}
                  onChange={(e) => setPendingCustomerName(e.target.value)}
                  autoFocus
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowSavePendingDialog(false)}>Batal</Button>
              <Button type="submit" disabled={isSavingPending}>
                {isSavingPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Simpan Pending
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* View Pending Dialog */}
      <Dialog open={showPendingDialog} onOpenChange={setShowPendingDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Daftar Keranjang Tertahan</DialogTitle>
            <DialogDescription>Pilih keranjang untuk dilanjutkan atau hapus.</DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-3 max-h-[60vh] overflow-auto">
            {pendingCarts.length === 0 ? (
              <div className="text-center text-slate-500 py-8">
                Tidak ada keranjang tertahan saat ini.
              </div>
            ) : (
              pendingCarts.map((p) => (
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
                    <Button variant="ghost" size="icon"
                      className="text-red-500 hover:text-red-600 hover:bg-red-50"
                      onClick={() => handleDeletePending(p.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleRestorePending(p)}>
                      Lanjutkan
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setShowPendingDialog(false)}>Tutup</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Void Dialog */}
      <Dialog open={showVoidDialog} onOpenChange={setShowVoidDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Batalkan Transaksi</DialogTitle>
            <DialogDescription>Transaksi hari ini. Hanya bisa dibatalkan selama shift transaksi itu masih buka.</DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-2 max-h-[60vh] overflow-auto">
            {recentTrx.length === 0 ? (
              <div className="text-center text-slate-500 py-8">Belum ada transaksi hari ini.</div>
            ) : (
              recentTrx.map((t) => (
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
                    <Button variant="destructive" size="sm" disabled={voidingNumber !== null} onClick={() => handleVoidTrx(t)}>
                      {voidingNumber === t.transactionNumber ? <Loader2 className="w-4 h-4 animate-spin" /> : "Batalkan"}
                    </Button>
                  )}
                </div>
              ))
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setShowVoidDialog(false)}>Tutup</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment Dialog */}
      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>Pembayaran</DialogTitle>
            <DialogDescription>
              Total tagihan: <span className="font-bold text-lg text-slate-900">{formatRupiah(total)}</span>
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCheckout} className="grid gap-6 py-4">
            <div className="flex gap-2">
              {(["tunai", "debit", "qris"] as const).map((method) => (
                <Button
                  key={method} type="button"
                  variant={paymentMethod === method ? "default" : "outline"}
                  className="flex-1 capitalize"
                  onClick={() => { setPaymentMethod(method); setCashReceived(""); }}
                >
                  {method}
                </Button>
              ))}
            </div>

            {paymentMethod === "tunai" && (
              <div className="grid gap-2">
                <Label htmlFor="cash_received">Uang Diterima (Rp)</Label>
                <Input
                  id="cash_received" type="number" autoFocus
                  placeholder="Contoh: 50000"
                  value={cashReceived}
                  onChange={(e) => setCashReceived(e.target.value)}
                  className="text-lg h-12"
                />

                {Number(cashReceived) > 0 && (
                  <div className={`mt-2 p-3 rounded-lg flex justify-between items-center ${Number(cashReceived) >= total ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}>
                    <span className="font-medium">Kembalian:</span>
                    <span className="font-bold text-lg">
                      {Number(cashReceived) >= total
                        ? formatRupiah(Number(cashReceived) - total)
                        : "Uang Kurang"}
                    </span>
                  </div>
                )}

                <div className="flex flex-wrap gap-2 mt-2">
                  <Button type="button" variant="outline" size="sm"
                    onClick={() => setCashReceived(total.toString())}>
                    Uang Pas
                  </Button>
                  {[20000, 50000, 100000].filter((a) => a > total).map((amt) => (
                    <Button key={amt} type="button" variant="outline" size="sm"
                      onClick={() => setCashReceived(amt.toString())}>
                      {formatRupiah(amt)}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" onClick={() => setShowPaymentDialog(false)}>Batal</Button>
              <Button
                type="submit"
                className="gap-2"
                disabled={
                  isCheckingOut ||
                  (paymentMethod === "tunai" && Number(cashReceived) < total)
                }
              >
                {isCheckingOut ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Selesaikan Pembayaran
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Close Shift Dialog */}
      <Dialog open={showCloseShiftDialog} onOpenChange={setShowCloseShiftDialog}>
        <DialogContent className="sm:max-w-[450px]">
          <form onSubmit={handleCloseShift}>
            <DialogHeader>
              <DialogTitle>Tutup Shift Kasir</DialogTitle>
              <DialogDescription>Rekap penjualan selama shift Anda.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="bg-slate-50 p-4 rounded-lg space-y-3 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Uang Modal Awal:</span>
                  <span className="font-semibold">{formatRupiah(shift?.openingCash ?? 0)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Total Penjualan Tunai:</span>
                  <span className="font-semibold">{formatRupiah(shiftSummary?.totalCash ?? 0)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Total Penjualan Debit/QRIS:</span>
                  <span className="font-semibold">{formatRupiah(shiftSummary?.totalNonCash ?? 0)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Jumlah Transaksi:</span>
                  <span className="font-semibold">{shiftSummary?.txCount ?? 0} transaksi</span>
                </div>
                <div className="border-t pt-2 flex justify-between items-center font-bold text-slate-800 text-base">
                  <span>Ekspektasi Uang di Laci:</span>
                  <span>{formatRupiah((shift?.openingCash ?? 0) + (shiftSummary?.totalCash ?? 0))}</span>
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
                {actualCash && (() => {
                  const expected = (shift?.openingCash ?? 0) + (shiftSummary?.totalCash ?? 0);
                  const diff = Number(actualCash) - expected;
                  return (
                    <div className={`text-sm mt-1 flex items-center justify-between font-medium ${diff === 0 ? "text-green-600" : diff > 0 ? "text-brand-green" : "text-red-600"}`}>
                      <span>Selisih:</span>
                      <span>{diff > 0 ? "+" : ""}{formatRupiah(diff)}</span>
                    </div>
                  );
                })()}
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowCloseShiftDialog(false)}>Batal</Button>
              <Button type="submit" variant="destructive" disabled={isClosingShift}>
                {isClosingShift ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Tutup Shift
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Receipt Modal - data from server */}
      <ReceiptModal
        isOpen={showReceipt}
        onClose={() => setShowReceipt(false)}
        transactionId={receiptData?.id}
      />
      {confirmDialog}
    </div>
  );
}

function PackagePlaceholder() {
  return (
    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="opacity-50">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.29 7 12 12 20.71 7" />
      <line x1="12" y1="22" x2="12" y2="12" />
    </svg>
  );
}
