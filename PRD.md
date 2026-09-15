# PRD: SembakoDistro — Sistem Manajemen Distribusi Sembako

> **Versi**: 1.0  
> **Tanggal**: 2026-09-10  
> **Status**: Draft  
> **Author**: AI-generated, to be reviewed by Project Owner

---

## 1. Ringkasan Eksekutif

SembakoDistro adalah aplikasi manajemen distribusi sembako (bahan pokok) untuk komunitas berjenjang (Level 1-4). Aplikasi ini membantu Manajer Level 3 mengelola siklus pemesanan mingguan — dari penjadwalan rotasi anggota, pengumpulan pesanan, rekap ke supplier (Level 4), hingga tracking pembayaran dan pengiriman.

**Masalah utama yang diselesaikan:**
- Rekap pesanan manual dari banyak PJ (Penanggung Jawab) yang rawan salah dan memakan waktu
- Tidak ada sistem untuk menjamin target pesanan minimum (20 kg ayam + 20 bungkus tahu) terpenuhi setiap minggu
- Tracking pembayaran dan status pengiriman yang tidak terstruktur
- Komunikasi yang tersebar di banyak chat WhatsApp

---

## 2. Konteks & Latar Belakang

### 2.1 Struktur Komunitas

```
Level 4 (Pusat/Supplier)
  └── Level 3 (Grup — Manajer) ← USER ada di sini
        └── Level 2 (Sub-grup — ada PJ per sub-grup)
              └── Level 1 (Anggota — ~82 orang total)
```

- **Level 4**: Supplier pusat, menerima pesanan agregat dari Level 3
- **Level 3**: Manajer grup (1 orang per grup), mengumpulkan pesanan dari semua level di bawahnya
- **Level 2**: Sub-grup, masing-masing punya **PJ (Penanggung Jawab)** yang mengumpulkan pesanan dari anggota di level-nya
- **Level 1**: Anggota biasa, melakukan pemesanan

### 2.2 Alur Kerja Saat Ini (Manual)

1. Anggota (L1) menyampaikan pesanan ke **PJ di Level 2** masing-masing (via WhatsApp, format bebas)
2. PJ L2 merekap pesanan dari anggota-anggotanya, lalu kirim ke **Manajer L3** (user)
3. Manajer L3 mengagregasi semua rekap dari PJ, lalu submit pesanan ke **Level 4** — **deadline Selasa**
4. Pesanan tiba di Manajer L3 pada **hari Kamis**
5. Kurir mengantar pesanan ke anggota
6. Pembayaran dicatat secara manual

### 2.3 Pain Points

| # | Pain Point | Dampak |
|---|-----------|--------|
| 1 | Rekap manual dari banyak PJ via chat WA | Rawan salah hitung, memakan waktu |
| 2 | Tidak ada sistem rotasi untuk menjamin target mingguan | Target 20 ayam/20 tahu kadang tidak tercapai |
| 3 | Tracking pembayaran di catatan terpisah | Bingung siapa yang sudah/belum bayar |
| 4 | Status pengiriman tidak tertrack | Anggota tidak tahu kapan pesanan tiba |
| 5 | Harga berubah tiap minggu, harus dikomunikasikan manual | Informasi terlambat atau terlewat |

---

## 3. Tujuan & Metrik Keberhasilan

### 3.1 Tujuan Produk

| # | Tujuan | Deskripsi |
|---|--------|-----------|
| T1 | Efisiensi Rekap | Mengurangi waktu rekap pesanan dari >1 jam menjadi <15 menit |
| T2 | Target Terpenuhi | Target minimum 20 kg ayam + 20 bungkus tahu terpenuhi setiap minggu |
| T3 | Transparansi Pembayaran | Status bayar selalu up-to-date dan bisa dicek kapan saja |
| T4 | Tracking Pengiriman | Status pesanan bisa dilacak dari order → dikirim → diterima |
| T5 | Komunikasi Efektif | Info harga, jadwal, dan reminder terkirim otomatis |

### 3.2 Metrik Keberhasilan (KPI)

