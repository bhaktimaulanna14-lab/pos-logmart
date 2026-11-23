# Backlog Masalah — Logmart POS

Daftar masalah dan fitur yang belum jalan, untuk dikerjakan Claude Code (atau developer) di sesi berikutnya.
Dibuat: 2026-11-22. Centang `[x]` setelah item selesai **dan sudah diverifikasi** di aplikasi.

**Prioritas:** P1 = segera (fitur rusak / data salah / keamanan), P2 = penting, P3 = perapian.

## Catatan untuk agen (baca dulu)
- Baca `AGENTS.md`. Project ini memakai **Next.js 16**, yang punya breaking changes, jadi cek docs di `node_modules/next/dist/docs/` sebelum menulis kode.
- Perubahan skema harus lewat Drizzle: edit `src/db/schema.ts`, lalu jalankan `npx drizzle-kit generate`. Migrasi disimpan di `src/db/migrations`. Jangan mengedit `sqlite.db` secara manual.
- Kerjakan **satu item per sesi**, ikuti pola kode yang sudah ada, lalu centang di file ini.
- Verifikasi: `npm run dev`, lalu login sebagai `admin` (manajer) dan `kasir1` (kasir). Kredensial ada di README.
- **Uji dengan data produksi (lokal):** `sqlite-prod.db` adalah salinan database produksi, dan `sqlite-prod.original.db` cadangan bersihnya (salin ulang untuk reset). Keduanya sudah di-`.gitignore`. Jalankan app dengan env `DATABASE=sqlite-prod.db`, lalu tambahkan akun uji lokal lewat `node scripts/seed-test-users.js sqlite-prod.db` (`uji-manajer` / `uji-kasir`, password ada di file skrip). **Jangan pernah menguji alur yang menulis data di situs produksi.**
- Helper yang tersedia: `getSession()` di `src/lib/session.ts`, `hashPassword` / `verifyPassword` di `src/lib/auth-helper.ts`, helper Excel di `src/lib/excel-helper.ts`, dan komponen UI di `src/components/ui/*` (shadcn).
- **Helper API (baru):** `src/lib/api-auth.ts` berisi `requireSession(role?)` (wajib di setiap route yang menulis data), `toInt(value, min)`, dan `ApiError` + `errorResponse()` untuk pesan error 4xx yang jelas. Transaksi DB memakai API **sinkron** better-sqlite3: `db.transaction((tx) => { tx.insert(...).values(...).run(); })`, tanpa async/await di dalamnya.
- **Jalankan server uji:** `node scripts/dev-prod-copy.js` (atau konfigurasi `logmart-prod-copy` di `.claude/launch.json`).

## Progres pengerjaan
- **Gelombang 1 — data & uang (selesai, 22 Nov 2026):** F1, B1, B2, B3, B12, B13, B15, B18. Diverifikasi di salinan lokal: 49/49 skenario uji lulus, tidak ada transaksi tanpa item, transaksi tercatat atas nama dan shift kasir yang benar, log server bersih.
  - Keputusan user: checkout **hanya untuk kasir**. Manajer melihat menu Kasir dalam keadaan terkunci.
  - B4 sebagian: semua route yang disentuh sudah memakai `requireSession`; sisanya menyusul.
  - B19 (perbaikan data lama di produksi) belum: kode baru mencegah data salah bertambah, tapi data yang sudah salah perlu skrip terpisah.
- **Gelombang 2 — fitur yang dilaporkan user (selesai, 22 Nov 2026):** F7, B16, F4. API Pengguna 24/24 skenario lulus; tampilan diuji di browser lokal.
  - F7: cetak lewat iframe khusus struk (`src/lib/print-receipt.ts`, `RECEIPT_WIDTH_MM = 58`). Isi cetak terverifikasi (ukuran 58 mm, barang, kasir, total). **Belum diuji ke printer thermal fisik** — cek di toko setelah deploy.
  - Bug tambahan diperbaiki: struk dari **Riwayat Transaksi** tidak pernah termuat (`transactionId` membaca field yang salah di `src/app/transactions/page.tsx`).
  - B16: Tambah/Edit/Reset password/Nonaktifkan di menu Pengguna; "Ganti Password" untuk semua user di Sidebar; akun nonaktif tidak bisa login dan sesinya langsung ditolak (`requireSession` mengecek status & peran terbaru di DB).
  - F4: komponen `src/components/ProductSearch.tsx` (`ProductSearch` untuk Buat PO, `ProductPicker` untuk form Retur). Lookup barang kini menyembunyikan barang nonaktif.
- **Gelombang 3 — laporan & kecepatan (selesai, 22 Nov 2026):** F3, F5, B14, F6, B11 + index DB & PRAGMA. 28/28 skenario lulus; angka laporan dicocokkan dengan hitungan SQL langsung untuk semua periode. `npm run build` sukses.
  - Helper periode WIB: `src/lib/report-period.ts` (`resolvePeriod`: `period=hariIni|7hari|bulanIni|tahunIni` atau `startDate/endDate`). Dipakai semua API laporan, Excel, dashboard, dan filter tanggal Riwayat Transaksi.
  - Dashboard "hari ini/bulan ini" & tren bulanan kini memakai kalender **WIB** (sebelumnya UTC, sehingga penjualan 00.00–07.00 WIB masuk ke hari sebelumnya).
  - Absensi: `src/lib/attendance.ts`, shift yang masih buka dihitung sampai sekarang dan ditandai "sedang berjalan".
  - Halaman Barang: 50 barang/halaman, hanya satu tata letak dirender. Jumlah elemen halaman turun dari ±131.700 menjadi ±1.500. Pilihan cetak label tetap tersimpan lintas halaman.
  - Riwayat Transaksi: filter tanggal (default hari ini) & kasir dikerjakan di server, 50/halaman. Tombol "Tgl: Hari Ini" yang dulu hanya hiasan kini berfungsi.
  - Index baru di `src/db/schema.ts` + migrasi `src/db/migrations/0002_add_indexes.sql` (berisi juga tabel `purchase_returns` yang sebelumnya terlewat di file migrasi). **Saat deploy jalankan `npx drizzle-kit push`** (sesuai DEPLOY.md) agar index terpasang.
  - `src/db/index.ts`: `journal_mode=WAL`, `synchronous=NORMAL`, `busy_timeout=5000`. **Catatan backup:** dengan WAL, database terdiri dari `sqlite.db` + `sqlite.db-wal` + `sqlite.db-shm`. Untuk salinan yang konsisten gunakan `sqlite3 sqlite.db ".backup backup.db"` (atau hentikan app dulu), jangan hanya `cp sqlite.db`.
  - Minor (belum): filter kategori di halaman Barang menampilkan teks `all` bawaan komponen Select — kosmetik.
