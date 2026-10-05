# Acceptance dan anggaran verifikasi

Fixture sintetis: cycle C1 Senin 2026-10-05 s/d Minggu 2026-10-11 WIB, rekap 2026-10-06, tiba 2026-10-08. C2 2026-10-12. Produk Karkas/Recah kg (AYAM), Tahu Putih/Kuning bungkus (TAHU), produk X unit eksplisit (NONE). Nama anggota gunakan Fixture A/B/C. Semua UUID test dibuat khusus, bukan ID pengguna.

Tests wajib memanggil public service/handler yang benar-benar digunakan route. Pure tests tidak menggantikan integration test Prisma. Jangan menyalin rumus implementasi ke assertion; gunakan hasil eksplisit di bawah.

| ID | Input/tindakan | Hasil yang harus terlihat |
|---|---|---|
| A01 | C1 pada Minggu23:59 WIB dan Senin00:00 WIB; komputer/DB timezone berbeda; close manual lebih awal | Tanggal tetap benar. Setelah batas/closed, order baru, restore dan kenaikan quantity ditolak; pembayaran diterima. Pengurangan untuk shortage mengikuti guard pembayaran/distribusi |
| A02 | Target ayam10; demand7/10/14; target0 | Progress70/100/140%; shortfall3/0/0; target0 label Tidak ditargetkan, tanpa NaN |
| A03 | Demand karkas4+recah3, target10; input recap karkas6+recah4 | Total10 sah. Total9 ditolak; mengurangi varian di bawah demand ditolak. Mapping rename produk tidak mengubah histori |
| A04 | Confirm recap10; kemudian target12 | Snapshot tetap10, target live12, tampilan menjelaskan perbedaan. Tidak menciptakan receipt/jatah2 tambahan |
| A05 | Kapasitas produk10; alokasi7; tambah2 kemudian2; edit order2 menjadi3 | Tambah pertama berhasil, kedua409 tersedia1. Edit menjadi3 boleh bila delta1 cukup. Periksa consumer+trader dijumlah |
| A06 | Receipt draft received20 pada recap10; lalu confirm received8 damaged1; allocated9 dikurangi menjadi8 | Draft capacity tetap planned10. Confirm capacity received7. Allocated9 menghasilkan shortage2; tambah quantity ditolak. Pengurangan ke8 boleh (bila pembayaran/distribusi mengizinkan), shortage menjadi1 meskipun belum nol |
| A07 | Receipt layak10, active allocated7 termasuk shipped4 | Fisik6, reserved3, available3. shipped4 menjadi delivered4 tidak mengurangi lagi. Pending cancel2 -> available5, receipt tetap10 |
| A08 | Cancel order belum keluar paid0; restore; cancel paid/ shipped | Pertama tercatat cancelled bukan deleted; restore ID sama dan recheck jatah. Paid/shipped ditolak dengan penjelasan |
| A09 | Tagihan150000; bayar50000 lalu40000 lalu60000; coba tambah1; reverse40000 | Sisa100000/60000/0; kelebihan1 ditolak; reverse menghasilkan sisa40000. Reverse ulang tidak berefek dua kali |
| A10 | Mobile parse `{cycle,recap}`, prices nested product; ganti cycle beda harga; invalid response | Nama/detail benar, total preview sesuai server; invalid JSON shape menimbulkan error yang dapat ditindaklanjuti, bukan undefined/Rp0 |
| A11 | Tanpa token; valid user nonadmin; admin; expired; spoofed cookie; wrong browser origin | 401/403/allowed/refresh-or401/401/403 sesuai kasus; tidak ada auth bypass. Raw Data API anon tidak membaca tabel bisnis |
| A12 | Fresh empty test DB dan legacy populated test DB; nullable new fields | Migration tidak membutuhkan reset live; existing count/total sama; unknown target/recap jelas, tidak diisi10/20 otomatis |
| A13 | Legacy paid dengan paidAt valid/null dan unpaid berpotensi cicilan; backfill diulang | Satu legacy payment per order yang terverifikasi; unknown date tidak direka; rerun tidak duplikasi. ledgerReconciledAt null -> summary unverified, nominal null dan payment/edit/cancel ditolak; daftar piutang menyatakan total belum lengkap |
| A14 | Dua create C1 bersamaan; recap preview lalu concurrent order; replay key sama/different body | Satu cycle; recap stale409; same key+same body satu efek+respons asli; same key+different body409 |
| A15 | Dua koneksi bersamaan memesan2 ketika available3; receipt update vs order create | Maksimal satu tambah2 berhasil, total tidak >capacity. Receipt shortage nyata dicatat dan mencegah alokasi baru |
| A16 | Outstanding60000, dua request bayar40000; payment versus edit total lebih kecil | Tidak overpay. Yang kalah409 dan history konsisten; edit tidak membuat total<effectivePaid. Uji dengan DB sungguhan terisolasi |
| A17 | Cycle closed dengan partial payments; paidAt/count orders berbeda dari paid sums | Dashboard, report, piutang dan detail order memakai nominal sama. Closed tidak menghilangkan saldo. Tidak ada barang masuk sintetis |
| A18 | Simpan response timeout; retry; auth expired; app background; ganti perangkat | Draf terjaga; key sama satu efek; ulang login tidak kehilangan input; hasil setelah refresh sama web/native |
| A19 | 10 order berurutan, cycle switch, member duplicate, belum pilih member, harga loading | Siklus tidak dipilih ulang; duplicate membuka existing order; blank/loading belum bisa submit; jumlah tagihan benar |
| A20 | Desktop1440x900, web390x844, iPhone/Android fisik; keyboard/zoom/focus | Bayar/edit tidak butuh horizontal scroll HP; input/simpan tidak tertutup keyboard; dialog web Escape+focus; label kontrol terbaca |
| A21 | Ayam quantity0.25 harga10000.02; dua baris dengan subtotal hasil sama; tahu1.5; quantity negatif/NaN/overflow; harga0; input koma1,5 | Subtotal2500.01 half-up, dua baris total5000.02. Tahu pecahan dan input invalid ditolak sebelum DB; harga0 PRICE_NOT_READY. Koma menjadi canonical1.50, bukan15. Order total melebihi Decimal(12,2) ditolak tanpa partial write |

