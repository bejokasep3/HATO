# T07 — rekap supplier

Status: CODE_VERIFIED pada database uji lokal `hato_recap`; belum siap rilis karena T08 writer order lama belum memakai cycle lock.

- GET pratinjau menghitung demand order aktif per produk dan target gabungan AYAM/TAHU. Ia hanya membaca data dan menampilkan kekurangan yang harus dibagi manajer ke varian.
- POST konfirmasi mengambil cycle row lock, memeriksa `expectedVersion` dan demand ulang, menolak pembagian di bawah demand atau total yang tidak tepat, lalu menyimpan snapshot target dan produk sekali. Salin teks WhatsApp berasal dari snapshot; tidak mengirim pesan.
- Integrasi 1/1 PASS: pesanan masuk setelah pratinjau membuat konfirmasi versi lama 409; alokasi total9 saat target10 ditolak; replay key tidak menambah rekap; target berubah menjadi12 setelah konfirmasi namun snapshot tetap10; penggantian nama produk tidak mengubah teks rekap. Root TypeScript dan lint area T07 PASS.

Race sungguhan antara API order dan konfirmasi rekap masih menunggu T08. Pesanan pada fixture disisipkan langsung sambil meningkatkan version untuk menguji stale preview, bukan bukti seluruh writer sudah memakai lock.
