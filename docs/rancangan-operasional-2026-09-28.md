# Rancangan operasional HATO

Status: revisi rancangan setelah jawaban pemilik, belum implementasi. Tanggal 28 September 2026.

Panduan eksekusi terperinci untuk Sol: [docs/implementation/README.md](implementation/README.md). Dokumen ini menjelaskan arah produk; paket implementasi menetapkan urutan tugas, Dxx keputusan teknis, kontrak dan acceptance. Jika detail teknis berbeda, ikuti paket terbaru tanpa mengubah keputusan bisnis pengguna.

## Keputusan yang sudah pasti

| Hal | Keputusan pengguna |
|---|---|
| Pengguna | Satu manajer; belum akses aplikasi untuk PJ/anggota |
| Data | Transaksi nyata |
| Perangkat | Web, Android dan iPhone; lebih sering iPhone melalui Expo |
| Pencatatan | Input pesanan tetap manual |
| Periode | Senin sampai Minggu; rekap supplier Selasa, barang datang Kamis |
| Target | Per siklus dan bisa diubah; saat ini 10 kg ayam dan 10 bungkus tahu, gabungan semua varian per kelompok |
| Pembelian | Minimal sejumlah target; mengikuti pesanan aktual bila lebih besar |
| Order setelah rekap Selasa | Diterima hanya jika barang minggu itu masih cukup |
| Pembayaran | Bisa dicicil; siklus boleh ditutup dengan piutang |
| UX | Penyusunan diserahkan kepada agent |

Satuan, pengelompokan target, batas minimal pembelian, jadwal supplier dan order setelah rekap sudah dikonfirmasi. Detail implementasi berikut merupakan rancangan agent berdasarkan keputusan tersebut.

## Arah produk

HATO menjadi buku kerja mingguan manajer dengan pencatatan manual yang cepat dan angka yang bisa ditelusuri. Jalur utama: buka minggu dan isi target, catat pesanan, tinjau rekap, catat penerimaan, distribusikan, lalu catat pembayaran yang bisa berlanjut lintas minggu.

Pertahankan emerald/slate dan istilah Bahasa Indonesia yang konsisten. Tampilan iPhone menjadi acuan kenyamanan form dan tindakan harian; desktop dioptimalkan untuk input beruntun serta pemeriksaan banyak order. Android memakai kemampuan dan kontrak data yang sama.

Tidak memasukkan otomatisasi pembacaan WhatsApp, payment gateway atau aplikasi PJ ke milestone ini. Pesanan tetap dicatat oleh manajer.

## 1. Buka minggu dan isi target

Form Buka Minggu berisi periode Senin-Minggu, target ayam dalam kg, target tahu dalam bungkus, tanggal rekap Selasa dan kedatangan Kamis. Label periode dibentuk dari tanggal untuk menghindari nama minggu yang ambigu.

- Tanggal minggu dibantu otomatis; angka target wajib terlihat dan dikonfirmasi sebelum pembukaan.
- Siklus berikutnya boleh menawarkan salinan target sebelumnya sebagai nilai awal yang masih dapat diedit.
- Angka 10 hanya nilai awal saat ini, bukan konstanta di kode.
- Gunakan tanggal/waktu Asia/Jakarta. Usulan batas periode adalah Senin 00.00 sampai akhir Minggu; detail jam masih asumsi rancangan, belum keputusan tambahan pengguna.
- Awal implementasi memakai form pembukaan yang jelas. Automasi boleh menyiapkan draf mingguan setelah alur manual terbukti; tidak boleh diam-diam menetapkan target atau menyelesaikan operasi lama.
- Kalender, masa penerimaan pesanan, rekap supplier, kedatangan barang, dan pembayaran adalah konsep terpisah. Setelah rekap Selasa, pemesanan dibatasi jatah barang minggu tersebut sampai Minggu. Jangan otomatis menyamakan Selasa dengan penutupan siklus.

## 2. Target sebagai alat keputusan