| Metrik | Target | Cara Ukur |
|--------|--------|-----------|
| Persentase minggu target tercapai | ≥ 90% | (minggu target tercapai / total minggu) × 100 |
| Waktu rekap pesanan | < 15 menit | Stopwatch admin |
| Persentase pembayaran on-time | ≥ 85% | Dari data payment tracking |
| Adopsi rotasi | 100% anggota order min. 1×/bulan | Dari data rotasi vs order |

---

## 4. User Personas

### 4.1 Admin / Manajer L3 (Primary User — MVP)

```
Nama: Manajer Grup A
Level: 3
Peran: Mengelola seluruh siklus pesanan mingguan
Kebutuhan:
  - Input pesanan dari PJ L2 dengan cepat
  - Set harga produk mingguan
  - Generate jadwal rotasi otomatis
  - Lihat rekap pesanan untuk dikirim ke L4
  - Track pembayaran (sudah/belum)
  - Track status pengiriman
  - Lihat dashboard & laporan
```

### 4.2 PJ Level 2 (Future User — Fase 2+)

```
Nama: Penanggung Jawab Sub-grup
Level: 2
Peran: Mengumpulkan pesanan dari anggota di sub-grupnya
Kebutuhan:
  - Input pesanan anggota di sub-grupnya
  - Lihat rekap sub-grup sendiri
  - Terima reminder dan info harga
```

### 4.3 Anggota Level 1 (Future User — Fase 3+)

```
Nama: Anggota Komunitas
Level: 1
Peran: Melakukan pemesanan sembako
Kebutuhan:
  - Pesan via WhatsApp (utama) atau app
  - Lihat harga minggu ini
  - Tahu kapan gilirannya
  - Track status pesanan & pembayaran
```

---

## 5. Scope Produk

### 5.1 Dalam Scope (MVP — Fase 1)

| # | Fitur | Deskripsi |
|---|-------|-----------|
| F1 | Manajemen Anggota | CRUD data anggota (nama, no HP, level, sub-grup) |
| F2 | Manajemen Produk & Katalog | CRUD produk, set unit (kg/bungkus/dll), tandai produk target |
| F3 | Harga Mingguan | Input harga per produk per minggu |
| F4 | Siklus Pemesanan | Buat siklus mingguan (deadline, tanggal kirim) |
| F5 | Jadwal Rotasi | Auto-generate jadwal ~20 anggota/minggu yang wajib order |
| F6 | Input Pesanan | Admin input pesanan per anggota (termasuk dari rekap PJ) |
| F7 | Rekap Pesanan | Agregasi total pesanan per produk, siap kirim ke L4 |
| F8 | Payment Tracking | Toggle status bayar per pesanan (lunas/belum) |
| F9 | Status Pengiriman | Track status per pesanan (dipesan → dikirim → diterima) |
| F10 | Dashboard | Ringkasan: target vs aktual, payment status, rotasi progress |
| F11 | Riwayat | History pesanan per anggota, per minggu |

### 5.2 Dalam Scope (Fase 2 — WhatsApp Integration)

| # | Fitur | Deskripsi |
|---|-------|-----------|
| F12 | WA Reminder | Kirim reminder otomatis ke anggota yang dijadwalkan |
| F13 | WA Broadcast | Broadcast info harga, deadline, status pengiriman |
| F14 | WA Order | Anggota bisa order via reply WA bot |
| F15 | Rekap Auto-Forward | Generate rekap format WA untuk dikirim ke L4 |

### 5.3 Dalam Scope (Fase 3 — User-Facing App)

| # | Fitur | Deskripsi |
|---|-------|-----------|
| F16 | Login Anggota | Anggota bisa login dan akses app sendiri |
| F17 | Self-Service Order | Anggota pesan langsung di app |
| F18 | Notifikasi Push | Push notification untuk reminder dan status update |

### 5.4 Dalam Scope (Fase 4 — Multi-Grup & Scale)

| # | Fitur | Deskripsi |
|---|-------|-----------|
| F19 | Multi-Tenant | Tiap Grup L3 punya dashboard sendiri |
| F20 | Dashboard L4 | Level 4 bisa lihat agregat dari semua L3 |
| F21 | Role Management | Role-based access per level dan fungsi |

### 5.5 Di Luar Scope

- Fitur e-commerce / marketplace
- Integrasi pembayaran digital (OVO, GoPay, dll) — pembayaran dicatat manual
- Manajemen gudang / inventory
- Akuntansi lengkap (jurnal, neraca, dll)

