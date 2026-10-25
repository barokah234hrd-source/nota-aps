# Nota Surabaya — Pembuat Nota Pesanan Ayam Penyet Surabaya

Aplikasi PWA terpisah (varian dari Nota KQ5, dengan merek Ayam Penyet Surabaya) untuk membuat nota pesanan dengan cepat dan menyimpannya sebagai PDF. HTML/CSS/JavaScript tanpa build step dan tanpa library luar. Data tersimpan di IndexedDB (`nota-surabaya`) pada HP, tidak bercampur dengan aplikasi nota lain, bahkan bila dihosting di domain GitHub Pages yang sama. Cache service worker memakai awalan `notasby-`.

## Fitur
- **Rekening pembayaran:** isi di Pengaturan (bank/e-wallet, nomor, atas nama; boleh lebih dari satu). Selalu tampil di PDF, gambar nota, dan pesan WhatsApp ke pelanggan selama sudah diisi.
- **Tampilan simpel:** form hanya menampilkan nama, nomor WhatsApp, menu, dan total. Pilihan **Belum lunas / Lunas** selalu terlihat di form. Tanggal, jam, alamat, diskon, pajak, DP, dan catatan ada di *Opsi lainnya* (terbuka otomatis saat edit bila sudah terisi). Tombol utama *Buat & Kirim ke Pelanggan*, tombol kedua *Simpan Saja*.
- Buat nota: pelanggan, telepon, tanggal, jam di lokasi, alamat, daftar menu, diskon (Rp/%), pajak (%), DP, status lunas, catatan. Total dihitung otomatis.
- Nomor nota berurutan `N-0001`, nama berkas PDF `NOTA-TanggalNota-NomorUrut.pdf` (mis. `NOTA-20261022-0003.pdf`).
- PDF nota dibuat langsung di HP (tanpa internet), memakai logo Ayam Penyet Surabaya.
- **Kirim gambar nota:** *Buat & Kirim ke Pelanggan* dan *Kirim Gambar & Buka Chat* menyimpan gambar PNG lalu langsung membuka chat WhatsApp untuk nomor pelanggan. Lampirkan gambar nota dari unduhan dan tekan kirim di WhatsApp. Jika popup diblokir browser, buka chat pelanggan secara manual. Menu *Cara kirim lainnya* tetap menyediakan berbagi gambar lewat aplikasi/kontak pilihan, teks WhatsApp, teks ke grup, dan salin teks.
- Kirim WhatsApp ke pelanggan, kirim teks ringkas ke grup WhatsApp (pilih grup di WhatsApp), salin teks.
- Riwayat: cari, lihat, edit (nomor tetap), duplikat, tandai lunas, hapus, ekspor CSV.
- Menu cepat (nama + harga) agar harga terisi otomatis; autofill telepon dan alamat untuk pelanggan lama.
- Cadangan JSON (unduh/pulihkan), offline, bisa dipasang di layar utama.

## Catatan
- Nota ini bukan pembukuan: tidak ada laporan omzet atau laba.
- Data hanya di satu HP; hapus data browser = data hilang. Unduh cadangan rutin (Pengaturan).
- WhatsApp tidak mengizinkan aplikasi web melampirkan dan mengirim gambar otomatis ke nomor tertentu; pengguna tetap memilih gambar nota dan menekan kirim sendiri.
- Aplikasi tidak bisa memilih grup WhatsApp otomatis dan tidak tahu apakah pesan terkirim.

## Menjalankan & deploy
```
python3 -m http.server 8080      # lalu buka http://localhost:8080
node --test tests/nota.test.mjs
```
GitHub Pages: unggah isi folder ke repositori **baru** (atau subfolder), aktifkan Pages. Semua path relatif. Naikkan `VERSION` di `service-worker.js` setiap ada perubahan.