Target adalah pembanding untuk total pesanan yang sah pada siklus tersebut dan batas minimum pembelian supplier yang dikonfirmasi pengguna. Target bukan batas maksimum order atau bukti stok diterima. Aplikasi menyiapkan usulan pembelian; manajer tetap memeriksa pembagian produk dan mengirim rekap secara manual.

Contoh berikut memakai kg ayam. Aturan yang sama berlaku untuk tahu dalam bungkus:

| Target | Pesanan aktual saat rekap | Tampilan | Usulan pembelian supplier |
|---:|---:|---|---:|
| 10 kg | 7 kg | Kurang 3 kg; tercapai 70%; ada 3 kg pembelian belum teralokasi | 10 kg |
| 10 kg | 10 kg | Target tercapai; 100% | 10 kg |
| 10 kg | 14 kg | Melebihi target 4 kg; 140% | 14 kg |

- Progress dihitung dari pesanan dibagi target. Angka di atas 100% tetap ditampilkan; bila bar visual berhenti di 100%, tambahan jumlah harus tetap jelas.
- Untuk target nol/tidak digunakan, tampilkan Tidak ditargetkan; jangan membagi dengan nol atau menampilkan pencapaian rekaan.
- Order batal tidak ikut total. Pembayaran yang belum lunas tidak mengurangi jumlah pesanan.
- Kelompok Ayam dan Tahu menggabungkan seluruh varian yang menjadi anggotanya secara eksplisit, bukan pencocokan kata pada nama. Anggota kelompok Ayam memakai kg dan Tahu memakai bungkus; jangan menjumlahkan kg dan ekor tanpa konversi yang disepakati. Produk baru perlu dipetakan ke kelompok secara sengaja.
- Target per siklus disimpan sebagai snapshot. Mengubah target minggu ini tidak mengubah minggu sebelumnya.
- Edit target menampilkan nilai lama dan baru serta waktu perubahan; perubahan setelah order masuk dicatat agar laporan dapat dijelaskan.
- Target yang baru hanya mengubah indikator pencapaian, tidak mengubah order, harga, tagihan atau stok.

Pada layar rekap, tampilkan empat angka terpisah: target, pesanan aktual, rencana pembelian supplier, barang diterima.

Usulan pembelian awal per kelompok = maksimum(target siklus, pesanan sah pada saat rekap). Stok lama tidak otomatis mengurangi minimum pembelian yang telah disepakati. Jika kelak stok lama dipakai memenuhi pesanan, alokasinya perlu dicatat dan perhitungan pembelian direvisi sesuai aturan yang disetujui; jangan otomatis mengarang carry-over.

Tambahan kuota dibagi ke varian oleh manajer sebelum rekap dikirim. Contoh: pesanan 4 kg karkas dan 3 kg recah dengan target 10 kg menyisakan tambahan pembelian 3 kg. Aplikasi menunjukkan kekurangannya dan meminta pembagian 3 kg tersebut, bukan memilih produk sendiri. Untuk tahu, gunakan prinsip sama pada tahu kuning/putih atau varian lain yang terdaftar.

Rekap yang dikonfirmasi menyimpan snapshot produk dan quantity, target saat rekap, serta waktu konfirmasi. Perubahan target atau pesanan sesudahnya menghasilkan selisih terhadap snapshot, bukan mengubah rekap terkirim secara diam-diam. Edit target setelah rekap tidak menambah jatah barang atau mengirim pembelian baru; tampilkan dampaknya terhadap pembelian yang sudah dikonfirmasi. Nilai stok aktual baru berubah setelah penerimaan terkonfirmasi; sisa pembelian belum teralokasi sebelum Kamis adalah proyeksi, bukan stok fisik.

Setelah barang datang, bedakan stok fisik yang belum didistribusikan dari stok bebas yang belum dialokasikan untuk order. Barang rusak tidak dihitung sebagai stok layak. Detail carry-over dan retur diperinci pada modul Barang.

### Order setelah rekap: jangan menjual jatah yang sudah dipakai

Pengecekan dilakukan per produk/varian. Sisa tahu putih tidak otomatis memenuhi order tahu kuning; sisa kelompok ayam tidak berarti semua varian tersedia.