---

## 6. Spesifikasi Fitur Detail (MVP)

### F1: Manajemen Anggota

**Deskripsi**: Admin bisa menambah, mengedit, menghapus, dan melihat daftar anggota komunitas.

**Data yang disimpan:**
| Field | Tipe | Required | Keterangan |
|-------|------|----------|------------|
| Nama | Text | ✅ | Nama lengkap anggota |
| No HP | Text | ✅ | Nomor WhatsApp (untuk integrasi WA nanti) |
| Level | Enum (1-3) | ✅ | Level di hierarki komunitas |
| Sub-grup | Reference | ✅ | Sub-grup L2 tempat anggota terdaftar |
| Peran | Enum | ❌ | anggota / pj / pengurus |
| Status | Enum | ✅ | aktif / nonaktif |
| Tanggal bergabung | Date | ✅ | Auto-set saat ditambahkan |

**Acceptance Criteria:**
- [ ] Admin bisa menambah anggota baru dengan nama dan no HP (minimum)
- [ ] Admin bisa mengedit data anggota
- [ ] Admin bisa menonaktifkan anggota (soft delete)
- [ ] Admin bisa melihat daftar anggota, filter by level / sub-grup / status
- [ ] Admin bisa melihat total anggota aktif
- [ ] Admin bisa import anggota dari CSV (nice-to-have)

---

### F2: Manajemen Produk & Katalog

**Deskripsi**: Admin bisa mengelola daftar produk yang tersedia untuk dipesan.

**Data yang disimpan:**
| Field | Tipe | Required | Keterangan |
|-------|------|----------|------------|
| Nama produk | Text | ✅ | Contoh: "Ayam", "Tahu" |
| Satuan | Text | ✅ | kg, bungkus, liter, pcs, dll |
| Produk target? | Boolean | ✅ | True untuk ayam dan tahu |
| Target kuantitas/minggu | Number | Conditional | Wajib jika produk target. Contoh: 20 |
| Kategori | Text | ❌ | Misal: protein, bahan pokok, bumbu |
| Status | Enum | ✅ | aktif / nonaktif |
| Kelipatan order | Number | ❌ | Misal: tahu hanya bisa dipesan kelipatan 1 bungkus |

**Acceptance Criteria:**
- [ ] Admin bisa menambah produk baru dengan nama dan satuan
- [ ] Admin bisa menandai produk sebagai "produk target" dan set target kuantitas
- [ ] Admin bisa mengaktifkan/menonaktifkan produk
- [ ] Produk nonaktif tidak muncul saat input pesanan
- [ ] Admin bisa melihat daftar produk dan target-nya

---

### F3: Harga Mingguan

**Deskripsi**: Admin set harga tiap produk per siklus mingguan. Harga bisa berubah tiap minggu.

**Data yang disimpan:**
| Field | Tipe | Required | Keterangan |
|-------|------|----------|------------|
| Produk | Reference | ✅ | Produk mana |
| Siklus | Reference | ✅ | Siklus minggu ke berapa |
| Harga per satuan | Currency | ✅ | Contoh: Rp 35.000/kg |

**Acceptance Criteria:**
- [ ] Admin bisa set harga per produk untuk minggu ini
- [ ] Jika harga belum di-set, gunakan harga minggu lalu sebagai default (bisa diedit)
- [ ] Harga otomatis dipakai untuk kalkulasi total pesanan
- [ ] Riwayat harga tersimpan dan bisa dilihat

---

### F4: Siklus Pemesanan

**Deskripsi**: Setiap minggu ada satu siklus pemesanan dengan timeline yang jelas.

**Data yang disimpan:**
| Field | Tipe | Required | Keterangan |
|-------|------|----------|------------|
| Label | Text | ✅ | Auto-generate: "Minggu 1 - Sep 2026" |
| Tanggal mulai | Date | ✅ | Awal periode order (misal Sabtu) |
| Deadline order | Date | ✅ | Default: Selasa |
| Tanggal pengiriman | Date | ✅ | Default: Kamis |
| Status | Enum | ✅ | draft / open / closed / delivered / completed |

