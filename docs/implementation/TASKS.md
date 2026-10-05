# Kartu tugas implementasi

Setiap kartu selesai dengan evidence pada STATUS.md. Path NEW adalah file yang perlu dibuat, bukan file yang diklaim sudah tersedia. Periksa path sebelum edit. Bila satu kartu terlalu besar untuk satu sesi, berhenti pada sublangkah a/b/c yang sudah dapat diverifikasi, tulis bagian tersisa, jangan menandai seluruh kartu selesai.

Urutan default: T00 -> T01 -> T02 -> T03 -> T04 -> T05 -> T06 -> T07 -> T08 -> T09 -> T10 -> T11 -> T12 -> T13 -> T14 -> T15 -> T16 -> T17. Baca dependensi, bukan menebak bahwa nomor sebelumnya otomatis sudah selesai.

## T00 - Baseline dan batas lingkungan

Dependensi: tidak ada. Scope: read-only code/env metadata; dokumen evidence saja.

Input: README paket, RULES, AGENTS, package manifests, schema Prisma, git status. Perubahan lokal yang ditemukan saat planning: cycles API/page, vercel.json, cron dan cycle-automation; jangan overwrite/reset. PDF kalender unrelated.

Langkah: (a) catat branch/HEAD dan dirty files tanpa meng-commit pekerjaan orang lain; (b) catat versi Node/Next/Prisma/Expo resolved dan package manager; (c) jalankan typecheck web/mobile dan lint src sekali sebagai baseline; (d) identifikasi koneksi test vs production dari host/project/database, simpan hanya label/reference non-secret; (e) inventarisasi API dan caller, RLS/Data API exposure dan migration history bila akses read-only tersedia.

Output NEW: `docs/implementation/evidence/T00-baseline.md`, `api-callers.md`, `product-mapping.md`, `data-readiness.md`. Product mapping harus membedakan usulan agent vs terverifikasi. Jangan dump nama/telepon anggota ke evidence.

Selesai: baseline dan daftar blockers spesifik tersedia. Tanpa test DB, tandai T05 integration BLOCKED tetapi T01/T02 dan auth dengan mocks masih bisa berjalan. Tanpa akses cloud jangan mengaku RLS/backup aman. Tidak membuat cloud project/clone berbayar secara otomatis.

## T01 - Aturan murni, kontrak dan test runner

Dependensi: T00 code baseline.

Files NEW: `shared/contracts/{common,orders,cycles,inventory,payments}.ts`, `src/lib/domain/{money,calendar,targets,availability,payments}.ts`, `tests/domain/`, `tests/contracts/`; package scripts bila dibutuhkan.

Langkah: a) tulis bagian pure fixtures dan assertions A01-A09 serta A21 berdasarkan RULES; b) implement pure functions; c) buktikan response schema mendeteksi salah bentuk dan import kontrak dapat diresolve Next/Expo. Status/persistensi/race pada IDs tersebut tetap menunggu integration di kartu terkait; jangan mengklaim seluruh ID PASS dari pure tests. Gunakan node:test + tsx yang sudah ada; tidak memasang framework test besar untuk milestone ini. Gunakan Prisma.Decimal hanya di domain server; shared contracts tidak boleh mengimpornya.

Selesai: domain tests lulus, contoh `.safeParse` respons salah gagal, typecheck keduanya lulus, bundling/import proof untuk shared dicatat. Belum ada DB writes. Jangan migrasikan semua file any dalam task ini.

## T02 - Perbaiki ketidakcocokan mobile existing

Dependensi: T01 kontrak legacy fixtures.

Files: `mobile/lib/api.ts`, `mobile/lib/types.ts`, `mobile/app/orders/new.tsx`, `mobile/app/cycles/[id].tsx`, `mobile/app/(tabs)/orders.tsx`.

Langkah: a) adapter detail mengambil `response.cycle`, menormalkan product/member/group dari relasi nested; b) harga memakai endpoint harga siklus, consumer/trader sesuai pilihan, refresh saat ganti siklus; c) sementara toggle payment memakai PATCH `/api/orders` body `{id,paymentStatus}` agar sesuai backend existing; d) tampilkan error/retry dan refresh ketika kembali ke daftar. T09/T10 menyiapkan ledger/adapter dan T13/T14 mengganti toggle pada layar; jangan menganggap solusi toggle sudah memenuhi cicilan.

Uji: A10, fixtures JSON aktual yang disanitasi/sintetis dengan bentuk sama, typecheck, Expo bundle. Tidak submit transaksi ke API nyata. Selesai CODE_VERIFIED bila contract tests lolos; device check dicatat terpisah.

## T03 - Auth server dan web

Dependensi: T00, T01. Tidak perlu schema bisnis baru.

