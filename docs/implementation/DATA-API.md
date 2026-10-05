# Kontrak data, API dan transaksi

Ini desain implementasi yang harus diikuti. Existing file = sudah ada saat planning; NEW = target baru. T00 boleh mengoreksi path bila repository berubah, dengan catatan bukti, bukan mengganti aturan bisnis.

## Penempatan kode

| Lokasi | Tanggung jawab |
|---|---|
| `shared/contracts/` NEW | Zod request/response, enum dan DTO murni; tidak import Prisma/Next/RN |
| `src/lib/domain/` NEW | Pure money, target, calendar, availability, payment calculations |
| `src/lib/services/` NEW | Authenticated orchestration, transaksi Prisma, audit/idempotency |
| `src/lib/auth/` NEW | Verifikasi identitas dan allowlist admin |
| `src/app/api/**/route.ts` existing/new | Parse, authorize, panggil service, serialize DTO; tidak copy rumus |
| `mobile/lib/api.ts` existing | Session header, response validation dan satu adapter per DTO |
| `src/lib/api-client.ts` NEW | Fetch client web, error/response validation, tidak ada business totals sendiri |
| `tests/domain/`, `tests/contracts/`, `tests/integration/` NEW | Fixture sintetis; integrasi hanya test DB terverifikasi |

Gunakan shared source sederhana, bukan migrasi monorepo besar. T01 membuktikan import shared/contracts dapat dibundle Next dan Expo v57 sebelum diperluas. Jika resolver gagal, perbaiki satu alias/config berbasis dokumentasi; jangan menggandakan definisi kontrak. Zod mobile perlu dependency eksplisit bila dipakai; install sesuai panduan Expo dan lockfile yang ada. Jangan import Prisma atau secret ke bundle client.

## Wire format

- Uang/quantity pada DTO bisnis baru berupa string decimal, misalnya `"150000.00"`, `"1.25"`; tampilan boleh mengubah format, perhitungan server tetap Decimal.
- Request quantity menerima format canonical string; adapter input menerima koma desimal Indonesia lalu menormalkan, bukan mengubah `1,5` menjadi 15. T02 compatibility fix mempertahankan payload legacy sampai adapter T10 dan layar T11-T16 siap; cutover diverifikasi T17.
- Tanggal kalender `YYYY-MM-DD`; instant ISO UTC; ID UUID; version integer >=0.
- Success mengikuti bentuk existing untuk endpoint existing: array tetap array, detail cycle tetap `{cycle, recap}`. Tambah field dengan schema terdefinisi; jangan tiba-tiba membungkus semua respons menjadi `{data}`.
- Error baru: `{error:{code,message,fieldErrors?,details?},requestId}`. Adapter harus tetap mengenali error string/array legacy selama transisi. Jangan mengirim stack/SQL/connection string.
- HTTP: 400 payload invalid; 401 tanpa/invalid sesi; 403 bukan admin/origin ditolak; 404 tidak ditemukan; 409 konflik versi/jatah/idempotency/aksi state; 422 harga/target belum siap; 503 dependency unavailable. Jangan mengembalikan HTTP200 dengan data kosong saat DB gagal.

## Penambahan schema (additive dahulu)