## Cara menjalankan checks

T00 merekam command persis yang valid pada mesin. Untuk compiler yang ada saat planning:

```powershell
& .\node_modules\.bin\tsc.cmd --noEmit --incremental false
& .\mobile\node_modules\.bin\tsc.cmd -p mobile/tsconfig.json --noEmit --incremental false
```

Runner domain dengan file yang ditemukan secara eksplisit (setelah T01 membuat tests):

```powershell
$hatoDomainTests = @(Get-ChildItem -LiteralPath tests/domain -Filter '*.test.ts' -File | ForEach-Object FullName)
if ($hatoDomainTests.Count -eq 0) { throw 'Tidak ada domain tests; bukan PASS' }
& node --import tsx --test @hatoDomainTests
if ($LASTEXITCODE -ne 0) { throw 'Domain tests gagal' }
```

Contract tests mengikuti cara yang sama pada tests/contracts. Integration runner dibuat T05 dengan validasi target DB pada DATA-API. Jangan menuliskan contoh command yang fallback ke DATABASE_URL aplikasi; harus memerlukan HATO_TEST_DATABASE_URL dan identitas test terverifikasi. Tidak memuat dotenv aplikasi secara diam-diam untuk integration tests.

Build web: jalankan script build repository yang terverifikasi T00. Jika prisma generate terkunci proses Windows, identifikasi/hentikan hanya proses test sendiri; next build tanpa generate adalah pemeriksaan parsial, bukan build PASS penuh. Expo: gunakan CLI lokal SDK dan `--help` untuk export/bundle command iOS+Android, bukan menerka flag atau upgrade SDK.

Lint awal pada src saat review:117 error33 warning, bukan janji angka sekarang sama. T00 refresh sekali. Untuk kartu berikutnya: lint file berubah; jangan tambah issue baru, jangan disable rule/file supaya hijau. Masalah existing dalam file yang benar-benar menghalangi perubahan diselesaikan; unrelated backlog dicatat. Tidak perlu mengulang seluruh repo tiap edit kecil.

## Anggaran pengujian

- Tiap kartu: tests IDs terkait + typecheck target; tambah pengecekan hanya bila ada risiko baru.
- UI: satu inspeksi gabungan desktop/web HP atau native OS relevan, satu batch perbaikan, satu konfirmasi terarah. Tidak polishing tanpa batas.
- Concurrency/migration: wajib integration PostgreSQL terisolasi; tanpa DB, status BLOCKED untuk pembuktian itu. Mock pass tidak boleh diganti label menjadi integration pass.
- Akhir T17: sekali full critical-flow run, lalu retest perubahan/failures saja. Dependency security scan atau load test lanjutan hanya bila ada alasan spesifik, bukan loop mencari kesempurnaan.
- Bila pengguna akan test, berikan startup, environment label dan 5-8 langkah; hentikan browser automation. Catat hasil dari pengguna/perangkat, jangan klaim telah menyaksikan sesuatu yang belum diperiksa.

## Template evidence

Untuk tiap ID simpan: status PASS/FAIL/NOT_RUN, commit/diff, environment label, command/perangkat, hasil aktual, expected, batas verifikasi. Tidak menyimpan password/token/customer data. NOT_RUN selalu disertai penyebab dan langkah terkecil untuk menyelesaikannya.
