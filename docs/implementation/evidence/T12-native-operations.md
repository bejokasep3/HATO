# T12 — native Minggu Ini, target, rekap, input cepat

Status: CODE_VERIFIED + DEVICE_PENDING.

- Tab utama memakai kontrak dashboard ledger: konteks siklus, target live/demand/rencana beli, langkah berikutnya, pembayaran diterima, sisa diketahui, unknown balance dan rotasi.
- Detail siklus memakai open/close dengan `expectedVersion`; target ayam/tahu dapat diedit dengan alasan; rekap supplier dialokasikan per varian, divalidasi, dikonfirmasi sebagai snapshot, lalu dapat dibagikan lewat native Share.
- Toggle pembayaran dan PATCH status siklus generik dihapus dari caller mobile. Badge pembayaran kini hanya status; layar cicilan khusus disiapkan pada T14.
- Form pesanan mempertahankan siklus, anggota, pencarian, quantity, catatan, dan idempotency key melalui storage per cycle. Retry payload yang sama memakai key yang sama; hasil sukses menghapus draf. Koma dinormalisasi menjadi titik sebelum request.
- Semua kontrol baru memiliki press feedback dan tinggi minimal 44 px. Dashboard memakai grouped rows dan divider agar tidak menjadikan setiap angka sebagai card.
- Mobile TypeScript PASS. Expo export final PASS untuk iOS, Android, dan web setelah seluruh perubahan T12.

Belum terbukti: iPhone Expo Go, Android fisik, keyboard, safe area, app background/return, refresh token saat draf aktif, native Share pada perangkat, dan interaksi target/rekap akun nyata. Semua tetap DEVICE_PENDING; bundle bukan pengganti uji perangkat.