**Status Flow:**
```
draft → open → closed → delivered → completed
         ↑                              │
         │    (bisa reopen jika perlu)   │
         └──────────────────────────────┘ (next cycle)
```

**Acceptance Criteria:**
- [ ] Admin bisa membuat siklus baru (auto-suggest tanggal berdasarkan minggu ini)
- [ ] Siklus bisa di-open (menerima pesanan) dan di-close (deadline)
- [ ] Siklus berstatus "delivered" saat barang tiba
- [ ] Siklus berstatus "completed" saat semua pesanan terdeliver & terbayar
- [ ] Dashboard menampilkan siklus aktif

---

### F5: Jadwal Rotasi

**Deskripsi**: Sistem auto-generate jadwal ~20 anggota per minggu yang "dijadwalkan" untuk order, memastikan setiap anggota kebagian minimal 1×/bulan.

**Logika Rotasi:**
1. Ambil semua anggota aktif (N orang)
2. Bagi jadi 4 kelompok (minggu 1-4) secara merata
3. Kelompok ditentukan berdasarkan urutan — bisa diacak ulang tiap bulan
4. Anggota yang sudah order di minggu sebelumnya tetap boleh order lagi
5. Yang dijadwalkan tapi belum order → muncul di highlight/reminder

**Data yang disimpan:**
| Field | Tipe | Required | Keterangan |
|-------|------|----------|------------|
| Siklus | Reference | ✅ | Siklus minggu ini |
| Anggota | Reference | ✅ | Siapa yang dijadwalkan |
| Status | Enum | ✅ | scheduled / ordered / skipped |

**Acceptance Criteria:**
- [ ] Sistem bisa auto-generate jadwal rotasi untuk 1 bulan (4 siklus)
- [ ] Admin bisa adjust manual (pindahkan anggota antar minggu)
- [ ] Dashboard menampilkan: siapa yang dijadwalkan, siapa yang sudah order, siapa yang belum
- [ ] Anggota yang belum pernah order dalam sebulan di-highlight
- [ ] Rotasi memprioritaskan anggota yang paling lama belum order

---

### F6: Input Pesanan

**Deskripsi**: Admin menginput pesanan atas nama anggota. Satu pesanan = satu anggota untuk satu siklus.

**Data yang disimpan:**

**Order (Header):**
| Field | Tipe | Required | Keterangan |
|-------|------|----------|------------|
| Siklus | Reference | ✅ | Siklus minggu ini |
| Anggota | Reference | ✅ | Siapa yang pesan |
| Total harga | Currency | ✅ | Auto-calculated |
| Status bayar | Enum | ✅ | belum / lunas |
| Status pesanan | Enum | ✅ | pending / confirmed / shipped / delivered |
| Catatan | Text | ❌ | Catatan tambahan |
| Dibuat oleh | Reference | ✅ | Admin yang input (untuk audit trail) |
| Tanggal input | DateTime | ✅ | Auto-set |

**Order Item (Detail):**
| Field | Tipe | Required | Keterangan |
|-------|------|----------|------------|
| Order | Reference | ✅ | Milik order mana |
| Produk | Reference | ✅ | Produk apa |
| Kuantitas | Number | ✅ | Berapa banyak (kg/bungkus/dll) |
| Harga satuan | Currency | ✅ | Auto-fill dari harga mingguan |
| Subtotal | Currency | ✅ | Auto-calculated: kuantitas × harga |

**Acceptance Criteria:**
- [ ] Admin bisa membuat pesanan baru: pilih anggota → pilih produk → isi kuantitas
- [ ] Harga otomatis terisi dari harga mingguan
- [ ] Total otomatis terhitung
- [ ] Admin bisa edit pesanan yang sudah di-input (sebelum siklus closed)
- [ ] Admin bisa hapus pesanan
- [ ] Saat input pesanan, status rotasi anggota otomatis update ke "ordered"
- [ ] Validasi: tidak bisa input pesanan untuk anggota yang sudah punya pesanan di siklus yang sama (kecuali edit)
- [ ] Quick-input mode: batch input untuk banyak anggota sekaligus (nice-to-have)

---

### F7: Rekap Pesanan

**Deskripsi**: Agregasi semua pesanan dalam satu siklus, siap untuk dikirim ke Level 4.

