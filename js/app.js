/**
 * app.js
 * ------------------------------------------------------------------
 * Logika halaman index.html (toko online customer): render produk,
 * kategori, keranjang, checkout, login/register customer, dan trigger
 * login admin tersembunyi (klik logo 5x).
 * ------------------------------------------------------------------
 */

// Kategori & ikon/gradient sekarang dipusatkan di js/product-image.js (ProductImage module)
// supaya index.html, kasir.html (POS), dan gudang.html (tabel admin) memakai sumber yang sama.
function catEmoji(category) { return ProductImage.categoryIcon(category); }
function catGradient(category) { return ProductImage.categoryGradientCSS(category); }

function formatCompactNumber(n) {
  n = Number(n) || 0;
  if (n >= 1000000) return (n / 1000000).toFixed(1).replace('.0', '') + 'jt';
  if (n >= 1000) return (n / 1000).toFixed(1).replace('.0', '') + 'rb';
  return String(n);
}

let currentCategory = null;
let allProductsVisibleCount = 15;
let currentSearchQuery = '';
let currentQuickFilter = ''; // '', 'promo', 'terlaris', 'terbaru', 'termurah', 'tersedia'
let currentSort = 'relevan';
let advancedFilters = { priceMin: null, priceMax: null, minRating: 0, inStockOnly: false };

document.addEventListener('DOMContentLoaded', () => {
  renderHeroStats();
  renderCategoryCards();
  renderPromoProducts();
  renderTerlarisProducts();
  renderNewProducts();
  renderLowStockProducts();
  renderAllProducts();
  renderBranchList();
  updateCartBadge();
  bindEvents();
  bindFilterSheet();
  UI.bindSecretAdminTrigger('#brand-logo', () => UI.openModal('modal-admin-login'));

  // Tombol admin login yang terlihat (selain trik ketuk logo 5x di atas)
  document.getElementById('btn-admin-login-open')?.addEventListener('click', () => UI.openModal('modal-admin-login'));
  document.getElementById('footer-admin-login-link')?.addEventListener('click', (e) => {
    e.preventDefault();
    UI.openModal('modal-admin-login');
  });

  // Badge "Prototipe / testing" bisa ditutup, dan tetap tertutup setelah reload
  (function initPrototypeBadge() {
    const wrap = document.getElementById('prototype-badge-wrap');
    const closeBtn = document.getElementById('prototype-badge-close');
    if (!wrap || !closeBtn) return;
    if (localStorage.getItem('kopdar_prototype_badge_closed') === '1') {
      wrap.classList.add('badge-closed');
    }
    closeBtn.addEventListener('click', () => {
      wrap.classList.add('badge-closed');
      localStorage.setItem('kopdar_prototype_badge_closed', '1');
    });
  })();
});

document.addEventListener('cart:changed', (e) => {
  if (e.detail.storageKey === 'cart_customer_v1') updateCartBadge();
});

// ---------------- RENDER: HERO STATS ----------------
function renderHeroStats() {
  UI.countUp(document.getElementById('stat-products'), Products.getAll().length);
  UI.countUp(document.getElementById('stat-branches'), Branches.getActive().length);
}

