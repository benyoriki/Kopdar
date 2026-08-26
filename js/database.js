/**
 * database.js
 * ------------------------------------------------------------------
 * Lapisan abstraksi database berbasis localStorage.
 * Semua modul WAJIB mengakses data lewat objek `DB` di file ini,
 * jangan panggil localStorage langsung dari file lain.
 *
 * Struktur penyimpanan:
 *   localStorage["app_database_v1"] = {
 *     products: [...], customers: [...], orders: [...], ...
 *   }
 *
 * Untuk migrasi ke Firebase/Supabase/REST API di masa depan, cukup
 * ganti isi fungsi get/set/insert/update/delete/find/filter di bawah
 * ini menjadi pemanggilan API/SDK yang sesuai — seluruh kode di
 * modul lain (products.js, cart.js, dst) tidak perlu diubah karena
 * mereka hanya bergantung pada kontrak fungsi `DB.*`.
 *
 * CATATAN SUMBER DATA PRODUK (baca sebelum mengubah katalog demo):
 * Katalog demo memakai nama produk & merek yang umum dijual di
 * ritel/minimarket Indonesia agar terasa realistis. ITU BUKAN salinan
 * database internal jaringan minimarket mana pun — harga adalah
 * REFERENSI/ESTIMASI (field priceSource/priceCheckedAt pada setiap
 * produk), dan gambar produk adalah ILUSTRASI KEMASAN buatan sistem
 * (lihat js/product-image.js), bukan foto asli hasil scraping.
 * ------------------------------------------------------------------
 */

const DB_KEY = 'app_database_v1';
const SCHEMA_VERSION = 2;

const DB_COLLECTIONS = [
  'products', 'customers', 'orders', 'transactions', 'cashTransactions',
  'stockMovements', 'branches', 'users', 'suppliers', 'settings',
  'categories', 'purchaseOrders'
];

