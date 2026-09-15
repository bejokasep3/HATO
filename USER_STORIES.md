# User Stories — SembakoDistro

> **Versi**: 1.0  
> **Tanggal**: 2026-09-10  
> **Referensi**: PRD.md

---

## Format

```
Sebagai [persona],
Saya ingin [aksi],
Supaya [tujuan/benefit].
```

Prioritas: **P0** = Must have (MVP) | **P1** = Should have | **P2** = Nice to have

---

## Epic 1: Manajemen Anggota

### US-1.1 — Menambah Anggota Baru `P0`
**Sebagai** Admin,  
**Saya ingin** menambahkan anggota baru dengan nama dan no HP,  
**Supaya** anggota tersebut terdaftar di sistem dan bisa dijadwalkan untuk order.

**Acceptance Criteria:**
- Form input: nama (wajib), no HP (wajib), level, sub-grup
- Validasi: no HP tidak boleh duplikat (untuk anggota aktif)
- Setelah simpan, anggota muncul di daftar
- Default status: aktif

### US-1.2 — Melihat Daftar Anggota `P0`
**Sebagai** Admin,  
**Saya ingin** melihat daftar semua anggota,  
**Supaya** saya tahu siapa saja yang terdaftar dan bisa mengelola datanya.

**Acceptance Criteria:**
- Tabel: nama, no HP, level, sub-grup, status, terakhir order
- Filter: by level, sub-grup, status (aktif/nonaktif)
- Search: by nama atau no HP
- Pagination
- Total anggota aktif ditampilkan

### US-1.3 — Mengedit Data Anggota `P0`
**Sebagai** Admin,  
**Saya ingin** mengedit data anggota (nama, HP, level, sub-grup),  
**Supaya** data selalu up-to-date.

### US-1.4 — Menonaktifkan Anggota `P0`
**Sebagai** Admin,  
**Saya ingin** menonaktifkan anggota yang sudah keluar dari komunitas,  
**Supaya** mereka tidak muncul di jadwal rotasi dan input pesanan, tapi history-nya tetap tersimpan.

**Acceptance Criteria:**
- Soft delete (status → nonaktif)
- Anggota nonaktif tidak muncul di dropdown input pesanan
- Anggota nonaktif tidak di-schedule di rotasi
- History pesanan lama tetap tersimpan

### US-1.5 — Import Anggota dari CSV `P2`
**Sebagai** Admin,  
**Saya ingin** import daftar anggota dari file CSV,  
**Supaya** tidak perlu input satu-satu untuk 82 orang.

**Acceptance Criteria:**
- Upload CSV dengan kolom: nama, no_hp, level, sub_grup
- Preview data sebelum import
- Validasi duplikat no HP
- Report: berapa berhasil, berapa gagal

---

## Epic 2: Manajemen Produk

### US-2.1 — Menambah Produk `P0`
**Sebagai** Admin,  
**Saya ingin** menambahkan produk baru ke katalog (misal: ayam, tahu, telur),  
**Supaya** produk tersebut bisa dipesan oleh anggota.

**Acceptance Criteria:**
- Form: nama produk, satuan (kg/bungkus/liter/pcs), is_target, target_quantity
- Jika is_target = true, target_quantity wajib diisi
- Produk baru otomatis aktif

### US-2.2 — Melihat Daftar Produk `P0`
**Sebagai** Admin,  
**Saya ingin** melihat daftar produk dengan info target-nya,  
**Supaya** saya tahu produk apa saja yang tersedia dan targetnya berapa.

### US-2.3 — Menandai Produk Target `P0`
**Sebagai** Admin,  
**Saya ingin** menandai produk tertentu sebagai "produk target" dengan target kuantitas mingguan,  
**Supaya** sistem bisa tracking pencapaian target di dashboard.

### US-2.4 — Menonaktifkan Produk `P1`
**Sebagai** Admin,  
**Saya ingin** menonaktifkan produk yang sudah tidak tersedia,  
**Supaya** produk tersebut tidak muncul saat input pesanan.

