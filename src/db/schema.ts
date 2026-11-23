import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const categories = sqliteTable("categories", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
});

export const products = sqliteTable("products", {
  id: text("id").primaryKey(),
  barcode: text("barcode").notNull().unique(),
  name: text("name").notNull(),
  categoryId: text("category_id")
    .notNull()
    .references(() => categories.id),
  price: integer("price").notNull(),
  cost: integer("cost").notNull(),
  stockQty: integer("stock_qty").notNull().default(0),
  minStock: integer("min_stock").notNull().default(0),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
}, (t) => [
  index("products_name_idx").on(t.name),
  index("products_category_idx").on(t.categoryId),
  index("products_active_stock_idx").on(t.isActive, t.stockQty),
]);

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull(), // kasir, manajer
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export const shifts = sqliteTable("shifts", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  openAt: text("open_at").notNull(),
  closeAt: text("close_at"),
  openingCash: integer("opening_cash").notNull(),
  closingCash: integer("closing_cash"),
  status: text("status").notNull(), // buka, tutup
}, (t) => [
  index("shifts_user_status_idx").on(t.userId, t.status),
  index("shifts_open_at_idx").on(t.openAt),
]);

export const transactions = sqliteTable("transactions", {
  id: text("id").primaryKey(),
  transactionNumber: text("transaction_number").notNull().unique(),
  shiftId: text("shift_id")
    .notNull()
    .references(() => shifts.id),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  totalAmount: integer("total_amount").notNull(),
  paymentMethod: text("payment_method").notNull(), // tunai, debit, qris
  cashReceived: integer("cash_received"),
  changeAmount: integer("change_amount"),
  transactionTime: text("transaction_time")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  /** Diisi bila transaksi dibatalkan kasir: stok dikembalikan, tidak dihitung di laporan. */
  voidedAt: text("voided_at"),
  voidedBy: text("voided_by").references(() => users.id),
  voidReason: text("void_reason"),
}, (t) => [
  index("transactions_time_idx").on(t.transactionTime),
  index("transactions_shift_idx").on(t.shiftId),
  index("transactions_user_idx").on(t.userId),
]);

export const transactionItems = sqliteTable("transaction_items", {
  id: text("id").primaryKey(),
  transactionId: text("transaction_id")
    .notNull()
    .references(() => transactions.id),
  productId: text("product_id")
    .notNull()
    .references(() => products.id),
  quantity: integer("quantity").notNull(),
  price: integer("price").notNull(),
  /** Potongan promo untuk baris ini (rupiah). subtotal = price * quantity - discount. */
  discount: integer("discount").notNull().default(0),
  /** Promo yang dipakai (bila ada). Disimpan sebagai teks agar riwayat tetap utuh walau promo dihapus. */
  promotionId: text("promotion_id"),
  promotionName: text("promotion_name"),
  subtotal: integer("subtotal").notNull(),
}, (t) => [
  index("transaction_items_trx_idx").on(t.transactionId),
  index("transaction_items_product_idx").on(t.productId),
]);

export const stockMovements = sqliteTable("stock_movements", {
  id: text("id").primaryKey(),
  productId: text("product_id")
    .notNull()
    .references(() => products.id),
  type: text("type").notNull(), // penjualan, pembatalan, penerimaan, penyesuaian, retur
  qtyChange: integer("qty_change").notNull(),
  referenceId: text("reference_id"), // ID transaksi / PO
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
}, (t) => [
  index("stock_movements_product_time_idx").on(t.productId, t.createdAt),
  index("stock_movements_type_time_idx").on(t.type, t.createdAt),
]);

export const purchaseOrders = sqliteTable("purchase_orders", {
  id: text("id").primaryKey(),
  poNumber: text("po_number").notNull().unique(),
  supplierName: text("supplier_name").notNull(),
  orderDate: text("order_date").notNull(),
  status: text("status").notNull(), // dipesan, diterima, dibatalkan
  createdBy: text("created_by")
    .notNull()
    .references(() => users.id),
  receivedAt: text("received_at"),
  notes: text("notes"),
});

export const purchaseOrderItems = sqliteTable("purchase_order_items", {
  id: text("id").primaryKey(),
  purchaseOrderId: text("purchase_order_id")
    .notNull()
    .references(() => purchaseOrders.id),
  productId: text("product_id")
    .notNull()
    .references(() => products.id),
  quantity: integer("quantity").notNull(),
  receivedQty: integer("received_qty").notNull().default(0),
});

export const pendingCarts = sqliteTable("pending_carts", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  customerName: text("customer_name"),
  totalAmount: integer("total_amount").notNull(),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export const pendingCartItems = sqliteTable("pending_cart_items", {
  id: text("id").primaryKey(),
  pendingCartId: text("pending_cart_id")
    .notNull()
    .references(() => pendingCarts.id, { onDelete: "cascade" }),
  productId: text("product_id")
    .notNull()
    .references(() => products.id),
  quantity: integer("quantity").notNull(),
  price: integer("price").notNull(),
  subtotal: integer("subtotal").notNull(),
});

export const returns = sqliteTable("returns", {
  id: text("id").primaryKey(),
  returnNumber: text("return_number").notNull().unique(),
  transactionId: text("transaction_id")
    .references(() => transactions.id),
  productId: text("product_id")
    .notNull()
    .references(() => products.id),
  quantity: integer("quantity").notNull(),
  reason: text("reason").notNull(),
  status: text("status").notNull().default("pending"), // pending, disetujui, ditolak
  processedBy: text("processed_by")
    .references(() => users.id),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  processedAt: text("processed_at"),
});

export const purchaseReturns = sqliteTable("purchase_returns", {
  id: text("id").primaryKey(),
  returnNumber: text("return_number").notNull().unique(),
  supplierName: text("supplier_name").notNull(),
  productId: text("product_id")
    .notNull()
    .references(() => products.id),
  quantity: integer("quantity").notNull(),
  reason: text("reason").notNull(),
  status: text("status").notNull().default("pending"), // pending, disetujui, ditolak
  processedBy: text("processed_by")
    .references(() => users.id),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  processedAt: text("processed_at"),
});

/**
 * Promo yang berlaku otomatis di kasir selama periode tanggalnya (WIB, inklusif).
 * type:
 *   persen      → value = persen diskon (1–100)
 *   nominal     → value = potongan rupiah per item
 *   grosir      → value = harga per item bila qty >= min_qty
 *   beli_gratis → beli min_qty item, gratis value item (barang yang sama)
 */
export const promotions = sqliteTable("promotions", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull(), // persen, nominal, grosir, beli_gratis
  targetType: text("target_type").notNull(), // produk, kategori
  productId: text("product_id").references(() => products.id),
  categoryId: text("category_id").references(() => categories.id),
  value: integer("value").notNull(),
  minQty: integer("min_qty").notNull().default(1),
  startDate: text("start_date").notNull(), // YYYY-MM-DD (WIB)
  endDate: text("end_date").notNull(), // YYYY-MM-DD (WIB), inklusif
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdBy: text("created_by").references(() => users.id),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
}, (t) => [
  index("promotions_period_idx").on(t.isActive, t.startDate, t.endDate),
  index("promotions_product_idx").on(t.productId),
  index("promotions_category_idx").on(t.categoryId),
]);
