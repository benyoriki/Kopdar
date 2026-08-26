/**
 * product-image.js
 * ------------------------------------------------------------------
 * Sistem gambar produk.
 *
 * CATATAN SUMBER GAMBAR:
 * Versi demo ini TIDAK melakukan hotlink ke foto produk/brand pihak
 * ketiga (mis. Open Food Facts, marketplace, dsb) karena tiga alasan:
 *   1. Stabilitas — hotlink eksternal mudah rusak/berubah tanpa kendali kita,
 *      melanggar aturan "no broken image".
 *   2. Kepatuhan hak cipta — foto kemasan/logo brand adalah milik brand
 *      pemilik merek, sehingga tidak digunakan secara massal di sini.
 *   3. Kecepatan & GitHub Pages — tanpa dependency jaringan eksternal,
 *      katalog tetap instan dan 100% berjalan offline setelah dimuat.
 *
 * Sebagai gantinya, setiap produk mendapat ILUSTRASI KEMASAN yang
 * di-generate otomatis (SVG, bukan foto asli) — bentuk botol/kotak/pouch
 * sesuai kategori, warna gradient konsisten per kategori, nama produk,
 * dan brand. ADMIN GUDANG dapat meng-upload foto asli kapan saja lewat
 * form produk (disimpan sebagai Data URL di localStorage, lihat
 * gudang.js) — begitu produk punya `product.image` asli, ilustrasi ini
 * otomatis digantikan foto tersebut.
 * ------------------------------------------------------------------
 */

