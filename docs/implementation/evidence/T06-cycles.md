# T06 — layanan siklus

Status: CODE_VERIFIED pada database lokal, endpoint baru dibuild. UI lama belum dipindah sehingga kandidat ini tidak boleh di-deploy.

- `POST /api/cycles` kini menerima Senin dan target AYAM/TAHU eksplisit, membuat draf atomik, menyalin harga serta snapshot mapping untuk produk aktif, dan menyiapkan rotasi saat mutasi. Tidak lagi mengubah siklus lain menjadi `completed`.
- Endpoint `open`, `close`, `targets`, dan harga draft memakai admin auth, `Idempotency-Key`, `expectedVersion`, transaksi serializable, cycle row lock, audit. Pembukaan mensyaratkan harga dan mapping siap. Harga dibekukan setelah dibuka. Target nol diterima.
- Detail GET tidak lagi menulis rotasi. PATCH siklus lama ditutup dengan `CLIENT_UPDATE_REQUIRED`; mutasi rotasi lama ditolak pada siklus v2. Cron tetap no-op/fail-closed.
- `tests/integration/cycles.test.ts`: 2/2 PASS, mencakup key replay, payload berbeda, minggu duplikat, dua create bersamaan, harga belum siap, target nol, stale version, close, dan order lama tidak berubah. Prisma TypeScript, lint area layanan/siklus, Next build PASS.

Belum diuji: auth lewat akun nyata, kontrak UI web/native, Data API anon/authenticated, perangkat fisik. Mapping produk nyata harus disetujui dan diisi sebelum layanan siklus v2 dipakai pada database aplikasi.
