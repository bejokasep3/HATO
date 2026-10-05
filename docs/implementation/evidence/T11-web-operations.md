# T11 — web Minggu Ini, target, rekap, input cepat

Status: CODE_VERIFIED. Pemeriksaan visual browser 1440x900/390x844 dan transaksi akun nyata masih NOT_RUN karena sesi admin nyata belum tersedia pada lingkungan lokal.

- Dashboard memakai `cycleId` di URL sebagai konteks kerja dan meneruskannya pada navigasi. Sidebar tidak lagi menampilkan siklus/status statis.
- Dashboard menampilkan target live per kelompok, permintaan, rencana beli minimum, next action, rotasi, nilai pesanan, pembayaran diterima, sisa diketahui dan saldo legacy unknown. Copy target 20 dan stok sintetis dihapus.
- Form siklus hanya meminta Senin, target ayam/tahu editable dengan default 10, dan catatan. Selasa/Kamis/Minggu dihitung service. Siklus dibuat sebagai draf; browser tidak lagi memanggil cron atau menutup siklus lain.
- Detail siklus menyediakan harga draf, buka/tutup eksplisit dengan version check, perubahan target beralasan, dan alokasi rekap per varian. Alokasi di bawah demand atau total kelompok yang tidak sama dengan `max(target,demand)` ditolak di UI dan server.
- Pesanan web memakai kartu responsif dan input dialog: pencarian anggota, harga snapshot konsumen/pedagang, quantity kosong, ketersediaan per produk, preview uang integer, draf localStorage per cycle, serta `Simpan & berikutnya`. Harga tidak dikenal/nol dan siklus non-open tidak dapat disubmit.
- Mutation attempt menyimpan idempotency key untuk retry payload yang sama pada create cycle, target, harga, recap, open/close dan create order. Input berubah menghasilkan signature/key baru.
- Dialog memiliki `role=dialog`, aria label/description, focus entry, focus trap, Escape close dan restore focus. Kontrol utama mobile memiliki target 44 px; layout reflow tanpa tabel horizontal untuk pesanan.
- Antislop detector: 0 output. Contrast checks PASS untuk enam pasangan utama (rasio minimum 4.76:1). Targeted ESLint PASS, TypeScript PASS, production build PASS, `git diff --check` tanpa whitespace error.

Belum terbukti: screenshot browser dengan data terautentikasi, zoom 200%, keyboard ponsel, race availability melalui UI, refresh session sambil mempertahankan draf, dan fokus pada seluruh browser/AT. T12/T14 tetap memerlukan perangkat fisik.