Files NEW: `src/lib/auth/`, `src/lib/supabase/`, `src/proxy.ts` bila dibutuhkan docs terpasang, `src/app/login/page.tsx`; existing layout/API handlers/next.config serta `.env.example` untuk nama config saja.

Langkah: a) Supabase SSR email/password dan admin UUID allowlist server; b) satu requireAdmin di semua route bisnis, server verification untuk cookie/Bearer; c) CSRF/origin mutasi cookie dan response cache private/no-store; d) cron secret fail-closed, tanpa browser secret; e) login/logout/expired state web.

Uji A11 dan inventarisasi route T00: no token401, valid non-admin403, admin boleh, config hilang tidak fail-open, origin salah ditolak. Jangan menambahkan self-signup, service role ke browser atau auth bypass untuk test. Auth account yang belum tersedia adalah blocker uji integrasi, bukan alasan membuat akun/kredensial sendiri. Jangan deploy guard sebelum T04 siap.

## T04 - Auth native dan gate deployment

Dependensi: T03.

Files NEW: `mobile/lib/auth.ts`, `mobile/app/login.tsx`; existing `mobile/app/_layout.tsx`, api.ts, config.ts, mobile env example/package sesuai kebutuhan.

Langkah: a) session provider/login/logout menggunakan SDK dan secure session storage kompatibel Expo Go57; b) Bearer access token, refresh, satu retry setelah401 yang mempertahankan mutation key; c) clear cache/draft saat logout; d) native login + web login dapat memakai admin sama.

Uji A11, A18: tidak ada privileged key dalam bundle; token expired tidak menghilangkan form; logout menutup data. Physical device unavailable -> DEVICE_PENDING, jangan label release-ready. Tidak mengganti SDK atau beralih dev client demi menghindari masalah Expo Go.

## T05 - Schema additive dan dry-run migrasi

Dependensi: T01; test DB terverifikasi T00. Admin guards T03 sebelum serving data baru.

Files: `prisma/schema.prisma`, NEW migrations hasil tooling yang diverifikasi; NEW `scripts/migration/` untuk preview/apply terjaga, `tests/integration/migration.test.ts`.

Langkah: a) inspect history lalu baseline pada DB kosong/test, bukan reset live; b) tambah tabel/field DATA-API, constraint dan privilege pada test; c) preview legacy mapping, duplicate weeks, saldo/receipt unknown; d) backfill idempotent pada fixture legacy terkontrol; e) rerun dan bandingkan aggregates.

Uji A12, A13. Selesai: migrate fresh test + upgrade legacy fixture lulus; rerun tidak duplikasi; prisma client generate/typecheck sukses. Unknown legacy tidak dipalsukan. Tidak menerapkan backfill produksi. Jika makna damagedQty/paidAt atau cicilan lama tidak terverifikasi, output unresolved record counts dan sample anonim.

## T06 - Service siklus dan target

Dependensi: T05.

Files NEW: `src/lib/services/cycles.ts`, targets.ts, mutation.ts; existing cycles routes, cron route, `src/lib/cycle-automation.ts`; new `/open`, `/close`, `/targets` routes.

Langkah: a) draft cycle Senin-Minggu + copy harga dan snapshot mapping atomik; b) open requires explicit targets dan harga siap; c) close hanya periode; d) edit target audited/versioned; e) hapus auto-complete siklus lain dan pastikan GET read-only; pindahkan inisialisasi rotasi yang sebelumnya terjadi saat GET ke mutasi persiapan siklus dengan aturan rotasi existing, jangan menghilangkan hasilnya; f) cron aman no-op selama automasi belum disetujui, tombol manual menggunakan endpoint admin baru.

Uji A01-A03, A14. Dua create minggu sama -> satu cycle. Pembukaan minggu baru tidak mengubah status pembayaran/fulfillment minggu lama. Tidak edit UI besar dulu; endpoint smoke pada fixture cukup.

## T07 - Rekap supplier yang disimpan

Dependensi: T06.

Files NEW: `src/lib/services/supplier-recap.ts`, `/api/cycles/[id]/supplier-recap/route.ts`, recap contract/integration tests.

Langkah: a) calculate proposal per kelompok dan demand per varian; b) manual allocation shortages; c) version+cycle lock saat confirm; d) persist snapshot sekali; e) read snapshot dan format WA dari snapshot. Preview tidak sama dengan confirm; copy WA tidak mengirim pesan atau mencatat sent otomatis.

Uji A03, A04, A14. Order masuk ketika recap preview terbuka -> confirm stale409; user refresh/review. Request duplicate tidak membuat snapshot kedua. Target berubah setelah confirm tidak mengubah recap quantities.