---

## Epic 3: Siklus Pemesanan

### US-3.1 — Membuat Siklus Baru `P0`
**Sebagai** Admin,  
**Saya ingin** membuat siklus pemesanan mingguan baru,  
**Supaya** pesanan minggu ini bisa mulai diterima.

**Acceptance Criteria:**
- Auto-suggest tanggal: period_start (Sabtu), deadline (Selasa), delivery (Kamis)
- Label auto-generate: "Minggu X - Bulan Tahun"
- Status awal: draft
- Admin bisa adjust tanggal manual
- Tombol "Open" untuk mulai menerima pesanan

### US-3.2 — Membuka & Menutup Siklus `P0`
**Sebagai** Admin,  
**Saya ingin** membuka siklus (open) untuk menerima pesanan dan menutupnya (close) saat deadline,  
**Supaya** ada batasan waktu yang jelas untuk pemesanan.

**Acceptance Criteria:**
- Open: pesanan bisa di-input
- Close: pesanan tidak bisa di-input lagi (kecuali admin force-add)
- Countdown timer di dashboard menunjukkan sisa waktu sebelum deadline

### US-3.3 — Menandai Siklus Delivered `P0`
**Sebagai** Admin,  
**Saya ingin** menandai siklus bahwa barang sudah tiba,  
**Supaya** proses distribusi bisa dimulai.

### US-3.4 — Menyelesaikan Siklus `P1`
**Sebagai** Admin,  
**Saya ingin** menandai siklus sebagai completed saat semua pesanan sudah diterima dan dibayar,  
**Supaya** siklus bisa diarsipkan dan tidak mengganggu tampilan.

---

## Epic 4: Harga Mingguan

### US-4.1 — Set Harga Produk untuk Siklus Ini `P0`
**Sebagai** Admin,  
**Saya ingin** menentukan harga per produk untuk siklus minggu ini,  
**Supaya** total pesanan bisa dihitung otomatis.

**Acceptance Criteria:**
- Form batch: semua produk aktif ditampilkan dengan input harga
- Default: harga dari siklus sebelumnya (jika ada)
- Harga otomatis dipakai saat input pesanan
- Harga tersimpan per siklus (history)

### US-4.2 — Melihat Riwayat Harga `P2`
**Sebagai** Admin,  
**Saya ingin** melihat riwayat harga produk dari minggu ke minggu,  
**Supaya** saya bisa analisis tren harga.

---

## Epic 5: Jadwal Rotasi

### US-5.1 — Generate Jadwal Rotasi Otomatis `P0`
**Sebagai** Admin,  
**Saya ingin** sistem otomatis membagi 82 anggota ke 4 minggu secara merata,  
**Supaya** setiap anggota kebagian minimal 1x order per bulan dan target 20/minggu terpenuhi.

**Acceptance Criteria:**
- Tombol "Generate Rotasi Bulan Ini"
- Anggota dibagi merata (~21/21/20/20 atau serupa)
- Prioritas: anggota yang paling lama belum order di posisi minggu awal
- Hasil bisa di-review sebelum di-apply
- Warning jika sudah ada rotasi untuk bulan ini (overwrite confirmation)

### US-5.2 — Melihat Jadwal Rotasi `P0`
**Sebagai** Admin,  
**Saya ingin** melihat siapa yang dijadwalkan order minggu ini (dan bulan ini),  
**Supaya** saya bisa mengingatkan mereka.

**Acceptance Criteria:**
- View per minggu: daftar anggota + status (scheduled/ordered/skipped)
- View per bulan: kalender rotasi
- Highlight: yang sudah order (✅), belum order (⏳), skipped (❌)

### US-5.3 — Adjust Jadwal Manual `P1`
**Sebagai** Admin,  
**Saya ingin** memindahkan anggota dari minggu 1 ke minggu 2 (atau sebaliknya),  
**Supaya** saya bisa akomodasi permintaan khusus.