- **Gelombang 4 — perapian, data, promo (selesai di lokal, 22 Nov 2026):** F2, B4, B5, B9, B10, B17 selesai; B6, B8, B19 siap tapi menunggu langkah lain (lihat di bawah). Promo & impor 22/22 skenario lulus; regresi gelombang 1–3 tetap 49/49, 24/24, 28/28; `tsc` 0 error; `npm run build` sukses.
  - **F2 Promo** (keputusan user: 4 jenis — diskon persen, potongan nominal, harga grosir, beli X gratis Y; target barang atau kategori; otomatis selama periode tanggal WIB):
    - Tabel `promotions` + kolom `discount`, `promotion_id`, `promotion_name` di `transaction_items` (`subtotal = price × qty − discount`).
    - Mesin harga `src/lib/promotions.ts` (`priceCart`) dipakai checkout **dan** pratinjau keranjang (`POST /api/checkout/preview`); bila beberapa promo cocok dipakai potongan **terbesar** (tidak ditumpuk). Harga & diskon selalu dihitung di server.
    - Halaman `/promotions` (menu "Promo", khusus manajer): buat/edit/aktif-nonaktif/hapus (hapus hanya bila belum pernah dipakai), statistik pemakaian & total potongan, contoh hitungan saat membuat promo.
    - Kasir: harga coret + label promo per barang, baris "Diskon promo", tombol Bayar menunggu harga final. Struk (layar & cetak 58 mm) menampilkan potongan per barang dan "Hemat promo". Laporan memakai nilai setelah diskon.
  - **B17 Impor:** pratinjau & simpan memakai aturan yang sama (`validateImportRows` di `src/lib/import-validator.ts`, termasuk cek barcode ke DB); file dengan baris tidak valid ditolak seluruhnya — tidak ada lagi PO kosong. Retur hasil impor kini **pending** (stok berubah saat disetujui), retur penjualan ditautkan ke nomor TRX di kolom Referensi.
  - **B5:** `src/middleware.ts` → `src/proxy.ts` (export `proxy`), menu & API `/promotions` ditambahkan ke rute manajer.
  - **B4:** semua route API kini mengecek sesi/peran sendiri lewat `requireSession` (kecuali login/logout/me).
  - **B9/B10:** file sisa dihapus atas persetujuan user (`deploy-logmart.zip`, `run.sh`, `check_users.js`, `test_hash.js`, `seed.ts`, `auto_sum.js`, `auto_complete.js`, `all_tasks.json`); `*.zip` di-`.gitignore`.
  - **⚠️ Temuan deploy:** `npx drizzle-kit push` pada database produksi akan menjalankan `delete from transaction_items` (semua rincian transaksi hilang) bila dikonfirmasi. Untuk produksi pakai **`node scripts/migrate-2026-11.js sqlite.db`** (hanya menambah, idempoten; diuji di salinan produksi — 3.398 transaksi & 6.688 rincian utuh, skema identik). `DEPLOY.md` sudah diperbarui.
  - **B19:** `scripts/fix-production-data.js` (pratinjau default, `--apply` untuk menerapkan) — diuji di salinan: 1.744 transaksi pindah dari Budi ke Siti, total tetap 3.398 / Rp 62.063.900, aman dijalankan ulang. Keputusan user: pemilik shift = kasir yang melayani. **Belum dijalankan di produksi** (dilakukan saat deploy).
  - **B8:** langkah keamanan ditulis di `DEPLOY.md` (JWT_SECRET acak, ganti password bawaan lewat fitur B16). **Belum dilakukan di VPS.**
  - **B6 sebagian:** `@ts-nocheck` dihapus dari ±20 file yang disentuh dan semua error tipenya diperbaiki (`tsc` 0 error). Sisa: 30 file lain masih memakai pragma, dan ESLint melaporkan pola `react-hooks/set-state-in-effect` (setState di dalam useEffect untuk fetch data) di hampir semua halaman — perlu refactor pola pengambilan data, dikerjakan terpisah.
- **Fitur tambahan (23 Nov 2026): Unduh Stok (Excel)** di Manajemen Barang → `GET /api/products/excel` (khusus manajer; ikut filter cari & kategori). Kolom: barcode, nama, kategori, harga modal, harga jual, stok, stok minimum, status stok (Aman/Menipis/Habis/Minus), nilai stok (modal × stok, stok minus dihitung 0), status barang, plus baris TOTAL. Diuji: 2.158 barang & nilai stok Rp 73.415.551 cocok dengan DB, filter kategori/cari cocok, kasir 403. Header & tombol halaman Manajemen Barang kini tidak melebar di layar HP.
- **DEPLOY PRODUKSI (23 Nov 2026, ±13.15 WIB) — selesai:** VPS `/var/www/pos-logmart` dari `6a84c8b` → `c47b62f`.
  - Uji dulu di salinan DB terbaru dari VPS: migrasi aman (3.445 transaksi / 6.781 rincian / Rp 62.952.400 tetap sama), regresi 49/49, 24/24, 28/28, 21/22 (1 = bug skrip uji, bukan app).
  - Di VPS: `pm2 stop` → backup `/root/db-backup/sqlite.db.2026-11-23-0615` (integrity ok) → `git pull` + `npm install` → `scripts/migrate-2026-11.js` → `scripts/fix-production-data.js --apply` (**B19**: 1.780 transaksi dipindah dari Budi ke Siti, sisa 0) → `npm run build` → app jalan lagi via `pm2 startOrRestart ecosystem.config.js --update-env` + `pm2 save`.
  - **B8:** `JWT_SECRET` produksi ternyata masih placeholder publik → diganti secret acak 96 karakter di `ecosystem.config.js` VPS (tidak di-commit; backup file lama di `/root/db-backup/ecosystem.config.js.bak`). Semua user harus login ulang sekali.
  - Smoke test: `/login` 200 (lokal & `https://logmarttrowono.web.id`), API tanpa login 401, DB mode WAL, port 3000 tertutup dari luar. File sisa `sqlite-copy.db` di VPS dihapus.
  - Catatan VPS: app & file dimiliki root (PM2 jalan sebagai root), `package-lock.json` di VPS berubah lokal (biarkan; tidak bentrok selama upstream tidak mengubahnya). Log error berisi ratusan "Server Reference ID ... Received "x"" dari bot pemindai sebelum deploy — app tidak memakai server actions, abaikan.
  - **Rollback** (bila perlu): `sudo pm2 stop logmart-pos` → `sudo git checkout 6a84c8b` → salin backup ke `sqlite.db` (hapus `sqlite.db-wal`/`-shm`) → `sudo npm run build` → `sudo pm2 restart logmart-pos`.
