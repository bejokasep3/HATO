# Status implementasi

Verifikasi pra-push 13 Oktober 2026: clean candidate lulus frozen-lockfile install, full web build, TypeScript native, 38 tes domain/kontrak/integrasi, dan export iOS/Android/web. Rollback Ranking/Laporan terkonfirmasi; artefak redesign ditolak dikeluarkan dari candidate. Review branch masih reviewable, bukan siap rilis produksi: database terhubung masih schema lama dan kontrak tab Ranking/Laporan yang dipulihkan belum cocok dengan schema operasional. Bukti: `evidence/2026-10-13-prepush.md`. Belum commit/push/deploy.

Pembaruan kalender 13 Oktober 2026: status waktu **Akan datang / Minggu ini / Berakhir** dihitung otomatis memakai WIB pada API dan web/mobile, dengan pembaruan layar setiap 15 detik. Dashboard default tidak lagi memilih minggu lama saat minggu baru belum dibuat. Periode berakhir tidak menghapus piutang atau menandai pengiriman selesai. Bukti: `evidence/2026-10-13-cycle-calendar.md`. Belum push/deploy.

Pembaruan 13 Oktober 2026: alur manual **Mulai minggu ini** ditambahkan pada web/mobile. Target diisi saat mulai; pesanan dapat dicatat sebagai jumlah tanpa harga pada minggu draf. Harga diisi kemudian dan seluruh tagihan dihitung atomik saat **Kunci harga & buka minggu**. Cron tetap nonaktif. Bukti dan batas pengujian: `evidence/2026-10-13-week-start.md`. Belum push/deploy; blocker produksi sebelumnya tetap berlaku.

Status kerja 30 September 2026: kandidat lokal reviewable dengan blocker eksplisit. Evidence T00-T04 di bawah adalah hasil sesi implementasi, bukan hasil review awal. Tidak ada deploy atau migrasi produksi.

Pembaruan 5 Oktober 2026: kandidat kode `106ae2c` pada branch `codex/hato-v2-review` lulus install frozen-lockfile, full `pnpm build` dari clone bersih (Next.js 16.3.8), typecheck web/mobile, 20/20 contract/domain tests, serta export iOS/Android/web (Expo 57.0.26). Lint tanpa error, tetapi masih ada 60 warning web/server pada file yang berubah dan 23 warning mobile. Build/commit bersih bukan lagi blocker; blocker data/auth/perangkat tetap terbuka. Bukti terkini: `evidence/2026-10-05-review-push.md`. Bukti browser 4 Oktober hanya mencakup scope Dashboard/Orders yang tercatat pada `anti-slop/fix-003-2026-10-04.md` dan `anti-slop/fix-004-2026-10-04.md`.