### US-5.4 — Melihat Anggota yang Belum Order Bulan Ini `P0`
**Sebagai** Admin,  
**Saya ingin** melihat daftar anggota yang belum order sama sekali bulan ini,  
**Supaya** saya bisa mengingatkan atau menjadwalkan mereka di sisa minggu.

---

## Epic 6: Input & Kelola Pesanan

### US-6.1 — Input Pesanan Baru `P0`
**Sebagai** Admin,  
**Saya ingin** menginput pesanan atas nama anggota (pilih anggota → pilih produk → isi kuantitas),  
**Supaya** pesanan tercatat di sistem.

**Acceptance Criteria:**
- Pilih anggota dari dropdown (search by nama/HP)
- Pilih produk dari daftar produk aktif
- Input kuantitas per produk
- Harga otomatis terisi dari harga mingguan
- Total otomatis terhitung
- Validasi: 1 anggota hanya boleh 1 pesanan per siklus
- Setelah simpan, status rotasi anggota otomatis update

### US-6.2 — Quick-Input Mode `P1`
**Sebagai** Admin,  
**Saya ingin** input pesanan secara cepat untuk banyak anggota sekaligus (misal dari rekap PJ),  
**Supaya** proses input lebih efisien.

**Acceptance Criteria:**
- Tampilan spreadsheet-like: baris = anggota, kolom = produk
- Input kuantitas langsung di cell
- Bisa filter by sub-grup (input per sub-grup sesuai rekap PJ)
- Bulk save

### US-6.3 — Edit Pesanan `P0`
**Sebagai** Admin,  
**Saya ingin** mengedit pesanan yang sudah di-input (ubah kuantitas, tambah/hapus item),  
**Supaya** saya bisa koreksi kesalahan input.

**Acceptance Criteria:**
- Hanya bisa edit jika siklus belum closed (atau admin override)
- Perubahan otomatis recalculate total

### US-6.4 — Hapus Pesanan `P0`
**Sebagai** Admin,  
**Saya ingin** menghapus pesanan jika anggota membatalkan,  
**Supaya** rekap tetap akurat.

---

## Epic 7: Rekap Pesanan

### US-7.1 — Melihat Rekap Agregat `P0`
**Sebagai** Admin,  
**Saya ingin** melihat total pesanan per produk untuk siklus ini,  
**Supaya** saya tahu berapa yang harus dipesan ke Level 4.

**Acceptance Criteria:**
- Tabel: produk, satuan, total quantity, target (jika ada), status target (✅/❌)
- Total jumlah orang yang order
- Total nilai pesanan (Rupiah)

### US-7.2 — Copy Rekap sebagai Teks `P0`
**Sebagai** Admin,  
**Saya ingin** meng-copy rekap dalam format teks yang rapi,  
**Supaya** saya bisa langsung paste ke WhatsApp dan kirim ke Level 4.

**Acceptance Criteria:**
- Format teks yang clean dan readable (lihat contoh di PRD F7)
- Tombol "Copy to Clipboard"
- Include: nama produk, quantity, target status, total orang, total nilai

### US-7.3 — Melihat Rekap Detail per Anggota `P1`
**Sebagai** Admin,  
**Saya ingin** melihat rekap detail: siapa pesan apa dan berapa,  
**Supaya** saya bisa verifikasi dan crosscheck.

### US-7.4 — Export Rekap ke PDF `P2`
**Sebagai** Admin,  
**Saya ingin** export rekap ke PDF,  
**Supaya** saya punya dokumen arsip yang formal.

---

## Epic 8: Payment Tracking

### US-8.1 — Toggle Status Bayar `P0`
**Sebagai** Admin,  
**Saya ingin** menandai pesanan sebagai "sudah bayar" dengan satu klik,  
**Supaya** saya tahu siapa yang sudah dan belum bayar.

**Acceptance Criteria:**
- Toggle button: unpaid ↔ paid
- Bisa dilakukan dari list pesanan atau detail pesanan
- Timestamp pembayaran otomatis tercatat
- Visual distinction (warna/icon) antara paid dan unpaid

