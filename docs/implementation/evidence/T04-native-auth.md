# T04 — sesi native

Expo SecureStore 57.0.4 dipakai untuk sesi Supabase, dipecah ke potongan kecil agar tidak bergantung pada dukungan nilai besar perangkat lama. Expo Router protected routes menutup layar bisnis sebelum token diverifikasi lewat `/api/auth/me`. Native request menambah Bearer token; bila respons401, refresh lalu retry sekali dengan request body/header yang sama. Login, logout dan pesan koneksi terpasang. Dependensi mobile dan kedua lockfile telah diperbarui.

TypeScript mobile PASS; Expo export iOS/Android/web PASS. Tidak ada uji fisik iPhone/Android, akun nyata, atau token refresh network nyata. Status CODE_VERIFIED, DEVICE_PENDING. Draf lokal order belum dibuat (cakupan T12), sehingga penghapusan draf saat logout menyusul.
