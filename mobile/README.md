# HATO Manajer — Aplikasi Mobile (Expo / iOS)

Aplikasi mobile HATO Manajer dibangun menggunakan **Expo React Native** dan dirancang untuk dapat dijalankan langsung di **iPhone tanpa memerlukan akun Apple Developer / sertifikat publishing**, menggunakan aplikasi **Expo Go**.

---

## 📱 Cara Menjalankan di iPhone

### 1. Persiapan di iPhone
1. Buka **App Store** di iPhone Anda.
2. Cari dan install aplikasi **Expo Go** (Gratis).

---

### 2. Konfigurasi Alamat API Backend

Aplikasi mobile membutuhkan koneksi ke backend Next.js HATO.

Buat file `.env` di dalam folder `mobile/`:
```env
# Jika backend dijalankan lokal di laptop dan iPhone di jaringan WiFi yang sama:
# (Ganti IP dengan IP lokal laptop Anda, misalnya 192.168.1.50)
EXPO_PUBLIC_API_URL="http://192.168.1.50:3000"

# ATAU jika backend Next.js sudah dideploy di Vercel:
# EXPO_PUBLIC_API_URL="https://hato-distro.vercel.app"
```

> **Tips Mengetahui IP Laptop (Windows):**  
> Buka PowerShell / Terminal, ketik: `ipconfig` lalu lihat bagian `IPv4 Address`.

---

### 3. Menjalankan Backend (Jika Menggunakan Lokal)

Di terminal pertama (root project `HATO`):
```bash
pnpm dev
```
*(Next.js sudah dilengkapi konfigurasi CORS untuk menerima request dari Expo)*

---

### 4. Menjalankan Aplikasi Mobile Expo

Di terminal kedua:
```bash
cd mobile
npx expo start
```

---

### 5. Membuka di iPhone
1. Setelah perintah di atas dijalankan, terminal akan memunculkan **QR Code**.
2. Buka aplikasi **Kamera bawaan iPhone** (atau buka **Expo Go**).
3. Arahkan kamera ke **QR Code** di layar terminal laptop Anda.
4. Ketuk notifikasi **"Open in Expo Go"**.
5. Aplikasi HATO Manajer akan otomatis dimuat dan siap digunakan di iPhone!

---

## 🚀 Fitur yang Tersedia di Mobile
- **Tab Dashboard**: Memantau siklus aktif, target ayam & tahu, kepatuhan rotasi giliran anggota, dan ringkasan pembayaran.
- **Tab Siklus**: Melihat daftar siklus, detail siklus, status (Buka/Tutup/Delivered), daftar harga mingguan, dan share ringkasan ke WhatsApp.
- **Tab Pesanan**: Melihat pesanan masuk, filter pesanan (Semua / Lunas / Belum Bayar), toggle status bayar sekali klik, dan tombol tambah pesanan baru.
- **Input Pesanan Baru**: Pilih anggota dengan fitur pencarian, pilih produk, isi kuantitas, catatan, dan simpan langsung ke database.
- **Tab Lainnya**: Akses ke daftar anggota komunitas lengkap dengan tombol cepat hubungi via WhatsApp.
