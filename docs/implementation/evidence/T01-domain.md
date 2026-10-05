# T01 — domain dan kontrak

Ada kontrak Zod di `shared/contracts/` serta fungsi kalender WIB, target/rekap, availability, uang dua desimal dan cicilan di `src/lib/domain/`. Web dan mobile typecheck lulus. Expo export iOS/Android/web membundel kontrak shared yang dipakai adapter mobile. Uji pure/contract termasuk A01-A07 bagian hitung, A09 bagian saldo, A10 bentuk respons, A21 uang/quantity; ini belum menggantikan integrasi DB.

Node test runner `node --import tsx --test` menghasilkan 16/16 PASS pada checkpoint T04. T01 diterima untuk cakupan pure; A03/05/09 masih butuh service integration sesuai kartu berikutnya.