- Sebelum penerimaan: usulan operasional menggunakan kapasitas pada rekap supplier yang sudah dikonfirmasi, dikurangi alokasi order sah. Label layar Jatah tersisa, barang belum diterima. Ini pemesanan atas kedatangan yang direncanakan, bukan pengakuan stok fisik.
- Setelah penerimaan: gunakan jumlah layak aktual dikurangi jumlah yang sudah didistribusikan serta alokasi order yang belum didistribusikan. Jangan mengurangi order terdistribusi dua kali.
- Submit order, penambahan quantity dan perubahan varian harus diperiksa server secara atomik terhadap sisa jatah yang relevan. Jika tidak cukup, jelaskan jumlah tersedia dan jangan menyimpan sebagian order diam-diam.
- Pembatalan melepaskan alokasi barang yang belum didistribusikan. Barang yang sudah keluar hanya kembali menjadi stok jika ada penerimaan retur nyata.
- Bila penerimaan lebih kecil daripada order yang sudah dialokasikan, tampilkan daftar kekurangan yang perlu diselesaikan manajer; hentikan penambahan alokasi pada produk itu. Jangan diam-diam mengurangi pesanan atau mengarang penerimaan.
- Sesudah rekap, pesanan tambahan yang masih tertampung meningkatkan pencapaian target, tetapi tidak mengubah pembelian supplier yang sudah dikonfirmasi.

Contoh: rekap supplier 10 kg untuk suatu produk, sudah dialokasikan 7 kg. Tambahan 2 kg boleh, sisa jatah menjadi 1 kg. Order baru 2 kg berikutnya ditolak dengan informasi hanya 1 kg tersedia. Angka ini ilustrasi aturan, bukan data transaksi pengguna.

## 3. Input manual yang cepat

Urutan: pilih anggota, isi jumlah produk, periksa total, simpan.

- Siklus terbawa dari layar sebelumnya; perubahan siklus dilakukan secara sengaja.
- Cari anggota berdasarkan nama/grup, dengan konteks yang cukup untuk membedakan nama sama.
- Jika anggota sudah memiliki order pada siklus itu, tampilkan Lanjutkan pesanan dan buka order tersebut, bukan hanya error duplikat.
- Produk yang sering dipakai dapat ditampilkan sebagai daftar quantity. Jangan membuat quantity 1 atau memilih anggota secara diam-diam.
- Harga konsumen/pedagang dibaca dari siklus terpilih. Jika harga belum lengkap, simpan diblokir dengan penjelasan produk mana yang perlu diatur.
- Tombol Simpan & berikutnya mempertahankan siklus, membersihkan anggota/quantity, dan mengembalikan fokus ke pencarian anggota.
- Draf form disimpan lokal dengan cycleId dan identitas admin. Draf belum berarti order tersimpan dan harus dibersihkan setelah sukses/logout. Kebutuhan jaringan offline penuh ditunda.
- Jika respons simpan terputus, cek hasil melalui idempotency key sebelum mencoba lagi agar tidak terjadi order/pembayaran ganda.

iPhone/Android: form layar penuh, keyboard numerik yang menerima jumlah pecahan sesuai satuan, total dan simpan mudah dijangkau ketika keyboard terbuka. Desktop: input beruntun dengan keyboard dan panel yang tidak menutupi daftar kerja seluruhnya.

## 4. Cicilan dan piutang

Tampilan ringkas per order: Total tagihan, Sudah dibayar, Sisa, lalu Catat pembayaran.

Contoh ilustratif: tagihan Rp150.000, pembayaran pertama Rp50.000 dan kedua Rp40.000 menghasilkan Sudah dibayar Rp90.000 dan Sisa Rp60.000. Ini contoh rancangan, bukan transaksi pengguna.

Status diturunkan dari catatan pembayaran:

- Belum bayar: belum ada pembayaran efektif.
- Sebagian: pembayaran efektif lebih dari nol tetapi kurang dari tagihan.
- Lunas: tagihan tertutup oleh pembayaran efektif sesuai aturan pembulatan yang dipakai aplikasi.