const DB = (() => {

  function emptyState() {
    const state = { _schemaVersion: SCHEMA_VERSION };
    DB_COLLECTIONS.forEach(c => { state[c] = []; });
    return state;
  }

  function loadRaw() {
    try {
      const raw = localStorage.getItem(DB_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      console.error('DB: gagal membaca localStorage', e);
      return null;
    }
  }

  function saveRaw(state) {
    try {
      localStorage.setItem(DB_KEY, JSON.stringify(state));
      return true;
    } catch (e) {
      console.error('DB: gagal menyimpan localStorage (mungkin penuh)', e);
      return false;
    }
  }

  // ---------------- MIGRASI SCHEMA (TIDAK MENGHAPUS DATA) ----------------
  // Setiap migrasi HANYA menambah/menormalisasi field baru pada data lama.
  // customers/orders/transactions/cashTransactions/stockMovements/branches/
  // users/suppliers TIDAK PERNAH dihapus atau di-reset oleh migrasi ini.
  function migrateV1ToV2(state) {
    const today = new Date().toISOString().slice(0, 10);
    state.products = (state.products || []).map(p => ({
      ...p, // field asli produk dipertahankan seluruhnya
      subcategory: p.subcategory || '',
      discountPrice: p.discountPrice ?? null,
      imageSource: p.imageSource || (p.image ? 'admin-upload' : 'generated-illustration'),
      weight: p.weight || '',
      rating: p.rating ?? 4.5,
      sold: p.sold ?? 0,
      promo: p.promo ?? false,
      promoLabel: p.promoLabel || '',
      isFeatured: p.isFeatured ?? false,
      isBestSeller: p.isBestSeller ?? false,
      isNew: p.isNew ?? false,
      isPromo: p.isPromo ?? (p.promo ?? false),
      priceSource: p.priceSource || 'Harga referensi retail Indonesia (estimasi demo)',
      priceCheckedAt: p.priceCheckedAt || today,
      sourceType: p.sourceType || 'public-reference',
      sourceName: p.sourceName || 'Master Produk Retail Indonesia — Demo',
      lastVerified: p.lastVerified || today
    }));
    state._schemaVersion = 2;
    return state;
  }

  const MIGRATIONS = { 1: migrateV1ToV2 };

  function runMigrations(state) {
    let version = state._schemaVersion || 1;
    while (version < SCHEMA_VERSION && MIGRATIONS[version]) {
      state = MIGRATIONS[version](state);
      version = state._schemaVersion;
    }
    state._schemaVersion = SCHEMA_VERSION;
    return state;
  }

  function ensureInit() {
    let state = loadRaw();
    if (!state) {
      state = emptyState();
      saveRaw(state);
      return state;
    }
    if (!state._schemaVersion || state._schemaVersion < SCHEMA_VERSION) {
      state = runMigrations(state);
      saveRaw(state);
    }
    // Pastikan semua koleksi ada (untuk kompatibilitas versi lama)
    let changed = false;
    DB_COLLECTIONS.forEach(c => {
      if (!Array.isArray(state[c])) { state[c] = []; changed = true; }
    });
    if (changed) saveRaw(state);
    return state;
  }

  // Ambil seluruh koleksi
  function get(collection) {
    const state = ensureInit();
    if (!DB_COLLECTIONS.includes(collection)) {
      console.warn(`DB.get: koleksi "${collection}" tidak dikenal`);
      return [];
    }
    return state[collection] || [];
  }

  // Timpa seluruh isi koleksi
  function set(collection, arr) {
    const state = ensureInit();
    state[collection] = arr;
    return saveRaw(state);
  }

  // Sisipkan satu record baru (otomatis id jika belum ada)
  function insert(collection, record) {
    const state = ensureInit();
    if (!record.id) record.id = genId(collection);
    if (!record.createdAt) record.createdAt = new Date().toISOString();
    record.updatedAt = new Date().toISOString();
    state[collection].push(record);
    saveRaw(state);
    return record;
  }

  // Perbarui record berdasarkan id, patch berisi field yang berubah
  function update(collection, id, patch) {
    const state = ensureInit();
    const idx = state[collection].findIndex(r => r.id === id);
    if (idx === -1) return null;
    state[collection][idx] = {
      ...state[collection][idx],
      ...patch,
      updatedAt: new Date().toISOString()
    };
    saveRaw(state);
    return state[collection][idx];
  }

  // Hapus record berdasarkan id
  function del(collection, id) {
    const state = ensureInit();
    const before = state[collection].length;
    state[collection] = state[collection].filter(r => r.id !== id);
    saveRaw(state);
    return state[collection].length < before;
  }

  // Cari satu record
  function find(collection, predicateOrId) {
    const arr = get(collection);
    if (typeof predicateOrId === 'function') return arr.find(predicateOrId) || null;
    return arr.find(r => r.id === predicateOrId) || null;
  }

  // Filter banyak record
  function filter(collection, predicate) {
    const arr = get(collection);
    if (typeof predicate !== 'function') return arr;
    return arr.filter(predicate);
  }

  // Generator ID unik sederhana per koleksi
  function genId(collection) {
    const prefix = collection.slice(0, 3).toUpperCase();
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  }

  // Nomor dokumen berurutan per hari, contoh: TRX-20260817-0001
  function nextDocNumber(prefix, collection, dateField = 'createdAt') {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    const dateStr = `${y}${m}${d}`;
    const arr = get(collection);
    const todayCount = arr.filter(r => {
      const docNo = r.docNumber || r.transactionNumber || r.orderId || '';
      return docNo.startsWith(`${prefix}-${dateStr}`);
    }).length;
    const seq = String(todayCount + 1).padStart(4, '0');
    return `${prefix}-${dateStr}-${seq}`;
  }

  function exportDatabase() {
    const state = ensureInit();
    return JSON.stringify(state, null, 2);
  }

  function importDatabase(jsonString) {
    try {
      const parsed = JSON.parse(jsonString);
      if (typeof parsed !== 'object' || parsed === null) throw new Error('Format tidak valid');
      const state = emptyState();
      DB_COLLECTIONS.forEach(c => {
        if (Array.isArray(parsed[c])) state[c] = parsed[c];
      });
      saveRaw(state);
      return true;
    } catch (e) {
      console.error('DB.importDatabase gagal:', e);
      return false;
    }
  }

  function resetDatabase() {
    localStorage.removeItem(DB_KEY);
    ensureInit();
    seedDemoData(true);
  }

  function isEmpty() {
    const state = ensureInit();
    return state.products.length === 0;
  }

  // ------------------------------------------------------------------
  // DEMO DATA SEEDING
  // ------------------------------------------------------------------
  function seedDemoData(force = false) {
    const state = ensureInit();
    if (!force && state.products.length > 0) return; // sudah ada data

    const fresh = emptyState();

    // ---- Cabang ----
    fresh.branches = [
      { id: 'BR-001', name: 'Cabang Utama', address: 'Jl. Merdeka No. 1, Jakarta Pusat', whatsapp: '628111111111', headName: 'Budi Santoso', status: 'aktif', createdAt: iso() },
      { id: 'BR-002', name: 'Cabang Bogor', address: 'Jl. Pajajaran No. 22, Bogor', whatsapp: '628222222222', headName: 'Siti Aminah', status: 'aktif', createdAt: iso() },
      { id: 'BR-003', name: 'Cabang Parung', address: 'Jl. Raya Parung No. 5, Bogor', whatsapp: '628333333333', headName: 'Andi Wijaya', status: 'aktif', createdAt: iso() },
      { id: 'BR-004', name: 'Cabang Cianjur', address: 'Jl. Siliwangi No. 10, Cianjur', whatsapp: '628444444444', headName: 'Rina Marlina', status: 'aktif', createdAt: iso() },
      { id: 'BR-005', name: 'Cabang Depok', address: 'Jl. Margonda Raya No. 88, Depok', whatsapp: '628555555555', headName: 'Dedi Kurniawan', status: 'aktif', createdAt: iso() }
    ];

    // ---- Users (admin) ----
    fresh.users = [
      { id: 'USR-001', name: 'Super Admin', email: 'admin@kopdar', password: 'admin123', role: 'superadmin', branchId: 'BR-001', status: 'aktif' },
      { id: 'USR-002', name: 'Admin Kasir', email: 'kasir@kopdar', password: 'kasir123', role: 'admin_kasir', branchId: 'BR-001', status: 'aktif' },
      { id: 'USR-003', name: 'Admin Gudang', email: 'gudang@kopdar', password: 'gudang123', role: 'admin_gudang', branchId: 'BR-001', status: 'aktif' }
    ];

    // ---- Suppliers ----
    fresh.suppliers = [
      { id: 'SUP-001', name: 'PT Sumber Makmur Distribusi', contact: '628121212121', address: 'Jakarta' },
      { id: 'SUP-002', name: 'CV Berkah Sejahtera', contact: '628131313131', address: 'Bogor' },
      { id: 'SUP-003', name: 'PT Anugrah Pangan', contact: '628141414141', address: 'Bandung' },
      { id: 'SUP-004', name: 'UD Maju Jaya', contact: '628151515151', address: 'Tangerang' }
    ];

    // ---- Categories ----
    fresh.categories = [
      'Makanan', 'Minuman', 'Snack', 'Sembako', 'Rokok',
      'Perawatan Tubuh', 'Rumah Tangga', 'Bayi', 'Elektronik Kecil', 'ATK', 'Lainnya'
    ].map((name, i) => ({ id: `CAT-00${i + 1}`, name }));

    // ---- Products (demo, nama umum pasaran, bukan data proprietary) ----
    fresh.products = buildDemoProducts(fresh.branches);

    // ---- Customers ----
    fresh.customers = buildDemoCustomers();

    // ---- Settings ----
    fresh.settings = [{
      id: 'SETTINGS',
      storeName: 'KOPDAR',
      storeFullName: 'KOPDAR — Koperasi Darat',
      tagline: 'Belanja Hemat, Hidup Lebih Dekat',
      logo: './assets/images/kopdar-app-icon.png',
      address: 'Jl. Merdeka No. 1, Jakarta Pusat',
      whatsapp: '628111111111',
      openHours: '06:00 - 22:00',
      deliveryFee: 10000,
      minOrder: 15000,
      tax: 0,
      currency: 'IDR',
      theme: 'light'
    }];

    // ---- Transaksi kasir demo ----
    const { transactions, stockMovements: trxStockMoves, cashTransactions: trxCash } =
      buildDemoTransactions(fresh.products, fresh.branches, fresh.users);
    fresh.transactions = transactions;

    // ---- Barang masuk demo (stockMovements + kas keluar utk pembelian) ----
    const { stockMovements: inMoves, cashTransactions: inCash } =
      buildDemoStockIn(fresh.products, fresh.branches, fresh.suppliers);

    fresh.stockMovements = [...trxStockMoves, ...inMoves];
    fresh.cashTransactions = [...trxCash, ...inCash, ...buildDemoCashMisc(fresh.branches)];

    // ---- Order online demo ----
    fresh.orders = buildDemoOrders(fresh.products, fresh.customers, fresh.branches);

    // ---- Hitung "sold" & tandai best seller dari transaksi demo di atas ----
    applySoldAndBestSeller(fresh.products, fresh.transactions);

    saveRaw(fresh);
  }

  // Mengisi field `sold` tiap produk dari agregasi qty transaksi demo,
  // lalu menandai isBestSeller pada 10 produk dengan penjualan tertinggi.
  function applySoldAndBestSeller(products, transactions) {
    const soldMap = {};
    transactions.forEach(t => {
      (t.items || []).forEach(it => { soldMap[it.productId] = (soldMap[it.productId] || 0) + it.qty; });
    });
    products.forEach(p => { p.sold = soldMap[p.id] || 0; });
    products.slice().sort((a, b) => b.sold - a.sold).slice(0, 10).forEach(p => {
      if (p.sold > 0) p.isBestSeller = true;
    });
  }

  function iso(daysAgo = 0, hour = 9) {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    d.setHours(hour, Math.floor(Math.random() * 59), 0, 0);
    return d.toISOString();
  }

  function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  function buildDemoProducts(branches) {
    // Katalog demo "Master Produk Retail Indonesia — Demo": nama produk &
    // merek umum dijual di ritel Indonesia, BUKAN salinan database resmi
    // jaringan minimarket mana pun. Harga adalah referensi/estimasi.
    // Format tuple: [nama, kategori, subkategori, brand, unit, hargaBeli, hargaJual, berat/volume]
    const catalog = [
      // ---------------- MINUMAN ----------------
      ['Aqua Air Mineral 600ml', 'Minuman', 'Air Mineral', 'Aqua', 'botol', 2800, 4000, '600ml'],
      ['Aqua Air Mineral 1500ml', 'Minuman', 'Air Mineral', 'Aqua', 'botol', 4200, 6000, '1.5L'],
      ['Aqua Air Mineral 330ml', 'Minuman', 'Air Mineral', 'Aqua', 'botol', 2000, 3000, '330ml'],
      ['Le Minerale Air Mineral 600ml', 'Minuman', 'Air Mineral', 'Le Minerale', 'botol', 2700, 3900, '600ml'],
      ['Le Minerale Air Mineral 1500ml', 'Minuman', 'Air Mineral', 'Le Minerale', 'botol', 4100, 5900, '1.5L'],
      ['Crystalin Air Mineral 600ml', 'Minuman', 'Air Mineral', 'Crystalin', 'botol', 2300, 3500, '600ml'],
      ['Pocari Sweat 500ml', 'Minuman', 'Minuman Isotonik', 'Pocari Sweat', 'botol', 5800, 8000, '500ml'],
      ['Pocari Sweat Kaleng 330ml', 'Minuman', 'Minuman Isotonik', 'Pocari Sweat', 'kaleng', 5200, 7200, '330ml'],
      ['Mizone Fruit Punch 500ml', 'Minuman', 'Minuman Isotonik', 'Mizone', 'botol', 4200, 6000, '500ml'],
      ['Teh Pucuk Harum 350ml', 'Minuman', 'Minuman Teh', 'Teh Pucuk Harum', 'botol', 3500, 5000, '350ml'],
      ['Teh Pucuk Harum 450ml', 'Minuman', 'Minuman Teh', 'Teh Pucuk Harum', 'botol', 4300, 6000, '450ml'],
      ['Teh Kotak 200ml', 'Minuman', 'Minuman Teh', 'Teh Kotak', 'kotak', 2600, 4000, '200ml'],
      ['Teh Kotak 300ml', 'Minuman', 'Minuman Teh', 'Teh Kotak', 'kotak', 3400, 5000, '300ml'],
      ['Teh Botol Sosro 450ml', 'Minuman', 'Minuman Teh', 'Sosro', 'botol', 3800, 5500, '450ml'],
      ['Fruit Tea Botol 350ml', 'Minuman', 'Minuman Teh', 'Fruit Tea', 'botol', 3600, 5200, '350ml'],
      ['Nu Green Tea 500ml', 'Minuman', 'Minuman Teh', 'Nu Green Tea', 'botol', 4200, 6000, '500ml'],
      ['Coca-Cola Kaleng 330ml', 'Minuman', 'Minuman Bersoda', 'Coca-Cola', 'kaleng', 5500, 7500, '330ml'],
      ['Coca-Cola Botol 1500ml', 'Minuman', 'Minuman Bersoda', 'Coca-Cola', 'botol', 11000, 15000, '1.5L'],
      ['Sprite Kaleng 330ml', 'Minuman', 'Minuman Bersoda', 'Sprite', 'kaleng', 5500, 7500, '330ml'],
      ['Fanta Kaleng 330ml', 'Minuman', 'Minuman Bersoda', 'Fanta', 'kaleng', 5500, 7500, '330ml'],
      ['Milo Kotak 200ml', 'Minuman', 'Susu & Cokelat', 'Milo', 'kotak', 4200, 6000, '200ml'],
      ['Milo Sachet 3in1', 'Minuman', 'Susu & Cokelat', 'Milo', 'sachet', 1800, 2800, '33g'],
      ['Ultra Milk Coklat 250ml', 'Minuman', 'Susu UHT', 'Ultra Milk', 'kotak', 4800, 7000, '250ml'],
      ['Ultra Milk Full Cream 250ml', 'Minuman', 'Susu UHT', 'Ultra Milk', 'kotak', 4800, 7000, '250ml'],
      ['Indomilk UHT Coklat 190ml', 'Minuman', 'Susu UHT', 'Indomilk', 'kotak', 3600, 5500, '190ml'],
      ['Frisian Flag Kental Manis 370g', 'Minuman', 'Susu Kental Manis', 'Frisian Flag', 'kaleng', 12500, 16500, '370g'],
      ['Kapal Api Kopi Sachet', 'Minuman', 'Kopi', 'Kapal Api', 'sachet', 1200, 2000, '25g'],
      ['Kapal Api Kopi Bubuk 165g', 'Minuman', 'Kopi', 'Kapal Api', 'bungkus', 11500, 15500, '165g'],
      ['Good Day Cappuccino Sachet', 'Minuman', 'Kopi', 'Good Day', 'sachet', 1400, 2200, '25g'],
      ['Nescafe Classic Sachet', 'Minuman', 'Kopi', 'Nescafe', 'sachet', 1500, 2300, '20g'],
      ['ABC Kopi Susu Sachet', 'Minuman', 'Kopi', 'ABC', 'sachet', 1200, 2000, '25g'],
      ['You C1000 Vitamin 140ml', 'Minuman', 'Minuman Vitamin', 'You C1000', 'botol', 6000, 8500, '140ml'],
      ['Es Krim Cup Vanilla', 'Minuman', 'Es Krim', 'Walls', 'cup', 5000, 8000, '90ml'],
      ['Es Krim Cornetto Coklat', 'Minuman', 'Es Krim', 'Walls', 'pcs', 8000, 12000, '110ml'],

      // ---------------- MIE INSTAN / MAKANAN ----------------
      ['Indomie Goreng', 'Makanan', 'Mie Instan', 'Indomie', 'bungkus', 2800, 3500, '85g'],
      ['Indomie Kuah Ayam Bawang', 'Makanan', 'Mie Instan', 'Indomie', 'bungkus', 2800, 3500, '75g'],
      ['Indomie Kuah Soto', 'Makanan', 'Mie Instan', 'Indomie', 'bungkus', 2800, 3500, '75g'],
      ['Indomie Kuah Kaldu Ayam', 'Makanan', 'Mie Instan', 'Indomie', 'bungkus', 2800, 3500, '75g'],
      ['Mie Sedaap Goreng', 'Makanan', 'Mie Instan', 'Mie Sedaap', 'bungkus', 2700, 3400, '90g'],
      ['Mie Sedaap Kuah Soto', 'Makanan', 'Mie Instan', 'Mie Sedaap', 'bungkus', 2700, 3400, '76g'],
      ['Sarimi Goreng', 'Makanan', 'Mie Instan', 'Sarimi', 'bungkus', 2500, 3200, '80g'],
      ['Sarimi Ayam Bawang', 'Makanan', 'Mie Instan', 'Sarimi', 'bungkus', 2500, 3200, '70g'],
      ['Pop Mie Ayam Cup', 'Makanan', 'Mie Instan', 'Pop Mie', 'cup', 4000, 5500, '75g'],
      ['Pop Mie Baso Cup', 'Makanan', 'Mie Instan', 'Pop Mie', 'cup', 4000, 5500, '75g'],
      ['Supermi Ayam Bawang', 'Makanan', 'Mie Instan', 'Supermi', 'bungkus', 2500, 3200, '75g'],
      ['Roti Tawar Sari Roti', 'Makanan', 'Roti', 'Sari Roti', 'bungkus', 11000, 15000, '360g'],
      ['Roti Sobek Coklat', 'Makanan', 'Roti', 'Sari Roti', 'bungkus', 9500, 13000, '250g'],
      ['Sarden ABC Kaleng', 'Makanan', 'Makanan Kaleng', 'ABC', 'kaleng', 11000, 15000, '155g'],
      ['Sarden Botan Kaleng', 'Makanan', 'Makanan Kaleng', 'Botan', 'kaleng', 10500, 14500, '155g'],
      ['Kornet Pronas Kaleng', 'Makanan', 'Makanan Kaleng', 'Pronas', 'kaleng', 20000, 26000, '198g'],
      ['Kornet Bernardi Kaleng', 'Makanan', 'Makanan Kaleng', 'Bernardi', 'kaleng', 22000, 28000, '200g'],
      ['Bumbu Nasi Goreng Instan', 'Makanan', 'Bumbu Masak', 'Indofood', 'sachet', 1500, 2500, '20g'],

      // ---------------- SEMBAKO ----------------
      ['Beras Rojolele 5kg', 'Sembako', 'Beras', 'Rojolele', 'karung', 58000, 70000, '5kg'],
      ['Beras Pandan Wangi 5kg', 'Sembako', 'Beras', 'Pandan Wangi', 'karung', 62000, 75000, '5kg'],
      ['Beras Setra Ramos 5kg', 'Sembako', 'Beras', 'Setra Ramos', 'karung', 56000, 68000, '5kg'],
      ['Gula Pasir Gulaku 1kg', 'Sembako', 'Gula', 'Gulaku', 'kg', 13500, 16000, '1kg'],
      ['Minyak Goreng Bimoli 1L', 'Sembako', 'Minyak Goreng', 'Bimoli', 'botol', 16500, 20500, '1L'],
      ['Minyak Goreng Bimoli 2L', 'Sembako', 'Minyak Goreng', 'Bimoli', 'botol', 31000, 38000, '2L'],
      ['Minyak Goreng Sania 1L', 'Sembako', 'Minyak Goreng', 'Sania', 'botol', 16000, 20000, '1L'],
      ['Minyak Goreng Tropical 2L', 'Sembako', 'Minyak Goreng', 'Tropical', 'botol', 30500, 37500, '2L'],
      ['Tepung Segitiga Biru 1kg', 'Sembako', 'Tepung', 'Segitiga Biru', 'kg', 10000, 12500, '1kg'],
      ['Garam Cap Kapal 500g', 'Sembako', 'Garam', 'Cap Kapal', 'bungkus', 2500, 3800, '500g'],
      ['Telur Ayam 1kg', 'Sembako', 'Telur', 'Telur Segar', 'kg', 25000, 29000, '1kg'],

      // ---------------- BUMBU MASAK ----------------
      ['Royco Kaldu Ayam', 'Makanan', 'Bumbu Masak', 'Royco', 'sachet', 500, 1000, '9g'],
      ['Royco Kaldu Sapi', 'Makanan', 'Bumbu Masak', 'Royco', 'sachet', 500, 1000, '9g'],
      ['Masako Ayam', 'Makanan', 'Bumbu Masak', 'Masako', 'sachet', 500, 1000, '8g'],
      ['Masako Sapi', 'Makanan', 'Bumbu Masak', 'Masako', 'sachet', 500, 1000, '8g'],
      ['Sasa Bumbu Penyedap', 'Makanan', 'Bumbu Masak', 'Sasa', 'bungkus', 2500, 3800, '250g'],
      ['Kecap Manis Bango 275ml', 'Makanan', 'Bumbu Masak', 'Bango', 'botol', 10500, 14000, '275ml'],
      ['Kecap Manis ABC 275ml', 'Makanan', 'Bumbu Masak', 'ABC', 'botol', 9500, 13000, '275ml'],
      ['Saus Sambal ABC 340ml', 'Makanan', 'Bumbu Masak', 'ABC', 'botol', 9800, 13000, '340ml'],
      ['Saus Sambal Indofood 340ml', 'Makanan', 'Bumbu Masak', 'Indofood', 'botol', 9500, 12500, '340ml'],
      ['Saus Tiram Saori 135ml', 'Makanan', 'Bumbu Masak', 'Saori', 'botol', 8500, 11500, '135ml'],

      // ---------------- SNACK ----------------
      ['Chitato Sapi Panggang', 'Snack', 'Keripik', 'Chitato', 'bungkus', 9000, 12000, '68g'],
      ['Chitato Rasa Ayam', 'Snack', 'Keripik', 'Chitato', 'bungkus', 9000, 12000, '68g'],
      ["Lay's Rumput Laut", 'Snack', 'Keripik', "Lay's", 'bungkus', 8500, 11500, '68g'],
      ["Lay's Original", 'Snack', 'Keripik', "Lay's", 'bungkus', 8500, 11500, '68g'],
      ['Oreo Original', 'Snack', 'Biskuit', 'Oreo', 'bungkus', 7500, 10000, '137g'],
      ['Oreo Chocolate', 'Snack', 'Biskuit', 'Oreo', 'bungkus', 7500, 10000, '137g'],
      ['SilverQueen Cokelat Susu', 'Snack', 'Cokelat', 'SilverQueen', 'batang', 13000, 17000, '65g'],
      ['SilverQueen Almond', 'Snack', 'Cokelat', 'SilverQueen', 'batang', 14000, 18000, '65g'],
      ['Tango Wafer Coklat', 'Snack', 'Wafer', 'Tango', 'bungkus', 7000, 10000, '128g'],
      ['Beng Beng', 'Snack', 'Cokelat', 'Beng Beng', 'pcs', 1800, 2800, '20g'],
      ['Beng Beng Maxx', 'Snack', 'Cokelat', 'Beng Beng', 'pcs', 3200, 4800, '32g'],
      ['Good Time Cookies', 'Snack', 'Biskuit', 'Good Time', 'bungkus', 8500, 11500, '68g'],
      ['Roma Kelapa', 'Snack', 'Biskuit', 'Roma', 'bungkus', 6500, 9000, '300g'],
      ['Roma Malkist Coklat', 'Snack', 'Biskuit', 'Roma', 'bungkus', 7000, 9500, '135g'],
      ['Taro Net Snack', 'Snack', 'Keripik', 'Taro', 'bungkus', 4500, 6500, '30g'],
      ['Qtela Keripik Singkong', 'Snack', 'Keripik', 'Qtela', 'bungkus', 6500, 9000, '65g'],
      ['Better Biskuit Sandwich', 'Snack', 'Biskuit', 'Better', 'bungkus', 6000, 8500, '80g'],
      ['Trebor Permen Mint', 'Snack', 'Permen', 'Trebor', 'bungkus', 4000, 6000, '32g'],
      ['Kis Mint Permen', 'Snack', 'Permen', 'Kis', 'bungkus', 3800, 5500, '25g'],
      ['Kacang Atom', 'Snack', 'Kacang', 'Dua Kelinci', 'bungkus', 6500, 9000, '80g'],
      ['Kacang Garuda', 'Snack', 'Kacang', 'Garuda', 'bungkus', 7000, 9500, '80g'],
      ['Kerupuk Udang', 'Snack', 'Kerupuk', 'Finna', 'bungkus', 7500, 10500, '200g'],
      ['Popcorn Kemasan', 'Snack', 'Popcorn', 'Jack N Jill', 'bungkus', 5500, 8500, '60g'],
      ['Sosis Siap Makan', 'Snack', 'Sosis', 'Champ', 'bungkus', 8500, 12500, '100g'],

      // ---------------- ROKOK ----------------
      ['Gudang Garam Filter', 'Rokok', 'Rokok Kretek', 'Gudang Garam', 'bungkus', 24000, 28500, '12 batang'],
      ['Djarum Super', 'Rokok', 'Rokok Kretek', 'Djarum', 'bungkus', 25000, 29500, '12 batang'],
      ['Sampoerna Mild', 'Rokok', 'Rokok Mild', 'Sampoerna', 'bungkus', 26000, 30500, '16 batang'],
      ['Marlboro Merah', 'Rokok', 'Rokok Mild', 'Marlboro', 'bungkus', 27000, 32000, '20 batang'],

      // ---------------- PERAWATAN TUBUH ----------------
      ['Lifebuoy Sabun Batang', 'Perawatan Tubuh', 'Sabun Mandi', 'Lifebuoy', 'batang', 3200, 4800, '85g'],
      ['Lifebuoy Sabun Cair 250ml', 'Perawatan Tubuh', 'Sabun Mandi', 'Lifebuoy', 'botol', 12500, 16500, '250ml'],
      ['Lux Sabun Batang', 'Perawatan Tubuh', 'Sabun Mandi', 'Lux', 'batang', 3200, 4800, '85g'],
      ['Dove Sabun Batang', 'Perawatan Tubuh', 'Sabun Mandi', 'Dove', 'batang', 4500, 6500, '90g'],
      ['Dove Shampoo 170ml', 'Perawatan Tubuh', 'Shampo', 'Dove', 'botol', 15500, 20000, '170ml'],
      ['Pantene Shampoo 170ml', 'Perawatan Tubuh', 'Shampo', 'Pantene', 'botol', 15000, 19500, '170ml'],
      ['Pantene Conditioner 170ml', 'Perawatan Tubuh', 'Shampo', 'Pantene', 'botol', 15500, 20000, '170ml'],
      ['Sunsilk Shampoo 170ml', 'Perawatan Tubuh', 'Shampo', 'Sunsilk', 'botol', 14500, 19000, '170ml'],
      ['Clear Shampoo Men 170ml', 'Perawatan Tubuh', 'Shampo', 'Clear', 'botol', 16000, 21000, '170ml'],
      ['Clear Shampoo Women 170ml', 'Perawatan Tubuh', 'Shampo', 'Clear', 'botol', 16000, 21000, '170ml'],
      ['Shampo Sachet', 'Perawatan Tubuh', 'Shampo', 'Sunsilk', 'sachet', 800, 1500, '10ml'],
      ['Pepsodent Pasta Gigi 190g', 'Perawatan Tubuh', 'Pasta Gigi', 'Pepsodent', 'tube', 9500, 13000, '190g'],
      ['Pepsodent Herbal 190g', 'Perawatan Tubuh', 'Pasta Gigi', 'Pepsodent', 'tube', 10000, 13500, '190g'],
      ['Ciptadent Pasta Gigi 190g', 'Perawatan Tubuh', 'Pasta Gigi', 'Ciptadent', 'tube', 8500, 12000, '190g'],
      ['Sikat Gigi', 'Perawatan Tubuh', 'Peralatan Mandi', 'Formula', 'pcs', 4000, 6500, '1pcs'],
      ['Rexona Deodorant Roll On', 'Perawatan Tubuh', 'Deodorant', 'Rexona', 'botol', 11000, 15500, '50ml'],
      ['Nivea Deodorant Roll On', 'Perawatan Tubuh', 'Deodorant', 'Nivea', 'botol', 12500, 17000, '50ml'],
      ['Vaseline Body Lotion 100ml', 'Perawatan Tubuh', 'Skincare', 'Vaseline', 'botol', 9500, 13500, '100ml'],
      ['Citra Body Lotion 100ml', 'Perawatan Tubuh', 'Skincare', 'Citra', 'botol', 8500, 12500, '100ml'],
      ['Tisu Wajah Paseo 250 lembar', 'Perawatan Tubuh', 'Tisu', 'Paseo', 'pack', 8500, 12000, '250 lembar'],
      ['Tisu Basah Paseo', 'Perawatan Tubuh', 'Tisu', 'Paseo', 'pack', 6500, 9500, '50 lembar'],
      ['Tisu Tessa 250 lembar', 'Perawatan Tubuh', 'Tisu', 'Tessa', 'pack', 8000, 11500, '250 lembar'],
      ['Pembalut Wanita Laurier', 'Perawatan Tubuh', 'Kebutuhan Wanita', 'Laurier', 'pack', 9500, 13500, '10pcs'],
      ['Pembalut Wanita Charm', 'Perawatan Tubuh', 'Kebutuhan Wanita', 'Charm', 'pack', 9800, 14000, '10pcs'],

      // ---------------- PERAWATAN BAYI ----------------
      ['Pigeon Sabun Bayi 200ml', 'Bayi', 'Perawatan Bayi', 'Pigeon', 'botol', 15000, 20000, '200ml'],
      ['MamyPoko Popok M isi 20', 'Bayi', 'Popok', 'MamyPoko', 'pack', 45000, 58000, '20pcs'],
      ['MamyPoko Popok L isi 18', 'Bayi', 'Popok', 'MamyPoko', 'pack', 46000, 59000, '18pcs'],
      ['Sweety Popok M isi 20', 'Bayi', 'Popok', 'Sweety', 'pack', 43000, 55000, '20pcs'],
      ['Sweety Popok L isi 18', 'Bayi', 'Popok', 'Sweety', 'pack', 44000, 56000, '18pcs'],
      ['Zwitsal Baby Cologne 100ml', 'Bayi', 'Perawatan Bayi', 'Zwitsal', 'botol', 13500, 18000, '100ml'],
      ['Cussons Baby Oil 100ml', 'Bayi', 'Perawatan Bayi', 'Cussons', 'botol', 14000, 19000, '100ml'],
      ['Susu Formula Bayi 400g', 'Bayi', 'Susu Formula', 'SGM', 'kaleng', 58000, 72000, '400g'],
      ['Bubur Bayi Instan', 'Bayi', 'Makanan Bayi', 'SUN', 'box', 8500, 12000, '120g'],
      ['Tisu Basah Bayi', 'Bayi', 'Perawatan Bayi', 'MamyPoko', 'pack', 9500, 13500, '50 lembar'],

      // ---------------- RUMAH TANGGA ----------------
      ['Sunlight Sabun Cuci Piring 750ml', 'Rumah Tangga', 'Pembersih Dapur', 'Sunlight', 'botol', 11500, 15500, '750ml'],
      ['Rinso Deterjen Bubuk 800g', 'Rumah Tangga', 'Deterjen', 'Rinso', 'bungkus', 13500, 18000, '800g'],
      ['Rinso Deterjen Cair 800ml', 'Rumah Tangga', 'Deterjen', 'Rinso', 'pouch', 14500, 19000, '800ml'],
      ['Attack Deterjen Bubuk 800g', 'Rumah Tangga', 'Deterjen', 'Attack', 'bungkus', 13000, 17500, '800g'],
      ['Downy Pewangi Pakaian 900ml', 'Rumah Tangga', 'Pewangi Pakaian', 'Downy', 'botol', 13500, 18000, '900ml'],
      ['Molto Pewangi Pakaian 900ml', 'Rumah Tangga', 'Pewangi Pakaian', 'Molto', 'botol', 12500, 17000, '900ml'],
      ['Wipol Pembersih Lantai 800ml', 'Rumah Tangga', 'Pembersih Rumah', 'Wipol', 'botol', 11500, 15500, '800ml'],
      ['SoKlin Pembersih Lantai 800ml', 'Rumah Tangga', 'Pembersih Rumah', 'SoKlin', 'botol', 10500, 14500, '800ml'],
      ['Baygon Semprot 600ml', 'Rumah Tangga', 'Anti Serangga', 'Baygon', 'kaleng', 20000, 26000, '600ml'],
      ['HIT Aerosol 600ml', 'Rumah Tangga', 'Anti Serangga', 'HIT', 'kaleng', 18500, 24500, '600ml'],
      ['Kantong Plastik Sampah', 'Rumah Tangga', 'Peralatan Rumah', 'Plastik Kuat', 'pack', 8500, 12000, '1 pack'],
      ['Baterai ABC AA isi 4', 'Rumah Tangga', 'Baterai', 'ABC', 'pack', 12500, 17000, '4pcs'],
      ['Baterai Panasonic AAA isi 4', 'Rumah Tangga', 'Baterai', 'Panasonic', 'pack', 14000, 19000, '4pcs'],
      ['Lilin Penerangan', 'Rumah Tangga', 'Peralatan Rumah', 'Cap Gajah', 'pack', 6500, 9500, '6pcs'],
      ['Korek Api Gas', 'Rumah Tangga', 'Peralatan Rumah', 'Tokai', 'pcs', 3200, 5200, '1pcs'],
      ['Sapu Lidi', 'Rumah Tangga', 'Peralatan Rumah', 'Rumah Bersih', 'pcs', 15500, 21500, '1pcs'],
      ['Gayung Plastik', 'Rumah Tangga', 'Peralatan Rumah', 'Lion Star', 'pcs', 8500, 12500, '1pcs'],
      ['Stella Kapas 60g', 'Rumah Tangga', 'Peralatan Rumah', 'Stella', 'pack', 5500, 8000, '60g'],

      // ---------------- ELEKTRONIK KECIL ----------------
      ['Kabel Data USB-C', 'Elektronik Kecil', 'Aksesoris Gadget', 'Vivan', 'pcs', 16000, 26000, '1pcs'],
      ['Charger 2 Ampere', 'Elektronik Kecil', 'Aksesoris Gadget', 'Vivan', 'pcs', 32000, 47000, '1pcs'],
      ['Lampu LED 9 Watt', 'Elektronik Kecil', 'Lampu', 'Philips', 'pcs', 13500, 19500, '1pcs'],
      ['Power Bank 10000mAh', 'Elektronik Kecil', 'Aksesoris Gadget', 'Vivan', 'pcs', 88000, 125000, '1pcs'],
      ['Earphone Kabel', 'Elektronik Kecil', 'Aksesoris Gadget', 'Sonic', 'pcs', 21000, 33000, '1pcs'],

      // ---------------- ATK ----------------
      ['Buku Tulis 38 Lembar', 'ATK', 'Alat Tulis', 'Sinar Dunia', 'pcs', 3200, 4800, '1pcs'],
      ['Pulpen Standard Hitam', 'ATK', 'Alat Tulis', 'Standard', 'pcs', 2200, 3200, '1pcs'],
      ['Pensil Faber Castell 2B', 'ATK', 'Alat Tulis', 'Faber Castell', 'pcs', 2500, 3800, '1pcs'],
      ['Penghapus', 'ATK', 'Alat Tulis', 'Joyko', 'pcs', 1500, 2500, '1pcs'],
      ['Penggaris Kenko 30cm', 'ATK', 'Alat Tulis', 'Kenko', 'pcs', 2800, 4200, '1pcs'],
      ['Map Plastik', 'ATK', 'Peralatan Kantor', 'Bantex', 'pcs', 2800, 4200, '1pcs'],
      ['Isi Staples', 'ATK', 'Peralatan Kantor', 'Kenko', 'box', 3200, 4800, '1 box'],
      ['Amplop Coklat isi 10', 'ATK', 'Peralatan Kantor', 'Paperline', 'pack', 5200, 7800, '10pcs'],

      // ---------------- LAINNYA ----------------
      ['Payung Lipat', 'Lainnya', 'Peralatan Harian', 'Fiberglass', 'pcs', 26000, 39000, '1pcs'],
      ['Masker Medis Sensi isi 50', 'Lainnya', 'Kesehatan', 'Sensi', 'box', 21000, 29000, '50pcs'],
      ['Hand Sanitizer 100ml', 'Lainnya', 'Kesehatan', 'Antis', 'botol', 8500, 12500, '100ml'],
      ['Kertas Nasi Bungkus', 'Lainnya', 'Peralatan Harian', 'Rasa Cinta', 'pack', 4200, 6200, '1 pack'],
      ['Sedotan Plastik', 'Lainnya', 'Peralatan Harian', 'Praktis', 'pack', 2200, 3700, '1 pack'],

      // ---------------- TAMBAHAN VARIAN (melengkapi katalog ke 200+ produk) ----------------
      ['Aqua Galon 19L', 'Minuman', 'Air Mineral', 'Aqua', 'galon', 18000, 24000, '19L'],
      ['Le Minerale Galon 19L', 'Minuman', 'Air Mineral', 'Le Minerale', 'galon', 17500, 23500, '19L'],
      ['Nescafe Kaleng 220ml', 'Minuman', 'Kopi', 'Nescafe', 'kaleng', 7500, 10500, '220ml'],
      ['Kopiko 78°C 200ml', 'Minuman', 'Kopi', 'Kopiko', 'botol', 6500, 9500, '200ml'],
      ['Buavita Jambu 250ml', 'Minuman', 'Jus Buah', 'Buavita', 'kotak', 5500, 8000, '250ml'],
      ['Buavita Jeruk 250ml', 'Minuman', 'Jus Buah', 'Buavita', 'kotak', 5500, 8000, '250ml'],
      ['Floridina Orange 350ml', 'Minuman', 'Jus Buah', 'Floridina', 'botol', 4500, 6500, '350ml'],
      ['Bir Bintang Kaleng 330ml', 'Minuman', 'Minuman Bersoda', 'Bintang Zero', 'kaleng', 8000, 11500, '330ml'],
      ['Indomie Goreng Jumbo', 'Makanan', 'Mie Instan', 'Indomie', 'bungkus', 4200, 5500, '129g'],
      ['Indomie Kuah Kari Ayam', 'Makanan', 'Mie Instan', 'Indomie', 'bungkus', 2800, 3500, '75g'],
      ['Mie Sedaap Kuah Ayam Bawang', 'Makanan', 'Mie Instan', 'Mie Sedaap', 'bungkus', 2700, 3400, '76g'],
      ['Bakmi Mewah Goreng', 'Makanan', 'Mie Instan', 'Bakmi Mewah', 'bungkus', 3200, 4200, '90g'],
      ['Roti Sisir Coklat', 'Makanan', 'Roti', 'Sari Roti', 'bungkus', 8500, 12000, '180g'],
      ['Abon Sapi Kemasan', 'Makanan', 'Makanan Kaleng', 'Abon Sapi', 'bungkus', 15000, 20000, '100g'],
      ['Nugget Ayam Fiesta 500g', 'Makanan', 'Makanan Beku', 'Fiesta', 'bungkus', 28000, 36000, '500g'],
      ['Sosis So Nice 500g', 'Makanan', 'Makanan Beku', 'So Nice', 'bungkus', 26000, 34000, '500g'],
      ['Bakso Sapi Kemasan 500g', 'Makanan', 'Makanan Beku', 'Bernardi', 'bungkus', 24000, 31000, '500g'],
      ['Beras Ir64 5kg', 'Sembako', 'Beras', 'IR64', 'karung', 54000, 65000, '5kg'],
      ['Gula Merah 500g', 'Sembako', 'Gula', 'Gula Jawa', 'bungkus', 9000, 12500, '500g'],
      ['Santan Kara 65ml', 'Sembako', 'Santan', 'Kara', 'pack', 3200, 4800, '65ml'],
      ['Susu Kental Manis Indomilk 370g', 'Minuman', 'Susu Kental Manis', 'Indomilk', 'kaleng', 11500, 15500, '370g'],
      ['Kopiko Coffee Candy', 'Snack', 'Permen', 'Kopiko', 'bungkus', 4200, 6200, '108g'],
      ['Ricola Permen Herbal', 'Snack', 'Permen', 'Ricola', 'bungkus', 5500, 8000, '24g'],
      ['Momogi Snack Jagung', 'Snack', 'Snack Anak', 'Momogi', 'bungkus', 3500, 5200, '9g'],
      ['Chiki Balls Snack', 'Snack', 'Snack Anak', 'Chiki', 'bungkus', 3200, 5000, '10g'],
      ['Gery Saluut Coklat', 'Snack', 'Biskuit', 'Gery', 'bungkus', 6500, 9200, '95g'],
      ['Nabati Richeese', 'Snack', 'Wafer', 'Nabati', 'bungkus', 6800, 9500, '110g'],
      ['Marlboro Black Menthol', 'Rokok', 'Rokok Mild', 'Marlboro', 'bungkus', 27500, 32500, '20 batang'],
      ['LA Lights', 'Rokok', 'Rokok Mild', 'LA Lights', 'bungkus', 24500, 29000, '16 batang'],
      ['Emeron Shampoo 170ml', 'Perawatan Tubuh', 'Shampo', 'Emeron', 'botol', 12500, 17000, '170ml'],
      ['Zinc Shampoo 170ml', 'Perawatan Tubuh', 'Shampo', 'Zinc', 'botol', 13500, 18000, '170ml'],
      ['Biore Sabun Cair 250ml', 'Perawatan Tubuh', 'Sabun Mandi', 'Biore', 'botol', 13000, 17500, '250ml'],
      ['Nivea Body Lotion 100ml', 'Perawatan Tubuh', 'Skincare', 'Nivea', 'botol', 10500, 15000, '100ml'],
      ['Wardah Facial Wash 100ml', 'Perawatan Tubuh', 'Skincare', 'Wardah', 'botol', 16000, 22000, '100ml'],
      ['Gatsby Hair Wax 75g', 'Perawatan Tubuh', 'Perawatan Rambut', 'Gatsby', 'pot', 15000, 21000, '75g'],
      ['Softex Pembalut', 'Perawatan Tubuh', 'Kebutuhan Wanita', 'Softex', 'pack', 8500, 12500, '10pcs'],
      ['Molto Ultra Sekali Bilas 800ml', 'Rumah Tangga', 'Pewangi Pakaian', 'Molto', 'botol', 14000, 18500, '800ml'],
      ['Superpell Pembersih Lantai 770ml', 'Rumah Tangga', 'Pembersih Rumah', 'SoKlin', 'botol', 10500, 14500, '770ml'],
      ['Stella Cotton Bud', 'Rumah Tangga', 'Peralatan Rumah', 'Stella', 'pack', 4500, 6800, '1 pack'],
      ['Vixal Pembersih Kamar Mandi 780ml', 'Rumah Tangga', 'Pembersih Rumah', 'Vixal', 'botol', 12500, 17000, '780ml'],
      ['Aluminium Foil Klin Pak', 'Rumah Tangga', 'Peralatan Dapur', 'Klin Pak', 'pack', 9500, 13500, '1 pack'],
      ['Plastik Wrap Klin Pak', 'Rumah Tangga', 'Peralatan Dapur', 'Klin Pak', 'pack', 8500, 12000, '1 pack'],
      ['Baterai ABC AAA isi 4', 'Rumah Tangga', 'Baterai', 'ABC', 'pack', 12000, 16500, '4pcs'],
      ['Anlene Susu Bubuk 250g', 'Minuman', 'Susu Bubuk', 'Anlene', 'bungkus', 32000, 41000, '250g'],
      ['Dancow Susu Bubuk 400g', 'Minuman', 'Susu Bubuk', 'Dancow', 'bungkus', 38000, 48000, '400g'],
      ['Bear Brand Susu Steril 189ml', 'Minuman', 'Susu Steril', 'Bear Brand', 'kaleng', 8500, 12000, '189ml']
    ];

    const today = new Date().toISOString().slice(0, 10);

    return catalog.map((row, i) => {
      const [name, category, subcategory, brand, unit, purchasePrice, sellingPrice, weight] = row;
      const stock = rand(15, 200);
      const minimumStock = rand(10, 25);
      const branchStock = {};
      branches.forEach(b => { branchStock[b.id] = rand(5, 60); });

      const isPromo = Math.random() < 0.16;
      const discountPct = isPromo ? pick([10, 15, 20, 25]) : 0;
      const discountPrice = isPromo ? Math.round(sellingPrice * (1 - discountPct / 100) / 100) * 100 : null;

      return {
        id: `PRD-${String(i + 1).padStart(4, '0')}`,
        sku: `SKU${String(i + 1).padStart(5, '0')}`,
        barcode: `899${String(1000000 + i)}`,
        name, category, subcategory, brand,
        description: `${name} dari ${brand}. Cocok untuk kebutuhan sehari-hari. Kemasan ${weight || unit}.`,
        image: '', // kosong = pakai ilustrasi kemasan auto-generate (lihat js/product-image.js)
        imageSource: 'generated-illustration',
        purchasePrice, sellingPrice,
        discountPrice,
        stock,
        minimumStock,
        unit,
        weight: weight || '',
        supplier: pick(['SUP-001', 'SUP-002', 'SUP-003', 'SUP-004']),
        branchStock,
        promo: isPromo,
        isPromo,
        promoLabel: isPromo ? `HEMAT ${discountPct}%` : '',
        rating: (4 + Math.random() * 0.9).toFixed(1) * 1,
        sold: 0, // dihitung ulang dari transaksi nyata oleh reports.js; ini hanya baseline awal
        isFeatured: Math.random() < 0.12,
        isBestSeller: false, // ditetapkan setelah data transaksi demo dibuat, lihat seedDemoData
        isNew: Math.random() < 0.1,
        status: 'aktif',
        priceSource: 'Harga referensi retail Indonesia (estimasi demo)',
        priceCheckedAt: today,
        sourceType: 'public-reference',
        sourceName: 'Master Produk Retail Indonesia — Demo',
        lastVerified: today,
        createdAt: iso(rand(10, 90)),
        updatedAt: iso(rand(0, 5))
      };
    });
  }

  function buildDemoCustomers() {
    const names = [
      'Ahmad Fauzi', 'Dewi Lestari', 'Rudi Hartono', 'Putri Wulandari', 'Agus Salim',
      'Maya Sari', 'Fajar Nugroho', 'Indah Permata', 'Bayu Aji', 'Rina Susanti',
      'Hendra Gunawan', 'Yuni Astuti', 'Wawan Setiawan', 'Lia Marlina', 'Doni Prasetyo',
      'Tari Anggraini', 'Eko Purnomo', 'Nina Kurnia', 'Rizal Ramadhan', 'Sari Wahyuni'
    ];
    return names.map((name, i) => ({
      id: `CUST-${String(i + 1).padStart(4, '0')}`,
      name,
      whatsapp: `62812${rand(10000000, 99999999)}`,
      address: `Jl. Contoh No. ${rand(1, 99)}, Jakarta`,
      password: 'demo1234',
      registeredAt: iso(rand(5, 120))
    }));
  }

  function buildDemoTransactions(products, branches, users) {
    const transactions = [];
    const stockMovements = [];
    const cashTransactions = [];
    const kasirUsers = users.filter(u => u.role !== 'admin_gudang');
    const paymentMethods = ['Cash', 'QRIS', 'Transfer', 'Debit', 'Kredit'];

    for (let i = 0; i < 70; i++) {
      // Bias ke 7 hari terakhir supaya grafik dashboard selalu terlihat hidup,
      // tetap menyisakan sebagian data lebih lama untuk laporan bulanan.
      const daysAgo = i < 50 ? rand(0, 6) : rand(7, 20);
      const branch = pick(branches);
      const cashier = pick(kasirUsers);
      const itemCount = rand(1, 5);
      const items = [];
      let subtotal = 0;
      for (let j = 0; j < itemCount; j++) {
        const p = pick(products);
        const qty = rand(1, 4);
        const lineTotal = p.sellingPrice * qty;
        subtotal += lineTotal;
        items.push({ productId: p.id, name: p.name, price: p.sellingPrice, qty, lineTotal });
      }
      const discount = Math.random() < 0.2 ? Math.round(subtotal * 0.05) : 0;
      const total = subtotal - discount;
      const payment = pick(paymentMethods);
      const cashReceived = payment === 'Cash' ? total + pick([0, 0, 5000, 10000, 20000]) : total;
      const change = payment === 'Cash' ? cashReceived - total : 0;
      const createdAt = iso(daysAgo, rand(8, 20));

      const trxNumber = `TRX-${dateStrFromIso(createdAt)}-${String(i + 1).padStart(4, '0')}`;

      transactions.push({
        id: `TRX-${i + 1}`,
        transactionNumber: trxNumber,
        items, subtotal, discount, tax: 0, total,
        paymentMethod: payment,
        cashReceived, change,
        cashierId: cashier.id,
        cashierName: cashier.name,
        branchId: branch.id,
        createdAt
      });

      items.forEach(it => {
        stockMovements.push({
          id: genId('stockMovements'),
          type: 'keluar', reason: 'Penjualan',
          productId: it.productId, quantity: it.qty,
          branchId: branch.id, refId: trxNumber,
          createdAt
        });
      });

      cashTransactions.push({
        id: genId('cashTransactions'),
        docNumber: `IN-${dateStrFromIso(createdAt)}-${String(i + 1).padStart(4, '0')}`,
        type: 'masuk', category: 'Penjualan',
        description: `Penjualan ${trxNumber}`,
        amount: total, branchId: branch.id, staffName: cashier.name,
        createdAt
      });
    }
    return { transactions, stockMovements, cashTransactions };
  }

  function buildDemoStockIn(products, branches, suppliers) {
    const stockMovements = [];
    const cashTransactions = [];
    for (let i = 0; i < 10; i++) {
      const daysAgo = rand(1, 30);
      const branch = pick(branches);
      const supplier = pick(suppliers);
      const p = pick(products);
      const qty = rand(20, 100);
      const createdAt = iso(daysAgo, 10);
      const docNumber = `IN-${dateStrFromIso(createdAt)}-${String(i + 1).padStart(4, '0')}`;
      stockMovements.push({
        id: genId('stockMovements'),
        type: 'masuk', reason: 'Pembelian',
        productId: p.id, quantity: qty,
        branchId: branch.id, supplierId: supplier.id,
        docNumber, createdAt
      });
      cashTransactions.push({
        id: genId('cashTransactions'),
        docNumber: `OUT-${dateStrFromIso(createdAt)}-${String(i + 1).padStart(4, '0')}`,
        type: 'keluar', category: 'Belanja Barang',
        description: `Pembelian stok ${p.name} dari ${supplier.name}`,
        amount: qty * p.purchasePrice, branchId: branch.id, staffName: 'Admin Gudang',
        createdAt
      });
    }
    return { stockMovements, cashTransactions };
  }

  function buildDemoCashMisc(branches) {
    const items = [
      { type: 'masuk', category: 'Modal Kas', description: 'Setoran modal awal' },
      { type: 'keluar', category: 'Operasional', description: 'Biaya listrik toko' },
      { type: 'keluar', category: 'Transport', description: 'Biaya kirim barang antar cabang' },
      { type: 'masuk', category: 'Pendapatan Lain', description: 'Sewa mesin EDC' }
    ];
    return items.map((it, i) => ({
      id: genId('cashTransactions'),
      docNumber: `${it.type === 'masuk' ? 'IN' : 'OUT'}-MISC-${i + 1}`,
      type: it.type, category: it.category, description: it.description,
      amount: rand(50000, 500000), branchId: pick(branches).id, staffName: 'Super Admin',
      createdAt: iso(rand(1, 20))
    }));
  }

  function buildDemoOrders(products, customers, branches) {
    const statuses = ['Pesanan masuk', 'Diproses', 'Disiapkan', 'Dikirim', 'Selesai'];
    const orders = [];
    for (let i = 0; i < 10; i++) {
      const daysAgo = rand(0, 10);
      const createdAt = iso(daysAgo, rand(9, 21));
      const customer = pick(customers);
      const branch = pick(branches);
      const itemCount = rand(1, 4);
      const items = [];
      let subtotal = 0;
      for (let j = 0; j < itemCount; j++) {
        const p = pick(products);
        const qty = rand(1, 3);
        const lineTotal = p.sellingPrice * qty;
        subtotal += lineTotal;
        items.push({ productId: p.id, name: p.name, price: p.sellingPrice, qty, lineTotal });
      }
      const fulfillmentType = pick(['Ambil Sendiri', 'Delivery']);
      const deliveryFee = fulfillmentType === 'Delivery' ? 10000 : 0;
      const discount = 0;
      const grandTotal = subtotal + deliveryFee - discount;
      const orderId = `ORD-${dateStrFromIso(createdAt)}-${String(i + 1).padStart(4, '0')}`;
      orders.push({
        id: `ORDID-${i + 1}`,
        orderId,
        customerId: customer.id,
        customerName: customer.name,
        whatsapp: customer.whatsapp,
        items, subtotal, discount, deliveryFee, grandTotal,
        paymentMethod: pick(['Cash', 'QRIS', 'Transfer']),
        fulfillmentType,
        branchId: branch.id,
        address: fulfillmentType === 'Delivery' ? customer.address : '',
        status: pick(statuses),
        createdAt
      });
    }
    return orders;
  }

  function dateStrFromIso(isoStr) {
    const d = new Date(isoStr);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}${m}${day}`;
  }

  return {
    get, set, insert, update, delete: del, find, filter,
    genId, nextDocNumber,
    exportDatabase, importDatabase, resetDatabase, isEmpty, seedDemoData,
    COLLECTIONS: DB_COLLECTIONS
  };
})();

// Inisialisasi otomatis saat file dimuat
DB.seedDemoData(false);
