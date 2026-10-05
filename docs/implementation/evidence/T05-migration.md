# T05 — skema additive dan drill migrasi

Status: CODE_VERIFIED pada dua database lokal terisolasi; penerapan ke database aplikasi dan rekonsiliasi saldo nyata belum dilakukan.

- `20260928113603_baseline` dibuat dari schema lama dan diterapkan ke database uji kosong.
- `20260928120000_operational_foundation` menambah enum, kolom nullable legacy, target, recap, payment, idempotency dan audit; CHECK, FK RESTRICT, RLS dan REVOKE pada enam tabel bisnis baru. Dua siklus legacy yang tanggal mulainya sama tidak mengisi `weekKey` secara spekulatif. Constraint target menerima nol sesuai D08.
- `20260928123000_payment_note` menambah catatan pembayaran nullable. Diterapkan hanya pada tiga database lokal uji bersama perubahan client Prisma.
- Pada fixture legacy: order count 1 dan total Rp100.000 tetap sama sebelum/sesudah; satu penerimaan tetap `draft`, dua siklus tetap `rulesVersion=null`, satu produk tetap `targetGroup=null`. Saldo fixture yang sengaja diatestasi menjadi satu payment Rp100.000. Script diulang dua kali: tetap satu payment dan satu audit.
- `tests/integration/migration.test.ts`: 2/2 PASS, termasuk RLS dan constraint terpasang. `hato_fresh`: tiga migration diterapkan, 0 cycle, dan Prisma diff ke schema repo kembali menghasilkan **No difference detected**. Prisma client generate dan root TypeScript PASS.
- `inspect-existing-readonly.ts` menemukan database aplikasi tanpa `_prisma_migrations`, tetapi datamodel cocok dengan HEAD pra-perubahan. Baseline adoption diperlukan pada rilis; belum dijalankan.

Belum dibuktikan: grant/RLS tabel lama melalui Data API anon/authenticated, makna saldo paid/unpaid lama, apakah pernah ada cicilan manual, makna damagedQty, backup/restore, migrasi pada clone data nyata, dan test perangkat fisik. `backfill-fixture.ts` hanya untuk UUID sintetis di cluster uji; bukan prosedur backfill produksi.
