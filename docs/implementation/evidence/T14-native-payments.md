# T14 — pembayaran native

Status: CODE_VERIFIED + DEVICE_PENDING.

- Tab Pembayaran menampilkan total piutang diketahui, jumlah saldo lama yang belum diverifikasi, seluruh tagihan lintas siklus, serta filter siklus dan sub-grup.
- Rincian pembayaran dapat dibuka dari tab Pembayaran maupun kartu Pesanan. Layar menampilkan total/paid/outstanding, ledger aktif dan dibalik, cicilan, `Lunasi sisa`, metode bayar, catatan, serta pembalikan dengan alasan tertulis.
- Pesanan lunas tidak menampilkan form pembayaran; pesanan dibatalkan dan saldo `unverified` diberi penjelasan dan diblokir dari pembayaran baru. Input lebih besar dari outstanding ditolak di client dan tetap dijaga server.
- Draf pembayaran tersimpan per order melalui storage native. Payload yang sama memakai idempotency key yang sama setelah timeout/error; draf dibersihkan hanya setelah respons sukses. Adapter API mempertahankan retry auth bawaan ketika token 401.
- TypeScript mobile PASS. Expo export final PASS untuk iOS, Android, dan web; route `/payments` dan `/payments/[id]` ikut dibundel.

Belum terbukti: iPhone Expo Go, Android fisik, keyboard dan safe area, background/return, token kedaluwarsa saat draf aktif, timeout jaringan nyata, serta sinkronisasi transaksi dengan web memakai test account. Semua tetap DEVICE_PENDING; tidak ada transaksi pengguna yang dipakai untuk pengujian.