- **Sisa pekerjaan:** ganti password bawaan (`admin123`/`kasir123`) lewat menu Ganti Password & Pengguna, uji cetak struk di printer thermal 58 mm toko, stok opname 63 barang stok minus, temuan review no. 2–14, lalu B6 lanjutan.

## Catatan rebrand tampilan (commit `2f8bd10`, 22 Nov 2026)
Frontend sudah dirombak secara **visual**: warna brand hijau `#8DC63F→#009245` dan oranye `#F7931E→#F15A24` sebagai token di `src/app/globals.css` (`--brand-*`, utilitas `bg-brand-gradient`, `bg-brand-orange-gradient`, `bg-brand-stripe`, `text-brand-gradient`), komponen logo `src/components/brand/Logo.tsx`, favicon `src/app/icon.svg`, Sidebar dan halaman login baru, serta font Montserrat (`font-brand`).
- **Tidak ada logika yang berubah**, jadi semua item di bawah (kecuali B7) masih berlaku.
- Saat memperbaiki halaman, **pakai token dan utilitas brand ini**, bukan warna Tailwind biru/indigo bawaan.

## Hasil cek situs produksi (22 Nov 2026, baca saja)
Situs: https://logmarttrowono.web.id, login sebagai manajer. Datanya: 2.157 barang (304 di bawah stok minimum), sekitar 1.327 transaksi bulan ini, 3 user.

| Menu | Hasil |
|---|---|
| Beranda | OK. Penjualan hari ini/bulan ini dan stok menipis tampil. |
| Kasir (POS) | Akun admin: "Shift Tutup". Kasir Budi punya shift `buka` sejak 06.00 WIB (lihat B1). |
| Manajemen Barang | `/api/products` 133 ms / 539 KB, tetapi halaman merender **±131.700 elemen DOM** (lihat F6). |
| Terima PO / Riwayat | Kosong (belum ada PO), tanpa error. |
| Laporan Penjualan | Semua Rp 0 dan data dummy. **`/api/reports/sales` dan `/api/reports/top-products` = HTTP 500** (lihat F3). |
| Rekap Absensi | Label "7 Hari Terakhir", tetapi yang tampil 44–46 shift per kasir dari seluruh periode (lihat F5). |
| Riwayat Transaksi | Berfungsi, tetapi `/api/transactions` mengirim 764 KB berisi semua transaksi (lihat B11). |
| Retur, Impor Data, Pengguna | Terbuka normal. |
| Pending carts | `GET` OK (kosong). POST tidak dicoba karena akan menulis data produksi. |

## Hasil uji semua fungsi di salinan lokal (22 Nov 2026)
Diuji di `localhost:3000` memakai `sqlite-prod.db` (salinan produksi: 2.174 barang, 3.398 transaksi, 91 shift), lewat tampilan dan API.

| Fitur | Hasil | Item |
|---|---|---|
| Login / logout | OK | — |
| Buka / tutup shift | OK. Manajer ditolak membuka shift (hanya kasir) | — |
| Cari barang (barcode & nama) di POS | OK | — |
| **Simpan pending** | **GAGAL** — `FOREIGN KEY constraint failed` | F1 |
| Checkout tunai, tampilan struk | Jalan, tapi struk menulis **"Kasir: Budi Santoso"** untuk kasir lain | B1 |
| **Cetak struk (ke printer)** | **GAGAL — hasil cetak kosong** (dilaporkan user) | F7 |
| **Checkout dengan harga palsu / qty > stok** | **Diterima** — total Rp 1 tersimpan, stok jadi −9.999 | B1 |
| Barang: tambah / ubah / nonaktif / label PDF | OK, tapi tanpa validasi angka; ubah stok tidak tercatat | B13, B15, B18 |
| Kategori: tambah / ubah / hapus | OK. Hapus kategori yang dipakai ditolak (benar), tapi pesan error menyesatkan | B15 |
| Impor kategori / barang | OK, satu baris salah membatalkan seluruh file | B17 |
| Impor PO / retur | Ada data setengah jadi | B17 |
| Buat PO / batal PO / riwayat / Excel | OK | — |
| **Terima PO** | **Salah** — semua item ikut "diterima", PO bisa diterima berulang | B2 |
| Retur pelanggan: ajukan / setujui | OK, tapi tanpa cek stok dan referensi transaksi | B13 |
| **Retur ke supplier (form di UI)** | **GAGAL** 500, data retur tersimpan setengah | B12 |
| **Pengguna (Staf)** | **Tombol Tambah/Edit/Hapus di halaman tidak berfungsi**; API tidak bisa mengubah nama, username, password, atau role; validasi lemah | B16 |
| Akses kasir ke menu manajer | Kasir bisa buka Barang/Retur/Impor, buat kategori, nonaktifkan barang | B3 |
| Laporan penjualan & terlaris (JSON) | **500** (versi Excel jalan) | F3 |
| Laporan shift, pergerakan stok, absensi, semua Excel | OK | F5 |
| Dashboard | Jika hari ini belum ada penjualan, tampil angka **palsu** | B14 |

**Temuan pada data produksi asli** (dari `sqlite-prod.original.db`, tanpa diubah):
- **Semua 3.398 transaksi tercatat atas nama Budi (`user-kasir-1`)**, padahal 1.744 di antaranya terjadi di shift Siti (lihat B1, B19).
- **61 barang memiliki stok minus** (lihat B13, B19).

---

## A. Fitur yang belum jalan (laporan user)

