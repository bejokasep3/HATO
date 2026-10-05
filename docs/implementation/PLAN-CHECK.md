# Pemeriksaan paket planning

28 September 2026. Ini pemeriksaan dokumen, bukan bukti implementasi atau hasil test aplikasi.

## Hasil

- 18 kartu T00-T17, dengan dependensi, ruang lingkup file, langkah dan bukti selesai.
- 21 skenario acceptance A01-A21; seluruh referensi ID pada paket mengarah ke ID yang tersedia.
- 5 keputusan pengguna U01-U05 dipisahkan dari 36 keputusan implementasi D01-D36.
- Pemeriksaan otomatis ID duplikat/hilang dan tautan Markdown lokal: tidak menemukan kesalahan pada paket yang diperiksa.
- Dependensi ditinjau: tidak ada kartu yang membutuhkan implementasi kartu bernomor sesudahnya. Penggantian UI T11-T16 mengikuti adapter T10; T17 memverifikasi pergantian lengkap sebelum rilis.
- Entry point IMPLEMENTATION_PLAN lama diberi penunjuk ke paket terbaru. Riwayat perencanaan lama tetap tersimpan.

## Celah yang diperbaiki saat pemeriksaan

1. Target gabungan belum menentukan varian pembelian: tambahan dibagi manual, jumlah tiap kelompok harus cocok, dan snapshot rekap disimpan.
2. Edit order saat shortage berpotensi menolak pengurangan yang berguna: pemeriksaan kapasitas berlaku pada penambahan, sedangkan pengurangan tetap diperiksa terhadap pembayaran/distribusi.
3. Penutupan siklus berpotensi dilewati melalui edit/restore: semua penambahan alokasi setelah penutupan diblokir.
4. Retry create cycle belum punya row untuk dikunci: lock idempotency mendahului resource, unique weekKey menangani dua create berbeda.
5. Saldo lama belum memiliki bukti siap ledger: ledgerReconciledAt/By, nilai unknown dan pembatasan mutasi ditetapkan.
6. Adapter pembayaran dan layar baru belum selesai bersamaan: implementasi lokal bertahap; pergantian produksi satu paket setelah kedua client siap.
7. Penghapusan side effect GET dapat menghilangkan rotasi: inisialisasi dipindah ke mutasi persiapan siklus.
8. Pembulatan/quantity belum punya contoh tegas: A21 menetapkan hasil angka serta kegagalan input/range.

## Yang masih harus dibuktikan saat implementasi

T00 memeriksa versi resolved, caller aktual, pemetaan produk, identitas test DB, migration history dan akses autentikasi. T05 memeriksa data legacy; T17 memerlukan hasil perangkat fisik dan rekonsiliasi. Temuan tersebut dapat membatasi langkah tertentu, tetapi tidak perlu menanyakan ulang aturan bisnis yang sudah dijawab.

Tidak ada migrasi, deploy atau perubahan kode aplikasi dalam penyusunan paket ini. Semua kartu tetap TODO. Perubahan kode aplikasi yang sudah ada sebelum planning tetap pekerjaan existing, bukan hasil paket ini.
