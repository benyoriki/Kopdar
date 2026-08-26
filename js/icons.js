/**
 * icons.js
 * ------------------------------------------------------------------
 * Sistem ikon terpusat berbasis inline SVG (bukan emoji, bukan
 * dependency eksternal/font icon). Semua ikon memakai:
 *   - stroke="currentColor" (otomatis ikut warna teks/tema)
 *   - stroke-width 1.8–2
 *   - viewBox 0 0 24 24 konsisten
 *   - ukuran default 20px, bisa di-override lewat opts.size
 *
 * Emoji TETAP dipakai untuk konten marketing non-UI (mis. label
 * "🔥 Promo Hari Ini", ilustrasi kategori produk) sesuai arahan —
 * yang dihilangkan hanya emoji yang berfungsi sebagai ICON UI utama
 * (navigasi, tombol aksi, sidebar, header).
 * ------------------------------------------------------------------
 */

const Icon = (() => {
  const PATHS = {
    home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
    cart: '<circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M3 4h2l2.4 12.2a1.6 1.6 0 0 0 1.6 1.3h8.4a1.6 1.6 0 0 0 1.6-1.3L21 8H6"/>',
    user: '<circle cx="12" cy="8" r="3.6"/><path d="M4.5 20.2a7.5 7.5 0 0 1 15 0"/>',
    package: '<path d="M3.5 8 12 3.5 20.5 8 12 12.5 3.5 8Z"/><path d="M3.5 8v8L12 20.5 20.5 16V8"/><path d="M12 12.5V20.5"/>',
    warehouse: '<path d="M3 10.5 12 4l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Z"/><path d="M9 21v-6h6v6"/>',
    receipt: '<path d="M6 3h12v18l-2.5-1.5L13 21l-2.5-1.5L8 21l-2-1.5Z"/><path d="M9 8h6M9 12h6M9 16h3"/>',
    chart: '<path d="M4 20V10M11 20V4M18 20v-7"/><path d="M2.5 20h19"/>',
    'trend-up': '<path d="m4 16 5.5-6 4 3L21 6"/><path d="M15 6h6v6"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M12 3v2.2M12 18.8V21M4.9 4.9l1.5 1.5M17.6 17.6l1.5 1.5M3 12h2.2M18.8 12H21M4.9 19.1l1.5-1.5M17.6 6.4l1.5-1.5"/>',
    store: '<path d="M4 9.5 5 4h14l1 5.5"/><path d="M4 9.5a2 2 0 0 0 4 0 2 2 0 0 0 4 0 2 2 0 0 0 4 0 2 2 0 0 0 4 0"/><path d="M5.5 9.5V20h13V9.5"/>',
    truck: '<rect x="2.5" y="7" width="12" height="10"/><path d="M14.5 10.5h4l3 3.5V17h-7z"/><circle cx="7" cy="18.5" r="1.6"/><circle cx="17.5" cy="18.5" r="1.6"/>',
    wallet: '<rect x="3" y="6.5" width="18" height="13" rx="2"/><path d="M3 10h18"/><circle cx="16.5" cy="14.5" r="1.1"/>',
    barcode: '<path d="M4 5v14M8 5v14M11 5v14M13 5v14M17 5v14M20 5v14"/>',
    bell: '<path d="M6 10a6 6 0 0 1 12 0c0 4 1.5 5.5 1.5 5.5H4.5S6 14 6 10Z"/><path d="M10 19a2 2 0 0 0 4 0"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    x: '<path d="m6 6 12 12M18 6 6 18"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7"/>',
    'chevron-down': '<path d="m6 9 6 6 6-6"/>',
    'chevron-right': '<path d="m9 6 6 6-6 6"/>',
    'chevron-left': '<path d="m15 6-6 6 6 6"/>',
    'arrow-right': '<path d="M4 12h16M14 6l6 6-6 6"/>',
    filter: '<path d="M4 5h16l-6 7.5V19l-4 2v-8.5Z"/>',
    more: '<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2.5 12h2M19.5 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/>',
    moon: '<path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5Z"/>',
    menu: '<path d="M4 6.5h16M4 12h16M4 17.5h16"/>',
    edit: '<path d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17v3Z"/><path d="m14.5 6.5 3 3"/>',
    trash: '<path d="M5 7h14M9 7V5.2A1.2 1.2 0 0 1 10.2 4h3.6A1.2 1.2 0 0 1 15 5.2V7M6.5 7l1 12a1.5 1.5 0 0 0 1.5 1.4h6a1.5 1.5 0 0 0 1.5-1.4l1-12"/>',
    eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="2.6"/>',
    star: '<path d="m12 3.5 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17.4l-5.4 3 1-6.1-4.4-4.3 6.1-.9Z"/>',
    tag: '<path d="M11.5 4H5a1 1 0 0 0-1 1v6.5a1 1 0 0 0 .3.7l9 9a1 1 0 0 0 1.4 0l6.5-6.5a1 1 0 0 0 0-1.4l-9-9a1 1 0 0 0-.7-.3Z"/><circle cx="8.2" cy="8.2" r="1.3"/>',
    layers: '<path d="m12 3 8.5 5-8.5 5-8.5-5Z"/><path d="m3.5 13 8.5 5 8.5-5"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    'credit-card': '<rect x="2.5" y="5.5" width="19" height="13" rx="2"/><path d="M2.5 10h19"/>',
    'qr-code': '<rect x="3.5" y="3.5" width="6" height="6"/><rect x="14.5" y="3.5" width="6" height="6"/><rect x="3.5" y="14.5" width="6" height="6"/><path d="M14.5 14.5h2.5v2.5h-2.5zM19.5 14.5h1v1h-1zM14.5 19.5h1v1h-1zM19.5 19.5h1v1h-1zM17 17h2v2h-2z"/>',
    banknote: '<rect x="2.5" y="6.5" width="19" height="11" rx="1.5"/><circle cx="12" cy="12" r="2.6"/><path d="M5.5 9v0M18.5 15v0"/>',
    transfer: '<path d="m7 4-4 4 4 4"/><path d="M3 8h13.5A4.5 4.5 0 0 1 21 12.5V13"/><path d="m17 20 4-4-4-4"/><path d="M21 16H7.5A4.5 4.5 0 0 1 3 11.5V11"/>',
    clipboard: '<rect x="5" y="4.5" width="14" height="17" rx="2"/><rect x="8.5" y="3" width="7" height="3" rx="1"/><path d="M8.5 12h7M8.5 16h5"/>',
    building: '<rect x="4" y="3" width="10" height="18"/><path d="M14 9h6v12h-6"/><path d="M7 7h1M10 7h1M7 11h1M10 11h1M7 15h1M10 15h1"/>',
    'log-out': '<path d="M9 5H6a1.5 1.5 0 0 0-1.5 1.5v11A1.5 1.5 0 0 0 6 19h3"/><path d="M15.5 16.5 20 12l-4.5-4.5"/><path d="M20 12H9"/>',
    image: '<rect x="3" y="4.5" width="18" height="15" rx="2"/><circle cx="8.5" cy="9.5" r="1.6"/><path d="m5 17.5 5-5 3 3 3.5-4.5 4.5 6.5"/>',
    upload: '<path d="M12 15.5V4M8 8l4-4 4 4"/><path d="M4.5 15.5V19a1.5 1.5 0 0 0 1.5 1.5h12a1.5 1.5 0 0 0 1.5-1.5v-3.5"/>',
    download: '<path d="M12 4v11.5M8 12l4 4 4-4"/><path d="M4.5 15.5V19a1.5 1.5 0 0 0 1.5 1.5h12a1.5 1.5 0 0 0 1.5-1.5v-3.5"/>',
    refresh: '<path d="M20 11A8 8 0 0 0 6.3 6.3L4 8.5"/><path d="M4 4v4.5h4.5"/><path d="M4 13a8 8 0 0 0 13.7 4.7L20 15.5"/><path d="M20 20v-4.5h-4.5"/>',
    'map-pin': '<path d="M12 21s7-6.5 7-11.5A7 7 0 0 0 5 9.5C5 14.5 12 21 12 21Z"/><circle cx="12" cy="9.5" r="2.3"/>',
    'alert-triangle': '<path d="M12 4 2.5 20h19Z"/><path d="M12 10v4.5"/><circle cx="12" cy="17.3" r="0.4" fill="currentColor" stroke="none"/>',
    'check-circle': '<circle cx="12" cy="12" r="8.5"/><path d="m8.3 12.3 2.6 2.6 5-5.4"/>',
    'shopping-bag': '<path d="M6.5 8.5h11l1 12H5.5Z"/><path d="M9 8.5v-2a3 3 0 0 1 6 0v2"/>',
    percent: '<path d="M5 19 19 5"/><circle cx="7" cy="7" r="2.2"/><circle cx="17" cy="17" r="2.2"/>',
    sparkle: '<path d="M12 3v3.5M12 17.5V21M3 12h3.5M17.5 12H21M6 6l2 2M16 16l2 2M18 6l-2 2M8 16l-2 2"/>',
    zap: '<path d="M13 3 5 13.5h5.5L11 21l8-10.5h-5.5Z"/>',
    'shield-check': '<path d="M12 3.5 19 6.5v5.5c0 5-3 8-7 9-4-1-7-4-7-9V6.5Z"/><path d="m9 12 2 2 4-4.5"/>'
  };

  function svg(name, opts = {}) {
    const size = opts.size || 20;
    const strokeWidth = opts.strokeWidth || 1.9;
    const cls = opts.class ? ` class="${opts.class}"` : '';
    const path = PATHS[name];
    if (!path) return '';
    return `<svg${cls} width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
  }

  return { svg, PATHS };
})();

// Helper singkat global: Icon.svg('cart') dipakai luas, ic('cart') untuk template literal ringkas
function ic(name, opts) { return Icon.svg(name, opts); }

// Untuk markup HTML statis (bukan hasil render JS), pakai <span data-icon="cart"></span>
// lalu panggil mountIcons() — dipanggil otomatis saat DOMContentLoaded, dan bisa dipanggil
// ulang manual setelah innerHTML dinamis yang mengandung data-icon baru disisipkan.
function mountIcons(root) {
  (root || document).querySelectorAll('[data-icon]').forEach(el => {
    const name = el.getAttribute('data-icon');
    const size = el.getAttribute('data-icon-size');
    el.innerHTML = Icon.svg(name, size ? { size: Number(size) } : {});
  });
}
document.addEventListener('DOMContentLoaded', () => mountIcons());