### US-8.2 — Melihat Ringkasan Pembayaran `P0`
**Sebagai** Admin,  
**Saya ingin** melihat ringkasan pembayaran per siklus (total tagihan, sudah bayar, belum bayar),  
**Supaya** saya tahu posisi keuangan saat ini.

### US-8.3 — Filter Pesanan by Status Bayar `P0`
**Sebagai** Admin,  
**Saya ingin** memfilter daftar pesanan berdasarkan status bayar (belum bayar saja),  
**Supaya** saya bisa follow up ke anggota yang belum bayar.

---

## Epic 9: Status Pengiriman

### US-9.1 — Update Status Pesanan `P0`
**Sebagai** Admin,  
**Saya ingin** mengupdate status pesanan (pending → confirmed → shipped → delivered),  
**Supaya** ada tracking jelas untuk setiap pesanan.

### US-9.2 — Batch Update Status `P1`
**Sebagai** Admin,  
**Saya ingin** mengupdate status banyak pesanan sekaligus (misal: semua jadi "shipped" saat barang tiba),  
**Supaya** tidak perlu update satu-satu.

**Acceptance Criteria:**
- Select multiple orders → batch update status
- Atau: saat siklus status berubah → prompt untuk batch update order status

---

## Epic 10: Dashboard

### US-10.1 — Melihat Dashboard Ringkasan `P0`
**Sebagai** Admin,  
**Saya ingin** melihat satu halaman yang merangkum semua info penting minggu ini,  
**Supaya** saya bisa ambil keputusan cepat.

**Acceptance Criteria:**
- Widget: Siklus aktif + countdown deadline
- Widget: Target vs Aktual (ayam dan tahu) — progress bar
- Widget: Rotasi progress — X/20 sudah order
- Widget: Payment summary — pie chart atau angka
- Widget: Quick actions — tombol menuju fitur utama
- Responsive (mobile-friendly)

### US-10.2 — Melihat Anggota Belum Order Bulan Ini `P0`
**Sebagai** Admin,  
**Saya ingin** melihat daftar anggota yang belum pernah order di bulan ini,  
**Supaya** saya bisa pastikan semua kebagian.

---

## Epic 11: Riwayat & Reporting

### US-11.1 — Riwayat Pesanan per Anggota `P0`
**Sebagai** Admin,  
**Saya ingin** melihat riwayat pesanan satu anggota dari waktu ke waktu,  
**Supaya** saya tahu pola belanjanya.

### US-11.2 — Riwayat per Siklus `P0`
**Sebagai** Admin,  
**Saya ingin** melihat semua pesanan dalam satu siklus tertentu,  
**Supaya** saya bisa review siklus yang sudah selesai.

### US-11.3 — Export Data ke CSV `P2`
**Sebagai** Admin,  
**Saya ingin** export data pesanan ke CSV,  
**Supaya** saya bisa olah di spreadsheet untuk keperluan lain.

---

## Epic 12: Manajemen Sub-grup (Groups)

### US-12.1 — Menambah Sub-grup `P0`
**Sebagai** Admin,  
**Saya ingin** menambahkan sub-grup (Level 2) beserta PJ-nya,  
**Supaya** anggota bisa dikelompokkan dan pesanan bisa direkap per sub-grup.

### US-12.2 — Melihat Daftar Sub-grup `P0`
**Sebagai** Admin,  
**Saya ingin** melihat daftar sub-grup, jumlah anggota per sub-grup, dan siapa PJ-nya,  
**Supaya** saya punya overview struktur komunitas.

---

## Ringkasan Prioritas

| Prioritas | Jumlah Stories | Epic |
|-----------|----------------|------|
| **P0** (Must Have) | 22 stories | Semua epic punya P0 |
| **P1** (Should Have) | 5 stories | Quick-input, adjust rotasi, batch status, rekap detail, deactivate produk |
| **P2** (Nice to Have) | 4 stories | CSV import, riwayat harga, PDF export, CSV export |
