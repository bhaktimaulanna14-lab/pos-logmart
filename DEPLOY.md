# Panduan Lengkap Deploy Logmart POS ke VPS Ubuntu 22.04 (Mulai dari Awal)

Panduan ini dibuat khusus untuk pemula. Ikuti langkah demi langkah secara berurutan di terminal VPS Ubuntu Anda (bisa menggunakan aplikasi seperti PuTTY atau SSH).

---

## 1. Persiapan Awal (Membersihkan Instalasi Lama)
Karena Anda ingin mengulangi dari awal, kita pastikan aplikasi lama benar-benar bersih.
Jalankan perintah ini satu per satu:
```bash
# Hentikan semua aplikasi yang mungkin sedang berjalan di PM2
pm2 stop all
pm2 delete all
pm2 save

# Hapus folder aplikasi lama (misal foldernya bernama pos-logmart, ganti jika berbeda)
rm -rf pos-logmart
```

## 2. Mengambil Kode Baru dari GitHub
```bash
# Clone ulang repositori dari GitHub (ganti URL di bawah dengan URL repo GitHub Anda)
git clone https://github.com/username-anda/pos-logmart.git

# Masuk ke dalam folder aplikasi yang baru di-clone
cd pos-logmart
```

*(Catatan: Jika VPS Anda belum ada Node.js atau PM2 sama sekali, jalankan `bash scripts/setup-ubuntu.sh` terlebih dahulu).*

## 3. Persiapan Lingkungan & Install Dependensi
Di dalam folder `pos-logmart`, jalankan perintah berikut:
```bash
# Install semua library yang dibutuhkan aplikasi
npm install

# (OPSIONAL) Jika Anda belum memiliki file ecosystem.config.js, buat secara otomatis dengan menyalin dari repo
# Jangan lupa edit file tersebut nanti untuk mengubah tulisan GANTI_DENGAN_SECRET_YANG_AMAN_SAAT_DEPLOY
```

## 4. Persiapan Database (SQLite)
Kita akan membuat struktur database baru yang masih kosong, dan mengisinya dengan 1 akun manajer dan 2 akun kasir awal.
```bash
# Buat tabel-tabel di dalam file sqlite.db
npx drizzle-kit push

# Isi data akun awal (username: admin, password: admin123)
npm run db:seed
```

## 5. Build dan Jalankan Aplikasi via PM2
Aplikasi Next.js harus di-*build* terlebih dahulu sebelum bisa dipakai di internet secara cepat.
```bash
# Proses build (tunggu sampai selesai, mungkin memakan waktu 1-2 menit)
npm run build

# Menjalankan aplikasi di background menggunakan PM2
pm2 start ecosystem.config.js

# Menyimpan status PM2 agar aplikasi otomatis menyala lagi saat VPS di-restart/mati lampu
pm2 save
pm2 startup
# (Jika muncul perintah tambahan di layar setelah mengetik pm2 startup, copy paste perintah tersebut dan tekan enter)
```
Sekarang aplikasi Anda sudah menyala di dalam VPS pada port `3000`. 

## 6. Mengamankan dengan HTTPS (Ganti Nginx dengan Caddy)
Untuk menghindari masalah koneksi dan mendapatkan HTTPS gratis, kita akan mematikan Nginx dan menggunakan Caddy.

**A. Matikan Nginx selamanya:**
```bash
sudo systemctl stop nginx
sudo systemctl disable nginx
```

**B. Install Caddy Server:**
Jalankan baris perintah ini berurutan (salin-tempel semua blok ini langsung ke terminal):
```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install caddy
```

**C. Mengatur Nama Domain Anda di Caddy:**
```bash
# Buka file konfigurasi Caddy menggunakan editor nano
sudo nano /etc/caddy/Caddyfile
```
Hapus semua tulisan di dalamnya, lalu ketik ini (Ganti `logmarttrowono.web.id` dengan domain Anda sendiri):
```text
logmarttrowono.web.id {
    reverse_proxy localhost:3000
}
```
*Cara simpan di nano: Tekan `Ctrl + X`, lalu tekan `Y`, lalu tekan `Enter`.*

**D. Jalankan Caddy:**
```bash
sudo systemctl restart caddy
```
*(Tunggu sekitar 1-2 menit, Caddy sedang meminta sertifikat HTTPS gembok hijau secara otomatis ke Let's Encrypt).*

🎉 **SELESAI!** Anda sekarang bisa membuka `https://logmarttrowono.web.id` di browser, dan aplikasinya akan bisa digunakan untuk _login_ tanpa *error* muter-muter kembali.

---

### Cheatsheet (Catatan Singkat Jika Ingin Update Kode Nanti)
Jika di masa depan Anda memperbaiki kode dan mem-*push*-nya ke GitHub, cara mengupdate VPS sangat mudah:
```bash
cd pos-logmart
git pull
npm install
npm run build
pm2 restart logmart-pos
```
