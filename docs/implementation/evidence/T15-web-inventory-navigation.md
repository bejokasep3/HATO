# T15 — Barang web dan navigasi akhir

Status: CODE_VERIFIED; browser akun nyata masih NOT_RUN.

- `/inventory` kini menjadi tujuan Barang yang utuh: pilihan siklus, planned supplier per produk, input received/damaged/harga beli, catatan supplier, simpan draf, serta konfirmasi immutable.
- Ringkasan tidak menjumlahkan kg ayam dengan bungkus tahu. Kuantitas tetap terlihat per produk/satuan; ringkasan tingkat halaman memakai jumlah produk bermasalah dan nilai modal.
- Setelah receipt confirmed, form menjadi read-only dan kapasitas menampilkan stok fisik. Shortage/rusak tetap terlihat dengan angka dan teks, bukan warna saja.
- Distribusi menggunakan aksi seluruh pesanan berurutan: Menunggu → Siap dibagikan → Sudah keluar → Diterima. `Tandai keluar` diblokir sampai penerimaan dikonfirmasi.
- GET inventory sekarang mengembalikan item receipt draft/confirmed secara eksplisit sehingga reload tidak menghapus isian. Endpoint PATCH lama tetap menolak 409 dan receipt confirmed tetap immutable di service.
- Navigasi web memiliki empat tujuan utama: Dashboard, Pesanan, Piutang & Pembayaran, dan Barang. Siklus, Komunitas, Laporan, Katalog, serta Peringkat tetap tersedia sebagai menu pendukung.
- Pencarian caller lama untuk tab inventory, toggle pembayaran, status generik, cron browser, dan PATCH inventory kosong.
- Integration inventory 1/1 PASS. Integration order-mutations 1/1 PASS saat dijalankan sendiri; percobaan paralel awal berbenturan pada fixture DB yang sama dan menghasilkan deadlock setup, bukan kegagalan perilaku. TypeScript, ESLint area, `next build`, dan detector desain PASS.

Belum terbukti: browser 1440×900/390×844 dengan akun nyata, receipt data nyata, dan interaksi distribusi pada perangkat sentuh. Tidak ada transaksi pengguna atau deployment yang dilakukan.