| Model/field | Bentuk minimum dan constraint |
|---|---|
| Cycle | Tambah nullable periodEnd, supplierDeadline, periodState, unique nullable weekKey, version default0, rulesVersion nullable. `weekKey` untuk siklus baru = tanggal Senin. Legacy dibiarkan null sampai diperiksa; tidak pasang unique pada tanggal legacy sebelum audit duplicate |
| Product | targetGroup enum AYAM/TAHU/NONE atau nullable legacy; quantityScale 0/2 setelah mapping |
| WeeklyPrice | targetGroupSnapshot, unitSnapshot, quantityScaleSnapshot; isi pada persiapan siklus dan bekukan saat open. Produk baru ditambahkan eksplisit ke siklus, bukan ikut histori otomatis |
| CycleTarget NEW | cycleId, groupCode AYAM/TAHU, quantity Decimal(10,2), unit kg/bungkus, timestamps; unique(cycleId,groupCode). Unknown legacy = row tidak ada, bukan target0 |
| SupplierRecap NEW | id, cycleId unique, confirmedAt, actorId, cycleVersionAtConfirm, targetSnapshot JSON tervalidasi. Tidak ada mutasi quantity setelah confirm |
| SupplierRecapItem NEW | recapId, productId, quantity Decimal(10,2), productNameSnapshot, unitSnapshot, groupSnapshot; unique(recapId,productId) |
| Order | version default0, cancelledAt nullable, cancellationReason nullable, createdBy nullable legacy, ledgerReconciledAt/By nullable. Order baru v2 ditandai siap ledger saat dibuat; legacy tetap null sampai saldo diperiksa. Pertahankan unique(cycleId,memberId), items dan total snapshot |
| Payment NEW | id, orderId FK RESTRICT, amount Decimal(12,2)>0, method, occurredAt nullable untuk legacy saja, source manual/legacy_opening_balance, actorId nullable legacy, createdAt, reversedAt/by/reason nullable, legacySourceOrderId unique nullable. Tidak hard-delete |
| MutationRequest NEW | actorId, operation, key, requestHash, responseStatus, responseJson, createdAt; unique(actorId,operation,key). Response disimpan tanpa secret; tidak membersihkan record sepanjang horizon retry milestone |
| AuditEvent NEW | actorId, entityType/id, action, before/after terpilih, reason, createdAt, requestId. Tidak menyalin seluruh data pribadi/secrets ke audit |
| GoodsReceipt existing | Tambah version dan confirmedBy/confirmedAt bila diperlukan; confirmed immutable pada UI milestone, koreksi lanjutan ditunda. Draft editable; receivedQty/damagedQty divalidasi server |

Foreign key tidak cascade-delete Payment/Audit ketika order dihapus; business route tidak lagi menghapus order. Gunakan check constraint amount/quantity dan enum sesuai baseline database yang terverifikasi. Semua tabel bisnis baru tidak boleh dapat dibaca/ditulis melalui Data API anon/authenticated secara langsung; server Prisma menjadi jalur akses. Periksa privilege/RLS tabel lama sebelum menyatakan aman. Jangan menganggap RLS otomatis berlaku pada koneksi Prisma berprivilege.

Satu pemilik migration history: Prisma karena schema repo sudah Prisma. T05 memeriksa migration history live secara read-only, menyusun baseline terhadap database kosong/test, dan tidak membuat history Supabase kedua. Jangan menjalankan saran mutasi SQL dari skill terhadap live. Jika ternyata history yang aktif dikelola alat lain, pause T05 dan minta keputusan konkret tentang pemilik migrasi.

## Endpoint final

| Endpoint | Perubahan/payload minimum | Client dan guard |
|---|---|---|
| GET /api/cycles | Tambah tanggal baru, periodState, targets, version | web + mobile |
| POST /api/cycles | `{periodStart, targets:[{groupCode,quantity}], notes?}`; derive tanggal; harga/copy diproses atomik; hasil draft | admin + idempotency |
| POST /api/cycles/[id]/open NEW | `{expectedVersion}`; harga dan targets siap; tanpa auto-complete siklus lain | admin + version + cycle lock |
| POST /api/cycles/[id]/close NEW | `{expectedVersion}`; close periode tanpa menandai delivered/paid | admin + cycle lock |
| PATCH /api/cycles/[id]/targets NEW | `{expectedVersion,reason,targets}` | admin + cycle lock + audit |
| GET /api/cycles/[id] | Tetap `{cycle,recap}`; seluruh GET read-only, hapus sync write rotasi | response schema shared |
| GET/PUT /api/cycles/[id]/prices | Update schema, harga valid, snapshot existing order tidak diubah | admin; perubahan ber-versi |
| GET /api/cycles/[id]/supplier-recap NEW | demand per produk, target, tambahan yang perlu dibagi, existing snapshot jika ada | server-calculated DTO |
| POST /api/cycles/[id]/supplier-recap NEW | `{expectedVersion,items:[{productId,quantity}]}`; confirm sekali | cycle lock; reread demand dan target |
| GET /api/cycles/[id]/availability NEW | productId, capacity, allocated, availableToOrder, shortage, source planned/received/unknown | unknown legacy tidak dibuat nol |
| GET/POST/PATCH /api/orders | Kontrak existing dipertahankan, tambah version/paymentSummary/cancelledAt; create/update hanya input produk, quantity,priceType,notes | cycle lock; update juga order lock |
| POST /api/orders/[id]/cancel NEW | `{expectedVersion,reason}` | cycle->order lock, aturan cancel |
| POST /api/orders/[id]/restore NEW | `{expectedVersion,reason}` | id order sama; jatah/price tervalidasi |
| POST /api/orders/[id]/fulfillment NEW | `{expectedVersion,status:confirmed|shipped|delivered}`; no backward transition | cycle->order lock, stok aktual sebelum shipped |
| GET/POST /api/orders/[id]/payments NEW | GET history+summary; POST `{amount,method,occurredAt,note?}` | order lock + idempotency |
| POST /api/payments/[id]/reverse NEW | `{reason}` | order lock; one-time reverse+audit |
| GET /api/payments/receivables NEW | semua order outstanding>0, filter cycle/group optional, pagination | admin; piutang closed cycles tetap masuk |
| GET/POST /api/inventory existing | save draft; qty ordered derived server dari recap, bukan dipercaya dari client | cycle lock; confirmed tidak replace items |
| POST /api/inventory/[cycleId]/confirm NEW | `{expectedVersion}`; qty aktual boleh menunjukkan shortage | cycle lock; receipt semua produk diperiksa |
| GET /api/dashboard, /api/reports, /api/inventory/summary, /api/ranking | Pakai service ringkasan yang sama; scope cycle/period eksplisit | tidak memakai asumsi barang masuk20 atau count paid sebagai nominal kas |
| /api/cron/cycles existing WIP | Secret missing -> 503, invalid ->401. Tidak complete/buka otomatis; no-op informed response sampai automasi draf disetujui | tidak dipanggil tombol browser, secret tetap server |

