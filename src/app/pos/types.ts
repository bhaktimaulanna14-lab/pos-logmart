// Tipe data halaman Kasir.

export type Product = {
  id: string;
  barcode: string;
  name: string;
  price: number;
  stock: number;
  nearestExpiry?: string | null;
};

export type CartItem = Product & { qty: number };

export type Shift = {
  id: string;
  userId: string;
  openAt: string;
  openingCash: number;
  status: string;
};

export type ShiftSummary = {
  totalCash: number;
  totalNonCash: number;
  totalAll: number;
  txCount: number;
};

/** Keranjang yang disimpan sementara (pelanggan belum bayar). */
export type PendingCart = {
  id: string;
  name: string;
  time: string;
  total: number;
  items: CartItem[];
};

/** Transaksi hari ini di daftar pembatalan. */
export type RecentTrx = {
  id: string;
  transactionNumber: string;
  transactionTime: string;
  totalAmount: number;
  cashierName: string | null;
  voidedAt: string | null;
};

export type PaymentMethod = "tunai" | "debit" | "qris";

/** Diskon promo per barang di keranjang, dihitung server. */
export type PricingLine = { discount: number; promotionName: string | null; promotionNote: string | null };