Form pembayaran memuat nominal dan tanggal/waktu, dengan metode serta catatan/referensi sebagai informasi pendukung. Catatan pembayaran tidak ditimpa oleh toggle Lunas/Belum Lunas. Sediakan Lunasi sisa sebagai pintasan yang memperlihatkan nominal sebelum disimpan.

- Riwayat cicilan tetap ada setelah siklus ditutup dan muncul pada Piutang lintas siklus.
- Koreksi pembayaran dilakukan melalui pembatalan tercatat/alasan dan catatan pengganti, bukan penghapusan tanpa jejak.
- Default usulan milestone: alokasi per order. Pembayaran gabungan beberapa order/PJ memerlukan pembagian yang eksplisit dan ditambahkan bila workflow membutuhkannya.
- Default usulan: cegah kelebihan bayar sebelum ada aturan saldo titipan/refund yang disepakati. Dua pembayaran bersamaan harus memeriksa sisa dalam transaksi, bukan hanya pada layar.
- Edit tagihan yang membuat total lebih kecil daripada uang sudah dibayar tidak boleh selesai diam-diam; arahkan ke koreksi/refund yang terkontrol.
- Harga order merupakan snapshot. Perubahan harga katalog berikutnya tidak otomatis mengubah tagihan yang sudah dicatat.

## 5. Penutupan Minggu

Penutupan periode tidak berarti pembayaran lunas atau barang sudah seluruhnya didistribusikan.

- Pada akhir minggu, layar penutupan merangkum order, penerimaan/distribusi yang belum tuntas, dan sisa piutang.
- Piutang tetap melekat pada order dan siklus asal, kemudian dapat dibayar pada minggu berikutnya.
- Ada perbedaan antara periode pemesanan ditutup dan operasional distribusi selesai.
- Membuka Senin berikutnya tidak menghapus atau mengubah status pembayaran minggu lalu.
- Usulan default: order baru untuk periode yang ditutup membutuhkan tindakan Buka untuk koreksi dengan alasan; pembayaran tetap dapat dicatat. Kebijakan koreksi ini disampaikan sebagai usulan, belum izin mengubah histori nyata.

## 6. Susunan layar

| Tujuan utama | Isi |
|---|---|
| Minggu Ini | Siklus terpilih, target vs pesanan, pekerjaan mendesak, akses input dan rekap |
| Pesanan | Cari anggota/order, input beruntun, edit, rekap supplier |
| Barang | Rencana pembelian, penerimaan, selisih/rusak, distribusi |
| Pembayaran | Catat cicilan, lunasi sisa, piutang semua minggu, riwayat |

Komunitas, Produk & Harga, Arsip, Laporan dan Peringkat berada di Lainnya/data pendukung. Pemilih siklus konsisten pada layar operasional. Layar Pembayaran menampilkan semua piutang secara default dengan filter siklus yang terlihat, agar utang lama tidak tersembunyi.

Pada HP, ringkasan disederhanakan sehingga daftar kerja segera terlihat. Kartu order memuat nama, jumlah tagihan, sisa pembayaran dan aksi. Pada desktop, tabel tetap dipakai untuk membandingkan banyak order.

Kondisi loading, kosong, error dan draf belum terkirim memiliki tampilan berbeda. Semua tindakan bernilai uang menampilkan order/anggota, nominal dan hasil simpan yang jelas. Tidak ada label technical seperti pending/shipped yang bercampur tanpa kebutuhan pengguna.

## 7. Model dan migrasi yang diperlukan

Model yang diusulkan: CycleTarget untuk target per siklus/kelompok produk, SupplierRecap beserta item untuk snapshot rekap yang dikonfirmasi, Payment untuk setiap pembayaran, PaymentReversal atau status koreksi tercatat, dan AuditEvent untuk perubahan target/order/status penting. Nama/model final mengikuti desain teknis setelah aturan bisnis selesai.

Order menyimpan snapshot harga, jumlah tagihan dan versi untuk mencegah overwrite antar perangkat. Status cicilan diturunkan dari pembayaran efektif; bila ada field ringkasan yang disimpan, harus diperbarui dalam transaksi yang sama.

