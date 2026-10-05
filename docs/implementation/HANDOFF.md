# Prompt handoff untuk Sol

Salin teks berikut ke sesi implementasi di checkout HATO. Ini tidak otomatis mengganti model atau memulai pekerjaan.

```text
Kerjakan implementasi HATO berdasarkan docs/implementation/README.md.

Baca AGENTS.md dan aturan nested yang relevan, kemudian RULES.md dan STATUS.md.
Mulai dari kartu READY paling awal di TASKS.md; satu kartu aktif pada satu waktu.
Baca DATA-API.md dan acceptance IDs yang dirujuk kartu itu sebelum menulis kode.
Setelah kartu terbukti selesai, lanjutkan kartu berikutnya yang dependensinya siap.
Jangan membaca semua skill atau seluruh repo berulang-ulang; gunakan path di kartu.

Aturan bisnis pengguna Uxx tidak boleh diubah. Dxx adalah keputusan implementasi
yang sudah dirancang agar Anda tidak perlu menebak; bila tidak cocok dengan bukti
repo/data, catat konflik konkret dan hentikan hanya langkah yang terdampak.
Tidak membangun ulang proyek, tidak upgrade framework, tidak menambah fitur di luar scope.
Antislop dipakai AFTER dan UX tetap emerald/slate; tidak perlu menanyakan pilihan itu ulang.

Data nyata harus tetap aman. Sebelum database writes, pastikan target adalah test DB
yang sudah diverifikasi, bukan hanya env bernama development. Jangan seed/reset/db push
ke database aplikasi. Jangan mencetak secret atau mengirim data pelanggan.
Jangan deploy, push, publish OTA, migrate production atau kirim WhatsApp pada instruksi ini.
Siapkan release candidate konkret pada T17 untuk review, bukan deployment otomatis.

Pertahankan perubahan lokal yang sudah ada, termasuk pekerjaan cron/cycles. Jangan reset,
stash atau commit pekerjaan pengguna diam-diam. Semua mutasi stok/pembayaran harus melalui
service, lock/idempotency dan kontrak yang ditetapkan; UI guard saja tidak cukup.

Jalankan test relevan, catat PASS/FAIL/NOT_RUN secara jujur. Mock/TypeScript/browser
tidak menggantikan integration DB atau uji iPhone/Android fisik. Hindari loop pemeriksaan
unrelated. Bila gagal dua kali dengan sebab sama, investigasi terarah lalu laporkan blocker
dan langkah terkecil; lanjutkan pekerjaan independen yang masih bisa diselesaikan.

Setiap akhir sesi perbarui STATUS.md: kartu/substep, files, evidence tests, blocker,
dan next exact action. Laporkan ke saya singkat apa yang selesai, belum terverifikasi,
serta apakah dibutuhkan tindakan manusia. Jangan menyebut implementasi seluruhnya selesai
sebelum T17 terpenuhi.
```

## Jika perlu berhenti untuk keputusan

Format: `Txx terhenti pada [langkah]. Bukti: [file/error/state]. Dampak: [apa yang tidak aman/ambigu]. Saya tetap dapat mengerjakan [bagian independen]. Keputusan/tindakan yang diperlukan: [satu pertanyaan spesifik].`

Jangan bertanya ulang soal Senin-Minggu, target10 yang editable, pembelian minimum, rekapSelasa/tibaKamis, late order dibatasi barang, cicilan, platform atau warna. Pertanyaan yang valid misalnya pemetaan produk ambigu, konflik migration history, akses test environment, atau saldo legacy yang tidak bisa direkonsiliasi.
