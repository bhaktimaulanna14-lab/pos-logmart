# Logmart POS

Aplikasi Point of Sale (POS) berbasis Next.js 16 dengan App Router, Drizzle ORM, dan SQLite (`better-sqlite3`).

---

## Stack Teknologi

| Layer | Teknologi |
|---|---|
| Framework | Next.js 16 (App Router) |
| UI | Tailwind CSS + shadcn/ui (Radix) |
| Database | SQLite via `better-sqlite3` |
| ORM | Drizzle ORM |
| Ekspor | PDFKit (label harga), ExcelJS (laporan) |

---

## Cara Menjalankan

### 1. Install dependencies

```bash
npm install
```

### 2. Persiapkan database (skema + migrasi)

Skema berada di `src/db/schema.ts`. Tabel dibuat otomatis saat app pertama kali jalan via Drizzle push, **atau** gunakan migrasi manual:

```bash
# Opsi A: push skema langsung ke sqlite.db (dev only)
npx drizzle-kit push

# Opsi B: generate + apply migrasi
npx drizzle-kit generate
npx drizzle-kit migrate
```

> **Catatan:** Bila `drizzle-kit push` gagal karena indeks sudah ada, jalankan seed saja — tabel sudah dibuat saat instalasi pertama.

### 3. Isi master data awal (seed)

```bash
npm run db:seed
```

Skrip seed berada di `scripts/seed.js`. Skrip ini harus dijalankan secara manual (tidak berjalan otomatis saat deploy) untuk memastikan ada user admin dan kategori dasar di database.

**Data yang disediakan seed (Versi Produksi Bersih):**

| Entitas | Jumlah | Keterangan |
|---|---|---|
| Users | 3 | 1 admin (`manajer`) + 2 kasir |
| Categories | 5 | Sembako, Minuman, Snack, Kebersihan, Rokok |

**Credential login:**

| Role | Username | Password |
|---|---|---|
| Admin / Manajer | `admin` | `admin123` |
| Kasir | `kasir1` | `kasir123` |

### 4. Jalankan development server

```bash
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000) di browser.

---

## Urutan Setup Lengkap (Fresh Install)

```bash
# 1. Install
npm install

# 2. Push skema ke database (buat tabel)
npx drizzle-kit push

# 3. Isi master data awal
npm run db:seed

# 4. Jalankan dev server
npm run dev
```

---

## Perintah Tersedia

| Perintah | Fungsi |
|---|---|
| `npm run dev` | Development server (webpack mode) |
| `npm run build` | Build produksi |
| `npm run start` | Jalankan hasil build |
| `npm run lint` | ESLint |
| `npm run db:seed` | Hapus & isi ulang master data awal (admin & kategori) |

---

## Struktur Direktori Utama

```
src/
  app/              # Next.js App Router — halaman & API routes
    api/            # Route Handlers (/api/*)
    (halaman)/      # Page components
  components/       # Komponen reusable (UI, layout)
  db/
    index.ts        # Koneksi Drizzle + better-sqlite3
    schema.ts       # Definisi skema tabel (JANGAN diubah sembarangan)
scripts/
  seed.js           # Skrip seed data demo (node, CommonJS)
sqlite.db           # File database SQLite (auto-created)
```

---

## Halaman Aplikasi

| Route | Deskripsi |
|---|---|
| `/login` | Halaman login |
| `/` | Dashboard (ringkasan, stok menipis, tren penjualan) |
| `/pos` | Kasir — transaksi penjualan |
| `/products` | Manajemen produk & kategori |
| `/purchase-orders` | Daftar PO yang sedang diproses |
| `/purchase-orders/history` | Riwayat PO yang sudah diterima |
| `/reports` | Laporan penjualan & pergerakan stok |
| `/returns` | Retur barang |
| `/transactions` | Riwayat transaksi |
| `/users` | Manajemen pengguna (admin only) |
