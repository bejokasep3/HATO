# T03 — admin web dan API

`withAdmin` melindungi 32 handler pada 13 keluarga route bisnis. Browser memakai Supabase SSR cookie dan Next 16 proxy untuk refresh; Bearer native diverifikasi server dengan `getUser`, UUID admin dari `HATO_ADMIN_USER_ID`. Origin mutasi cookie harus cocok dengan `NEXT_PUBLIC_APP_URL`; respons bisnis no-store. Halaman login web memeriksa `/api/auth/me` sebelum masuk. Cron tanpa secret ->503, secret salah ->401, secret benar -> no-op karena auto transition belum aktif.

Node tests tanpa sesi/config dan origin salah PASS, TypeScript web PASS, `pnpm build` PASS. Belum ada akun admin/nonadmin test yang terverifikasi; uji kredensial/sesi nyata, cache/CDN, serta Data API/RLS belum dilakukan. Jangan deploy guard ke pengguna sebelum native auth dan identitas config siap.
