# T09 — ledger cicilan

Status: CODE_VERIFIED pada PostgreSQL lokal; saldo historis nyata belum direkonsiliasi.

- POST pembayaran menambah baris ledger positif dengan metode, waktu, catatan dan actor; order row lock menjaga outstanding. Pembayaran tetap diizinkan setelah cycle closed. Retry idempotency tidak menambah baris kedua.
- Reverse sekali mencatat alasan, actor/time dan audit tanpa menghapus baris. Payment summary dihitung dari ledger non-reversed; `ledgerReconciledAt=null` menghasilkan status `unverified` dengan paid/outstanding null.
- Piutang memakai pagination, menggabungkan semua siklus, menghitung total known outstanding dan menghitung order belum diverifikasi terpisah. Total diberi `totalIncomplete=true` bila ada saldo unknown.
- Integrasi payments 1/1 PASS: dua pembayaran yang bersaing saat sisa Rp60.000 hanya satu berhasil; reverse sekali dan replay; payment bersamaan dengan pengurangan total order tidak menghasilkan overpay; piutang dari siklus tertutup tetap muncul. TypeScript/lint area PASS, build Next PASS.

Pengujian saldo historis dan akun nyata masih tertunda. Script fixture T05 bukan prosedur rekonsiliasi pengguna.