Mutasi baru memakai header `Idempotency-Key` UUID. `expectedVersion` wajib untuk perubahan record yang terlihat di UI; ledger payments memakai lock+idempotency dan membaca outstanding terbaru. API version header `X-Hato-Client: 2` menandai client baru saat cutover; ini bukan autentikasi.

Legacy PATCH paymentStatus/orderStatus dan DELETE order harus menolak `409 CLIENT_UPDATE_REQUIRED` pada server v2. Jangan mempertahankan dua jalur mutasi yang bisa melewati ledger, cancel atau jatah. T10 menyiapkan adapters dan inventaris caller; T11-T16 memindahkan layar; T17 memastikan tidak ada caller lama sebelum rilis. Build perantara lokal boleh belum memenuhi acceptance layar, tetapi tidak boleh di-deploy ke pengguna. Tidak perlu flag produksi yang mengizinkan bypass ledger. GET legacy dapat tetap tersedia, tetapi seluruh akses tetap memerlukan admin.

`ledgerReconciledAt=null` berarti paymentSummary berstatus `unverified`, dengan paid/outstanding null, bukan nol. Blok mutasi payment/reverse serta edit/cancel order tersebut dengan `409 LEDGER_RECONCILIATION_REQUIRED`. Daftar piutang menampilkan jumlah order belum diverifikasi terpisah dari total yang diketahui; total berlabel belum lengkap bila count>0. Rekonsiliasi dilakukan melalui script terjaga T05 dengan sumber saldo terverifikasi dan audit, bukan tombol yang sekadar menandai selesai. Order v2 baru memakai ledger kosong terverifikasi dengan paid=0.

## Auth satu admin

Supabase email/password dengan satu UUID admin allowlist server `HATO_ADMIN_USER_ID`. Tidak membangun signup umum atau role-management. Browser memakai SSR session cookies, native memakai access token Bearer dengan refresh/session storage sesuai SDK. Server memverifikasi token/session melalui SDK dan mengecek sub admin, bukan decode JWT/getSession saja. Kredensial pengguna tidak ditaruh di prompt/env sample.

Origin protection wajib untuk mutasi cookie browser: allow exact app origin yang dikonfigurasi; tolak origin tidak cocok. Native bearer tidak bergantung CORS. Hindari blanket wildcard credentialed CORS. OPTIONS boleh tanpa data bisnis. Auth checks di handler/service, proxy hanya bantu session refresh/redirect.

API tests mencakup valid non-admin user ->403, bukan hanya no-token ->401. Environment misconfigured tidak boleh fail-open. Login/logout/expired token diuji pada kedua client sebelum mengaktifkan guard pada deployment pengguna. Gunakan secure token storage native yang didukung Expo Go v57; no service-role key di client.

## Lock, versi, idempotency