const ProductImage = (() => {

  // Dua warna gradient (hex) per kategori — dipakai baik oleh SVG
  // placeholder maupun elemen UI lain yang butuh warna kategori.
  const CATEGORY_COLORS = {
    'Makanan':            ['#FFD9A8', '#FF9F5A'],
    'Minuman':            ['#9BE8D8', '#2FBF9C'],
    'Snack':              ['#FFC9B0', '#FF7A5C'],
    'Sembako':            ['#F0E4B8', '#D9BE6A'],
    'Rokok':              ['#D8D8DE', '#A6A6B2'],
    'Perawatan Tubuh':    ['#DCD4FB', '#A594F5'],
    'Rumah Tangga':       ['#C7E6FB', '#7FBEEF'],
    'Bayi':               ['#FFD3E4', '#FA92BB'],
    'Elektronik Kecil':   ['#CBDBFF', '#8EA9F5'],
    'ATK':                ['#FBE7B8', '#EEBE5C'],
    'Lainnya':            ['#E5E8E2', '#B9C0B4']
  };

  const CATEGORY_EMOJI = {
    'Makanan': '🍚', 'Minuman': '🥤', 'Snack': '🍪', 'Sembako': '🌾', 'Rokok': '🚬',
    'Perawatan Tubuh': '🧴', 'Rumah Tangga': '🧹', 'Bayi': '🍼', 'Elektronik Kecil': '🔌',
    'ATK': '✏️', 'Lainnya': '📦'
  };

  // Bentuk siluet kemasan per kategori: bottle | box | pouch | tube | can
  const CATEGORY_SHAPE = {
    'Makanan': 'box', 'Minuman': 'bottle', 'Snack': 'pouch', 'Sembako': 'pouch',
    'Rokok': 'box', 'Perawatan Tubuh': 'tube', 'Rumah Tangga': 'bottle',
    'Bayi': 'box', 'Elektronik Kecil': 'box', 'ATK': 'box', 'Lainnya': 'box'
  };

  function getCategoryColors(category) { return CATEGORY_COLORS[category] || CATEGORY_COLORS['Lainnya']; }
  function getCategoryEmoji(category) { return CATEGORY_EMOJI[category] || '📦'; }

  function shapePath(shape) {
    switch (shape) {
      case 'bottle':
        return `<path d="M172 40h56v28c18 10 28 26 28 46v230c0 14-11 26-25 26H169c-14 0-25-12-25-26V114c0-20 10-36 28-46V40Z" />`;
      case 'tube':
        return `<path d="M150 60c0-16 13-28 28-28h44c15 0 28 12 28 28v20c22 8 36 22 36 40v190c0 20-16 36-36 36H150c-20 0-36-16-36-36V120c0-18 14-32 36-40V60Z" />`;
      case 'pouch':
        return `<path d="M120 90c0-22 18-40 40-40h80c22 0 40 18 40 40v40c26 14 40 42 40 78v100c0 44-36 66-100 66s-100-22-100-66V208c0-36 14-64 40-78V90Z" />`;
      case 'box':
      default:
        return `<rect x="118" y="96" width="164" height="240" rx="14" /><rect x="118" y="96" width="164" height="46" rx="14" opacity="0.55"/>`;
    }
  }

  // Detail kecil per bentuk kemasan (tutup botol, klip pouch, dsb) supaya terlihat lebih "photographic"
  function shapeDetails(shape, c1) {
    switch (shape) {
      case 'bottle':
        return `<rect x="178" y="30" width="44" height="16" rx="6" fill="${c1}"/><rect x="178" y="30" width="44" height="6" rx="3" fill="#FFFFFF" opacity="0.4"/>`;
      case 'tube':
        return `<rect x="164" y="46" width="72" height="18" rx="7" fill="${c1}"/><rect x="176" y="36" width="48" height="14" rx="6" fill="#DADFDC"/>`;
      case 'pouch':
        return `<rect x="170" y="52" width="60" height="20" rx="9" fill="none" stroke="#00000022" stroke-width="3" stroke-dasharray="3 4"/>`;
      case 'box':
      default:
        return '';
    }
  }

  // Generate ilustrasi kemasan sebagai data URI SVG (tanpa foto asli, tanpa hak cipta pihak ketiga)
  function generatePlaceholder(product) {
    const category = product?.category || 'Lainnya';
    const [c1, c2] = getCategoryColors(category);
    const shape = CATEGORY_SHAPE[category] || 'box';
    const emoji = getCategoryEmoji(category);
    const brand = (product?.brand || '').toUpperCase().slice(0, 14);
    const nameLine = (product?.name || 'Produk').slice(0, 24);
    const uid = 'g' + Math.abs(hashStr(product?.id || product?.name || 'x'));
    const path = shapePath(shape);

    const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">
  <defs>
    <linearGradient id="${uid}bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${c1}"/>
      <stop offset="100%" stop-color="${c2}"/>
    </linearGradient>
    <linearGradient id="${uid}pack" x1="0.15" y1="0" x2="0.9" y2="1">
      <stop offset="0%" stop-color="#FFFFFF"/>
      <stop offset="55%" stop-color="#F3F5F3"/>
      <stop offset="100%" stop-color="#E3E8E5"/>
    </linearGradient>
    <linearGradient id="${uid}shine" x1="0" y1="0" x2="1" y2="1">
      <stop offset="30%" stop-color="#FFFFFF" stop-opacity="0"/>
      <stop offset="48%" stop-color="#FFFFFF" stop-opacity="0.55"/>
      <stop offset="62%" stop-color="#FFFFFF" stop-opacity="0"/>
    </linearGradient>
    <radialGradient id="${uid}vig" cx="50%" cy="38%" r="75%">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.22"/>
      <stop offset="100%" stop-color="#FFFFFF" stop-opacity="0"/>
    </radialGradient>
    <clipPath id="${uid}clip">${path}</clipPath>
    <filter id="${uid}blur"><feGaussianBlur stdDeviation="10"/></filter>
  </defs>

  <rect width="400" height="400" fill="url(#${uid}bg)"/>
  <circle cx="52" cy="336" r="86" fill="#FFFFFF" opacity="0.10"/>
  <circle cx="356" cy="46" r="64" fill="#FFFFFF" opacity="0.12"/>
  <rect width="400" height="400" fill="url(#${uid}vig)"/>

  <!-- bayangan tanah agar terlihat "berdiri" seperti foto studio -->
  <ellipse cx="200" cy="352" rx="98" ry="16" fill="#000000" opacity="0.16" filter="url(#${uid}blur)"/>

  <!-- badge kategori kecil pojok kiri atas -->
  <circle cx="46" cy="46" r="26" fill="#FFFFFF" opacity="0.9"/>
  <text x="46" y="56" font-size="24" text-anchor="middle">${emoji}</text>

  <!-- kemasan -->
  <g stroke="#00000014" stroke-width="2">
    <g fill="url(#${uid}pack)">${path}</g>
    ${shapeDetails(shape, c2)}
    <g clip-path="url(#${uid}clip)"><rect x="0" y="0" width="400" height="400" fill="url(#${uid}shine)"/></g>
  </g>

  <!-- label brand -->
  <rect x="118" y="168" width="164" height="64" rx="12" fill="#FFFFFF" stroke="${c2}" stroke-width="2.5" opacity="0.97"/>
  <rect x="118" y="168" width="164" height="8" rx="4" fill="${c2}"/>
  <text x="200" y="204" font-family="Plus Jakarta Sans, Arial, sans-serif" font-size="20" font-weight="800" fill="#1A2420" text-anchor="middle">${brand ? escapeXML(brand) : 'KOPDAR'}</text>
  <text x="200" y="222" font-family="IBM Plex Mono, monospace" font-size="9.5" font-weight="700" letter-spacing="1.5" fill="#8A9490" text-anchor="middle">${escapeXML(category.toUpperCase())}</text>

  <!-- name plate bawah -->
  <rect x="34" y="336" width="332" height="42" rx="11" fill="#FFFFFF" opacity="0.95"/>
  <text x="200" y="362" font-family="Plus Jakarta Sans, Arial, sans-serif" font-size="14.5" font-weight="700" fill="#1A2420" text-anchor="middle">${escapeXML(nameLine)}</text>
</svg>`.trim();

    return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
  }

  function escapeXML(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function hashStr(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) { h = ((h << 5) - h) + str.charCodeAt(i); h |= 0; }
    return h;
  }

  // Kecil, netral: dipakai untuk kartu kategori / empty state, bukan produk spesifik
  function categoryIcon(category) { return getCategoryEmoji(category); }
  function categoryGradientCSS(category) {
    const [c1, c2] = getCategoryColors(category);
    return `linear-gradient(145deg, ${c1}, ${c2})`;
  }

  /**
   * Titik masuk utama dipakai product card / modal / tabel admin.
   * Urutan prioritas:
   *   1. product.image      (foto asli hasil upload admin / data URL)
   *   2. product.imageUrl   (URL eksternal jika admin mengisinya manual)
   *   3. Ilustrasi kemasan auto-generate sesuai kategori (fallback selalu tersedia)
   */
  function getProductImage(product) {
    if (product?.image) return product.image;
    if (product?.imageUrl) return product.imageUrl;
    return generatePlaceholder(product);
  }

  // Dipasang ke atribut onerror img agar tidak pernah tampil broken-image icon
  function fallbackAttr(product) {
    const ph = generatePlaceholder(product).replace(/"/g, '&quot;');
    return `onerror="this.onerror=null;this.src=&quot;${ph}&quot;;"`;
  }

  return { getProductImage, generatePlaceholder, fallbackAttr, categoryIcon, categoryGradientCSS, getCategoryColors, getCategoryEmoji: getCategoryEmoji };
})();
