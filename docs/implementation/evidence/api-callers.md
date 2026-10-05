# Inventaris API dan caller

Inventaris ini diverifikasi ulang pada T10. Reader v2 sudah tersedia, tetapi baris caller lama di bawah tetap dianggap rusak sampai kartu penggantinya selesai. T17 harus membuktikan hasil pencarian caller mutasi lama kosong.

| Endpoint/keluarga | Caller web | Caller mobile | Risiko transisi |
|---|---|---|---|
| `/api/cycles`, detail, prices, rotation | halaman siklus/dashboard/pesanan | tab utama, siklus, form pesanan | client v2 aktif T11/T12 |
| `/api/orders` GET/POST/PATCH/DELETE | halaman pesanan dan detail siklus | daftar/form pesanan | client v2 + ledger aktif T13/T14 |
| `/api/inventory`, summary, availability | halaman Barang/detail | lib/api dan tab Barang | draft/confirm v2 aktif T15/T16 |
| `/api/dashboard`, `/api/reports`, `/api/ranking` | dashboard/laporan/ranking | dashboard/laporan | reader v2 aktif; visual perangkat masih pending |
| `/api/members`, `/api/groups`, `/api/products` | halaman master dan input | lib/api dan form pesanan | data anggota/katalog perlu admin guard |
| `/api/cron/cycles` existing WIP | tidak ada caller browser | tidak ada | route tetap fail-closed/no-op |

## Caller mutasi lama

Tidak ada caller mutasi lama tersisa pada UI web/native. Audit T17 mengembalikan `NO_LEGACY_CALLERS` untuk toggle payment, perubahan status cycle generik, browser cron, PATCH inventory, dan PATCH/DELETE order lama. Route kompatibilitas yang menolak 409 tetap dipertahankan sebagai guard untuk client usang.

GET detail kini additive `{cycle, recap, operational}` dan tidak menulis status rotasi. Adapter legacy hanya menangani bentuk response reader lama yang masih diperlukan, bukan mutasi bisnis. Semua route bisnis sudah memakai guard admin; bukti akun nyata masih tertunda.
