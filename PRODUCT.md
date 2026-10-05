# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
- Primary: Manajer Level 3 (Grup) mengelola siklus distribusi sembako mingguan untuk komunitas berjenjang (~82 anggota Level 1 melalui PJ Level 2).
- Secondary: Penanggung Jawab (PJ) Level 2 dan Anggota Level 1 (melalui ringkasan/notifikasi pesan dan mobile companion).

## Product Purpose
Sistem Manajemen Distribusi Sembako (HATO / SembakoDistro) mengelola siklus pemesanan mingguan bahan pokok (ayam, tahu, dan komoditas lainnya), membantu manajer memenuhi target pembelian minimum supplier yang ditetapkan setiap minggu, mempercepat rekapitulasi pesanan, serta memonitor pembayaran dan pengiriman secara transparan. Target awal saat ini 10 kg ayam dan 10 bungkus tahu, lalu dapat diubah saat membuat siklus.

## Positioning
Sistem operasional distribusi komunal terstruktur dengan mekanisme rotasi jadwal anggota yang memastikan kuota pesanan supplier Level 4 terpenuhi setiap minggu tanpa risiko salah rekap manual via chat WhatsApp.

## Operating Context
- Siklus mingguan terstruktur: Buka pesanan, rekap per sub-grup, submit ke Supplier Level 4 (deadline Selasa), penerimaan barang (Kamis), distribusi/pengantaran kurir, serta rekonsiliasi pembayaran.
- Komunikasi via WhatsApp: Generator template pesan rekap pesanan, reminder giliran rotasi anggota, penagihan pembayaran, dan update status pengantaran.

## Capabilities and Constraints
- Manajemen Siklus Distribusi (alur status: DRAFT -> OPEN -> SUBMITTED_L4 -> RECEIVED -> DELIVERING -> COMPLETED).
- Manajemen Jadwal Rotasi Anggota per siklus untuk pemenuhan kuota minimum mingguan.
- Agregasi dan pencatatan pesanan per sub-grup (Level 2) dan per anggota (Level 1).
- Tracking status pembayaran (PENDING, PAID) dan pengiriman (PENDING, ON_DELIVERY, DELIVERED).
- Lokalisasi: Bahasa Indonesia, mata uang Rupiah (IDR), format waktu Indonesia.

## Brand Commitments
- Nama Produk: HATO Manajer (SembakoDistro).
- Suara & Nada: Lugas, andal, teratur, dan berorientasi operasional.
- Bahasa antarmuka: Bahasa Indonesia (id-ID).

## Evidence on Hand
- PRD di PRD.md.
- Spesifikasi teknis di TECHNICAL_SPEC.md.
- User stories di USER_STORIES.md.
- Skema database Prisma di prisma/schema.prisma.

## Product Principles
- Nol Selisih Rekapitulasi: Seluruh kalkulasi jumlah pesanan dan total harga dihitung secara otomatis dan konsisten.
- Visibilitas Kuota Target: Kemajuan terhadap target ayam dan tahu yang tersimpan pada setiap siklus terpampang jelas di dashboard, termasuk permintaan yang melebihi target.
- Alur Kerja Cepat: Antarmuka intuitif untuk copy format pesan WA, filter status cepat, dan entri pesanan dalam hitungan detik.

## Accessibility & Inclusion
- Kontras warna tinggi dan teks terbaca jelas untuk penggunaan harian admin di desktop maupun layar sentuh mobile.
