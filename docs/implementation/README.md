# Paket implementasi HATO untuk Sol

Revisi 1, 28 September 2026. Status: SIAP UNTUK MULAI T00, bukan izin migrasi/deploy produksi. Paket ini ditulis setelah review kode dan keputusan pemilik pada chat yang sama.

## Mulai di sini

1. Baca `AGENTS.md` root dan `mobile/AGENTS.md` bila menyentuh mobile.
2. Baca file ini, lalu `RULES.md`.
3. Buka `TASKS.md`; kerjakan satu kartu READY paling awal. Status awal semua TODO; T00 satu-satunya yang langsung READY.
4. Baca hanya bagian `DATA-API.md` dan `ACCEPTANCE.md` yang dirujuk kartu tersebut.
5. Catat hasil dalam `STATUS.md`. Prompt siap salin ada di [HANDOFF.md](HANDOFF.md). Hasil pemeriksaan planning ada di [PLAN-CHECK.md](PLAN-CHECK.md).

Urutan otoritas: instruksi terbaru pengguna > paket implementasi ini > `docs/rancangan-operasional-2026-09-28.md` > laporan review. PRD, TECHNICAL_SPEC, USER_STORIES dan isi lama IMPLEMENTATION_PLAN adalah referensi historis, bukan perintah untuk membangun ulang aplikasi atau memakai target tetap 20.

## Tujuan rilis

Satu manajer dapat menjalankan siklus Senin-Minggu dengan target berbeda per minggu, rekap supplier Selasa, barang datang Kamis, pesanan tambahan dibatasi ketersediaan, serta pembayaran cicilan lintas minggu. Input tetap manual. Web, iPhone Expo Go dan Android memakai aturan serta angka yang sama.

Sasaran UX: tidak memilih ulang siklus setiap input; dapat memasukkan 10 order berurutan; bayar/edit terlihat pada lebar HP tanpa geser tabel; draft bertahan ketika koneksi gagal. Sasaran ini adalah acceptance, belum hasil yang telah dicapai.

## Batas eksekusi

- Data pengguna nyata. Tidak seed/reset/db push/migrate pada koneksi yang belum dibuktikan sebagai lingkungan uji. Jangan mencetak connection string, token, password atau isi data pribadi ke laporan.
- Permintaan sekarang adalah perbaikan planning. Eksekusi kode dimulai setelah pengguna memulai handoff implementasi. Tidak membuat chat/delegasi baru atau mengganti model secara otomatis.
- Perubahan aplikasi dikerjakan lokal; tidak push/deploy, publish OTA, mengirim WA, atau menerapkan migrasi produksi hanya berdasarkan paket ini.
- Jangan mengubah Next.js, React, Expo SDK, ORM atau package manager dalam pekerjaan ini. Manifest saat review: Next 16.3.4, Prisma ^6.4.1, Expo ~57.0.22. T00 memverifikasi versi terpasang/lockfile; manifest bukan bukti versi resolved.
- Gunakan Next docs pada `node_modules/next/dist/docs/` dan Expo docs v57 sebelum kode terkait. Baca skill Supabase untuk database/auth, Expo overview untuk native. Antislop sudah dipilih AFTER; jangan menanyakan waktunya ulang. Pertahankan emerald/slate dari DESIGN.md.
- Jangan menjalankan dua kartu yang mengubah schema/API sama secara bersamaan. Tidak perlu subagen untuk menjalankan paket ini.
- Rilis bisnis baru merupakan satu cutover terkoordinasi: schema, server dan kedua client harus kompatibel. Selesai satu kartu tidak berarti boleh deploy parsial.

## Lingkup minimum

Termasuk login satu admin, kontrak API, target per siklus, snapshot rekap, batas jatah per produk, penerimaan dan distribusi seluruh order, cicilan per order, koreksi pembayaran tercatat, draf lokal, input cepat, navigasi empat area dan laporan yang konsisten.

Ditunda: login PJ/anggota, OCR/AI WhatsApp, gateway pembayaran, pembayaran gabungan lintas order, refund/saldo titipan, retur, carry-over otomatis, pengiriman parsial per item, penerimaan beberapa batch, offline sync penuh, upgrade framework, redesign warna. Jika data nyata ternyata sudah membutuhkan fitur yang ditunda, hentikan hanya migrasi/alur yang terdampak dan catat contoh minimal; jangan mengarang pengganti.

## Mengapa paket lama diperketat

| Celah sebelumnya | Ketetapan sekarang |
|---|---|
| Saran besar tanpa unit kerja | T00-T17, dependensi dan bukti selesai tiap kartu |
| Ditutup vs selesai ambigu | Period state dipisah dari distribusi/pembayaran |
| Target berubah sesudah rekap | Target live dan target snapshot rekap berbeda; jatah tidak berubah |
| Persediaan dihitung dua kali | Rumus alokasi per produk dan contoh uji eksplisit |
| Transaksi bersamaan belum dirancang | Urutan lock, versi dan idempotency ditetapkan |
| Cicilan pada data lama belum jelas | Laporan rekonsiliasi dan sumber saldo legacy wajib |
| Mobile lolos TS tetapi respons salah | Response schemas, adapters dan contract tests |
| Rencana lama masih Next 14/target 20 | Entry point lama diberi penunjuk paket ini |

## Penutupan setiap kartu

Status yang diizinkan: TODO, IN_PROGRESS, CODE_VERIFIED, DEVICE_PENDING, BLOCKED, ACCEPTED. CODE_VERIFIED bukan verifikasi perangkat fisik atau izin produksi. ACCEPTED memerlukan seluruh bukti kartu, tanpa klaim menggantikan persetujuan rilis pengguna.

READY adalah kondisi dependensi, bukan status tambahan. Dependensi implementasi dapat dilanjutkan setelah CODE_VERIFIED jika bukti yang dibutuhkan kartu berikutnya sudah ada; catat DEVICE_PENDING di evidence tanpa menahan pekerjaan kode independen. T17 tetap memerlukan bukti perangkat. Kartu dengan integrasi DB belum terbukti tidak dianggap memenuhi dependensi transaksi/migrasi hanya karena typecheck lulus.

Jika test gagal karena perubahan sendiri, perbaiki lalu retest terarah. Dua percobaan dengan error sama: berhenti mencoba cara acak, tulis penyebab/bukti dan langkah terkecil berikutnya. Jangan menghabiskan sesi memperbaiki semua lint historis.

## Sumber teknis

- [Supabase SSR](https://supabase.com/docs/guides/auth/server-side/creating-a-client?queryGroups=framework&framework=nextjs): verifikasi identitas server; gunakan integrasi cookie/refresh yang sesuai versi.
- [Supabase React Native](https://supabase.com/docs/guides/auth/quickstarts/react-native): pengelolaan sesi native.
- [Expo SDK 57](https://docs.expo.dev/versions/v57.0.0/): kompatibilitas native.
- [Prisma transaksi v6](https://www.prisma.io/docs/orm/v6/prisma-client/queries/transactions): transaksi/concurrency; verifikasi contoh terhadap versi resolved sebelum implementasi.

Changelog Supabase dibaca pada review planning; perubahan minor PostgreSQL September 2026 tidak menjadi alasan melakukan upgrade database di task ini. T00 mencatat versi/extension relevan jika akses read-only tersedia.
