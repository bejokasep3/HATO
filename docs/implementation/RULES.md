# Aturan bisnis dan keputusan implementasi

Label U = keputusan eksplisit pengguna. Label D = keputusan teknis/UX agent untuk milestone ini, bukan klaim pengguna pernah memilih detail tersebut. Sol mengikuti D agar tidak mendesain ulang di tengah tugas. Konflik D dengan data nyata dicatat dan dibawa ke review; jangan mengubah U.

## Kalender dan status

- U01: satu manajer; input manual; data nyata; web + Android + iPhone, utama iPhone Expo Go.
- U02: periode Senin-Minggu; rekap Selasa; penerimaan Kamis. Order tambahan setelah rekap hanya bila barang minggu itu cukup.
- D01: tanggal kalender sebagai `YYYY-MM-DD`, zona bisnis Asia/Jakarta. Instant tersimpan UTC dan ditampilkan WIB. Batas akhir eksklusif Senin berikutnya 00.00 WIB; jangan memakai zona default mesin.
- D02: tambahkan `periodEnd` (tanggal Minggu) dan `supplierDeadline` (Selasa). Jangan mengganti makna kolom legacy `orderDeadline` secara diam-diam. Semua UI baru membaca nama tanggal baru; adapter legacy dipertahankan hingga cutover.
- D03: `periodState = draft | open | closed`, nullable untuk record legacy. `draft -> open` lewat konfirmasi target/harga; `open -> closed` manual dengan ringkasan. Setelah closed atau batas minggu, order baru, restore dan kenaikan quantity ditolak meski cron belum berjalan. Pengurangan/cancel yang memenuhi aturan pembayaran/distribusi tetap boleh untuk menyelesaikan shortage. Pembayaran, penerimaan dan distribusi existing tetap diperbolehkan sesudah period closed.
- D04: state rekap berasal dari keberadaan SupplierRecap yang confirmed; state penerimaan dari GoodsReceipt; distribusi dari order. Jangan memetakan `completed` legacy menjadi lunas. Minggu baru tidak menyelesaikan minggu lama secara otomatis.
- D05: setelah Selasa berakhir tanpa rekap confirmed, blok order baru/penambahan quantity dengan `RECAP_REQUIRED`. Aksi confirm recap tetap tersedia untuk pemulihan. Tidak ada jam cutoff Selasa tambahan; default akhir tanggal Selasa WIB. Rekap lebih awal langsung mengaktifkan batas jatah.
- D06: reopen periode lama, edit shipment yang sudah keluar, dan koreksi histori kompleks ditunda. Tolak dengan penjelasan; jangan memakai toggle bebas.

## Target dan pembelian

- U03: target per minggu editable. Nilai awal saat ini ayam 10 kg, tahu 10 bungkus. Target adalah gabungan varian dalam tiap kelompok.
- U04: pembelian minimal target atau sebesar order jika lebih besar.
- D07: kelompok AYAM/TAHU/NONE eksplisit. Jangan klasifikasi dengan substring nama. T00 menghasilkan tabel mapping produk untuk dicek; bagian ayam selain varian yang sudah jelas jangan diasumsikan ikut target tanpa keputusan. Snapshot mapping/unit pada harga siklus menjaga histori dari perubahan katalog.
- D08: setiap siklus baru harus mendapat target dari input/konfirmasi manajer. Angka awal 10 hanya default form; server menolak target yang tidak dikirim, bukan diam-diam mengisi 10. Target nol = Tidak ditargetkan; tidak ada pembagian nol.
- D09: `demand` = jumlah item order aktif yang tidak batal, terlepas lunas atau belum. Draft form lokal tidak dihitung. Quantity dua jenis harga pada produk sama dijumlahkan untuk stok/target.
- D10: per kelompok, usulan pembelian = max(target, demand saat confirm recap). Tiap baris produk minimal memenuhi demand produk itu. Tambahan sampai target dibagi manual ke varian; jumlah baris kelompok harus sama dengan usulan. Produk NONE dibeli sesuai demand dalam milestone ini.
- D11: `progress = demand / target * 100`, boleh >100. Kekurangan = max(0,target-demand), kelebihan = max(0,demand-target). Angka 140% tidak ditampilkan sebagai 100%, meskipun bar visual dibatasi lebarnya.
- D12: confirm recap dilakukan dalam transaksi sambil memeriksa versi siklus dan demand terbaru. Snapshot produk, quantity, unit, nama, kelompok dan target tidak berubah sesudah confirm. Tombol Salin WA tidak otomatis berarti rekap sudah dikonfirmasi/dikirim.
- D13: edit target menaikkan version dan mencatat old/new/reason. Sebelum recap, usulan berubah; setelah recap, tampilkan perbedaan target baru dengan rencana yang sudah dikonfirmasi, tanpa menambah jatah atau mengirim rekap ulang. Histori minggu lain tidak berubah.