### - [x] F1. Pending transaksi di menu Kasir tidak bisa dipakai — P1
- **File:** `src/app/api/pending-carts/route.ts`, `src/app/api/pending-carts/[id]/route.ts`, `src/app/pos/page.tsx` (handler pending sekitar baris 205–280)
- **Akar masalah (TERKONFIRMASI di uji lokal):** POS tidak mengirim `userId`, sehingga `POST /api/pending-carts` memakai default `userId = "user-1"`. ID itu tidak ada di tabel `users`. Foreign key aktif (`PRAGMA foreign_keys = 1`), jadi insert `pending_carts` gagal dengan `SqliteError: FOREIGN KEY constraint failed` di `route.ts:27`, dan kasir melihat pesan "Gagal menyimpan keranjang pending".
- **Perbaikan:**
  - Ambil `userId` dari `getSession()`, jangan dari body.
  - Validasi item, lalu bungkus insert header dan item dalam `db.transaction`.
  - `GET` sebaiknya hanya menampilkan pending milik kasir atau shift yang sedang aktif.
  - Saat restore, keranjang langsung dihapus dari DB, sehingga data hilang kalau kasir batal checkout. Pertimbangkan menghapusnya setelah checkout sukses.
- **Selesai bila:** kasir bisa menahan keranjang, melihat daftar keranjang tertahan, memulihkannya, lalu checkout dengan normal.

### - [x] F2. Fitur Promo belum ada — P2 (fitur baru)
- **Kondisi:** belum ada tabel, API, maupun UI promo.
- **Usulan desain** (konfirmasi aturan promo ke user sebelum implementasi):
  - Tabel `promotions`: nama, tipe (diskon %, diskon nominal, harga spesial, beli X gratis Y), target produk atau kategori, tanggal mulai–selesai, dan status aktif. Buat juga migrasi Drizzle-nya.
  - API CRUD `/api/promotions`, khusus manajer. Tambahkan ke daftar route manajer di middleware/proxy.
  - Halaman `/promotions` dan menu baru di `src/components/layout/Sidebar.tsx`.
  - POS menerapkan promo aktif secara otomatis di keranjang dan struk (`src/components/ReceiptModal.tsx`).
  - Simpan diskon per item, misalnya kolom `discount` di `transaction_items`. **Total harus dihitung ulang di server**, jangan percaya angka dari client.
  - Laporan penjualan ikut memperhitungkan diskon.
- **Selesai bila:** manajer bisa membuat promo berperiode, dan promo itu otomatis berlaku di kasir serta tercatat di transaksi.

### - [x] F3. Menu Laporan Penjualan belum tersinkron dengan data — P1
- **File:** `src/app/reports/page.tsx`
- **Kondisi:** halaman ini masih **mock**. Yang palsu atau hardcoded:
  - Chart berisi array bernilai nol, dan total pendapatan, total transaksi, serta rata-rata = 0.
  - Persentase "+12.5% / +5% dari periode lalu".
  - Daftar fast/slow-moving (Indomie, Telur, dll.).
  - Kartu "Shift Pagi/Malam" yang statis.
  - Tombol unduh yang hanya menjalankan `alert("... (Simulasi)")`.
- **Akar masalah terkonfirmasi (API error 500 di produksi):**
  - `src/app/api/reports/sales/route.ts` dan `src/app/api/reports/top-products/route.ts` memakai kolom yang **tidak ada di skema**: `transactions.createdAt` (seharusnya `transactions.transactionTime`) dan `transactionItems.priceAtTransaction` (seharusnya `transactionItems.price`). Kesalahan ini tidak tertangkap karena file memakai `@ts-nocheck`.
  - Kedua API hanya menerima `period=7hari|bulanIni`. Tambahkan dukungan Hari Ini, Tahun Ini, dan `startDate`/`endDate` kustom.
  - `top-products` mengambil **semua** item transaksi lalu memfilternya di JavaScript. Ganti dengan join + `WHERE transaction_time BETWEEN` + `GROUP BY product_id`.
  - Agregasi per hari harus memakai zona waktu WIB (UTC+7), bukan potongan string ISO UTC.
  - Cek juga apakah route `/excel` terkait memakai kolom yang sama.
- **API yang sudah tersedia:** `/api/reports/sales`, `/api/reports/top-products`, `/api/reports/shifts`, `/api/reports/stock-movements`, masing-masing dengan versi `/excel`. Halaman `src/app/reports/shifts/page.tsx` dan `src/app/reports/stock-movements/page.tsx` bisa dijadikan contoh pemakaian.
- **Perbaikan:** sambungkan semua kartu, chart, dan daftar ke API sesuai filter periode (Hari Ini / 7 Hari Terakhir / Bulan Ini / Tahun Ini / Kustom). Arahkan tombol unduh ke endpoint excel dengan parameter periode, dan hapus semua data dummy. Sesuaikan respons API bila belum cocok untuk chart, misalnya agregasi per hari atau per minggu.
- **Selesai bila:** angka di halaman laporan sama dengan data transaksi di `/transactions` untuk periode yang sama, dan file Excel bisa diunduh.

### - [x] F4. Buat PO Baru: rombak pilih barang menjadi ketik nama atau barcode — P1 (diminta user)
- **File:** `src/app/purchase-orders/page.tsx` (fetch semua produk di sekitar baris 72, `<Select>` produk di sekitar baris 371)
- **Kondisi:** halaman memuat **semua** produk lalu menampilkannya di dropdown `<Select>` biasa, tanpa pencarian. Cara ini lambat dan sulit dipakai bila produknya banyak.
- **Perbaikan:**
  - Ganti dengan input pencarian (combobox, debounce sekitar 300 ms) yang memanggil `/api/products/lookup?q=`, endpoint yang juga dipakai POS (lihat `lookupProduct` di `src/app/pos/page.tsx`).
  - Jika barcode cocok persis (hasil scan atau Enter), produk langsung ditambahkan ke item PO. Ketik nama untuk menampilkan daftar hasil yang bisa dipilih.
  - Setelah produk ditambahkan, input dikosongkan dan fokus kembali ke input agar bisa langsung scan berikutnya.
  - Daftar hasil bisa dinavigasi dengan keyboard (↑/↓ lalu Enter) dan menampilkan nama, barcode, serta stok saat ini.
  - Qty bisa diubah langsung di tabel item PO, dan item bisa dihapus. Barang yang sama ditambahkan dua kali cukup menambah qty.
  - Hapus `<Select>` dropdown dan fetch semua produk; data diambil per pencarian saja.
  - **Bonus:** pakai komponen pencarian yang sama untuk form Retur (`src/app/returns/page.tsx`), yang juga memuat semua produk (`fetch('/api/products')` sekitar baris 122).