| Task | Status | Evidence | Langkah berikutnya |
|---|---|---|---|
| T00 | ACCEPTED | `evidence/T00-baseline.md`, `api-callers.md`, `product-mapping.md`, `data-readiness.md` | Katalog/cloud masih perlu bukti T05 |
| T01 | ACCEPTED | `evidence/T01-domain.md` | Pure domain dipakai services berikutnya |
| T02 | CODE_VERIFIED | `evidence/T02-mobile.md` | Uji iPhone/Android fisik DEVICE_PENDING |
| T03 | CODE_VERIFIED | `evidence/T03-auth.md` | Uji akun admin nyata/anon Data API masih NOT_RUN |
| T04 | CODE_VERIFIED | `evidence/T04-native-auth.md` | Uji login/refresh/logout pada perangkat fisik DEVICE_PENDING |
| T05 | CODE_VERIFIED | `evidence/T05-migration.md`, `data-readiness.md`, `product-mapping.md` | Rilis perlu baseline adoption, backup/restore dan saldo legacy terverifikasi |
| T06 | CODE_VERIFIED | `evidence/T06-cycles.md` | UI web/native dan auth nyata belum diverifikasi |
| T07 | CODE_VERIFIED | `evidence/T07-recap.md` | Race dengan order writer T08 belum diuji |
| T08 | CODE_VERIFIED | `evidence/T08-orders-inventory.md` | UI/caller dan akun nyata belum diverifikasi |
| T09 | CODE_VERIFIED | `evidence/T09-payments.md` | Saldo historis nyata belum direkonsiliasi |
| T10 | CODE_VERIFIED | `evidence/T10-readers.md`, `api-callers.md` | Ganti semua layar/caller lama pada T11-T16 |
| T11 | CODE_VERIFIED | `evidence/T11-web-operations.md` | Browser admin 1440/390 dan interaksi nyata masih NOT_RUN |
| T12 | CODE_VERIFIED | `evidence/T12-native-operations.md` | iPhone/Android fisik DEVICE_PENDING |
| T13 | CODE_VERIFIED | `evidence/T13-web-payments.md` | Browser admin 1440/390 dan auth/timeout nyata masih NOT_RUN |
| T14 | CODE_VERIFIED | `evidence/T14-native-payments.md` | iPhone/Android fisik dan sinkronisasi akun uji DEVICE_PENDING |
| T15 | CODE_VERIFIED | `evidence/T15-web-inventory-navigation.md` | Browser admin 1440/390 dan receipt nyata masih NOT_RUN |
| T16 | CODE_VERIFIED | `evidence/T16-native-inventory-navigation.md` | iPhone/Android fisik dan deep-link nyata DEVICE_PENDING |
| T17 | REVIEWABLE | `evidence/T17-release-candidate.md`, `release-runbook.md` | Tahan deploy sampai mapping, clone/reconciliation, auth nyata, visual web, dan dua perangkat lulus |

## Resume checkpoint

- 14 October: operational Ranking/Reports compatibility repaired while retaining restored layouts; 43 tests plus web build/native exports passed. Production application-data backup restored and migrated on a local clone with all original table contents preserved. Catalog mapping approved and tested on the clone. Password, historical payment attestation, hosted authorization and device acceptance remain pending. Latest evidence: `evidence/2026-10-14-release-preparation.md`.

- 13 October follow-up: ended operational weeks now allow manager late entry and pending-order corrections while retaining `Berakhir`; manually closed weeks remain locked. See `evidence/2026-10-13-ended-week-entry.md` for fresh checks and the pending Auth password change. Earlier pre-push evidence predates this behavior change.

- Task/substep saat ini: T17 kandidat rilis lokal sudah reviewable; deployment ditahan oleh blocker data/auth/perangkat yang tercatat.
- Files changed oleh implementasi: `shared/contracts`, `src/lib/domain`, `src/lib/auth`, `src/lib/supabase`, `src/proxy.ts`, route guards, login web/native, mobile API/adapters, manifests/lockfiles dan docs evidence. Perubahan cycles/page, cron automation, vercel dan PDF yang sudah ada saat T00 tetap dipertahankan; endpoint cron existing WIP kini fail-closed dan no-op.
- Tests run: pure/contract 18/18 PASS; integration migration 2/2, cycle 2/2, recap 1/1, orders 2/2, inventory 1/1, order-mutations 1/1, payments 1/1 dan readers 1/1 PASS pada fixture yang dibuat ulang per file; fresh deploy 3/3 migration dan legacy fixture migrate PASS; web/native TypeScript PASS; `next build` PASS final; Expo export iOS/Android/web PASS final T16. Baseline lint src 117 errors/33 warnings; lint file perubahan dan detector desain PASS.
- Belum terbukti: akun admin nyata/nonadmin, RLS/Data API tabel lama, browser 1440/390, uji perangkat fisik, clone backup nyata, migrasi produksi, saldo legacy, mapping produk final, dan transaksi end-to-end.
- Next exact action: pengguna menjalankan checklist web+iPhone+Android pada `release-runbook.md`, lalu menyetujui mapping produk dan hasil rekonsiliasi clone sebelum keputusan deploy.

Setiap akhir sesi ganti checkpoint di atas dengan keadaan sebenarnya. Jangan menghapus daftar failures/unverified ketika merangkum. Tidak menandai ACCEPTED hanya karena context/token hampir habis.