Semua mutasi yang memengaruhi target, recap, order quantity/status/cancel dan receipt wajib mengambil lock row Cycle dalam transaksi PostgreSQL yang sama (`SELECT ... FOR UPDATE`, query berparameter). Bila perlu lock Order, urutannya Cycle lalu Order. Payment/reverse hanya lock Order; tidak mengambil Cycle setelahnya. Jangan network request ke Auth/WA di dalam transaksi.

Urutan: authorize -> parse -> begin transaction -> lock idempotency key -> cek MutationRequest/key+hash -> lock resource -> cek expectedVersion -> baca ulang sumber -> validasi -> tulis bisnis + version + audit + response MutationRequest -> commit.

Lock key menggunakan transaction-scoped PostgreSQL advisory lock dari hash stabil `(actorId,operation,key)`, query berparameter. Selalu ambil sebelum Cycle/Order; gunakan satu key per transaksi agar tidak membalik urutan lock. Ini menyerialisasi retry meski record bisnis belum dibuat. CREATE cycle tidak bisa lock row yang belum ada: gunakan unique weekKey sebagai arbitrase. Dua key berbeda pada minggu sama -> satu berhasil, yang lain rollback lalu409 WEEK_ALREADY_EXISTS; key sama -> replay respons asli. Jangan menangkap unique violation lalu meneruskan transaksi PostgreSQL yang sudah aborted.

Setiap mutasi order yang mengubah demand/receipt/target meningkatkan Cycle.version agar konfirmasi recap stale ditolak. Payment tidak perlu meningkatkan Cycle.version. Semua mutasi order meningkatkan Order.version. Idempotent replay diperiksa sebelum expectedVersion agar retry sukses lama tidak berubah menjadi conflict.

Key sama dan payload canonical sama -> response asli, tanpa efek kedua. Key sama body/resource berbeda ->409 IDEMPOTENCY_CONFLICT. Unique-conflict race/serialization ditangani dengan bounded retry maksimal3, lalu409/503 dengan pesan retry aman. UI mempertahankan key jika hasil belum diketahui. Test concurrency wajib dengan dua koneksi PostgreSQL; mock tidak membuktikan lock.

## Migrasi dan cutover

1. T00 membuktikan test DB terpisah dari semua production identifiers. Script mutasi menolak jika test marker tidak ada atau project/db sama dengan produksi; jangan hanya bergantung nama env atau NODE_ENV.
2. T05 baseline tanpa reset live; schema additive pada test, nullable legacy fields. Catat enum/string/trigger/FK/index live yang berbeda dari schema repo bila akses tersedia.
3. Backfill preview: order count, sums total/paid/unpaid, duplicate weeks, target unknown, product group unknown, receipt draft/confirmed dan makna damagedQty. Simpan ringkasan tanpa daftar PII.
4. Saldo legacy paid menjadi satu payment per order dengan source dan unique legacySourceOrderId, rerun idempotent. Saldo unpaid harus dicek kemungkinan cicilan manual. Unknown tidak otomatis dianggap0 atau lunas.
5. Target/recap historis hanya diisi dari sumber terverifikasi. `rulesVersion=null` berarti legacy read-only bagi mutasi stok/order sampai rekonsiliasi per siklus selesai; pembayaran bisa diaktifkan per order setelah ledgerReconciledAt/By tercatat dalam transaksi backfill+audit. New cycles rulesVersion=2. Jangan menganggap semua saldo legacy benar hanya karena satu siklus berhasil direkonsiliasi.
6. Drill pada test: order count dan total tidak berubah; ledger paid cocok dengan sumber; piutang setelah migrasi tepat; draft/unknown bukan penerimaan terkonfirmasi. T17 mencatat checksum/aggregate before-after dan migration ids.
7. Rilis produksi hanya setelah kandidat siap, backup/restore terbukti, admin access diuji, client v2 tersedia, dan persetujuan deployment spesifik. Gunakan maintenance window untuk menghentikan writer lama saat backfill; reconcile ulang delta sebelum membuka akses.
8. Sesudah ledger dipakai, rollback ke versi lama yang menulis paid/unpaid langsung tidak aman. Mitigasi: matikan mutasi sementara, pertahankan data/tabel, forward-fix atau restore melalui prosedur yang mempertimbangkan transaksi baru. Jangan DROP ledger/restore backup lama sambil membuang pembayaran baru.
