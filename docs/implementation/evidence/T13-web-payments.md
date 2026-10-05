# T13 — pusat piutang dan pembayaran web

Status: CODE_VERIFIED; verifikasi visual dengan akun admin nyata masih NOT_RUN.

- `/payments` menampilkan seluruh piutang lintas siklus secara bawaan, total sisa yang diketahui, jumlah saldo lama yang belum diverifikasi, pagination, serta filter siklus dan sub-grup yang terlihat.
- Rincian pesanan menampilkan nilai pesanan, total dibayar, sisa, dan ledger lengkap. Form mendukung cicilan, metode pembayaran, catatan, serta tombol `Lunasi sisa`; pesanan lunas, dibatalkan, atau belum direkonsiliasi tidak menawarkan pembayaran baru.
- Pembalikan tidak menghapus ledger. Manajer wajib mengisi alasan, lalu saldo dan daftar piutang dimuat ulang dari server.
- Draf pembayaran disimpan per pesanan di local storage. Payload yang sama mempertahankan `Idempotency-Key` saat hasil request belum diketahui; perubahan nominal/metode/catatan membuat percobaan baru. Draf baru dibersihkan setelah respons sukses.
- Navigasi, dashboard, kartu pesanan, dan detail siklus kini menuju pusat pembayaran dengan konteks `cycleId`/`orderId`. Pencarian caller tidak menemukan toggle status pembayaran langsung.
- A09/A16 backend: integration payment 1/1 PASS pada PostgreSQL lokal terisolasi, termasuk cicilan, replay satu efek, dua pembayaran bersaing, reverse satu kali, dan piutang siklus tertutup.
- TypeScript PASS; ESLint pada file T13 PASS; `next build` PASS dan menghasilkan route `/payments`; detector antislop/impeccable PASS tanpa temuan.

`pnpm build` sempat gagal pada langkah `prisma generate` karena DLL query engine dikunci proses `next dev` yang sudah berjalan. Build aplikasi kemudian diverifikasi dengan `npx next build` memakai client Prisma yang sudah tergenerasi. Proses dev tidak dihentikan.

Belum terbukti: tampilan 1440×900 dan 390×844 dengan data akun nyata, timeout jaringan sesungguhnya, login kedaluwarsa ketika form terbuka, serta konsistensi lintas perangkat. Tidak ada transaksi pengguna atau database produksi yang disentuh.