## T08 - Order, jatah, penerimaan dan fulfillment services

Dependensi: T07, T01, T05.

Gunakan payment calculation T01 dan tabel Payment T05 untuk memeriksa effectivePaid/reconciliation pada edit/cancel; endpoint pembayaran baru menyusul T09. Tidak menunggu UI cicilan untuk melindungi invariant server.

Files: order/inventory routes existing; NEW services orders.ts, availability.ts, inventory.ts; cancel/restore/fulfillment/availability/confirm routes; schema contracts/tests.

Langkah a: validasi order aktif/harga/quantity; snapshot harga existing; cancel/restore dengan alasan dan version. Langkah b: cek jatah per varian atomik, read-only availability, error berisi productId+available+requested. Langkah c: receipt draft/confirm, shortage dan full-order fulfillment. Setiap sublangkah punya integration tests sebelum lanjut.

Uji A05-A08, A15, A21. Server harus melindungi semua jalur lama termasuk PATCH dan DELETE. Receipt draft tidak mengurangi/menambah capacity. Concurrent order vs receipt/recap ikut cycle lock. Tidak mengimplementasikan partial shipment, retur atau carry-over.

## T09 - Ledger cicilan dan koreksi

Dependensi: T05, T08 (lock protocol/cancel/edit total), auth T03.

Files NEW: services payments.ts, payment routes, reverse, receivables; existing orders service untuk invariants; integration payment tests.

Langkah: a) add payment + summary derived dan gate ledgerReconciledAt; b) reverse sekali dengan alasan+audit; c) piutang semua cycle dengan pagination dan penanda saldo belum terverifikasi; d) locking order melindungi add payment dan edit/cancel; e) reject direct paymentStatus writes pada server v2, tanpa fallback bypass.

Uji A09, A13, A16. Replay payment satu efek; dua pembayaran melebihi sisa tidak keduanya berhasil; reverse sekali; close cycle tidak menolak pembayaran. Saldo legacy tidak direkayasa. Jangan implement refund/gabungan PJ.

## T10 - Pembaca, adapter dan inventaris caller baru

Dependensi: T06-T09 dan T04.

Files: dashboard/reports/ranking/inventory summary APIs, products/member read adapters seperlunya, `src/lib/api-client.ts` NEW, mobile api/types, shared contracts; `docs/implementation/evidence/api-callers.md`.

Langkah: a) semua angka berasal dari domain/service, tidak ada fallback `max(20,demand)` sebagai stock; b) payments paidAmount dari ledger, partial masuk piutang; c) target/saldo histori unknown diberi label; d) mapping response dua client dan methods baru pada adapter, old write endpoints409; e) GET detail tidak menulis rotasi. Inventory/report yang memakai jumlah lintas unit harus dipisah per unit/produk. Inventaris mencatat caller lama beserta kartu penggantinya T11-T16; T10 tidak mengklaim layar yang belum diganti sudah bekerja. T17 mensyaratkan nol caller mutasi lama sebelum kandidat rilis.

Uji A10, A17 dan contract tests seluruh reader/caller dalam inventory. Laporan baru menyebut nilai pesanan, pembayaran diterima, nilai pembelian dan sisa tagihan; jangan menyebut laba/HPP final sebelum kebijakan costing disepakati. Badge Bayar Cepat tidak boleh didasarkan hanya lunas.

## T11 - Web Minggu Ini, target, rekap dan input cepat

Dependensi: T10. Baca DESIGN dan Impeccable; antislop AFTER.

Files: `src/app/page.tsx`, cycles/page, cycles/[id]/page, orders/page, components/AppShell dan ui; NEW components fitur kecil. Jangan menambah rumus target/uang versi UI.

Langkah a: ganti status sidebar statis dengan context cycleId di URL; form minggu/target dan rekap confirm+split varian. Langkah b: cari anggota, qty kosong, harga sesuai cycle, Simpan & berikutnya, draft scoped, modal/panel aksesibel. Langkah c: orders mobile-web cards dan ringkasan pendek.

Uji A18-A20, desktop1440x900 dan web390x844. Tautan tidak kehilangan cycleId; modal Escape/focus; unknown harga tidak sempat bisa disubmit; tersedia berkurang saat dipakai order lain. Jalankan detector sesudah pass awal; nol temuan bukan bukti UX lulus.

## T12 - Native Minggu Ini, target, rekap dan input cepat

Dependensi: T10, desain alur T11. Tidak perlu menyalin DOM/tabel.

Files: `mobile/app/(tabs)/index.tsx`, cycles.tsx, orders.tsx, cycles/[id].tsx, orders/new.tsx; new reusable native feature components dan draft storage.

