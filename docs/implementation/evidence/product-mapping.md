# Pemetaan produk untuk target

Katalog dibaca ulang pada 13 Oktober 2026 dalam transaksi read-only. Pengguna menyetujui bahwa hanya Recah, Karkas, dan Gebrus dihitung dalam target ayam. Mapping berikut telah diuji pada clone lokal hasil backup; belum diterapkan pada produksi.

| Produk aktual | Satuan | isTarget lama | Usulan targetGroup |
|---|---|---:|---|
| Ayam Recah | kg | true | AYAM |
| Ayam Karkas | kg | false | AYAM |
| Ayam Gebrus | kg | false | AYAM |
| Ceker ayam | kg | false | NONE |
| Kepala ayam | kg | false | NONE |
| Ati Ampela | kg | false | NONE |
| Tahu Kuning | bungkus | true | TAHU |
| Tahu Putih | bungkus | true | TAHU |

Target diisi manajer setiap siklus; `isTarget`/`targetQuantity=20` lama bukan sumber target baru. Recah/Karkas/Gebrus memakai AYAM dengan dua desimal kg; Kuning/Putih memakai TAHU dengan jumlah bungkus bulat. Ceker/Kepala/Ati Ampela tetap dapat dipesan sebagai NONE dengan dua desimal kg. Script `scripts/migration/approved-hato-catalog.sql` menolak katalog yang berubah dari delapan nama/satuan yang disetujui, lalu memperbarui hanya mapping dan skala kuantitas produk aktif. Harga dan pesanan historis tidak diubah oleh script.
