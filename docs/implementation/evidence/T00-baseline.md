# T00 baseline — 28 September 2026

Repo `main` pada HEAD `2c5beaf`. Saat mulai implementasi, working tree sudah berisi perubahan lokal pada `IMPLEMENTATION_PLAN.md`, `src/app/api/cycles/route.ts`, `src/app/cycles/page.tsx`, `vercel.json`, serta file belum terlacak di `docs/`, `anti-slop/`, `src/app/api/cron/`, `src/lib/cycle-automation.ts` dan PDF lain. Jangan reset/commit perubahan tersebut secara diam-diam.

Versi terpasang: Node 24.12.0, Next 16.3.4, Prisma CLI/client 6.19.3, TypeScript root 5.9.3, Expo CLI 57.0.24. Root memakai pnpm-lock.yaml; mobile punya package-lock.json. Prisma config memuat dotenv tetapi tidak ada bukti bahwa URL itu menunjuk database uji.

Checks baseline:

| Perintah | Hasil |
|---|---|
| `node_modules/.bin/tsc.cmd --noEmit --incremental false` | PASS |
| `mobile/node_modules/.bin/tsc.cmd -p mobile/tsconfig.json --noEmit --incremental false` | PASS |
| `node_modules/.bin/eslint.cmd src --format json` | FAIL: 117 errors, 33 warnings, 34 file terlapor |

Lint output rinci tidak disimpan karena hanya dibutuhkan untuk baseline; rerun pada file terkait saat berubah. Prisma CLI mengeluarkan peringatan properti `package.json#prisma` yang deprecated, bukan kegagalan command. Belum ada app build/physical-device/DB integration yang dijalankan pada T00.

Status T00: baseline lokal selesai; identitas cloud, pemetaan produk nyata dan test DB tetap unresolved. Lihat `data-readiness.md`, `product-mapping.md`, `api-callers.md`. Pekerjaan pure T01 dan compatibility mobile T02 dapat berjalan. T05 dan tes concurrency yang menyentuh DB menunggu verifikasi lingkungan uji.