- **Selesai bila:** saat membuat PO, user bisa menambah barang dengan scan barcode atau mengetik sebagian nama barang.

### - [x] F5. Fitur Absensi belum bisa — P2
- **File:** `src/app/api/reports/attendance/route.ts`, `src/app/api/reports/attendance/excel/route.ts`, bagian "Rekap Absensi Kasir" di `src/app/reports/page.tsx`
- **Kondisi:**
  - Absensi tidak punya tabel sendiri. Rekapnya hanya dihitung dari shift **berstatus `tutup`** milik user ber-role `kasir`, sehingga shift yang belum ditutup dan staf manajer tidak tercatat.
  - Filter "Hari Ini / 7 Hari / Bulan Ini / Tahun Ini" tidak dikirim ke API. Hanya rentang Kustom yang dikirim, jadi preset selalu menampilkan seluruh data. **Terkonfirmasi di produksi:** label "7 Hari Terakhir" menampilkan Budi 44 shift dan Siti 46 shift, yaitu data seluruh periode.
  - Halaman laporan masih mock (lihat F3).
- **Perlu klarifikasi user:**
  - (a) Cukup diturunkan dari buka/tutup shift: perbaiki filter periode dan tampilkan shift yang masih berjalan. **atau**
  - (b) Absensi terpisah (jam masuk/pulang): tabel baru `attendances` (userId, clockIn, clockOut, catatan), tombol absen masuk/pulang untuk staf, dan halaman rekap sendiri.
- **Selesai bila:** rekap kehadiran tampil benar sesuai periode yang dipilih dan bisa diekspor ke Excel.

### - [x] F7. Cetak struk menghasilkan halaman kosong — P1 (dilaporkan user)
- **Printer toko:** thermal **58 mm**.
- **File:** `src/components/ReceiptModal.tsx` (dipakai di `src/app/pos/page.tsx` dan `src/app/transactions/page.tsx`), `src/app/globals.css`, `src/components/ui/dialog.tsx`
- **Akar masalah (dari penelusuran kode):**
  - Tombol "Cetak Struk" hanya memanggil `window.print()`, yang mencetak **seluruh halaman aplikasi**, bukan hanya struk.
  - Tidak ada aturan `@media print` di `globals.css` untuk menyembunyikan aplikasi dan menampilkan struk saja.
  - Struk berada di dialog Base UI yang di-render lewat portal dengan `position: fixed`, `top/left 50%`, `translate -50%`, animasi fade/zoom, dan overlay blur. Layout aplikasi memakai `h-screen overflow-hidden` (`src/components/layout/Sidebar.tsx`). Akibatnya isi struk terpotong atau tidak tercetak, sehingga kertas keluar kosong.
  - Kelas `print:w-[80mm]` mengasumsikan kertas 80 mm, padahal printer toko 58 mm, dan tidak ada `@page` untuk ukuran kertas.
  - `transaction.cashier || "Budi"` adalah fallback nama kasir yang di-hardcode (terkait B1).
- **Perbaikan:**
  - Cetak lewat **iframe tersembunyi** (atau jendela baru) yang berisi HTML struk saja, bukan `window.print()` pada halaman aplikasi.
  - CSS cetak di dalam iframe: `@page { size: 58mm auto; margin: 0 }`, lebar konten ±48 mm (area cetak efektif kertas 58 mm), font monospace 9–10 pt, hitam putih tanpa bayangan atau border dekoratif, dan teks panjang (nama barang) dibungkus.
  - Panggil `iframe.contentWindow.print()` setelah konten selesai dimuat, lalu hapus iframe.
  - Simpan lebar kertas sebagai konstanta atau pengaturan (default 58 mm) agar mudah diganti.
  - Hapus fallback `"Budi"` dan pakai nama kasir dari data transaksi.
- **Selesai bila:** pratinjau cetak Chrome menampilkan struk lengkap selebar 58 mm dari menu Kasir maupun Riwayat Transaksi, dan hasil cetak di printer thermal toko terbaca rapi tanpa halaman kosong tambahan.

### - [x] F6. Manajemen Barang lambat saat menampilkan semua barang — P1
- **File:** `src/app/api/products/route.ts` (GET tanpa limit/pagination), `src/app/products/page.tsx` (seluruh list dirender sekaligus, dua kali untuk tampilan desktop dan mobile, di sekitar baris 543 dan 624), `src/db/index.ts`
- **Diagnosis dari produksi:** penyebab utamanya **bukan SQLite**. `/api/products` selesai dalam 133 ms (539 KB untuk 2.157 barang). Yang lambat adalah browser, karena halaman merender **±131.700 elemen DOM** sekaligus. Urutan prioritas perbaikan: (1) pagination atau virtualisasi list di UI, (2) kirim data per halaman dari server, (3) index DB dan PRAGMA sebagai pelengkap.
- **Perbaikan:**
  - **Pagination di server:** parameter `page` dan `pageSize` (misalnya 50), respons menyertakan `total`. Di UI tambahkan kontrol halaman dan pencarian dengan debounce.
  - **Index DB** (via migrasi Drizzle): `products(name)`, `products(category_id)`, `products(is_active)`. Sekalian `transactions(transaction_time)`, `transactions(shift_id)`, `transaction_items(transaction_id)`, `stock_movements(product_id, created_at)` agar laporan juga cepat.
  - **Setting SQLite** di `src/db/index.ts`: `journal_mode = WAL`, `synchronous = NORMAL`.
  - **Stok menipis:** hitung lewat query atau endpoint terpisah (sudah ada `/api/dashboard/low-stock`), bukan dengan memfilter list di client.
  - Pilih barang untuk cetak label tetap berfungsi lintas halaman.
- **Selesai bila:** halaman Manajemen Barang tetap terbuka dengan cepat (di bawah ~1 detik) walau berisi ribuan produk.

---