## Jatah, penerimaan dan distribusi

- D14: satu recap confirmed dan satu penerimaan utuh per siklus pada milestone ini; model existing satu GoodsReceipt dipertahankan. Receipt draft tidak memengaruhi stok. Saat confirm receipt, setiap produk recap harus ada, termasuk yang diterima nol. Produk ekstra wajib ditambahkan eksplisit.
- D15: `receivedQty` berarti total diterima termasuk yang rusak; `0 <= damagedQty <= receivedQty`. Layak = receivedQty - damagedQty. Ini definisi baru yang wajib direkonsiliasi dengan data legacy; jangan mengubah angka lama berdasarkan dugaan.
- D16: sebelum receipt confirmed, kapasitas C produk = quantity recap produk; sumber `planned`. Sesudah receipt confirmed, C = quantity layak aktual; sumber `received`. Nol tetap nol, tidak kembali ke target. Produk yang absen pada receipt confirmed berkapasitas nol dan dicatat sebagai anomaly bila seharusnya ada.
- D17: A = seluruh quantity order aktif produk, termasuk yang sudah dikirim. Jatah bebas = C - A; bila negatif simpan/tampilkan shortage = A-C, sementara availableToOrder = max(0,C-A). Jangan menyembunyikan shortage karena clamp tampilan.
- D18: D = quantity order dengan status shipped/delivered, full-order saja. Fisik belum keluar = layak-D. Reserved = A-D. Rumus sama: fisik-reserved = layak-A. Jangan mengurangi D dua kali. `shipped -> delivered` tidak mengurangi stok lagi.
- D19: sebelum recap dan sebelum cutoff, order tidak dibatasi stok karena masih pengumpulan demand. Sesudah recap, order baru/edit harus memeriksa per varian, bukan total kelompok. Untuk kenaikan/alokasi baru, edit mengecualikan alokasi order itu sendiri: C-(A-oldQty) >= newQty. Quantity yang tetap atau berkurang tidak ditolak hanya karena shortage existing; tetap periksa pembayaran/distribusi. Swap varian diperiksa semuanya atomik, dengan pemeriksaan kapasitas pada setiap varian yang bertambah.
- D20: receipt kurang dari alokasi boleh dicatat sebagai kenyataan dan menghasilkan shortage. Saat shortage, larang alokasi baru/kenaikan; pengurangan order tetap boleh jika tidak melanggar pembayaran/distribusi. Distribusi full-order hanya boleh bila receipt confirmed dan barang fisik cukup; manajer menentukan order mana yang didahulukan.
- D21: cancel hanya order belum shipped/delivered dan effectivePaid=0. Gunakan cancelledAt + alasan; jangan DELETE. Pembatalan melepaskan reserved quantity, bukan menambah receipt. Order dibayar memerlukan koreksi pembayaran dahulu; order sudah keluar membutuhkan retur yang di luar milestone.
- D22: satu order per anggota per siklus tetap berlaku. Order batal tidak dihapus untuk menghindari unique conflict. Pengaktifan ulang hanya melalui aksi restore tercatat atas order yang sama dan pemeriksaan jatah/harga; riwayat lama tetap ada.
- D23: tidak ada substitusi produk, carry-over atau tambahan pembelian otomatis. Stok sisa di akhir minggu tetap ditampilkan sebagai belum ditangani, tidak dimusnahkan atau dipindahkan secara fiktif. Butuh aturan baru sebelum fungsi transfer/retur diimplementasi.