// ---------------- RENDER: CATEGORY CARDS (visual, dengan ikon + gradient + jumlah produk) ----------------
function renderCategoryCards() {
  const el = document.getElementById('category-chips');
  const categories = Products.getCategories();
  const allProducts = Products.getAll();

  let html = `
    <button class="category-card active" data-cat="" style="--cat-bg:linear-gradient(145deg, var(--primary-light), var(--primary-light))">
      <div class="cat-icon">🏬</div>
      <div class="cat-name">Semua</div>
      <div class="cat-count">${allProducts.length} produk</div>
    </button>`;
  categories.forEach(c => {
    const count = allProducts.filter(p => p.category === c.name).length;
    html += `
    <button class="category-card" data-cat="${UI.escapeHTML(c.name)}" style="--cat-bg:${catGradient(c.name)}">
      <div class="cat-icon">${catEmoji(c.name)}</div>
      <div class="cat-name">${UI.escapeHTML(c.name)}</div>
      <div class="cat-count">${count} produk</div>
    </button>`;
  });
  el.innerHTML = html;
  el.querySelectorAll('.category-card').forEach(card => {
    card.addEventListener('click', () => {
      el.querySelectorAll('.category-card').forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      currentCategory = card.getAttribute('data-cat') || null;
      allProductsVisibleCount = 15;
      renderAllProducts();
      document.getElementById('section-all-products').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
}

// ---------------- RENDER: PRODUCT CARD ----------------
function productCardHTML(p, opts = {}) {
  const cart = CustomerCart.getItems();
  const inCart = cart.find(i => i.productId === p.id);
  const qty = inCart ? inCart.qty : 0;
  const lowStock = p.stock > 0 && p.stock <= p.minimumStock;
  const outOfStock = p.stock <= 0;
  const imgSrc = ProductImage.getProductImage(p);
  const hasDiscount = p.promo && p.discountPrice;
  const displayPrice = hasDiscount ? p.discountPrice : p.sellingPrice;
  const discountPct = hasDiscount ? Math.round((1 - p.discountPrice / p.sellingPrice) * 100) : 0;

  return `
    <div class="product-card" data-product-id="${p.id}">
      <div class="thumb" data-open-detail="${p.id}" style="--thumb-bg:${catGradient(p.category)}">
        ${opts.rank ? `<span class="rank-badge">#${opts.rank}</span>` : (hasDiscount ? `<span class="badge-promo">-${discountPct}%</span>` : (p.isNew ? '<span class="badge-new">BARU</span>' : ''))}
        ${!opts.rank && lowStock ? '<span class="badge-low">Stok Terbatas</span>' : ''}
        <img src="${imgSrc}" alt="${UI.escapeHTML(p.name)}" loading="lazy" ${ProductImage.fallbackAttr(p)}>
      </div>
      <div class="info">
        <span class="cat">${UI.escapeHTML(p.category)}</span>
        <span class="name" data-open-detail="${p.id}">${UI.escapeHTML(p.name)}</span>
        <div class="rating-row"><span class="star">★</span> ${p.rating || '4.5'} <span>·</span> ${formatCompactNumber(p.sold)} terjual</div>
        <div class="price-row">
          <div class="price-now">
            <span class="price">${formatRupiah(displayPrice)}</span>
            ${hasDiscount ? `<span class="price-original">${formatRupiah(p.sellingPrice)}</span>` : ''}
          </div>
          <span class="stock ${lowStock ? 'low' : ''}">${outOfStock ? 'Stok habis' : (lowStock ? `Tinggal ${p.stock}` : `Stok ${p.stock}`)}</span>
        </div>
        <div class="add-row">
          ${qty > 0
            ? `<div class="qty-control" style="flex:1;justify-content:space-between;">
                 <button data-cart-dec="${p.id}">-</button>
                 <span>${qty}</span>
                 <button data-cart-inc="${p.id}">+</button>
               </div>`
            : `<button class="btn-add-cart" data-cart-add="${p.id}" ${outOfStock ? 'disabled' : ''}>${outOfStock ? 'Stok Habis' : '+ Keranjang'}</button>`
          }
        </div>
      </div>
    </div>`;
}

function skeletonCardHTML(n = 5) {
  return Array(n).fill(0).map(() => `
    <div class="skeleton-card">
      <div class="thumb skeleton"></div>
      <div class="info">
        <div class="skeleton-line skeleton w-40"></div>
        <div class="skeleton-line skeleton w-90"></div>
        <div class="skeleton-line skeleton w-60"></div>
      </div>
    </div>`).join('');
}

function bindProductCardEvents(container) {
  container.querySelectorAll('[data-open-detail]').forEach(el => {
    el.addEventListener('click', () => openProductDetail(el.getAttribute('data-open-detail')));
  });
  container.querySelectorAll('[data-cart-add]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const product = Products.getById(el.getAttribute('data-cart-add'));
      const res = CustomerCart.addItem(product, 1);
      if (res.success) { UI.toast('Produk ditambahkan', 'success'); refreshProductGrids(); }
      else UI.toast(res.message, 'error');
    });
  });
  container.querySelectorAll('[data-cart-inc]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = el.getAttribute('data-cart-inc');
      const product = Products.getById(id);
      const res = CustomerCart.addItem(product, 1);
      if (!res.success) UI.toast(res.message, 'error');
      refreshProductGrids();
    });
  });
  container.querySelectorAll('[data-cart-dec]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = el.getAttribute('data-cart-dec');
      const item = CustomerCart.getItems().find(i => i.productId === id);
      CustomerCart.updateQty(id, (item ? item.qty : 1) - 1);
      refreshProductGrids();
    });
  });
}

function refreshProductGrids() {
  renderPromoProducts();
  renderTerlarisProducts();
  renderNewProducts();
  renderLowStockProducts();
  renderAllProducts();
  updateCartBadge();
  if (document.getElementById('modal-cart').classList.contains('open')) renderCartModal();
}

// ---------------- RENDER: PROMO / TERLARIS / ALL ----------------
function renderPromoProducts() {
  const el = document.getElementById('grid-promo');
  const products = Products.getAll().filter(p => p.promo).slice(0, 10);
  if (!products.length) { el.innerHTML = UI.emptyStateHTML({ title: 'Belum ada produk promo' }); return; }
  el.innerHTML = products.map(p => productCardHTML(p)).join('');
  bindProductCardEvents(el);
}

function renderTerlarisProducts() {
  const el = document.getElementById('grid-terlaris');
  const list = Products.getAll().filter(p => p.isBestSeller).sort((a, b) => b.sold - a.sold).slice(0, 10);
  const fallback = list.length ? list : Products.getAll().slice(10, 20);
  if (!fallback.length) { el.innerHTML = UI.emptyStateHTML({ title: 'Belum ada data penjualan' }); return; }
  el.innerHTML = fallback.map((p, i) => productCardHTML(p, { rank: i + 1 })).join('');
  bindProductCardEvents(el);
}

function renderNewProducts() {
  const el = document.getElementById('grid-baru');
  if (!el) return;
  const list = Products.getAll().filter(p => p.isNew).slice(0, 10);
  if (!list.length) { el.innerHTML = UI.emptyStateHTML({ icon: '✨', title: 'Belum ada produk baru' }); return; }
  el.innerHTML = list.map(p => productCardHTML(p)).join('');
  bindProductCardEvents(el);
}

function renderLowStockProducts() {
  const el = document.getElementById('grid-stok-terbatas');
  if (!el) return;
  const list = Products.getAll().filter(p => p.stock > 0 && p.stock <= p.minimumStock).slice(0, 10);
  if (!list.length) { el.innerHTML = UI.emptyStateHTML({ icon: '✅', title: 'Semua stok dalam kondisi aman' }); return; }
  el.innerHTML = list.map(p => productCardHTML(p)).join('');
  bindProductCardEvents(el);
}

const QUICK_FILTER_LABELS = { promo: 'Promo', terlaris: 'Terlaris', terbaru: 'Terbaru', termurah: 'Termurah', tersedia: 'Stok Tersedia' };

function renderActiveFilterChips() {
  const wrap = document.getElementById('active-filter-chips');
  const chips = [];
  if (currentCategory) chips.push({ type: 'category', label: currentCategory });
  if (currentQuickFilter) chips.push({ type: 'quickFilter', label: QUICK_FILTER_LABELS[currentQuickFilter] || currentQuickFilter });
  if (currentSearchQuery) chips.push({ type: 'search', label: `"${currentSearchQuery}"` });
  if (advancedFilters.priceMin !== null || advancedFilters.priceMax !== null) {
    const min = advancedFilters.priceMin !== null ? formatRupiah(advancedFilters.priceMin) : '0';
    const max = advancedFilters.priceMax !== null ? formatRupiah(advancedFilters.priceMax) : '∞';
    chips.push({ type: 'price', label: `${min} – ${max}` });
  }
  if (advancedFilters.minRating > 0) chips.push({ type: 'rating', label: `★ ${advancedFilters.minRating}+` });
  if (advancedFilters.inStockOnly) chips.push({ type: 'inStock', label: 'Stok Tersedia' });

  const advCount = (advancedFilters.priceMin !== null || advancedFilters.priceMax !== null ? 1 : 0) + (advancedFilters.minRating > 0 ? 1 : 0) + (advancedFilters.inStockOnly ? 1 : 0);
  const filterBadge = document.getElementById('filter-sheet-badge');
  filterBadge.textContent = advCount;
  filterBadge.classList.toggle('hidden', advCount === 0);

  if (!chips.length) { wrap.classList.add('hidden'); wrap.innerHTML = ''; return; }
  wrap.classList.remove('hidden');
  wrap.innerHTML = chips.map(c => `
    <span class="active-filter-chip" data-clear-filter="${c.type}">${UI.escapeHTML(c.label)} <button title="Hapus filter">${ic('x', { size: 11 })}</button></span>
  `).join('') + `<span class="active-filter-chip clear-all" id="clear-all-filters">Hapus Semua</span>`;

  function resetCategoryChip() {
    document.querySelectorAll('.category-card').forEach(c => c.classList.remove('active'));
    document.querySelector('.category-card[data-cat=""]')?.classList.add('active');
  }
  function resetQuickFilterChip() {
    document.querySelectorAll('.quick-filter-btn').forEach(c => c.classList.remove('active'));
    document.querySelector('.quick-filter-btn[data-filter=""]')?.classList.add('active');
  }
  function resetSearchChip() {
    currentSearchQuery = '';
    document.getElementById('header-search').value = '';
    document.getElementById('header-search-mobile').value = '';
  }

  wrap.querySelectorAll('[data-clear-filter]').forEach(chip => {
    chip.querySelector('button').addEventListener('click', () => {
      const type = chip.getAttribute('data-clear-filter');
      if (type === 'category') { currentCategory = null; resetCategoryChip(); }
      if (type === 'quickFilter') { currentQuickFilter = ''; resetQuickFilterChip(); }
      if (type === 'search') resetSearchChip();
      if (type === 'price') { advancedFilters.priceMin = null; advancedFilters.priceMax = null; }
      if (type === 'rating') advancedFilters.minRating = 0;
      if (type === 'inStock') advancedFilters.inStockOnly = false;
      allProductsVisibleCount = 15;
      renderAllProducts();
    });
  });
  document.getElementById('clear-all-filters')?.addEventListener('click', () => {
    currentCategory = null; currentQuickFilter = '';
    advancedFilters = { priceMin: null, priceMax: null, minRating: 0, inStockOnly: false };
    resetCategoryChip(); resetQuickFilterChip(); resetSearchChip();
    allProductsVisibleCount = 15;
    renderAllProducts();
  });
}

function applySorting(list, sortKey) {
  const arr = [...list];
  switch (sortKey) {
    case 'terlaris': return arr.sort((a, b) => b.sold - a.sold);
    case 'terbaru': return arr.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    case 'harga-terendah': return arr.sort((a, b) => (a.discountPrice || a.sellingPrice) - (b.discountPrice || b.sellingPrice));
    case 'harga-tertinggi': return arr.sort((a, b) => (b.discountPrice || b.sellingPrice) - (a.discountPrice || a.sellingPrice));
    case 'rating': return arr.sort((a, b) => b.rating - a.rating);
    default: return arr;
  }
}

function renderAllProducts() {
  const el = document.getElementById('grid-all');
  const titleEl = document.getElementById('all-products-title');
  const countEl = document.getElementById('result-count');
  const loadMoreBtn = document.getElementById('btn-load-more');
  renderActiveFilterChips();

  let results = Products.search(currentSearchQuery, { category: currentCategory });

  if (currentQuickFilter === 'promo') results = results.filter(p => p.promo);
  if (currentQuickFilter === 'terlaris') results = results.filter(p => p.isBestSeller);
  if (currentQuickFilter === 'terbaru') results = results.filter(p => p.isNew);
  if (currentQuickFilter === 'tersedia') results = results.filter(p => p.stock > 0);
  if (currentQuickFilter === 'termurah') results = [...results].sort((a, b) => (a.discountPrice || a.sellingPrice) - (b.discountPrice || b.sellingPrice));

  if (advancedFilters.priceMin !== null) results = results.filter(p => (p.discountPrice || p.sellingPrice) >= advancedFilters.priceMin);
  if (advancedFilters.priceMax !== null) results = results.filter(p => (p.discountPrice || p.sellingPrice) <= advancedFilters.priceMax);
  if (advancedFilters.minRating > 0) results = results.filter(p => p.rating >= advancedFilters.minRating);
  if (advancedFilters.inStockOnly) results = results.filter(p => p.stock > 0);

  results = applySorting(results, currentSort);

  titleEl.textContent = currentSearchQuery ? `Hasil pencarian "${currentSearchQuery}"` : (currentCategory ? currentCategory : 'Semua Produk');
  countEl.textContent = `${results.length} produk`;

  if (!results.length) {
    el.innerHTML = UI.emptyStateHTML({
      icon: '🔍', title: 'Produk tidak ditemukan',
      desc: 'Coba kata kunci lain atau pilih kategori/filter berbeda.',
      actionLabel: 'Reset Pencarian', actionAttr: 'id="btn-reset-search"'
    });
    loadMoreBtn.classList.add('hidden');
    const reset = document.getElementById('btn-reset-search');
    if (reset) reset.addEventListener('click', () => {
      currentSearchQuery = '';
      document.getElementById('header-search').value = '';
      document.getElementById('header-search-mobile').value = '';
      document.getElementById('hero-search').value = '';
      currentCategory = null;
      currentQuickFilter = '';
      document.querySelectorAll('.category-card').forEach(c => c.classList.remove('active'));
      document.querySelector('.category-card[data-cat=""]')?.classList.add('active');
      document.querySelectorAll('.quick-filter-btn').forEach(c => c.classList.remove('active'));
      document.querySelector('.quick-filter-btn[data-filter=""]')?.classList.add('active');
      renderAllProducts();
    });
    return;
  }

  const visible = results.slice(0, allProductsVisibleCount);
  el.innerHTML = visible.map(p => productCardHTML(p)).join('');
  bindProductCardEvents(el);
  loadMoreBtn.classList.toggle('hidden', visible.length >= results.length);
}

// ---------------- RENDER: BRANCH LIST ----------------
function renderBranchList() {
  const el = document.getElementById('branch-list');
  const branches = Branches.getActive();
  if (!branches.length) { el.innerHTML = UI.emptyStateHTML({ title: 'Belum ada cabang terdaftar' }); return; }
  el.innerHTML = branches.map(b => `
    <div class="card branch-card">
      <h4>${UI.escapeHTML(b.name)}</h4>
      <p>📍 ${UI.escapeHTML(b.address)}</p>
      <p>👤 Kepala Cabang: ${UI.escapeHTML(b.headName)}</p>
      <p>📞 ${UI.escapeHTML(b.whatsapp)}</p>
    </div>`).join('');
}

// ---------------- PRODUCT DETAIL MODAL ----------------
function openProductDetail(productId) {
  const p = Products.getById(productId);
  if (!p) { UI.toast('Produk tidak ditemukan.', 'error'); return; }
  const cart = CustomerCart.getItems();
  const inCart = cart.find(i => i.productId === p.id);
  const qty = inCart ? inCart.qty : 0;
  const imgSrc = ProductImage.getProductImage(p);
  const hasDiscount = p.promo && p.discountPrice;
  const displayPrice = hasDiscount ? p.discountPrice : p.sellingPrice;
  const discountPct = hasDiscount ? Math.round((1 - p.discountPrice / p.sellingPrice) * 100) : 0;

  document.getElementById('modal-product-body').innerHTML = `
    <div class="sheet-scroll">
      <div class="modal-head">
        <h3>Detail Produk</h3>
        <button class="modal-close" onclick="UI.closeModal('modal-product')">${ic('x', { size: 16 })}</button>
      </div>
      <div class="thumb" style="border-radius:16px;margin-bottom:14px;--thumb-bg:${catGradient(p.category)}">
        ${hasDiscount ? `<span class="badge-promo">-${discountPct}%</span>` : (p.isNew ? '<span class="badge-new">BARU</span>' : '')}
        <img src="${imgSrc}" alt="${UI.escapeHTML(p.name)}" loading="lazy" style="width:100%;height:220px;object-fit:contain;padding:20px;box-sizing:border-box;" ${ProductImage.fallbackAttr(p)}>
      </div>
      <span class="cat">${UI.escapeHTML(p.category)}${p.subcategory ? ' • ' + UI.escapeHTML(p.subcategory) : ''} • ${UI.escapeHTML(p.brand)}</span>
      <h2 style="margin:6px 0;font-size:20px;">${UI.escapeHTML(p.name)}</h2>
      <div class="rating-row" style="font-size:13px;margin-bottom:10px;"><span class="star">★</span> ${p.rating || '4.5'} <span>·</span> ${formatCompactNumber(p.sold)} terjual ${p.weight ? `<span>·</span> ${UI.escapeHTML(p.weight)}` : ''}</div>
      <div class="price-now" style="align-items:baseline;">
        <span class="price" style="font-size:24px;color:var(--primary);">${formatRupiah(displayPrice)}</span>
        ${hasDiscount ? `<span class="price-original" style="font-size:14px;">${formatRupiah(p.sellingPrice)}</span><span class="discount-pct">HEMAT ${discountPct}%</span>` : ''}
        <span class="text-sm text-muted mono">/ ${UI.escapeHTML(p.unit)}</span>
      </div>
      <p class="text-sm text-muted mt-8">${UI.escapeHTML(p.description)}</p>
      <div class="detail-info-grid mt-16">
        <div><span class="text-faint">Kategori</span><b>${UI.escapeHTML(p.category)}</b></div>
        <div><span class="text-faint">Berat/Ukuran</span><b>${UI.escapeHTML(p.weight || p.unit)}</b></div>
        <div><span class="text-faint">Stok</span><b style="${p.stock <= 0 ? 'color:var(--danger)' : ''}">${p.stock > 0 ? `${p.stock} ${UI.escapeHTML(p.unit)}` : 'Habis'}</b></div>
        <div><span class="text-faint">Merek</span><b>${UI.escapeHTML(p.brand || '-')}</b></div>
      </div>
    </div>
    <div class="sheet-footer" id="detail-cart-control">
      ${qty > 0
        ? `<div class="flex gap-12 items-center">
             <div class="qty-control">
               <button id="detail-dec">-</button><span id="detail-qty">${qty}</span><button id="detail-inc">+</button>
             </div>
             <button class="btn btn-primary btn-block" onclick="UI.closeModal('modal-product'); UI.openModal('modal-cart'); renderCartModal();">Lihat Keranjang</button>
           </div>`
        : `<button class="btn btn-accent btn-block btn-lg" id="detail-add" ${p.stock <= 0 ? 'disabled' : ''}>${p.stock <= 0 ? 'Stok Habis' : '+ Tambah ke Keranjang'}</button>`
      }
    </div>`;

  const addBtn = document.getElementById('detail-add');
  if (addBtn) addBtn.addEventListener('click', () => {
    const res = CustomerCart.addItem(p, 1);
    if (res.success) { UI.toast('Produk ditambahkan', 'success'); openProductDetail(productId); refreshProductGrids(); }
    else UI.toast(res.message, 'error');
  });
  const decBtn = document.getElementById('detail-dec');
  if (decBtn) decBtn.addEventListener('click', () => {
    CustomerCart.updateQty(p.id, qty - 1);
    openProductDetail(productId); refreshProductGrids();
  });
  const incBtn = document.getElementById('detail-inc');
  if (incBtn) incBtn.addEventListener('click', () => {
    const res = CustomerCart.addItem(p, 1);
    if (!res.success) UI.toast(res.message, 'error');
    openProductDetail(productId); refreshProductGrids();
  });

  UI.openModal('modal-product');
}

// ---------------- CART MODAL ----------------
function renderCartModal() {
  const { items, subtotal, total, totalItems } = CustomerCart.getSummary();
  const itemsEl = document.getElementById('cart-items-container');
  const summaryEl = document.getElementById('cart-summary-container');
  const checkoutBtn = document.getElementById('btn-go-checkout');
  const footerEl = document.querySelector('.cart-drawer-footer');

  if (!items.length) {
    itemsEl.innerHTML = UI.emptyStateHTML({
      icon: 'cart', title: 'Keranjang masih kosong', desc: 'Yuk mulai belanja produk favoritmu.',
      actionLabel: 'Mulai Belanja', actionAttr: 'onclick="UI.closeModal(\'modal-cart\')"'
    });
    summaryEl.innerHTML = '';
    footerEl.classList.add('hidden');
    checkoutBtn.classList.add('hidden');
    return;
  }
  footerEl.classList.remove('hidden');
  checkoutBtn.classList.remove('hidden');

  itemsEl.innerHTML = items.map(i => {
    const product = Products.getById(i.productId);
    const imgSrc = product ? ProductImage.getProductImage(product) : '';
    return `
    <div class="cart-item">
      <div class="thumb" style="border-radius:10px;--thumb-bg:${catGradient(product?.category)}">${imgSrc ? `<img src="${imgSrc}" alt="" style="width:100%;height:100%;object-fit:contain;padding:6px;box-sizing:border-box;" ${product ? ProductImage.fallbackAttr(product) : ''}>` : ''}</div>
      <div class="body">
        <div class="name">${UI.escapeHTML(i.name)}</div>
        <div class="row-bottom">
          <div class="qty-control">
            <button data-mcart-dec="${i.productId}">-</button><span>${i.qty}</span><button data-mcart-inc="${i.productId}">+</button>
          </div>
          <b class="price">${formatRupiah(i.price * i.qty)}</b>
        </div>
      </div>
      <button class="remove-btn" data-mcart-remove="${i.productId}">${ic('trash',{size:14})}</button>
    </div>`;
  }).join('');

  summaryEl.innerHTML = `
    <div class="cart-summary-row"><span>Total Item</span><span>${totalItems}</span></div>
    <div class="cart-summary-row"><span>Subtotal</span><span>${formatRupiah(subtotal)}</span></div>
    <div class="cart-summary-row total"><span>Total</span><span>${formatRupiah(total)}</span></div>`;

  itemsEl.querySelectorAll('[data-mcart-inc]').forEach(el => el.addEventListener('click', () => {
    const p = Products.getById(el.getAttribute('data-mcart-inc'));
    const res = CustomerCart.addItem(p, 1);
    if (!res.success) UI.toast(res.message, 'error');
    renderCartModal(); refreshProductGrids();
  }));
  itemsEl.querySelectorAll('[data-mcart-dec]').forEach(el => el.addEventListener('click', () => {
    const id = el.getAttribute('data-mcart-dec');
    const item = CustomerCart.getItems().find(i => i.productId === id);
    CustomerCart.updateQty(id, (item ? item.qty : 1) - 1);
    renderCartModal(); refreshProductGrids();
  }));
  itemsEl.querySelectorAll('[data-mcart-remove]').forEach(el => el.addEventListener('click', () => {
    CustomerCart.removeItem(el.getAttribute('data-mcart-remove'));
    UI.toast('Produk dihapus dari keranjang', 'info');
    renderCartModal(); refreshProductGrids();
  }));
}

let lastCartBadgeCount = 0;
function updateCartBadge() {
  const { totalItems } = CustomerCart.getSummary();
  const badge = document.getElementById('cart-badge');
  const floatingBtn = document.getElementById('floating-cart-btn');
  const floatingCount = document.getElementById('floating-cart-count');
  badge.textContent = totalItems;
  badge.classList.toggle('hidden', totalItems === 0);
  floatingCount.textContent = totalItems;
  floatingBtn.classList.toggle('show', totalItems > 0);

  if (totalItems !== lastCartBadgeCount && totalItems > 0) {
    [badge, floatingCount].forEach(el => {
      el.classList.remove('bump');
      void el.offsetWidth; // restart animasi
      el.classList.add('bump');
    });
  }
  lastCartBadgeCount = totalItems;
}

// ---------------- CHECKOUT ----------------
function openCheckout() {
  const { items, subtotal } = CustomerCart.getSummary();
  if (!items.length) { UI.toast('Keranjang masih kosong.', 'error'); return; }
  if (!Auth.isCustomerLoggedIn()) {
    UI.toast('Silakan login terlebih dahulu.', 'warning');
    UI.closeModal('modal-cart');
    UI.openModal('modal-customer-auth');
    return;
  }
  const customer = Auth.getCurrentCustomer();
  const branches = Branches.getActive();
  const settings = DB.get('settings')[0] || {};

  document.getElementById('modal-checkout-body').innerHTML = `
    <div class="modal-head">
      <h3>Checkout</h3>
      <button class="modal-close" onclick="UI.closeModal('modal-checkout')">${ic('x', { size: 16 })}</button>
    </div>

    <div class="checkout-steps">
      <div class="cstep done"><div class="num">${ic('check', { size: 13 })}</div><span>Keranjang</span></div>
      <div class="cstep-line done"></div>
      <div class="cstep active"><div class="num">2</div><span>Pengiriman</span></div>
      <div class="cstep-line"></div>
      <div class="cstep"><div class="num">3</div><span>Pembayaran</span></div>
      <div class="cstep-line"></div>
      <div class="cstep"><div class="num">4</div><span>Selesai</span></div>
    </div>

    <div class="form-tabs">
      <button class="active" data-fulfill-tab="Ambil Sendiri">${ic('store', { size: 15 })} Ambil Sendiri</button>
      <button data-fulfill-tab="Delivery">${ic('truck', { size: 15 })} Delivery</button>
    </div>

    <div id="fulfill-ambil">
      <div class="form-group"><label>Pilih Cabang</label>
        <select class="form-control" id="checkout-branch">
          ${branches.map(b => `<option value="${b.id}">${UI.escapeHTML(b.name)}</option>`).join('')}
        </select>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Tanggal Ambil</label><input class="form-control" type="date" id="checkout-date"></div>
        <div class="form-group"><label>Jam Ambil</label><input class="form-control" type="time" id="checkout-time"></div>
      </div>
    </div>

    <div id="fulfill-delivery" class="hidden">
      <div class="form-group"><label>Pilih Cabang Pengirim</label>
        <select class="form-control" id="checkout-branch-delivery">
          ${branches.map(b => `<option value="${b.id}">${UI.escapeHTML(b.name)}</option>`).join('')}
        </select>
      </div>
      <div class="form-group"><label>Nama Penerima</label><input class="form-control" type="text" id="checkout-recipient" value="${UI.escapeHTML(customer?.name || '')}"></div>
      <div class="form-group"><label>Nomor WhatsApp</label><input class="form-control" type="tel" id="checkout-wa" value="${UI.escapeHTML(customer?.whatsapp || '')}"></div>
      <div class="form-group"><label>Alamat Lengkap</label><textarea class="form-control" id="checkout-address" rows="2">${UI.escapeHTML(customer?.address || '')}</textarea></div>
      <div class="form-group"><label>Catatan (opsional)</label><input class="form-control" type="text" id="checkout-note"></div>
    </div>

    <div class="form-group"><label>Metode Pembayaran</label>
      <select class="form-control" id="checkout-payment">
        <option>Cash</option><option>QRIS</option><option>Transfer</option><option>Debit</option><option>Kredit</option>
      </select>
    </div>

    <div class="barcode-divider"></div>
    <div class="cart-summary-row"><span>Subtotal</span><span>${formatRupiah(subtotal)}</span></div>
    <div class="cart-summary-row" id="checkout-fee-row"><span>Biaya Delivery</span><span>Rp 0</span></div>
    <div class="cart-summary-row total"><span>Total</span><span id="checkout-total">${formatRupiah(subtotal)}</span></div>

    <button class="btn btn-accent btn-block btn-lg mt-16" id="btn-submit-order">Buat Pesanan</button>
  `;

  const deliveryFee = Number(settings.deliveryFee) || 10000;
  const tabs = document.querySelectorAll('[data-fulfill-tab]');
  let fulfillType = 'Ambil Sendiri';
  tabs.forEach(tab => tab.addEventListener('click', () => {
    tabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    fulfillType = tab.getAttribute('data-fulfill-tab');
    document.getElementById('fulfill-ambil').classList.toggle('hidden', fulfillType !== 'Ambil Sendiri');
    document.getElementById('fulfill-delivery').classList.toggle('hidden', fulfillType !== 'Delivery');
    const fee = fulfillType === 'Delivery' ? deliveryFee : 0;
    document.getElementById('checkout-fee-row').innerHTML = `<span>Biaya Delivery</span><span>${formatRupiah(fee)}</span>`;
    document.getElementById('checkout-total').textContent = formatRupiah(subtotal + fee);
  }));

  document.getElementById('btn-submit-order').addEventListener('click', () => {
    const payment = document.getElementById('checkout-payment').value;
    let branchId, address = '', pickupDate = '', pickupTime = '', note = '', whatsapp = customer.whatsapp, customerName = customer.name;

    if (fulfillType === 'Ambil Sendiri') {
      branchId = document.getElementById('checkout-branch').value;
      pickupDate = document.getElementById('checkout-date').value;
      pickupTime = document.getElementById('checkout-time').value;
    } else {
      branchId = document.getElementById('checkout-branch-delivery').value;
      customerName = document.getElementById('checkout-recipient').value.trim();
      whatsapp = document.getElementById('checkout-wa').value.trim();
      address = document.getElementById('checkout-address').value.trim();
      note = document.getElementById('checkout-note').value.trim();
      if (!whatsapp) { UI.toast('Nomor WhatsApp wajib diisi.', 'error'); return; }
      if (!address) { UI.toast('Alamat wajib diisi untuk delivery.', 'error'); return; }
    }

    const fee = fulfillType === 'Delivery' ? deliveryFee : 0;
    const res = Transactions.createOrder({
      customerId: customer.id, customerName, whatsapp, items,
      deliveryFee: fee, paymentMethod: payment, fulfillmentType: fulfillType,
      branchId, address, pickupDate, pickupTime, note
    });

    if (!res.success) { UI.toast(res.message, 'error'); return; }

    UI.toast('Pesanan berhasil dibuat', 'success');
    CustomerCart.clear();
    refreshProductGrids();
    UI.closeModal('modal-checkout');
    showOrderSuccess(res.order, settings);
  });

  UI.closeModal('modal-cart');
  UI.openModal('modal-checkout');
}

function showOrderSuccess(order, settings) {
  const waMessage = Transactions.buildWhatsAppMessage(order, settings.storeName);
  const waLink = Transactions.whatsappLink(settings.whatsapp, waMessage);
  document.getElementById('modal-checkout-body').innerHTML = `
    <div class="checkout-steps">
      <div class="cstep done"><div class="num">${ic('check', { size: 13 })}</div><span>Keranjang</span></div>
      <div class="cstep-line done"></div>
      <div class="cstep done"><div class="num">${ic('check', { size: 13 })}</div><span>Pengiriman</span></div>
      <div class="cstep-line done"></div>
      <div class="cstep done"><div class="num">${ic('check', { size: 13 })}</div><span>Pembayaran</span></div>
      <div class="cstep-line done"></div>
      <div class="cstep done"><div class="num">${ic('check', { size: 13 })}</div><span>Selesai</span></div>
    </div>
    <div style="text-align:center;padding:12px 0 20px;">
      <div class="success-check-circle">${ic('check', { size: 30 })}</div>
      <h3>Pesanan Berhasil Dibuat</h3>
      <p class="text-muted">Nomor pesanan Anda:</p>
      <p class="mono" style="font-size:18px;font-weight:700;">${order.orderId}</p>
      <a class="btn btn-primary btn-block btn-lg mt-16" href="${waLink}" target="_blank" rel="noopener">${ic('shopping-bag', { size: 17 })} Kirim Detail Pesanan ke WhatsApp</a>
      <button class="btn btn-outline btn-block mt-8" onclick="UI.closeModal('modal-checkout')">Tutup</button>
    </div>`;
  UI.openModal('modal-checkout');
}

// ---------------- ACCOUNT MODAL ----------------
function openAccountModal() {
  if (!Auth.isCustomerLoggedIn()) { UI.openModal('modal-customer-auth'); return; }
  const customer = Auth.getCurrentCustomer();
  const orders = Transactions.getOrdersByCustomer(customer.id);

  document.getElementById('modal-account-body').innerHTML = `
    <div class="modal-head"><h3>Akun Saya</h3><button class="modal-close" onclick="UI.closeModal('modal-account')">${ic('x',{size:16})}</button></div>
    <div class="card mb-16">
      <b>${UI.escapeHTML(customer.name)}</b>
      <p class="text-sm text-muted mt-8">📞 ${UI.escapeHTML(customer.whatsapp)}</p>
      <p class="text-sm text-muted">📍 ${UI.escapeHTML(customer.address || 'Belum diisi')}</p>
      <button class="btn btn-outline btn-sm mt-8" id="btn-logout-customer">Logout</button>
    </div>
    <h4 style="margin-bottom:10px;">Riwayat Pesanan</h4>
    <div id="account-orders-list">
      ${orders.length ? orders.map(orderRowHTML).join('') : UI.emptyStateHTML({ icon: '📦', title: 'Belum ada pesanan' })}
    </div>`;

  document.getElementById('btn-logout-customer').addEventListener('click', () => {
    Auth.logoutCustomer();
    UI.toast('Berhasil logout', 'info');
    UI.closeModal('modal-account');
  });

  UI.openModal('modal-account');
}

function orderRowHTML(o) {
  const statusClass = o.status === 'Selesai' ? 'selesai' : (o.status === 'Dibatalkan' ? 'dibatalkan' : 'pending');
  return `
    <div class="card mb-16">
      <div class="flex justify-between items-center">
        <span class="mono text-sm">${o.orderId}</span>
        <span class="status-pill ${statusClass}">${o.status}</span>
      </div>
      <p class="text-sm text-muted mt-8">${o.items.length} produk • ${formatRupiah(o.grandTotal)}</p>
      <p class="text-sm text-muted">${o.fulfillmentType} • ${formatTanggalIndonesia(o.createdAt)}</p>
    </div>`;
}

// ---------------- BIND EVENTS ----------------
function renderSearchSuggest(query, suggestId) {
  const el = document.getElementById(suggestId);
  const q = query.trim();
  if (!q) { el.classList.add('hidden'); el.innerHTML = ''; return; }

  const results = Products.search(q).slice(0, 6);
  if (!results.length) {
    el.innerHTML = `<div class="search-suggest-item"><div class="ss-body"><div class="ss-name text-muted">Tidak ada produk cocok</div></div></div>`;
    el.classList.remove('hidden');
    return;
  }

  el.innerHTML = results.map(p => `
    <div class="search-suggest-item" data-suggest-product="${p.id}">
      <div class="ss-thumb"><img src="${ProductImage.getProductImage(p)}" alt="" ${ProductImage.fallbackAttr(p)}></div>
      <div class="ss-body"><div class="ss-name">${UI.escapeHTML(p.name)}</div><div class="ss-cat">${UI.escapeHTML(p.category)}</div></div>
      <div class="ss-price">${formatRupiah(p.promo && p.discountPrice ? p.discountPrice : p.sellingPrice)}</div>
    </div>`).join('') + `<div class="search-suggest-footer" data-suggest-viewall="1">Lihat semua hasil untuk "${UI.escapeHTML(q)}"</div>`;

  el.classList.remove('hidden');

  el.querySelectorAll('[data-suggest-product]').forEach(item => {
    item.addEventListener('click', () => {
      el.classList.add('hidden');
      openProductDetail(item.getAttribute('data-suggest-product'));
    });
  });
  el.querySelector('[data-suggest-viewall]').addEventListener('click', () => {
    el.classList.add('hidden');
    currentSearchQuery = q;
    document.getElementById('header-search').value = q;
    document.getElementById('header-search-mobile').value = q;
    renderAllProducts();
    document.getElementById('section-all-products').scrollIntoView({ behavior: 'smooth' });
  });
}

function bindFilterSheet() {
  // Isi dropdown kategori
  const catSelect = document.getElementById('filter-sheet-category');
  Products.getCategories().forEach(c => catSelect.insertAdjacentHTML('beforeend', `<option value="${UI.escapeHTML(c.name)}">${UI.escapeHTML(c.name)}</option>`));

  document.getElementById('btn-open-filter-sheet').addEventListener('click', () => {
    catSelect.value = currentCategory || '';
    document.getElementById('filter-sheet-price-min').value = advancedFilters.priceMin ?? '';
    document.getElementById('filter-sheet-price-max').value = advancedFilters.priceMax ?? '';
    document.getElementById('filter-sheet-instock').checked = advancedFilters.inStockOnly;
    document.querySelectorAll('.price-preset-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.rating-filter-btn').forEach(b => b.classList.toggle('active', Number(b.getAttribute('data-rating')) === advancedFilters.minRating));
    UI.openModal('modal-filter-sheet');
  });

  document.querySelectorAll('.price-preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const [min, max] = btn.getAttribute('data-price-preset').split('-').map(Number);
      document.getElementById('filter-sheet-price-min').value = min;
      document.getElementById('filter-sheet-price-max').value = max >= 999999999 ? '' : max;
      document.querySelectorAll('.price-preset-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  document.querySelectorAll('.rating-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.rating-filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  document.getElementById('btn-clear-filter-sheet').addEventListener('click', () => {
    advancedFilters = { priceMin: null, priceMax: null, minRating: 0, inStockOnly: false };
    allProductsVisibleCount = 15;
    UI.closeModal('modal-filter-sheet');
    renderAllProducts();
    document.getElementById('section-all-products').scrollIntoView({ behavior: 'smooth' });
  });

  document.getElementById('btn-apply-filter-sheet').addEventListener('click', () => {
    currentCategory = catSelect.value || null;
    document.querySelectorAll('.category-card').forEach(c => c.classList.toggle('active', c.getAttribute('data-cat') === (currentCategory || '')));

    const min = document.getElementById('filter-sheet-price-min').value;
    const max = document.getElementById('filter-sheet-price-max').value;
    advancedFilters.priceMin = min !== '' ? Number(min) : null;
    advancedFilters.priceMax = max !== '' ? Number(max) : null;
    advancedFilters.minRating = Number(document.querySelector('.rating-filter-btn.active')?.getAttribute('data-rating') || 0);
    advancedFilters.inStockOnly = document.getElementById('filter-sheet-instock').checked;

    allProductsVisibleCount = 15;
    UI.closeModal('modal-filter-sheet');
    renderAllProducts();
    document.getElementById('section-all-products').scrollIntoView({ behavior: 'smooth' });
  });
}

function bindEvents() {
  document.querySelectorAll('.quick-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.quick-filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentQuickFilter = btn.getAttribute('data-filter') || '';
      allProductsVisibleCount = 15;
      renderAllProducts();
    });
  });

  document.getElementById('sort-select').addEventListener('change', (e) => {
    currentSort = e.target.value;
    renderAllProducts();
  });

  const searchHandler = UI.debounce((val) => {
    currentSearchQuery = val;
    allProductsVisibleCount = 15;
    renderAllProducts();
  }, 300);

  const suggestHandler = UI.debounce((val, suggestId) => renderSearchSuggest(val, suggestId), 200);

  document.getElementById('header-search').addEventListener('input', (e) => {
    document.getElementById('header-search-mobile').value = e.target.value;
    searchHandler(e.target.value);
    suggestHandler(e.target.value, 'search-suggest-desktop');
  });
  document.getElementById('header-search-mobile').addEventListener('input', (e) => {
    document.getElementById('header-search').value = e.target.value;
    searchHandler(e.target.value);
    suggestHandler(e.target.value, 'search-suggest-mobile');
  });
  document.getElementById('header-search').addEventListener('focus', (e) => { if (e.target.value) renderSearchSuggest(e.target.value, 'search-suggest-desktop'); });
  document.getElementById('header-search-mobile').addEventListener('focus', (e) => { if (e.target.value) renderSearchSuggest(e.target.value, 'search-suggest-mobile'); });
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#search-bar-desktop')) document.getElementById('search-suggest-desktop').classList.add('hidden');
    if (!e.target.closest('#search-bar-mobile')) document.getElementById('search-suggest-mobile').classList.add('hidden');
  });

  document.getElementById('hero-search').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { currentSearchQuery = e.target.value; renderAllProducts(); document.getElementById('section-all-products').scrollIntoView({ behavior: 'smooth' }); }
  });
  document.getElementById('hero-search-btn').addEventListener('click', () => {
    currentSearchQuery = document.getElementById('hero-search').value;
    renderAllProducts();
    document.getElementById('section-all-products').scrollIntoView({ behavior: 'smooth' });
  });

  document.getElementById('btn-load-more').addEventListener('click', () => {
    allProductsVisibleCount += 15;
    renderAllProducts();
  });

  ['btn-cart', 'nav-cart', 'floating-cart-btn'].forEach(id => {
    document.getElementById(id).addEventListener('click', () => { renderCartModal(); UI.openModal('modal-cart'); });
  });
  ['btn-account', 'nav-account', 'footer-account-link'].forEach(id => {
    document.getElementById(id).addEventListener('click', (e) => { e.preventDefault(); openAccountModal(); });
  });

  document.getElementById('btn-go-checkout').addEventListener('click', openCheckout);

  // Auth tabs
  document.querySelectorAll('[data-auth-tab]').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('[data-auth-tab]').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const mode = tab.getAttribute('data-auth-tab');
      document.getElementById('form-customer-login').classList.toggle('hidden', mode !== 'login');
      document.getElementById('form-customer-register').classList.toggle('hidden', mode !== 'register');
      document.getElementById('customer-auth-title').textContent = mode === 'login' ? 'Selamat Datang Kembali' : 'Daftar Akun Baru';
      document.getElementById('customer-auth-subtitle').textContent = mode === 'login' ? 'Masuk untuk melanjutkan belanja.' : 'Buat akun singkat dengan nomor WhatsApp.';
    });
  });

  document.getElementById('form-customer-login').addEventListener('submit', (e) => {
    e.preventDefault();
    const whatsapp = document.getElementById('login-whatsapp').value.trim();
    const password = document.getElementById('login-password').value;
    const res = Auth.loginCustomer(whatsapp, password);
    if (res.success) {
      UI.toast(`Selamat datang, ${res.customer.name}`, 'success');
      UI.closeModal('modal-customer-auth');
      e.target.reset();
    } else {
      UI.toast(res.message, 'error');
    }
  });

  document.getElementById('form-customer-register').addEventListener('submit', (e) => {
    e.preventDefault();
    const res = Auth.registerCustomer({
      name: document.getElementById('reg-name').value.trim(),
      whatsapp: document.getElementById('reg-whatsapp').value.trim(),
      address: document.getElementById('reg-address').value.trim(),
      password: document.getElementById('reg-password').value
    });
    if (res.success) {
      Auth.loginCustomer(res.customer.whatsapp, res.customer.password);
      UI.toast('Pendaftaran berhasil, Anda telah masuk', 'success');
      UI.closeModal('modal-customer-auth');
      e.target.reset();
    } else {
      UI.toast(res.message, 'error');
    }
  });

  // Admin login modal — role select (segmented cards)
  let selectedRole = 'admin_kasir';
  document.getElementById('btn-role-kasir').classList.add('active');
  document.querySelectorAll('[data-admin-role]').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedRole = btn.getAttribute('data-admin-role');
      document.querySelectorAll('[data-admin-role]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  document.getElementById('form-admin-login').addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('admin-email').value.trim();
    const password = document.getElementById('admin-password').value;
    const submitBtn = document.getElementById('btn-admin-login-submit');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Memeriksa...';
    setTimeout(() => {
      const res = Auth.loginAdmin(email, password, selectedRole);
      submitBtn.disabled = false;
      submitBtn.textContent = 'Masuk';
      if (!res.success) { UI.toast(res.message, 'error'); return; }
      UI.toast(`Login berhasil sebagai ${res.session.role}`, 'success');
      UI.closeModal('modal-admin-login');
      e.target.reset();
      const target = res.session.role === 'admin_gudang' ? './gudang.html' : './kasir.html';
      window.open(target, '_blank');
    }, 250);
  });

  // Toggle panel kredensial demo (disembunyikan secara default)
  document.getElementById('btn-toggle-demo').addEventListener('click', (e) => {
    const panel = document.getElementById('demo-access-panel');
    panel.classList.toggle('hidden');
    e.currentTarget.classList.toggle('open', !panel.classList.contains('hidden'));
  });

  // Show/hide password
  document.querySelectorAll('[data-toggle-password]').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = document.getElementById(btn.getAttribute('data-toggle-password'));
      const isHidden = input.type === 'password';
      input.type = isHidden ? 'text' : 'password';
      btn.innerHTML = ic(isHidden ? 'eye' : 'eye', { size: 16 });
      btn.classList.toggle('active', isHidden);
    });
  });
}