### - [x] F8. Pembatalan transaksi oleh kasir — P1 (diminta user, 23 Nov 2026)
- Riwayat Transaksi → Detail → **Batalkan** (wajib alasan). `PATCH /api/transactions/[nomor]`.
- Hanya kasir yang melayani, selama shift transaksi itu masih buka (uang dikembalikan dari laci). Setelah shift ditutup pakai menu Retur. Ditolak bila sudah ada retur.
- Data tidak dihapus: kolom baru `transactions.voided_at/voided_by/void_reason`, stok dikembalikan dengan jejak `stock_movements.type = "pembatalan"`. Semua laporan, dashboard, ringkasan shift POS, dan retur mengabaikan transaksi batal.
- **Deploy:** jalankan lagi `node scripts/migrate-2026-11.js sqlite.db` (menambah 3 kolom, aman diulang).

### - [x] F9. Unduh PDF Purchase Order untuk supplier — P2 (diminta user, 23 Nov 2026)
- Tombol **Unduh PDF** di detail PO, dan tawaran unduh langsung setelah PO dibuat. `GET /api/purchase-orders/[id]/pdf` (manajer saja).
- Isi: kop toko, no. PO, tanggal, supplier, status, tabel barcode/nama/jumlah, catatan, kolom tanda tangan. Tanpa harga modal.

### - [x] F10. Sederhanakan kategori barang (118 → 23) — P2 (diminta user, 23 Nov 2026)
- Pemetaan nama lama → nama baru ada di `src/lib/category-map.json`. File ini juga dipakai impor Excel, jadi nama lama di Excel (mis. "SHAMPOO", "TISSU") masuk ke kategori baru dan tidak membuat kategori dobel lagi.
- Produk dan promo dipindah ke kategori baru. Kategori lama dan kategori kosong (PROMO ×3) dihapus.
- **Deploy:** backup DB, lalu `node scripts/simplify-categories.js sqlite.db` (pratinjau), lalu tambahkan `--apply`. Skrip idempoten dan berhenti bila ada kategori dengan produk yang belum terpetakan.

### - [x] F11. Tanggal kadaluarsa barang (batch + FIFO) — P2 (diminta user, 23 Nov 2026)
- Tabel `product_batches` menyimpan sebagian stok yang punya tanggal kadaluarsa. Stok tanpa tanggal = stok − total batch.
- Cara mencatat:
  - **Manajemen Barang:** ikon kalender → dialog Kadaluarsa (tanggal + jumlah, boleh beberapa baris, total ≤ stok).
  - **Terima PO:** kolom tanggal kadaluarsa per barang (opsional).
- **FIFO** (`src/lib/batches.ts` `consumeBatches`): setiap pengurangan stok memakai tanggal terdekat dulu, yaitu penjualan, retur ke supplier, koreksi stok turun, dan impor Excel yang menurunkan stok.
- **Peringatan:**
  - badge dan filter "Kadaluarsa ≤ 30 hari" di daftar barang;
  - kartu di dashboard (`/api/dashboard/expiring`);
  - banner di kasir saat scan barang yang punya stok lewat tanggal (tidak memblokir).
- **Pembatalan transaksi** mengembalikan tanggal kadaluarsa yang terpakai saat dijual (`transaction_items.batch_usage`). Pengecualiannya transaksi yang dibuat sebelum kolom ini ada.
- **Batasan:** retur pelanggan dan koreksi stok naik kembali sebagai stok tanpa tanggal.
- **Deploy (kolom `batch_usage`):** jalankan ulang `node scripts/migrate-2026-11.js sqlite.db`.
- **Deploy:** jalankan ulang `node scripts/migrate-2026-11.js sqlite.db` (membuat tabel `product_batches`).
- Stok bertanggal tidak pernah melebihi stok. Contoh: stok −5 lalu terima 10 → yang bertanggal hanya 5 (`addBatch`).
- **Tes (lokal saja):** `node scripts/test-expiry.js sqlite-prod.db`. Langkah persiapannya ada di kepala file.

## B. Bug & keamanan dari review kode

### - [x] B1. Simpan transaksi tidak aman dan tidak atomik — P1
- **File:** `src/app/api/transactions/route.ts` (`POST`)
- **Masalah:**
  - `userId` diambil dari body (default `"user-kasir-1"`).
  - Shift yang dipakai adalah shift `buka` **milik siapa saja** (fallback `"SHIFT-001"`, yang akan gagal karena foreign key).
  - Harga diambil dari client, stok tidak dicek, dan semua insert/update berjalan tanpa `db.transaction`.
- **Dampak nyata di produksi:** pada 22 Nov 2026 ada shift `buka` milik kasir Budi. Transaksi dari user lain yang belum membuka shift akan tercatat ke shift Budi, sehingga rekap kas dan penjualan per shift menjadi salah.
- **Terkonfirmasi di uji lokal:**
  - Kasir uji yang punya shift sendiri tetap tercatat sebagai Budi dan masuk ke shift Budi. Struknya pun menulis "Kasir: Budi Santoso", dan shift kasir uji berisi 0 transaksi saat ditutup.
  - Di data produksi asli, **seluruh 3.398 transaksi** ber-`user_id` Budi.
  - Harga dari client dipercaya: item seharga Rp 96.000 dikirim dengan `price: 1` dan tersimpan dengan total Rp 1.
  - Qty 9.999 untuk barang berstok 1 diterima, sehingga stok menjadi −9.999.
  - Karena tidak atomik, checkout yang gagal di tengah meninggalkan transaksi **tanpa item** (header sudah tersimpan, item gagal).
- **Perbaikan:** pakai `getSession()`, pakai shift aktif milik kasir tersebut (tolak bila belum buka shift), ambil harga dari DB, validasi stok cukup, dan jalankan semuanya secara atomik.

### - [x] B2. Terima PO menambah `receivedQty` ke semua item — P1
- **File:** `src/app/api/purchase-orders/receive/route.ts`
- **Masalah:** `update purchaseOrderItems` hanya difilter `purchaseOrderId`, tanpa `productId`, sehingga setiap barang yang diterima menambah qty ke **semua** item PO. Proses ini juga tidak memakai transaction.
- **Terkonfirmasi di uji lokal:** PO berisi A (5) dan B (7), dan hanya A yang diterima. Hasilnya B ikut tercatat `received_qty` 5. Selain itu, PO berstatus `diterima` **bisa diterima lagi**: penerimaan kedua menambah stok A sebanyak 5 lagi, dan `received_qty` kedua item menjadi 10. Tambahkan juga penolakan penerimaan untuk PO yang tidak berstatus `dipesan`.
- PO juga mencatat `createdBy` dengan default `"user-admin-1"`, bukan user yang login.
- **Perbaikan:** tambah filter `and(purchaseOrderId, productId)`, bungkus dengan `db.transaction`, dan validasi qty diterima agar tidak melebihi qty pesanan (atau catat selisihnya).