## Harga dan cicilan

- U05: cicilan diperbolehkan; piutang dapat berlanjut setelah siklus ditutup.
- D24: nilai uang dihitung dengan Decimal, bukan float JS. Presisi uang 2 desimal mengikuti schema existing. Harga x quantity dibulatkan half-up per baris ke 2 desimal, total = jumlah subtotal. Jangan mengubah total order lama saat migrasi. Tampilan menampilkan pecahan bila ada agar saldo kecil tidak tersembunyi.
- D25: quantity maksimal 2 desimal; ayam kg boleh pecahan, tahu bungkus bilangan bulat. Produk lain mengikuti metadata satuan eksplisit. Tolak NaN, Infinity, negatif, lebih dari presisi/range kolom. Harga <=0 diblok dalam milestone; transaksi gratis di luar scope.
- D26: client tidak menetapkan unitPrice/subtotal/total. Server mengambil harga siklus. Item existing mempertahankan snapshot harga saat quantity diedit. Item baru atau perubahan priceType memakai harga siklus saat perubahan; preview harus menunjukkan perbedaannya. Tanpa harga terdefinisi, tolak `PRICE_NOT_READY`.
- D27: satu Payment = satu nominal positif untuk satu order. EffectivePaid = jumlah Payment yang tidak reversed. Outstanding = totalAmount-effectivePaid. Status unpaid/partial/paid diturunkan, bukan field bebas yang bisa ditulis client.
- D28: nominal > outstanding ditolak; saldo titipan/refund/gabungan lintas order ditunda. Pembayaran tidak bergantung periodState. Catat metode cash/transfer/other dan waktu pembayaran yang diisi admin (default sekarang); actor/createdAt diisi server.
- D29: reverse satu Payment hanya sekali, dengan alasan, server actor/time, dan audit; jangan hapus pembayaran. Reverse mengurangi EffectivePaid sehingga utang muncul lagi. Reverse adalah koreksi pencatatan, bukan perintah transfer uang.
- D30: edit order sehingga total baru < effectivePaid ditolak. Payment dan edit total harus lock order yang sama agar tidak melewati pemeriksaan bersamaan.
- D31: legacy paid bukan bukti rincian cicilan. Backfill satu `legacy_opening_balance` hanya setelah rekonsiliasi; paidAt yang null tetap unknown, bukan waktu migrasi. Legacy unpaid mungkin punya cicilan yang belum tercatat, sehingga saldo harus diverifikasi sebelum dipakai sebagai piutang final.

## UX yang tidak perlu ditanyakan ulang

- D32: empat tujuan utama Minggu Ini/Pesanan/Barang/Pembayaran; area pendukung Lainnya. Gunakan nama rute existing bila sesuai, redirect lama dipertahankan. Dashboard dan order membawa cycleId; Pembayaran default seluruh piutang dengan filter eksplisit.
- D33: form native full-screen, quantity keyboard numerik, harga/total terlihat, simpan memperhitungkan keyboard/safe area. Web desktop tabel; web HP kartu. Jangan menambahkan library UI baru bila komponen existing cukup.
- D34: pilih anggota secara eksplisit, quantity awal kosong. Simpan & berikutnya mempertahankan siklus saja. Draf terikat admin+cycle+schemaVersion, tidak dikirim otomatis; logout menghapus draft/token lokal. Setelah resume, refresh harga/jatah sebelum submit.
- D35: ketika network outcome belum diketahui, tombol Retry memakai idempotency key yang sama. Jangan membuat key baru untuk retry request yang sama. 409 versi berubah mempertahankan input untuk review, bukan menimpa server secara otomatis.
- D36: visible error + retry, loading dan empty berbeda; screen reader labels, fokus dialog dan Escape web. Antar-screen native refresh saat kembali aktif. Tidak ada klaim device PASS dari browser.
