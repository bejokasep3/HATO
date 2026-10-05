# Runbook kandidat rilis HATO v2

Status: kandidat lokal untuk review. Dokumen ini tidak memberi izin migrasi atau deploy produksi.

## Identitas kandidat

- Repository/branch: `HATO`, `main`.
- Base commit yang diverifikasi: `2c5beafd7d0a63491593dc87e21e91314434cd6d`.
- Candidate kode: `106ae2c8922e2cf053a86c94a7f3c1f454369903`, branch `codex/hato-v2-review`; commit dokumentasi berikutnya mencatat hasil tanpa mengubah kode. Dua PDF kalender tidak disertakan.
- Web artifact terkini: `.next/` pada clone bersih `C:/Users/Komputer/AppData/Local/Temp/hato-review-20261005`, dibuat oleh full `pnpm build` dengan Next.js 16.3.8 pada 5 Oktober 2026.
- Native artifact terkini: `mobile/dist/review-20261005/` pada clone yang sama, Expo SDK 57.0.26, React Native `0.86.3`; iOS/Android/web lulus export.
- Bukti verifikasi terkini: `evidence/2026-10-05-review-push.md`. Build memakai placeholder konfigurasi, bukan kredensial/database nyata.
- Migration berurutan:
  1. `20260928113603_baseline`
  2. `20260928120000_operational_foundation`
  3. `20260928123000_payment_note`

## Penghambat sebelum produksi

Rilis tetap ditahan sampai seluruh poin ini selesai:

1. Manajer menyetujui mapping katalog nyata ke `AYAM`, `TAHU`, atau `NONE`, terutama produk jeroan/offal.
2. Saldo setiap order lama direkonsiliasi. `scripts/migration/backfill-fixture.ts` hanya untuk fixture sintetis dan dilarang dijalankan pada data pengguna.
3. Backup database nyata dipulihkan ke clone dan semua langkah di bawah lulus pada clone tersebut.
4. Login admin nyata, penolakan nonadmin, dan akses Data API anon/authenticated diuji.
5. Checklist iPhone Expo Go dan Android fisik lulus. Browser desktop 1440×900 dan web 390×844 juga belum diuji visual.
6. PASS pada 5 Oktober 2026: candidate commit dibuat dari file HATO yang masuk scope dan full build diulang dari clone bersih. Ulangi bila kode atau dependency berubah; perubahan dokumentasi saja tidak memerlukan build ulang.

## Persiapan clone data

Gunakan URL clone eksplisit; jangan memuat `.env` aplikasi secara diam-diam.

```powershell
$env:DATABASE_URL='<CLONE_DATABASE_URL>'
$env:DIRECT_URL='<CLONE_DIRECT_URL>'
```

Catat label project/host dan waktu backup. Ambil angka sebelum migrasi:

```sql
select count(*) as cycles from cycles;
select count(*) as orders, coalesce(sum(total_amount),0) as order_total from orders;
select payment_status, count(*), coalesce(sum(total_amount),0)
from orders group by payment_status order by payment_status;
select count(*) as receipts from goods_receipts;
```

Database aplikasi yang diperiksa sebelumnya belum memiliki `_prisma_migrations`. Pada clone saja, bandingkan schema lama dengan migration baseline. Jika sama, adopsi baseline lalu deploy migration additive:

```powershell
npx prisma migrate resolve --applied 20260928113603_baseline
npx prisma migrate deploy
npx prisma migrate status
npx prisma migrate diff --from-url $env:DIRECT_URL --to-schema-datamodel prisma/schema.prisma --exit-code
```

Hentikan proses bila diff tidak kosong, count order berubah, total order berubah, atau migration meminta reset.

## Rekonsiliasi saldo lama

Ekspor daftar order lama dengan `payment_status`, `paid_at`, dan `total_amount`. Manajer harus menandai tiap order sebagai salah satu dari:

- saldo terverifikasi dan lunas;
- saldo terverifikasi dengan nominal cicilan yang diketahui;
- saldo belum dapat dipastikan.

Order kategori terakhir tetap memakai `ledger_reconciled_at = null`; UI menampilkan `Belum diverifikasi` dan tidak memasukkannya ke total piutang diketahui. Script rekonsiliasi produksi harus dibuat dari daftar yang sudah disetujui, dijalankan idempotent pada clone, dan menghasilkan satu audit event per keputusan. Bandingkan total ledger efektif dengan angka yang disetujui sebelum melanjutkan.

## Verifikasi clone

Jalankan pemeriksaan kode dari checkout bersih:

```powershell
pnpm install --frozen-lockfile
pnpm build
npx tsc --noEmit -p mobile/tsconfig.json
Set-Location mobile
npx expo export --platform all --output-dir dist/release-candidate
```

Dengan akun uji pada clone, lakukan alur berikut:

1. Login admin berhasil; nonadmin ditolak.
2. Buat siklus Senin–Minggu dengan target 10 kg ayam dan 10 bungkus tahu.
3. Isi harga, buka siklus, input dua pesanan, dan konfirmasi rekap Selasa.
4. Coba order setelah rekap: diterima bila jatah varian cukup dan ditolak bila kurang.
5. Catat cicilan, `Lunasi sisa`, lalu balikkan satu pembayaran dengan alasan. Web dan ponsel harus menunjukkan saldo sama setelah refresh.
6. Simpan draf barang datang, catat rusak/shortage, lalu konfirmasi. Form harus menjadi read-only.
7. Jalankan distribusi satu order sampai `Diterima`; stok fisik tidak boleh berkurang dua kali.
8. Tutup siklus; pembayaran lama tetap dapat dicatat dan piutang tetap muncul lintas minggu.

## Checklist perangkat

Catat model, versi OS, versi Expo Go, koneksi API, dan hasil tiap perangkat.

- iPhone: buka form order/payment/barang, tampilkan keyboard, background 30 detik, kembali, lalu submit. Draf dan idempotency key harus tetap ada.
- Android: ulangi alur yang sama, termasuk decimal comma `1,5`, scroll sampai tombol simpan, dan back navigation.
- Uji deep link `/inventory`, `/cycles`, dan `/payments/<order-id>`; setiap tujuan harus membuka state yang sama dengan tab/menu.
- Verifikasi empat tab: Minggu Ini, Pesanan, Barang, Pembayaran. Siklus/Anggota/Laporan harus dapat dibuka dari tombol Lainnya di header.

## Deploy dan rollback

Deploy hanya setelah ada instruksi produksi yang menyebut environment secara spesifik dan seluruh blocker di atas sudah ditutup. Urutan rilis: backup teruji → migration clone PASS → migration produksi → deploy web → publish/update mobile → smoke test read-only → transaksi uji yang disetujui.

Migration ini additive. Rollback normal adalah mengembalikan kode aplikasi ke commit sebelumnya sambil mempertahankan tabel/kolom baru. Jangan drop ledger, audit, target, recap, atau receipt untuk rollback kode. Bila migration merusak data atau count/total berubah, hentikan write dan pulihkan backup ke instance pengganti; jangan mencoba memperbaiki produksi dengan `db push` atau reset.
