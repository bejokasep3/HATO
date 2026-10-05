# T17 — bukti kandidat rilis

Status: REVIEWABLE dengan blocker data/auth/perangkat. Belum deployed dan belum layak dinyatakan release-ready.

## Identitas dan lingkungan

- Base commit: `2c5beafd7d0a63491593dc87e21e91314434cd6d`, branch `main`; candidate commit belum dibuat.
- PostgreSQL lokal terisolasi 18.3, data directory bertanda `hato-test-pg-*`, loopback port 55441.
- `hato_test`: legacy fixture sintetis; sebelum migration 2 cycle/1 order/Rp100.000. Setelah migration+rekonsiliasi: count/total order tetap 1/Rp100.000, satu opening payment; setelah test cycle jumlah cycle menjadi 4 tetapi order/total legacy tetap sama.
- `hato_release_verify`: fresh deploy 3 migration, 0 cycle, 0 order; `migrate status` up-to-date dan schema diff `No difference detected`.
- Web: Next.js 16.3.4, artifact `.next/`. Native: Expo `~57.0.22`, React Native `0.86.3`, artifact `mobile/dist/t16-final/`.
- `.env` memiliki nama variabel Supabase dan `HATO_ADMIN_USER_ID`; nilai tidak dicetak. Identitas akun dan login nyata belum diuji.

## Hasil otomatis

- Pure/contract: 18/18 PASS.
- Migration legacy: 2/2 PASS setelah reset fixture; backfill sintetis dijalankan dua kali dan tetap satu efek.
- Cycle: 2/2 PASS.
- Recap supplier: 1/1 PASS.
- Orders/concurrency: 2/2 PASS.
- Inventory: 1/1 PASS.
- Edit/cancel/restore/fulfillment: 1/1 PASS.
- Payments/concurrency/reversal: 1/1 PASS.
- Operational readers: 1/1 PASS.
- Root TypeScript PASS; mobile TypeScript PASS; ESLint file T13–T16 PASS; `git diff --check` PASS.
- `npx next build` PASS dan menghasilkan 27 page/API routes termasuk `/payments` dan `/inventory`.
- Expo export iOS/Android/web PASS dan menghasilkan route `/inventory`, `/cycles`, `/more`, `/payments`, dan `/payments/[id]`.
- `impeccable detect src/` PASS tanpa output. Nol temuan detector tidak menggantikan review visual.
- Audit caller lama: `NO_LEGACY_CALLERS` untuk toggle payment, status cycle generik, browser cron, PATCH inventory, serta PATCH/DELETE order lama pada UI web/native.

Percobaan integration gabungan awal gagal karena file test berbagi database dan menambah produk satu sama lain. Final run membuat ulang `hato_recap` dari migration sebelum setiap file; seluruh test lulus independen. Percobaan `pnpm build` sebelumnya berhenti di `prisma generate` karena DLL Prisma dikunci proses `next dev` yang sudah berjalan. Proses tersebut tidak dihentikan; `npx next build` lulus dengan client yang sudah tergenerasi. Full build dari checkout bersih tetap wajib sebelum rilis.

## Coverage acceptance

| IDs | Status | Batas bukti |
|---|---|---|
| A01–A10 | PASS otomatis | Perilaku domain dan integration lokal; belum UI/perangkat nyata |
| A11 | PARTIAL | Fail-closed/config/cookie gate PASS; admin/nonadmin nyata dan Data API raw NOT_RUN |
| A12–A17 | PASS pada fixture lokal | Clone backup data nyata dan rekonsiliasi saldo belum dilakukan |
| A18 | PARTIAL | Idempotency/replay serta penyimpanan draf ada; timeout, auth expired, background, ganti perangkat NOT_RUN |
| A19 | PARTIAL | Guards kode/type/build PASS; 10 input berurutan dan duplicate UX nyata NOT_RUN |
| A20 | NOT_RUN | Desktop 1440×900, web 390×844, iPhone dan Android fisik belum diperiksa |
| A21 | PASS otomatis | Exact money/quantity contract; keyboard decimal perangkat tetap NOT_RUN |

## Blocker keputusan rilis

1. Mapping produk nyata, terutama offal, belum disetujui manajer.
2. Saldo historis nyata belum direkonsiliasi dan migration belum diuji pada clone backup nyata.
3. Login admin/nonadmin serta RLS/Data API nyata belum diverifikasi.
4. Uji visual web dan perangkat fisik belum dilakukan; versi OS/Expo Go belum tersedia.
5. Candidate commit bersih dan full `pnpm build` dari checkout bersih belum ada.

Runbook tindakan dan rollback: `docs/implementation/release-runbook.md`.