Data lama tidak boleh diisi ulang menggunakan target 10 secara massal. Target historis diambil dari sumber yang dapat dibuktikan atau ditandai belum diketahui. Stok hasil asumsi tidak dimigrasikan menjadi penerimaan fisik.

Order lama berstatus paid memerlukan rekonsiliasi sebelum menjadi saldo pembayaran awal. Pertahankan jumlah dan paidAt yang diketahui, tandai asal catatan migrasi, dan jangan mengarang rincian cicilan/metode/tanggal yang tidak tersedia.

Sebelum perubahan database: identifikasi environment aktif, verifikasi backup yang dapat dipulihkan, jalankan migrasi pada lingkungan uji, bandingkan jumlah order, total tagihan dan saldo pembayaran. Rancangan ini tidak memberi instruksi mengubah database live pada sesi review.

## 8. Tahapan pelaksanaan

1. Benarkan keamanan akses dan kontrak API mobile; siapkan lingkungan verifikasi yang terpisah dari transaksi nyata.
2. Terapkan periode Senin-Minggu, target per siklus, konteks bersama, dan pisahkan angka target dari stok aktual.
3. Terapkan catatan cicilan beserta riwayat dan migrasi saldo yang sudah direkonsiliasi.
4. Selesaikan input manual beruntun dan keempat layar utama pada web/native dengan bahasa yang sama.
5. Verifikasi penerimaan/distribusi, laporan dan performa pada data representatif; optimalkan berdasarkan masalah yang masih terlihat.

Setiap tahap harus selesai sebagai alur yang dapat digunakan, bukan hanya kumpulan komponen. Antislop tetap dilakukan setelah review/implementasi awal sesuai pilihan pengguna; Impeccable dipakai untuk konsistensi hierarki dan interaksi.

## 9. Kriteria penerimaan

- Target 10 dengan order 7/10/14 menghasilkan kurang 3/tercapai/lebih 4 dan usulan pembelian 10/10/14; tidak membatasi order atau menciptakan stok sebelum penerimaan.
- Tambahan kuota dibagi ke varian oleh manajer; total item rekap sesuai usulan pembelian yang dikonfirmasi.
- Rekap Selasa tetap memiliki snapshot; perubahan target/order setelah rekap menunjukkan selisih tanpa mengubah snapshot terkirim.
- Setelah rekap, tambahan 2 kg pada jatah 10 kg dengan alokasi awal 7 kg berhasil; tambahan 2 kg berikutnya ditolak karena sisa hanya 1 kg. Dua submit bersamaan tidak boleh melampaui jatah.
- Penerimaan kurang/rusak memunculkan kekurangan terhadap alokasi order, bukan stok negatif yang disembunyikan atau order yang diubah otomatis.
- Target minggu ini diubah tanpa mengubah target dan laporan historis siklus lain.
- Satu perhitungan harga/target/status dipakai web dan mobile; kontrak respons diuji, bukan hanya compile.
- Cicilan Rp50.000 + Rp40.000 pada tagihan Rp150.000 menyisakan Rp60.000; pencatatan ulang request yang sama tidak menggandakan pembayaran.
- Menutup Minggu dan membuka Senin mempertahankan piutang lama; pembayaran berikutnya tetap mengurangi order asal.
- Sepuluh input manual berurutan tidak mengharuskan memilih ulang siklus atau membuka form dari awal.
- Daftar pesanan HP menampilkan aksi utama tanpa geser horizontal; form tidak kehilangan simpan karena keyboard/safe area.
- Gagal jaringan menampilkan retry atau status belum terkirim, mempertahankan draf, dan tidak mengaku sukses.
- Validasi manual pada iPhone melalui Expo sebagai perangkat utama, kemudian Android; browser responsif tidak menggantikan uji native.
- Jumlah order, total tagihan dan saldo pembayaran sebelum/sesudah migrasi dapat direkonsiliasi; tidak ada penghapusan transaksi nyata untuk membuat test lulus.

Anggaran awal: satu putaran skenario di atas pada lingkungan uji, perbaikan penghambat, lalu satu retest terarah. Pengukuran waktu tugas dilakukan sebelum/sesudah; belum ada klaim peningkatan kecepatan tertentu.
