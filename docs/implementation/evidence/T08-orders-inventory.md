# T08 — pesanan, jatah, penerimaan, distribusi

Status: CODE_VERIFIED pada PostgreSQL lokal; web/native UI belum berpindah ke kontrak v2.

- POST pesanan kini menghitung harga dan total di server, memeriksa satuan (tahu bilangan bulat), periode Senin–Minggu, cutoff rekap Selasa, dan kapasitas per varian setelah rekap. Semua writer terkait memakai cycle row lock, version, idempotency dan audit. PATCH versi lama untuk paymentStatus/orderStatus dan DELETE ditolak 409.
- Edit menjaga snapshot harga item lama, menolak total di bawah pembayaran efektif, dan memeriksa delta jatah. Cancel/restore mempertahankan ID dan histori, menolak pesanan dibayar/sudah dikirim serta memeriksa jatah saat restore. Fulfillment satu langkah maju; shipped memerlukan receipt confirmed dan stok fisik.
- Penerimaan hanya dapat disimpan sebagai draf setelah rekap. `orderedQty` berasal dari rekap; semua item rekap harus dicatat saat confirm. Draf tidak mengubah kapasitas; confirmed memakai received minus damaged; shortage ditampilkan dan tidak disembunyikan. Receipt confirmed immutable.
- Integrasi: orders 2/2 PASS (dua order bersaing dan order vs recap), inventory 1/1 PASS (draft, missing item, shortage), order-mutations 1/1 PASS (edit/cancel/restore, pembayaran, stok fisik dan distribusi). TypeScript/lint area PASS, build Next PASS.

Masih perlu: uji endpoint dengan akun admin nyata dan perangkat, adaptasi semua caller lama T10-T16, serta audit performa query dengan data representatif. Tidak ada transaksi pengguna yang dibuat/diubah.