### - [x] B3. Halaman manajer tidak diproteksi role — P1
- **File:** `src/middleware.ts`
- **Masalah:** `/products`, `/returns`, `/import` beserta API-nya (`/api/products` untuk operasi tulis, `/api/categories`, `/api/returns`, `/api/import`) hanya disembunyikan dari Sidebar. Kasir tetap bisa membukanya lewat URL langsung.
- **Terkonfirmasi di uji lokal (login kasir):** halaman `/products`, `/returns`, dan `/import` terbuka (200). `POST /api/categories` berhasil membuat kategori, dan `DELETE /api/products/:id` berhasil menonaktifkan barang. (`/api/import/*` sudah aman karena mengecek role sendiri.)
- **Perbaikan:** masukkan route tersebut ke daftar route manajer. Untuk `/api/products`, GET dan lookup tetap boleh untuk kasir karena dipakai POS, tetapi POST/PUT/DELETE khusus manajer.

### - [x] B4. API tidak mengecek sesi/role sendiri — P2
- Banyak route handler hanya mengandalkan middleware dan tidak memanggil `getSession()`. Pending-carts dan transactions masih memakai userId hardcoded.
- **Perbaikan:** buat helper, misalnya `requireSession(role?)` di `src/lib/`, lalu pakai di semua route yang menulis data.

### - [x] B5. `middleware.ts` deprecated di Next.js 16 — P3
- Rename `src/middleware.ts` menjadi `src/proxy.ts` dengan export `proxy`. Lihat `node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md` (bagian middleware → proxy).

### - [ ] B6. `// @ts-nocheck` dan `eslint-disable` menyembunyikan bug nyata — P2
- Bukti: API laporan (F3) error 500 di produksi karena memakai kolom yang tidak ada di skema. TypeScript akan menangkapnya seandainya file tidak memakai `@ts-nocheck`.
- Hapus pragma bertahap per file (mulai dari `src/app/api/**`), lalu jalankan `npx tsc --noEmit` dan `npm run lint` dan perbaiki semua error.

### - [x] B7. Metadata aplikasi masih default — P3
- **File:** `src/app/layout.tsx`. Title "Create Next App" diganti "Logmart POS" dengan deskripsi yang sesuai, dan `lang="en"` diganti `lang="id"`.
- **Selesai** di commit `2f8bd10` (rebrand): title "LOGMart POS", deskripsi "Solusi Belanja Murah", `lang="id"`. Terverifikasi di browser lokal. Perlu deploy ulang agar tampil di produksi.

### - [x] B8. Secret dan kredensial default — P2
- `ecosystem.config.js`: `JWT_SECRET` masih placeholder. Pindahkan ke environment server dan jangan di-commit.
- README dan seed memakai password default (`admin123`, `kasir123`). Wajibkan ganti password setelah deploy. **Catatan:** saat ini aplikasi **tidak punya fitur ubah atau reset password** (lihat B16), jadi fitur itu harus dibuat dulu.

### - [x] B9. Bersihkan file sisa di root — P3
- Kandidat hapus (cek dulu isinya bersama user): `deploy-logmart.zip` (22 MB), `run.sh` (isinya potongan perintah grep, rusak), `check_users.js`, `test_hash.js`, `seed.ts` (duplikat dari `scripts/seed.js`), `all_tasks.json`.
- Tambahkan `*.zip`, `sqlite.db`, dan `tsconfig.tsbuildinfo` ke `.gitignore` bila belum ada.

### - [x] B10. Script otomatis NgodingPakeAI yang menyesatkan — P3
- `auto_sum.js` mengisi summary dengan teks generik ("Berkas X mengelola fungsionalitas..."), dan `auto_complete.js` menandai semua task selesai tanpa dikerjakan. Hapus atau jangan dipakai, karena keduanya merusak kualitas dokumentasi dan status task.

### - [x] B11. Riwayat Transaksi memuat semua transaksi sekaligus — P2
- **File:** `src/app/api/transactions/route.ts` (`GET`), `src/app/transactions/page.tsx`
- **Masalah:** `GET /api/transactions` tidak punya limit maupun filter tanggal di server. Di produksi responsnya sudah 764 KB dan akan terus membesar. Filter "Tgl: Hari Ini" di halaman dikerjakan di browser setelah semua data diunduh.
- **Perbaikan:** tambahkan parameter `startDate`/`endDate`, `page`/`pageSize`, dan total count di API. Halaman cukup meminta data sesuai filter. Tambahkan juga index `transactions(transaction_time)` (lihat F6).

### - [x] B12. Retur ke supplier (form di menu Retur) selalu gagal — P1
- **File:** `src/app/api/returns/purchase/route.ts` (`POST`), dipanggil dari `src/app/returns/page.tsx` (sekitar baris 192)
- **Masalah (terkonfirmasi):**
  - Kode memakai kolom `products.stock`, yang tidak ada (seharusnya `stockQty`), sehingga cek stok selalu lolos (`undefined < qty` bernilai false) dan update stok error SQL.
  - Memakai `db.transaction(async ...)`, padahal better-sqlite3 tidak mendukung fungsi transaksi async ("Transaction function cannot return a promise").
  - Akibatnya API mengembalikan 500, tetapi **baris `purchase_returns` sudah tersimpan berstatus `disetujui`** sementara stok tidak berkurang.
  - `processedBy` memakai default `"user-admin-1"`.
- **Perbaikan:** pakai `stockQty`, gunakan transaksi sinkron (`db.transaction((tx) => { ... })` tanpa async/await, dengan `.run()`), validasi stok cukup, dan ambil user dari sesi.

### - [x] B13. Tidak ada validasi angka & stok di banyak tempat — P1
- **Terkonfirmasi di uji lokal:**
  - Barang bisa dibuat dengan harga −5.000, modal lebih besar dari harga, dan stok −3 (`POST /api/products`).
  - Retur ke supplier lewat `/api/returns` (qty 999 untuk stok 30) disetujui dan stok menjadi −967.
  - Checkout melebihi stok diterima (lihat B1).
  - Retur pelanggan tidak memeriksa qty terhadap transaksi asalnya. Jika diberi `transactionId` yang tidak ada, hasilnya error 500 generik.
