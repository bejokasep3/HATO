# T10 — reader, adapter dan inventaris caller

Status: CODE_VERIFIED lokal. Layar lama belum dinyatakan bekerja dan tercatat untuk T11-T16.

- Dashboard dan detail operasional membaca target `CycleTarget`, snapshot kelompok produk, pesanan aktif, payment ledger dan receipt terkonfirmasi. Tidak ada target tetap 20, stok sintetis, atau inferensi lunas dari `paidAt`/status lama.
- Angka keuangan bernama `orderValue`, `receivedPayments`, `knownOutstanding` dan `purchaseValue`. Saldo legacy tetap `unverified`; harga beli yang tidak diketahui tetap `null`. Laporan tidak menyebut laba/HPP final.
- Reader availability per produk membedakan `planned`, `received`, dan `unknown`; jumlah lintas kg/bungkus tidak dijumlahkan menjadi satu stok.
- GET orders menambahkan `paymentSummary`; GET cycle menambahkan ledger totals dan unknown count; detail cycle menambahkan `operational`. GET detail tidak mengubah rotation.
- Adapter web/native mengirim `X-Hato-Client: 2`, membuat idempotency key untuk mutasi, dan membaca error code/request id. Native methods untuk availability, recap, cicilan, piutang, open dan close tersedia.
- Reader integration 1/1 PASS: target 10 kg/10 bungkus, demand per grup, cicilan Rp30.000 dari nilai pesanan Rp70.000 dan sisa Rp40.000 konsisten pada summary/dashboard/report. MutationRequest dan AuditEvent tidak bertambah selama lima reader berjalan.
- TypeScript web/native PASS; lint area T10 PASS; Next production build PASS.

Catatan uji regresi: integration services pada `hato_recap` lulus saat dijalankan per fixture. Upaya menjalankan seluruh folder dengan satu database sengaja tidak dijadikan bukti karena `cycles.test`/`migration.test` memakai database fixture `hato_test` yang berbeda; migration exact-count juga menjadi stateful setelah cycle test menambah data. T10 memakai test database terisolasi dan tidak menyentuh database aplikasi.