Langkah a: konteks siklus/deep link konsisten. Langkah b: input full-screen+search+Simpan & berikutnya+harga benar. Langkah c: target dan manual allocation recap; iOS/Android feedback sama. Baca Expo UI/native skills sebelum memilih kontrol; pertahankan Expo Go.

Uji A18-A20, bundle dua platform, iPhone utama lalu Android fisik. Keyboard/safe area, app background/return, comma decimal, refresh saat kembali. Tanpa perangkat: CODE_VERIFIED + DEVICE_PENDING, jangan terus mengulang browser sebagai pengganti.

## T13 - Web pembayaran

Dependensi: T09-T11.

Files NEW: `src/app/payments/page.tsx`, payment history/form components; existing orders/cycle detail/dashboard yang memiliki toggle bayar.

Langkah: per order tampilkan total/paid/outstanding/history, Catat pembayaran, Lunasi sisa, reverse dengan alasan. Default list seluruh piutang; filter cycle/group terlihat. Hilangkan seluruh toggle status langsung.

Uji A09, A16, A18. Submit outcome unknown memakai key sama; auto-refresh totals setelah berhasil; salah input mempertahankan form. Outstanding0 tampil sebagai Lunas tanpa tombol menerima lebih bayar.

## T14 - Native pembayaran

Dependensi: T13, T12.

Files NEW: `mobile/app/(tabs)/payments.tsx`, order payment detail/form sesuai Expo Router; existing orders/cards/api/navigation.

Langkah: UX equivalent T13, numeric input IDR, history dan reverse confirmation, expired auth retry aman. Tidak menggunakan Alert yang langsung membalik paid/unpaid.

Uji A09, A16, A18 pada iPhone+Android; payment dari HP terlihat di web, reverse di web terlihat sesudah refresh HP. Gunakan test account/test DB, bukan bayar order pengguna sebagai test.

## T15 - Web Barang dan navigasi akhir

Dependensi: T08,T11,T13.

Files: inventory/page, cycle detail inventory tab, AppShell, old links/groups redirect seperlunya; NEW barang components. Pertahankan `/inventory` untuk tujuan Barang dan `/payments` baru.

Langkah: planned versus received jelas; draft/confirm receipt; per-produk rusak/shortage; full-order distribution action; empat primary destinations, supporting menus. Semua jalur lama menuju tujuan/cycle/tab yang tepat. Jangan menghapus fitur rotasi/komunitas/ranking, pindahkan akses saja.

Uji A06-A08, A19-A20. Receipt confirmed tidak bisa ditimpa lewat form lama. Warna/label bukan satu-satunya penanda. Data transaksi pengguna tidak disentuh.

## T16 - Native Barang dan navigasi akhir

Dependensi: T15,T14.

Files: `mobile/app/inventory/index.tsx`, tabs/_layout, tabs/more, cycles detail; new tabs/inventory.tsx wrapper bila dipilih untuk bottom tab.

Langkah: empat tab Minggu Ini/Pesanan/Barang/Pembayaran. Siklus/anggota/laporan berada di Lainnya yang reachable dari header. Old deep link inventory dan cycles tetap berfungsi. Penerimaan+fulfillment setara web tanpa fitur native-only yang belum didukung Expo Go.

Uji A06-A08,A18-A20 pada dua OS. Navigation tidak membuat dua stack dengan state siklus berbeda. Tidak ada submit hilang di bawah keyboard/safe area.

## T17 - Verifikasi lengkap dan kandidat rilis

Dependensi: seluruh T00-T16; device checks dan rekonsiliasi tersedia.

Scope: evidence, runbook, perbaikan penghambat yang ditemukan; tanpa fitur baru.

Langkah: a) satu putaran ACCEPTANCE end-to-end dengan fixture terdefinisi dan nol caller mutasi legacy pada web/native; b) retest hanya bagian yang berubah/gagal; c) migrate dry-run+reconcile pada lingkungan terpisah; d) typecheck+build+lint perubahan, anti-slop sesudah implementasi awal; e) siapkan kandidat deployment/rollback dan checklist data nyata. Saat pengguna test, hentikan browser automation dan berikan langkah uji singkat.

Output NEW: `docs/implementation/evidence/T17-release-candidate.md`, `release-runbook.md` berisi exact commit/artifacts/migration ids, verified env labels, totals before-after, device OS/Expo versions dan hasil, serta outstanding blockers.

Selesai: release candidate REVIEWABLE; bukan deployed. Jangan meminta approval atas rencana kosong: siapkan kandidat dan bukti dulu. Production write/deploy memerlukan instruksi spesifik pengguna yang mencakup environment. Jika belum ada, laporkan kandidat siap dan tindakan yang akan diterapkan, tanpa menyatakan sudah live.