- Di produksi sudah ada **61 barang berstok minus**.
- **Perbaikan:** validasi angka positif di semua API tulis (barang, transaksi, PO, retur), tolak stok akhir < 0 (atau jadikan pengaturan eksplisit), dan tampilkan pesan error yang jelas.

### - [x] B14. Dashboard menampilkan angka palsu saat penjualan hari ini 0 — P2
- **File:** `src/app/api/dashboard/summary/route.ts` (sekitar baris 54), `src/app/api/dashboard/low-stock/route.ts` (sekitar baris 25), `src/app/page.tsx` (sekitar baris 60–76)
- **Masalah:** API mengirim `_fallback` berisi data dummy (mis. penjualan hari ini Rp 2.450.000, 142 transaksi), dan halaman memakai `d.todaySales || fb.todaySales`. Jadi setiap pagi sebelum ada transaksi, dashboard menampilkan angka palsu. Hal yang sama berlaku untuk stok menipis saat datanya kosong.
- **Perbaikan:** hapus `_fallback` dari API dan halaman, lalu tampilkan 0 atau empty state.

### - [x] B15. Error handling menyesatkan & update tanpa cek — P3
- `POST /api/products` dengan `categoryId` yang salah tetap menampilkan pesan "Mungkin barcode sudah digunakan".
- `PUT /api/products/:id` dan `DELETE /api/products/:id` untuk ID yang tidak ada tetap menjawab "berhasil".
- **Perbaikan:** bedakan error UNIQUE dan FOREIGN KEY, dan kembalikan 404 bila tidak ada baris yang berubah.

### - [x] B16. Menu Pengguna (Staf): tidak bisa ubah nama, username, password, role — P1 (dilaporkan user)
- **File:** `src/app/users/page.tsx`, `src/app/api/users/route.ts`, `src/app/api/users/[id]/route.ts`, `src/app/api/auth/login/route.ts`
- **Kondisi sekarang:**
  - **Tombol "Tambah Pengguna", "Edit" (ikon pensil), dan "Hapus" (ikon tempat sampah) tidak punya aksi (`onClick`)**, jadi tidak terjadi apa-apa saat diklik. Halaman ini hanya menampilkan daftar.
  - API hanya punya `GET`, `POST` (tambah), dan `DELETE` (hapus permanen). **Tidak ada endpoint untuk mengubah data user maupun password.**
  - `POST /api/users` menerima password "1" dan role sembarang (mis. "superadmin").
  - Hapus user berupa hard delete dan gagal (500) bila user sudah punya riwayat transaksi, shift, atau retur.
  - Login tidak mengecek `isActive`.
- **Fitur yang dibutuhkan:**
  - **Tambah pengguna:** form nama, username, password + konfirmasi, dan role (pilihan `manajer`/`kasir` saja).
  - **Edit pengguna:** ubah nama, username (cek unik), dan role lewat `PUT /api/users/:id`.
  - **Ganti/reset password:** manajer bisa mengatur password baru untuk staf, minimal 8 karakter, disimpan dengan `hashPassword` dari `src/lib/auth-helper.ts`.
  - **Ganti password sendiri:** setiap user (termasuk kasir) bisa mengganti password miliknya dengan memasukkan password lama (mis. `PUT /api/auth/password`, menu di Sidebar). Ini diperlukan untuk mengganti password bawaan `admin123`/`kasir123` (B8).
  - **Nonaktifkan / aktifkan** pengguna (`isActive`) sebagai pengganti hapus permanen. User nonaktif ditolak saat login dan tidak bisa membuka shift.
  - Pengaman: manajer tidak bisa menonaktifkan atau menurunkan role dirinya sendiri, dan minimal harus tetap ada satu manajer aktif.
  - Semua endpoint di atas khusus manajer, kecuali ganti password sendiri, dan wajib mengecek sesi di server.
- **Selesai bila:** manajer bisa menambah, mengedit, mereset password, dan menonaktifkan staf dari halaman Pengguna; user bisa mengganti password sendiri; dan password lama tidak bisa dipakai login setelah diganti.

### - [x] B17. Impor PO & retur menyimpan data setengah jadi — P2
- **File:** `src/app/api/import/save/route.ts`, `src/lib/import-repository.ts`
- **Terkonfirmasi:**
  - Pratinjau menandai baris PO dengan barcode tak dikenal sebagai tidak valid, tetapi **simpan tetap membuat header PO** tanpa item (PO kosong), dan ringkasannya "added: 2".
  - Retur hasil impor langsung berstatus `disetujui` tanpa pergerakan stok dan tanpa tautan ke transaksi (`transaction_id` null meski kolom Referensi berisi nomor TRX).
  - Impor barang: satu baris salah menolak seluruh file. Ini bisa diterima, tetapi sebaiknya ditampilkan jelas di UI.
  - Barcode yang sudah ada akan **menimpa stok** (dicatat sebagai `penyesuaian`); pastikan perilaku ini memang diinginkan.
- **Perbaikan:** jangan buat PO bila tidak ada item valid, samakan aturan pratinjau dan simpan, serta buat retur impor berstatus `pending` atau sekaligus menyesuaikan stok.

### - [x] B18. Ubah stok lewat form barang tidak tercatat di pergerakan stok — P3
- `PUT /api/products/:id` dengan `stockQty` langsung menimpa stok tanpa baris `stock_movements` (`penyesuaian`), sehingga laporan pergerakan stok tidak cocok dengan stok sebenarnya.
- **Perbaikan:** saat stok berubah, catat selisihnya sebagai `penyesuaian` beserta user dan alasan.

### - [x] B19. Perbaikan data produksi yang sudah salah — P1 (setelah B1 & B13 diperbaiki)
- **Transaksi atas nama Budi:** perbaiki `transactions.user_id` mengikuti pemilik shift-nya (`UPDATE transactions SET user_id = (SELECT user_id FROM shifts WHERE shifts.id = transactions.shift_id)`). Konfirmasi dulu ke pemilik toko bahwa pemilik shift = kasir yang melayani.
- **61 barang stok minus:** lakukan stok opname dan koreksi lewat penyesuaian stok (B18).
- Jalankan di salinan dulu, cek hasilnya, **backup database produksi**, baru terapkan di VPS.
