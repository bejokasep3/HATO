# Pemetaan produk untuk target

Katalog berikut dibaca dari koneksi aplikasi pada 28 September 2026 dalam transaksi read-only. Tidak ada nilai `targetGroup` pada database aplikasi karena kolom itu belum diterapkan. Kolom usulan adalah inferensi dari nama/satuan, **belum disetujui sebagai mapping final**.

| Produk aktual | Satuan | isTarget lama | Usulan targetGroup |
|---|---|---:|---|
| Ayam Recah | kg | true | AYAM |
| Ayam Karkas | kg | false | AYAM |
| Ayam Gebrus | kg | false | AYAM |
| Ceker ayam | kg | false | AYAM, perlu konfirmasi |
| Kepala ayam | kg | false | AYAM, perlu konfirmasi |
| Ati Ampela | kg | false | AYAM, perlu konfirmasi |
| Tahu Kuning | bungkus | true | TAHU |
| Tahu Putih | bungkus | true | TAHU |

Pengguna menetapkan target minggu awal 10 kg AYAM dan 10 bungkus TAHU, masing-masing gabungan semua varian, editable setiap siklus. `isTarget`/`targetQuantity=20` lama bukan sumber target baru. Target grup pada produk tetap null sampai mapping aktual disetujui; T06 harus fail-closed untuk rekap/order v2 jika produk aktif belum dipetakan. Produk non-target baru nantinya memakai `NONE` eksplisit.