**Output Rekap:**
```
REKAP PESANAN — Minggu 1 September 2026
Deadline: Selasa, 8 Sep 2026
========================================
Ayam (kg)     : 23 kg  ✅ Target: 20
Tahu (bungkus): 25 bks ✅ Target: 20
Telur (kg)    : 10 kg  (tambahan)
Minyak (liter): 5 ltr  (tambahan)
========================================
Total Order: 28 orang
Total Nilai: Rp 2.450.000
```

**Acceptance Criteria:**
- [ ] Admin bisa lihat rekap per siklus: total per produk, jumlah orang, total nilai
- [ ] Rekap menampilkan perbandingan vs target untuk produk target
- [ ] Rekap bisa di-copy sebagai teks (untuk forward ke WA L4)
- [ ] Rekap bisa di-export sebagai PDF (nice-to-have)
- [ ] Rekap detail per anggota juga tersedia

---

### F8: Payment Tracking

**Deskripsi**: Admin bisa menandai status pembayaran per pesanan.

**Acceptance Criteria:**
- [ ] Admin bisa toggle status bayar: belum → lunas (dan sebaliknya)
- [ ] Dashboard menampilkan: total tagihan, sudah dibayar, belum dibayar
- [ ] Filter pesanan by status bayar
- [ ] Highlight anggota yang sering telat bayar (nice-to-have)

---

### F9: Status Pengiriman

**Deskripsi**: Track status pengiriman per pesanan.

**Status Flow:**
```
pending → confirmed → shipped → delivered
```

| Status | Artinya |
|--------|---------|
| pending | Pesanan di-input, belum dikirim ke L4 |
| confirmed | Sudah masuk rekap dan dikirim ke L4 |
| shipped | Barang sudah tiba di L3, sedang dikirim kurir |
| delivered | Sudah diterima anggota |

**Acceptance Criteria:**
- [ ] Admin bisa update status pesanan satu-satu atau batch
- [ ] Saat siklus di-close, semua pesanan otomatis jadi "confirmed"
- [ ] Saat barang tiba (siklus → delivered), pesanan bisa di-update ke "shipped"
- [ ] Admin/kurir bisa tandai "delivered" per pesanan

---

### F10: Dashboard

**Deskripsi**: Ringkasan data utama dalam satu halaman.

**Komponen Dashboard:**

| Widget | Data |
|--------|------|
| Siklus Aktif | Siklus minggu ini, status, deadline countdown |
| Target vs Aktual | Bar chart: ayam (20 target vs X aktual), tahu (20 vs Y) |
| Rotasi Progress | X/20 orang dijadwalkan sudah order |
| Payment Summary | Total tagihan, sudah bayar, belum bayar |
| Belum Order Bulan Ini | Daftar anggota yang belum order sama sekali bulan ini |
| Quick Actions | Tombol: buat siklus baru, input pesanan, generate rekap |

**Acceptance Criteria:**
- [ ] Dashboard menampilkan semua widget di atas
- [ ] Data real-time (auto-refresh)
- [ ] Responsive (bisa dilihat di HP dan desktop)

---

### F11: Riwayat

**Deskripsi**: History pesanan untuk analisis dan tracking.

**Acceptance Criteria:**
- [ ] Admin bisa lihat riwayat pesanan per anggota (semua siklus)
- [ ] Admin bisa lihat riwayat per siklus (semua pesanan dalam siklus)
- [ ] Filter by periode, anggota, produk, status bayar
- [ ] Export ke CSV (nice-to-have)

---

## 7. Non-Functional Requirements

| # | Requirement | Target |
|---|-------------|--------|
| NFR1 | **Performance** | Halaman load < 2 detik |
| NFR2 | **Availability** | 99% uptime (toleransi downtime saat maintenance) |
| NFR3 | **Responsive** | Bisa diakses dari mobile browser dan desktop |
| NFR4 | **Security** | Login admin dengan password, data terenkripsi |
| NFR5 | **Scalability** | Arsitektur siap untuk multi-tenant di masa depan |
| NFR6 | **Backup** | Data di-backup otomatis (minimal harian) |
| NFR7 | **Offline** | Tidak wajib offline-first, tapi graceful degradation |
| NFR8 | **Bahasa** | Bahasa Indonesia |

