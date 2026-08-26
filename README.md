# 🏬 KOPDAR — Koperasi Darat | POS + Gudang + Toko Online

**Belanja Hemat, Hidup Lebih Dekat.**

Prototype sistem retail lengkap: **Point of Sale (Kasir)**, **Manajemen Gudang**,
dan **Toko Online Customer**, 100% berjalan di browser menggunakan `localStorage`
sebagai database sementara. Dibangun sebagai static website sehingga bisa
langsung di-deploy ke **GitHub Pages** tanpa server backend.

> ⚠️ **Ini adalah prototype/demo.** `localStorage` bukan database yang aman dan
> autentikasi berbasis client-side ini **tidak cocok untuk produksi**. Lihat
> bagian [Catatan Keamanan](#-catatan-keamanan) di bawah.

---

## 🆕 Upgrade Terbaru: Foto Produk, Warna, UI/UX & Master Barang

Versi ini adalah hasil overhaul besar dari versi sebelumnya. Ringkasan cepat:

- **217 produk demo** dengan nama & merek retail Indonesia yang umum (Aqua, Indomie,
  Teh Pucuk, Rinso, dll) — lihat [Catatan Sumber Data](#-catatan-sumber-data-produk--harga).
- **Setiap produk kini punya "foto"** berupa ilustrasi kemasan (botol/kotak/pouch/tube)
  yang digenerate otomatis sesuai kategori — bukan emoji besar lagi. Admin gudang bisa
  upload foto asli kapan saja untuk menggantikannya.
- Product card baru: rating, jumlah terjual, badge promo/diskon %, ranking best seller.
- Homepage baru: quick filter (Promo/Terlaris/Terbaru/Termurah/Stok Tersedia), kartu
  kategori visual, section Produk Baru & Hampir Habis, Trust section.
- Warna & tema diperbarui (emerald `#0F766E`, orange `#F97316`, kuning/biru/merah status).
- Skema database naik ke **v2** dengan migrasi otomatis yang **tidak menghapus data lama**.

Detail lengkap ada di bagian [Ringkasan Perubahan](#-ringkasan-perubahan-upgrade-total) di bawah.

---

## 📁 Struktur Folder

```
/
├── index.html          # Toko online (customer)
├── kasir.html           # Dashboard Admin Kasir / POS
├── gudang.html           # Dashboard Admin Gudang
├── css/
│   ├── style.css          # Design system utama + halaman customer
│   ├── kasir.css           # Layout dashboard admin & POS
│   └── gudang.css           # Layout khusus halaman gudang
├── js/
│   ├── database.js          # Abstraksi localStorage + seed data demo + migrasi schema
│   ├── product-image.js       # Generator ilustrasi kemasan produk + fallback foto
│   ├── auth.js                # Login/session admin & customer
│   ├── products.js             # CRUD produk + import/export CSV
│   ├── cart.js                   # Keranjang belanja (customer & kasir)
│   ├── transaction.js              # Transaksi, stok, kas, order online
│   ├── branches.js                   # Manajemen cabang
│   ├── reports.js                      # Laporan + chart ringan (canvas)
│   ├── ui.js                             # Toast, modal, tema, dsb
│   ├── app.js                              # Logika index.html
│   ├── kasir.js                              # Logika kasir.html
│   └── gudang.js                               # Logika gudang.html
├── assets/
│   ├── images/
│   └── icons/
└── README.md
```

## 🚀 Cara Menjalankan Secara Lokal

Karena menggunakan `fetch`/module path relatif, buka lewat local server (bukan
`file://`) agar tidak ada isu CORS pada beberapa browser:

```bash
# Python
python3 -m http.server 8080

# atau Node.js
npx serve .
```

Lalu buka `http://localhost:8080/index.html`.

## ☁️ Cara Upload ke GitHub Pages

1. Buat repository baru di GitHub, misalnya `nama-project`.
2. Push seluruh isi folder ini ke branch `main`.
3. Buka **Settings → Pages** pada repository.
4. Pilih source: branch `main`, folder `/ (root)`.
5. Tunggu beberapa menit, situs akan aktif di:
   `https://username.github.io/nama-project/`

Semua path aset sudah menggunakan path relatif (`./css/...`, `./js/...`)
sehingga aman digunakan pada *project repository* (bukan hanya `username.github.io`).

## 👤 Akun Demo

| Peran | Email | Password | Akses |
|---|---|---|---|
| Super Admin | `admin@kopdar` | `admin123` | Semua akses (Kasir + Gudang + Cabang + Pengaturan) |
| Admin Kasir | `kasir@kopdar` | `kasir123` | POS, Transaksi, Pesanan, Kas, Laporan Penjualan |
| Admin Gudang | `gudang@kopdar` | `gudang123` | Produk, Stok, Barang Masuk/Keluar, Transfer, Supplier |

Akun customer dapat dibuat langsung lewat tombol **Daftar** di halaman toko.

### Cara Membuka Login Admin

Login admin **sengaja disembunyikan** dari navigasi publik. Klik logo/nama
toko di pojok kiri atas halaman **5 kali berturut-turut dalam 3 detik** untuk
memunculkan modal Login Admin.

## 🛠️ Cara Mengisi / Update Master Produk

1. Login sebagai **Admin Gudang** (atau Superadmin) → buka halaman **Produk**.
2. Klik **+ Tambah Produk**, isi nama, kategori, subkategori, merek, harga, stok awal, dst.
3. Simpan — produk langsung muncul di POS kasir dan toko online.
4. Untuk edit massal, gunakan **Export CSV** untuk mengunduh seluruh katalog, edit
   di Excel/Spreadsheet, lalu **Import CSV** untuk memasukkan kembali (baris dengan
   SKU yang sudah ada akan di-update, SKU baru akan ditambahkan sebagai produk baru).

## 🖼️ Cara Mengganti Foto Produk

1. Di halaman **Gudang → Produk**, klik **Edit** pada produk yang ingin diberi foto asli.
2. Di bagian **Foto Produk**, klik **Pilih Foto** dan unggah gambar dari perangkat Anda
   (disarankan format persegi 1:1, maksimal 1.5MB agar localStorage tidak cepat penuh).
3. Foto otomatis disimpan sebagai Data URL di database lokal dan langsung menggantikan
   ilustrasi kemasan otomatis di semua tempat (toko online, POS, tabel admin).
4. Klik **Hapus Foto** untuk kembali memakai ilustrasi kemasan otomatis.

> Catatan: karena disimpan di localStorage browser, foto **tidak ikut ter-upload ke
> GitHub Pages** dan hanya terlihat di browser tempat foto diunggah. Untuk produksi,
> pindahkan penyimpanan foto ke object storage/CDN (lihat bagian migrasi database).

## 💲 Cara Update Harga & Promo

- **Harga jual/beli**: edit langsung di form produk (Gudang → Produk → Edit).
- **Promo/diskon**: centang **Aktifkan Promo** lalu isi **Harga Promo (Rp)** — badge
  diskon otomatis dihitung dan tampil di toko online, POS, serta section "Promo Hari Ini".
- **Penanda produk** (Terlaris/Baru/Unggulan) bisa dicentang manual, atau otomatis
  ditandai "Terlaris" oleh sistem berdasarkan jumlah transaksi riil (10 produk dengan
  penjualan tertinggi ditandai `isBestSeller` ulang setiap kali reset data demo).

## 🔄 Reset & Backup Database

Semua data (produk, transaksi, cabang, dst) tersimpan di localStorage dengan
key `app_database_v1`. Tersedia di halaman **Kasir → Pengaturan** (khusus
Super Admin):

- **Export JSON** — mengunduh seluruh database sebagai file `.json`.
- **Import JSON** — memuat kembali file backup yang pernah diekspor.
- **Reset Demo Data** — menghapus seluruh data dan membuat ulang data demo
  awal (5 cabang, 3 admin, ±20 customer, 217 produk, transaksi & order contoh).

Produk juga mendukung **Export/Import CSV** tersendiri di halaman
**Gudang → Produk**, terpisah dari backup JSON penuh.

## 🧠 Tentang localStorage & Migrasi ke Backend Nyata

Prototype ini memakai satu lapisan abstraksi (`js/database.js`, objek `DB`)
dengan API seperti:

```js
DB.get('products')
DB.insert('products', data)
DB.update('products', id, patch)
DB.delete('products', id)
DB.find('products', predicateOrId)
DB.filter('products', predicate)
```

Seluruh modul lain (`products.js`, `transaction.js`, dst) **hanya** memanggil
fungsi `DB.*` ini, tidak pernah mengakses `localStorage` secara langsung.
Untuk migrasi ke backend sungguhan:

1. **Firebase / Supabase** — ganti isi setiap fungsi di `database.js` agar
   memanggil Firestore/Supabase client, dengan mempertahankan signature
   fungsi yang sama (`get`, `insert`, `update`, `delete`, `find`, `filter`).
2. **REST API custom** — ganti isi fungsi tersebut menjadi pemanggilan
   `fetch()` ke endpoint API Anda.
3. **Foto produk** — pindahkan `product.image` dari Data URL localStorage
   ke URL object storage/CDN (S3, Cloudinary, dll); form upload di
   `gudang.js` (`bindProductForm`) tinggal diarahkan untuk upload ke API
   tersebut alih-alih `FileReader.readAsDataURL`.
4. Karena seluruh modul lain bergantung pada kontrak fungsi tersebut (bukan
   langsung ke localStorage), perubahan cukup dilakukan di satu file ini saja.

### Schema versioning & migrasi otomatis

Database memakai `SCHEMA_VERSION` (saat ini `2`). Saat versi database di
localStorage pengguna lebih lama dari `SCHEMA_VERSION` saat ini, `database.js`
menjalankan fungsi migrasi (`migrateV1ToV2`, dst) yang **hanya menambah field
baru** pada data lama — data `customers`, `orders`, `transactions`,
`cashTransactions`, `stockMovements`, `branches`, `users`, dan `suppliers`
**tidak pernah dihapus** oleh proses migrasi ini. Jika Anda menambah field
baru di masa depan, tambahkan fungsi migrasi baru di `MIGRATIONS` dan naikkan
`SCHEMA_VERSION`, jangan mengganti `emptyState()` secara langsung.

Autentikasi (`auth.js`) juga perlu dipindahkan ke layanan auth sungguhan
(Firebase Auth, Supabase Auth, atau JWT dari API Anda) — jangan gunakan pola
login berbasis localStorage ini di produksi.

## 📌 Catatan Sumber Data Produk & Harga

Katalog demo (217 produk) memakai **nama produk dan merek yang umum dijual di
ritel/minimarket Indonesia** (Aqua, Indomie, Teh Pucuk Harum, Rinso, dst) agar
katalog terasa realistis dan familiar. Beberapa hal penting:

- **Ini BUKAN salinan database internal Alfamart, Indomaret, atau jaringan
  minimarket mana pun.** Tidak ada data yang diambil dari sistem internal
  mereka.
- **Harga adalah referensi/estimasi**, bukan harga resmi satu jaringan retail
  tertentu. Setiap produk memiliki field `priceSource` (keterangan sumber
  harga) dan `priceCheckedAt`/`lastVerified` (tanggal referensi harga dibuat).
  Field-field ini disimpan di database dan bisa ditampilkan di UI admin bila
  diperlukan.
- **Foto produk bukan foto asli hasil scraping** — melainkan ilustrasi kemasan
  yang digenerate otomatis (lihat bagian di bawah), untuk menghindari masalah
  hak cipta foto produk/brand pihak ketiga dan risiko hotlink yang rapuh.
- Harga di dunia nyata **berbeda-beda tergantung wilayah, cabang, dan periode
  promo** — jangan jadikan angka di demo ini sebagai acuan harga resmi.
- Sumber: *"Master Produk Retail Indonesia — Demo"* (`sourceName` di setiap
  produk), dibuat manual berdasarkan pengetahuan umum produk consumer goods
  yang lazim beredar di Indonesia, bukan hasil scraping situs tertentu.

### Kenapa foto produk pakai ilustrasi, bukan foto asli?

Tiga alasan (dijelaskan juga sebagai komentar di `js/product-image.js`):

1. **Stabilitas** — hotlink ke gambar eksternal mudah rusak/berubah sewaktu-waktu,
   melanggar prinsip "jangan pernah menampilkan broken image".
2. **Hak cipta** — foto kemasan & logo brand adalah milik pemilik merek; memakainya
   secara massal untuk 200+ produk tanpa lisensi eksplisit berisiko secara hukum.
3. **Performa & GitHub Pages** — tanpa dependency jaringan eksternal, katalog
   tetap instan dan 100% berjalan offline setelah dimuat pertama kali.

Sebagai gantinya, `js/product-image.js` men-generate ilustrasi kemasan (SVG)
per produk secara otomatis: bentuk siluet (botol/kotak/pouch/tube) sesuai
kategori, warna gradient konsisten, dan nama produk/brand — cukup meyakinkan
sebagai placeholder visual sambil tetap 100% legal dan tidak pernah patah.
**Admin dapat mengunggah foto asli kapan saja** lewat form produk di halaman
Gudang, yang otomatis menggantikan ilustrasi tersebut di seluruh sistem.

## 🔐 Catatan Keamanan

- Password admin & customer pada demo ini **disimpan sebagai plain text** di
  localStorage — hanya untuk keperluan demo/prototype.
- Session login hanya disimpan di localStorage browser, bisa dengan mudah
  dimanipulasi lewat DevTools. **Jangan gunakan untuk data nyata/produksi.**
- Sebelum digunakan secara nyata, seluruh autentikasi & otorisasi wajib
  dipindahkan ke backend dengan hashing password, token tervalidasi server,
  dan aturan akses (role-based access control) yang diberlakukan di server,
  bukan hanya di client.
- Input pengguna sudah melalui sanitasi dasar (escape HTML) untuk mencegah
  XSS sederhana, namun ini bukan pengganti validasi & sanitasi sisi server.
- Upload foto produk memakai `FileReader`/Data URL di sisi klien — cocok untuk
  demo, namun untuk produksi foto sebaiknya divalidasi & disimpan di server/CDN.

## ✨ Fitur Utama

- **Toko Online**: pencarian, kategori visual, quick filter (promo/terlaris/
  terbaru/termurah/stok tersedia), keranjang, checkout (ambil sendiri /
  delivery), login/register customer, riwayat & status pesanan, integrasi
  link WhatsApp otomatis, trust section, ilustrasi foto produk per kategori.
- **Kasir / POS**: pencarian & input barcode manual, keranjang kasir dengan
  foto produk, diskon, multi metode pembayaran, hitung kembalian otomatis,
  cetak struk, dashboard omzet harian + grafik + feed aktivitas real-time.
- **Gudang**: CRUD produk lengkap dengan upload foto, promo, subkategori,
  berat/volume, barang masuk/keluar, transfer antar cabang, stock opname,
  manajemen supplier, laporan gudang, dashboard dengan feed pergerakan stok.
- **Kas**: pencatatan uang masuk/keluar dengan kategori, saldo kas otomatis.
- **Multi Cabang**: setiap transaksi, stok, dan laporan dapat difilter per
  cabang.
- **Laporan**: penjualan, produk terlaris/tersedikit, stok kritis/habis,
  kas, dan omzet per cabang — dengan export CSV.
- **Dark/Light Mode**, **responsive penuh** (mobile, tablet, desktop),
  **empty state**, **toast notification**, dan **role-based access** untuk
  Superadmin / Admin Kasir / Admin Gudang.

---

Dibangun sebagai prototype **Mini Retail Management System + Online Store**,
siap dikembangkan lebih lanjut ke database & backend produksi sesungguhnya.

