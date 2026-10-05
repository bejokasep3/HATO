# Identitas data dan kesiapan migrasi

Pemeriksaan 28 September 2026. Tidak ada SQL mutasi yang dijalankan pada koneksi aplikasi. Nilai URL, host, password, token, anggota, dan isi transaksi tidak disalin ke evidence.

Database uji adalah cluster PostgreSQL 18 baru di `C:/Users/Komputer/AppData/Local/Temp/hato-test-pg-4f1a1ddb`, bind `127.0.0.1:55439`, user `hato_test`. Identitas dibuktikan lewat `current_database`, `current_user`, port dan `data_directory`. Database `hato_test` memuat fixture sintetis; `hato_fresh` kosong. Script rekonsiliasi uji menolak koneksi selain loopback, `hato_test`, path cluster tersebut dan marker lokal, serta mensyaratkan HATO_TEST_DATABASE_URL identik dengan DATABASE_URL/DIRECT_URL. Cluster tidak berisi data pengguna.

Koneksi aplikasi diperiksa hanya dengan transaksi `SET TRANSACTION READ ONLY` dan perbandingan Prisma schema. Tabel `cycles`, `products`, `orders` ada; `_prisma_migrations` dan `payments` belum ada. Kolom v2 (`week_key`, `rules_version`, `target_group`, `ledger_reconciled_at`) belum ada. `prisma migrate diff` terhadap schema HEAD sebelum implementasi menghasilkan **No difference detected**. Ini membuktikan kecocokan datamodel Prisma yang terlihat, bukan semua RLS, grant, trigger, extension, atau backup.

History produksi perlu baseline adoption: setelah backup/restore dan maintenance window tervalidasi, tandai migration `20260928113603_baseline` sebagai applied pada database yang sudah berisi schema lama, kemudian jalankan hanya migration additive. Jangan menjalankan `migrate deploy` langsung pada database itu karena baseline akan mencoba membuat tabel lama lagi. Tindakan tersebut belum dilakukan dan perlu review rilis tersendiri.

Database lokal tambahan `hato_recap` memuat fixture sintetis beberapa varian untuk uji rekap. Hak Data API/RLS tabel lama, salinan backup yang bisa dipulihkan, akun admin/nonadmin, dan saldo historis belum diverifikasi. Fixture sintetis tidak menjadi bukti saldo nyata. Seed repo tidak dijalankan pada database transaksi.
