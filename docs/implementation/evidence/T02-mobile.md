# T02 — kontrak mobile existing

Adapter membaca `{cycle,recap}` dan nested product/member/group, harga konsumen/pedagang dari endpoint harga siklus. Form order mengganti harga default yang tidak tersedia dengan harga siklus, mengirim `priceType` dan menahan submit saat harga/error/jumlah tidak sah. Route sementara toggle pembayaran menunjuk PATCH `/api/orders` sesuai server existing. Daftar refetch saat kembali fokus dan menampilkan error reload.

Empat tests A10 fixture sintetis PASS, TypeScript mobile PASS, Expo export iOS/Android/web PASS. Tidak ada submit order nyata. UI iPhone/Android fisik belum diuji; perubahan ini masih kompatibilitas sebelum ledger baru.