---

## 8. User Flow

### 8.1 Siklus Mingguan (Admin)

```
1. SABTU: Buat siklus baru
   ├── Auto-generate jadwal rotasi (jika belum ada untuk bulan ini)
   ├── Set/update harga produk minggu ini
   └── Siklus status: OPEN

2. SABTU-SELASA: Terima & input pesanan
   ├── PJ L2 kirim rekap via WA
   ├── Admin input pesanan satu-satu di app
   ├── Dashboard update real-time (target vs aktual)
   └── Reminder ke anggota yang belum order (manual/WA)

3. SELASA: Close siklus & generate rekap
   ├── Siklus status: CLOSED
   ├── Generate rekap aggregat
   ├── Copy/forward rekap ke L4 via WA
   └── Semua pesanan status: CONFIRMED

4. KAMIS: Barang tiba
   ├── Siklus status: DELIVERED
   ├── Pesanan status: SHIPPED (kurir mengantar)
   └── Update status per pesanan: DELIVERED saat diterima

5. ONGOING: Payment tracking
   ├── Toggle status bayar per anggota
   └── Siklus status: COMPLETED (saat semua delivered & paid)
```

### 8.2 Input Pesanan (Detail)

```
Admin buka app
  → Pilih siklus aktif
  → Klik "Input Pesanan"
  → Pilih anggota (search by nama / filter by sub-grup)
  → Pilih produk & isi kuantitas
     ├── Harga otomatis terisi
     └── Total otomatis terhitung
  → Simpan
  → Dashboard & rekap auto-update
```

---

## 9. Asumsi & Batasan

### Asumsi
1. Admin (Manajer L3) memiliki akses internet yang stabil
2. Semua anggota memiliki WhatsApp
3. Harga ditetapkan satu kali per minggu dan berlaku untuk semua pesanan dalam siklus tersebut
4. Satu anggota hanya punya satu pesanan per siklus (bisa diedit, tidak duplikat)
5. Siklus pemesanan selalu mengikuti pola mingguan (Sabtu-Kamis)
6. Pembayaran di-track statusnya saja (bukan prosesnya) — tidak ada payment gateway

### Batasan
1. MVP hanya untuk 1 grup (Grup A, Level 3)
2. MVP hanya digunakan oleh 1 admin
3. Tidak ada integrasi pembayaran digital
4. WhatsApp integration belum ada di MVP (Fase 2)
5. Data anggota dikelola manual (tidak ada self-registration)

---

## 10. Roadmap

```
Fase 1 (MVP) ──→ Fase 2 ──→ Fase 3 ──→ Fase 4
Admin Tool       WA Bot      User App    Multi-Grup
~4-6 minggu      ~3-4 minggu ~4-6 minggu ~4-6 minggu
```

| Fase | Fitur Utama | Target User | Estimasi |
|------|-------------|-------------|----------|
| **1 (MVP)** | F1-F11: Admin dashboard lengkap | Admin L3 (1 orang) | 4-6 minggu |
| **2** | F12-F15: WA bot (reminder, broadcast, order) | Admin + Anggota via WA | 3-4 minggu |
| **3** | F16-F18: App untuk anggota (login, self-order) | Semua anggota | 4-6 minggu |
| **4** | F19-F21: Multi-grup, dashboard L4, role mgmt | Semua level & grup | 4-6 minggu |

---

## 11. Glosarium

| Istilah | Definisi |
|---------|----------|
| **Sembako** | Sembilan Bahan Pokok — kebutuhan pangan dasar |
| **Level** | Tingkatan dalam hierarki komunitas (1-4, 4 tertinggi) |
| **PJ** | Penanggung Jawab — pengurus di tiap sub-grup L2 yang mengumpulkan pesanan |
| **Siklus** | Satu periode pemesanan mingguan (Sabtu-Kamis) |
| **Rotasi** | Sistem penjadwalan bergilir untuk menjamin target minimum order |
| **Produk Target** | Produk yang punya target kuantitas mingguan (ayam 20kg, tahu 20bks) |
| **Rekap** | Agregasi total pesanan per produk untuk dikirim ke L4 |
| **Admin** | Manajer L3 yang mengelola app (satu-satunya user di MVP) |
