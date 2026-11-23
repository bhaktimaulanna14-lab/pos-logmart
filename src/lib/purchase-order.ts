// Bentuk data dari GET /api/purchase-orders/[id], dipakai halaman detail PO dan halaman terima barang.

export type PurchaseOrderStatus = "dipesan" | "diterima" | "dibatalkan";

export type PurchaseOrderItem = {
  id: string;
  productId: string;
  name: string;
  barcode: string;
  quantity: number;
  receivedQty: number;
  /** Harga modal per unit saat diterima; null bila belum diterima. */
  unitCost: number | null;
  /** Harga modal barang saat ini (untuk isian awal di halaman terima). */
  cost: number;
};

export type PurchaseOrderDetail = {
  id: string;
  poNumber: string;
  supplierName: string;
  status: PurchaseOrderStatus;
  orderDate: string;
  receivedAt: string | null;
  notes: string | null;
  items: PurchaseOrderItem[];
};
