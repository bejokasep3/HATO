# T16 — Barang dan navigasi native

Status: CODE_VERIFIED + DEVICE_PENDING.

- Bottom tab kini tepat empat: Minggu Ini, Pesanan, Barang, dan Pembayaran. Tombol `Lainnya` tersedia di header semua tab untuk membuka Siklus/Target/Rekap, Komunitas, dan Laporan.
- Route lama `/cycles`, `/cycles/[id]`, dan `/inventory` tetap dibundel. Layar Barang hanya memiliki satu route implementation di tab group sehingga tidak ada dua state penerimaan yang berbeda.
- Barang native setara web: pilihan siklus, planned per produk, input received/damaged/harga beli, catatan supplier, draft persistent, konfirmasi immutable, shortage/rusak, dan fulfillment seluruh order secara berurutan.
- Draf penerimaan tersimpan per siklus melalui storage native dan mempertahankan idempotency key untuk payload sama setelah hasil request tidak diketahui. KeyboardAvoidingView, scroll, touch target minimal 44 px, dan padding bawah diterapkan.
- Ringkasan tidak mencampur kg dengan bungkus. Kuantitas tetap tampil per produk dan satuan; ringkasan hanya menghitung jumlah produk dan nilai modal.
- TypeScript mobile PASS. Expo export final PASS untuk iOS, Android, dan web; route `/inventory`, `/cycles`, `/more`, `/payments`, dan `/payments/[id]` ikut dibundel.

Belum terbukti: iPhone Expo Go, Android fisik, keyboard/safe area nyata, background/return, deep link dari luar aplikasi, token kedaluwarsa saat draf aktif, serta receipt/fulfillment lintas web-native dengan akun uji. Semua tetap DEVICE_PENDING.
