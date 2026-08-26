/**
 * gudang.js
 * ------------------------------------------------------------------
 * Logika halaman gudang.html: produk, stok, barang masuk/keluar,
 * transfer antar cabang, stock opname, supplier, dan laporan gudang.
 * ------------------------------------------------------------------
 */

const G_HAS_ACCESS = Auth.requireAdminAccess('admin_gudang');
const gSession = G_HAS_ACCESS ? Auth.getAdminSession() : null;

document.addEventListener('DOMContentLoaded', () => {
  if (!G_HAS_ACCESS) return;
  document.getElementById('sidebar-role-label').textContent =
    gSession.role === 'superadmin' ? 'Super Admin' : 'Admin Gudang';
  bindNav();
  bindLogout();
  bindProductForm();
  bindStockInForm();
  bindStockOutForm();
  bindTransferForm();
  bindSupplierForm();
  bindPOForm();
  bindNotifDropdown();
  renderNotifications();
  populateCategoryFilters();
  switchView('dashboard');
});

function bindLogout() {
  document.getElementById('btn-logout').addEventListener('click', () => {
    Auth.logoutAdmin();
    window.location.href = './index.html';
  });
}

function renderNotifications() {
  const lowStock = Products.lowStock();
  const outOfStock = Products.outOfStock();

  const items = [
    ...outOfStock.slice(0, 6).map(p => ({ danger: true, icon: 'x', title: `${p.name} habis`, desc: 'Stok perlu diisi ulang segera' })),
    ...lowStock.slice(0, 6).map(p => ({ danger: false, icon: 'alert-triangle', title: `${p.name} stok kritis`, desc: `Tersisa ${p.stock} ${p.unit}` }))
  ];

  const total = outOfStock.length + lowStock.length;
  const badge = document.getElementById('notif-badge');
  badge.textContent = total > 9 ? '9+' : total;
  badge.classList.toggle('hidden', total === 0);

  const list = document.getElementById('notif-dropdown-list');
  list.innerHTML = items.length
    ? items.slice(0, 8).map(n => `
      <div class="notif-item ${n.danger ? 'danger' : ''}">
        <div class="notif-icon">${ic(n.icon, { size: 15 })}</div>
        <div><div class="notif-title">${UI.escapeHTML(n.title)}</div><div class="notif-desc">${UI.escapeHTML(n.desc)}</div></div>
      </div>`).join('')
    : `<div class="notif-empty">${ic('check-circle', { size: 22 })}<div class="mt-8">Semua kondisi aman</div></div>`;
}

function bindNotifDropdown() {
  const btn = document.getElementById('btn-notif');
  const dropdown = document.getElementById('notif-dropdown');
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdown.classList.toggle('hidden');
  });
  document.addEventListener('click', (e) => {
    if (!dropdown.contains(e.target) && e.target !== btn) dropdown.classList.add('hidden');
  });
}

function renderGudangQuickActions() {
  const actions = [
    { icon: 'download', label: 'Barang Masuk', sub: 'Catat pembelian stok', view: 'masuk', accent: true },
    { icon: 'upload', label: 'Barang Keluar', sub: 'Rusak / hilang / pakai', view: 'keluar' },
    { icon: 'transfer', label: 'Transfer Stok', sub: 'Antar cabang', view: 'transfer' },
    { icon: 'clipboard', label: 'Stock Opname', sub: 'Sesuaikan stok fisik', view: 'opname' }
  ];
  document.getElementById('gudang-quick-actions').innerHTML = actions.map(a => `
    <button class="quick-action-btn ${a.accent ? 'accent' : ''}" data-view-jump="${a.view}">
      <span class="qa-icon">${ic(a.icon, { size: 17 })}</span>
      <span><span class="qa-label" style="display:block;">${a.label}</span><span class="qa-sub">${a.sub}</span></span>
    </button>`).join('');
  document.querySelectorAll('[data-view-jump]').forEach(btn => {
    btn.addEventListener('click', () => switchView(btn.getAttribute('data-view-jump')));
  });
}

function renderGudangActivityFeed() {
  const movements = DB.get('stockMovements')
    .filter(m => gSession.role === 'superadmin' || m.branchId === gSession.branchId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 8);

  const wrap = document.getElementById('gudang-activity-feed');
  if (!movements.length) { wrap.innerHTML = UI.emptyStateHTML({ icon: '🕒', title: 'Belum ada pergerakan stok' }); return; }
  wrap.innerHTML = movements.map(m => {
    const product = Products.getById(m.productId);
    return `
    <div class="activity-item ${m.type === 'masuk' ? 'in' : 'out'}">
      <div class="act-icon">${ic(m.type === 'masuk' ? 'download' : 'upload', { size: 16 })}</div>
      <div class="act-body"><div class="act-title">${UI.escapeHTML(product?.name || m.productId)} <span class="text-faint">— ${UI.escapeHTML(m.reason)}</span></div><div class="act-time">${formatTanggalJamIndonesia(m.createdAt)}</div></div>
      <div class="act-amount" style="color:${m.type === 'masuk' ? 'var(--success)' : 'var(--danger)'}">${m.type === 'masuk' ? '+' : '-'}${m.quantity}</div>
    </div>`;
  }).join('');
}

const G_VIEW_TITLES = {
  dashboard: 'Dashboard Gudang', produk: 'Produk', stok: 'Stok Barang',
  masuk: 'Barang Masuk', keluar: 'Barang Keluar', transfer: 'Transfer Antar Cabang',
  opname: 'Stock Opname', supplier: 'Supplier', po: 'Purchase Order', laporan: 'Laporan Gudang'
};

function bindNav() {
  document.querySelectorAll('.admin-nav [data-view]').forEach(btn => {
    btn.addEventListener('click', () => switchView(btn.getAttribute('data-view')));
  });
}

function switchView(view) {
  renderNotifications();
  document.querySelectorAll('.view-section').forEach(v => v.classList.add('hidden'));
  document.getElementById(`view-${view}`).classList.remove('hidden');
  document.querySelectorAll('.admin-nav [data-view]').forEach(b => b.classList.toggle('active', b.getAttribute('data-view') === view));
  document.getElementById('topbar-title').textContent = G_VIEW_TITLES[view] || view;
  document.querySelector('.admin-sidebar').classList.remove('open');
  document.querySelector('.sidebar-overlay').classList.remove('show');

  if (view === 'dashboard') renderDashboard();
  if (view === 'produk') renderProdukView();
  if (view === 'stok') renderStokView();
  if (view === 'masuk') renderMasukView();
  if (view === 'keluar') renderKeluarView();
  if (view === 'transfer') renderTransferView();
  if (view === 'opname') renderOpnameView();
  if (view === 'supplier') renderSupplierView();
  if (view === 'po') renderPOView();
  if (view === 'laporan') renderLaporanGudangView();
}

function populateCategoryFilters() {
  const categories = Products.getCategories();
  const catFilter = document.getElementById('produk-filter-category');
  categories.forEach(c => catFilter.insertAdjacentHTML('beforeend', `<option value="${c.name}">${UI.escapeHTML(c.name)}</option>`));
  document.getElementById('prod-category').innerHTML = categories.map(c => `<option>${UI.escapeHTML(c.name)}</option>`).join('');
}

function fillBranchSelect(select, includeAll = false) {
  const branches = Branches.getAll();
  select.innerHTML = (includeAll ? '<option value="">Semua Cabang</option>' : '') +
    branches.map(b => `<option value="${b.id}">${UI.escapeHTML(b.name)}</option>`).join('');
}

function fillProductSelect(select) {
  const products = Products.getAll();
  select.innerHTML = products.map(p => `<option value="${p.id}">${UI.escapeHTML(p.name)} (${p.sku})</option>`).join('');
}

function fillSupplierSelect(select) {
  const suppliers = DB.get('suppliers');
  select.innerHTML = suppliers.map(s => `<option value="${s.id}">${UI.escapeHTML(s.name)}</option>`).join('');
}

// ================= DASHBOARD =================
// ================= DASHBOARD =================
function renderGreeting() {
  const hour = new Date().getHours();
  const greetLabel = hour < 11 ? 'Selamat Pagi' : hour < 15 ? 'Selamat Siang' : hour < 18 ? 'Selamat Sore' : 'Selamat Malam';
  document.getElementById('dashboard-greeting-text').textContent = `${greetLabel}, ${gSession.name}`;
  document.getElementById('dashboard-greeting-sub').textContent = 'Berikut ringkasan gudang Anda hari ini';
  document.getElementById('dashboard-greeting-date').textContent = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
}

function renderDashboard() {
  renderGreeting();
  const products = Products.getAll();
  const lowStock = Products.lowStock();
  const outOfStock = Products.outOfStock();
  const totalStockValue = products.reduce((s, p) => s + p.stock * p.purchasePrice, 0);
  const movementsToday = DB.get('stockMovements').filter(m => new Date(m.createdAt).toDateString() === new Date().toDateString());

  const wh = Reports.warehouseReport();
  const movementTrend = wh.masuk.slice(0, 7).reverse().map(m => m.quantity).concat(Array(7).fill(0)).slice(0, 7);

  const stats = [
    { label: 'Total Produk', value: products.length, raw: products.length, icon: 'tag', countUp: true },
    { label: 'Stok Kritis', value: lowStock.length, raw: lowStock.length, icon: 'alert-triangle', countUp: true },
    { label: 'Stok Habis', value: outOfStock.length, raw: outOfStock.length, icon: 'x', countUp: true },
    { label: 'Nilai Stok Gudang', value: formatRupiah(totalStockValue), icon: 'wallet', spark: movementTrend, money: true },
    { label: 'Pergerakan Stok Hari Ini', value: movementsToday.length, raw: movementsToday.length, icon: 'refresh', countUp: true },
    { label: 'Supplier Terdaftar', value: DB.get('suppliers').length, raw: DB.get('suppliers').length, icon: 'truck', countUp: true }
  ];
  document.getElementById('gudang-stats').innerHTML = stats.map((s, i) => `
    <div class="card stat-card ${s.spark ? 'has-spark' : ''}">
      <div class="icon-badge">${ic(s.icon,{size:18})}</div>
      <div class="card-stat"><span class="label">${s.label}</span><span class="value ${s.money ? 'value-sm' : ''}" ${s.countUp ? `id="g-stat-val-${i}"` : ''}>${s.countUp ? '0' : s.value}</span></div>
      ${s.spark ? Reports.sparklineSVG(s.spark) : ''}
    </div>`).join('');

  stats.forEach((s, i) => { if (s.countUp) UI.countUp(document.getElementById(`g-stat-val-${i}`), s.raw); });

  renderGudangQuickActions();
  renderGudangActivityFeed();

  const critical = [...outOfStock, ...lowStock].slice(0, 10);
  const wrap = document.getElementById('dashboard-low-stock');
  if (!critical.length) { wrap.innerHTML = UI.emptyStateHTML({ icon: '✅', title: 'Semua stok dalam kondisi aman' }); return; }
  wrap.innerHTML = `<table class="data-table"><thead><tr><th>Produk</th><th>Kategori</th><th>Stok</th><th>Minimum</th><th>Status</th></tr></thead><tbody>
    ${critical.map(p => `
      <tr>
        <td data-label="Produk">${UI.escapeHTML(p.name)}</td>
        <td data-label="Kategori">${UI.escapeHTML(p.category)}</td>
        <td data-label="Stok">${p.stock}</td>
        <td data-label="Minimum">${p.minimumStock}</td>
        <td data-label="Status"><span class="status-pill ${p.stock <= 0 ? 'dibatalkan' : 'pending'}">${p.stock <= 0 ? 'Habis' : 'Kritis'}</span></td>
      </tr>`).join('')}
  </tbody></table>`;
}

// ================= PRODUK =================
function renderProdukView() {
  if (!document.getElementById('produk-search').dataset.bound) {
    document.getElementById('produk-search').dataset.bound = '1';
    document.getElementById('produk-search').addEventListener('input', UI.debounce(() => renderProdukTable(), 250));
    document.getElementById('produk-filter-category').addEventListener('change', () => renderProdukTable());
    document.getElementById('btn-export-products').addEventListener('click', () => {
      Products.downloadCSV('produk.csv', Products.exportCSV());
    });
    document.getElementById('input-import-products').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const res = Products.importCSV(reader.result);
        UI.toast(`Import selesai: ${res.imported} baru, ${res.updated} diperbarui${res.errors.length ? `, ${res.errors.length} error` : ''}`, res.errors.length ? 'warning' : 'success');
        renderProdukTable();
      };
      reader.readAsText(file);
      e.target.value = '';
    });
    document.getElementById('btn-add-product').addEventListener('click', () => openProductModal(null));
  }
  renderProdukTable();
}

function renderProdukTable() {
  const q = document.getElementById('produk-search').value;
  const category = document.getElementById('produk-filter-category').value;
  const list = Products.search(q, { category });
  const wrap = document.getElementById('produk-table-wrap');
  if (!list.length) { wrap.innerHTML = UI.emptyStateHTML({ icon: 'tag', title: 'Produk tidak ditemukan' }); return; }

  wrap.innerHTML = `<table class="data-table"><thead><tr>
    <th>Foto</th><th>SKU</th><th>Produk</th><th>Kategori</th><th>Harga Beli</th><th>Harga Jual</th><th>Promo</th><th>Stok</th><th>Status</th><th>Aksi</th>
  </tr></thead><tbody>
    ${list.slice(0, 150).map(p => `
      <tr>
        <td data-label="Foto"><img class="table-thumb" src="${ProductImage.getProductImage(p)}" alt="" loading="lazy" ${ProductImage.fallbackAttr(p)}></td>
        <td data-label="SKU" class="mono">${p.sku}</td>
        <td data-label="Produk">${UI.escapeHTML(p.name)}${p.isBestSeller ? ' <span class="mini-tag gold" title="Produk Terlaris">Top</span>' : ''}${p.isNew ? ' <span class="mini-tag blue" title="Produk Baru">Baru</span>' : ''}</td>
        <td data-label="Kategori">${UI.escapeHTML(p.category)}</td>
        <td data-label="Harga Beli" class="mono">${formatRupiah(p.purchasePrice)}</td>
        <td data-label="Harga Jual" class="mono">${formatRupiah(p.sellingPrice)}</td>
        <td data-label="Promo">${p.promo ? `<span class="status-pill pending">-${Math.round((1 - p.discountPrice / p.sellingPrice) * 100)}%</span>` : '-'}</td>
        <td data-label="Stok">${p.stock} ${UI.escapeHTML(p.unit)}</td>
        <td data-label="Status"><span class="status-pill ${p.status === 'aktif' ? 'aktif' : 'dibatalkan'}">${p.status}</span></td>
        <td data-label="Aksi">
          <div class="row-actions"><button class="icon-action-btn" data-edit-product="${p.id}" title="Edit Produk">${ic('edit',{size:15})}</button><button class="icon-action-btn danger" data-delete-product="${p.id}" title="Hapus Produk">${ic('trash',{size:15})}</button></div>
        </td>
      </tr>`).join('')}
  </tbody></table>`;

  wrap.querySelectorAll('[data-edit-product]').forEach(b => b.addEventListener('click', () => openProductModal(b.getAttribute('data-edit-product'))));
  wrap.querySelectorAll('[data-delete-product]').forEach(b => b.addEventListener('click', () => {
    if (!confirm('Hapus produk ini? Tindakan tidak dapat dibatalkan.')) return;
    Products.remove(b.getAttribute('data-delete-product'));
    UI.toast('Produk dihapus', 'success');
    renderProdukTable();
  }));
}

function updatePhotoPreview(imageValue) {
  const preview = document.getElementById('prod-photo-preview');
  const img = document.getElementById('prod-photo-preview-img');
  if (imageValue) {
    img.src = imageValue;
    preview.classList.add('has-image');
  } else {
    img.src = '';
    preview.classList.remove('has-image');
  }
}

function openProductModal(id) {
  const p = id ? Products.getById(id) : null;
  document.getElementById('product-modal-title').textContent = p ? 'Edit Produk' : 'Tambah Produk';
  document.getElementById('prod-id').value = id || '';
  document.getElementById('prod-name').value = p?.name || '';
  document.getElementById('prod-category').value = p?.category || 'Lainnya';
  document.getElementById('prod-subcategory').value = p?.subcategory || '';
  document.getElementById('prod-sku').value = p?.sku || '';
  document.getElementById('prod-barcode').value = p?.barcode || '';
  document.getElementById('prod-brand').value = p?.brand || '';
  document.getElementById('prod-unit').value = p?.unit || 'pcs';
  document.getElementById('prod-weight').value = p?.weight || '';
  document.getElementById('prod-purchasePrice').value = p?.purchasePrice || 0;
  document.getElementById('prod-sellingPrice').value = p?.sellingPrice || 0;
  document.getElementById('prod-stock').value = p?.stock ?? 0;
  document.getElementById('prod-minimumStock').value = p?.minimumStock ?? 5;
  document.getElementById('prod-promo').checked = !!p?.promo;
  document.getElementById('prod-discountPrice').value = p?.discountPrice || '';
  document.getElementById('prod-isBestSeller').checked = !!p?.isBestSeller;
  document.getElementById('prod-isNew').checked = !!p?.isNew;
  document.getElementById('prod-isFeatured').checked = !!p?.isFeatured;
  document.getElementById('prod-image-data').value = p?.image || '';
  updatePhotoPreview(p?.image || '');
  fillSupplierSelect(document.getElementById('prod-supplier'));
  document.getElementById('prod-supplier').value = p?.supplier || '';
  document.getElementById('prod-description').value = p?.description || '';
  document.getElementById('prod-status').value = p?.status || 'aktif';
  document.getElementById('prod-stock').disabled = !!p; // stok hanya diubah lewat barang masuk/keluar/opname setelah dibuat
  UI.openModal('modal-product-form');
}

function bindProductForm() {
  document.getElementById('prod-image-input').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 1.5 * 1024 * 1024) {
      UI.toast('Ukuran foto maksimal 1.5MB (disimpan di localStorage browser).', 'error');
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      document.getElementById('prod-image-data').value = reader.result;
      updatePhotoPreview(reader.result);
    };
    reader.readAsDataURL(file);
  });
  document.getElementById('prod-image-clear').addEventListener('click', () => {
    document.getElementById('prod-image-data').value = '';
    document.getElementById('prod-image-input').value = '';
    updatePhotoPreview('');
  });

  document.getElementById('form-product').addEventListener('submit', (e) => {
    e.preventDefault();
    const id = document.getElementById('prod-id').value;
    const isPromo = document.getElementById('prod-promo').checked;
    const discountPrice = isPromo ? Number(document.getElementById('prod-discountPrice').value) || null : null;
    const data = {
      name: document.getElementById('prod-name').value.trim(),
      category: document.getElementById('prod-category').value,
      subcategory: document.getElementById('prod-subcategory').value.trim(),
      sku: document.getElementById('prod-sku').value.trim(),
      barcode: document.getElementById('prod-barcode').value.trim(),
      brand: document.getElementById('prod-brand').value.trim(),
      unit: document.getElementById('prod-unit').value.trim() || 'pcs',
      weight: document.getElementById('prod-weight').value.trim(),
      purchasePrice: Number(document.getElementById('prod-purchasePrice').value),
      sellingPrice: Number(document.getElementById('prod-sellingPrice').value),
      minimumStock: Number(document.getElementById('prod-minimumStock').value),
      promo: isPromo,
      isPromo,
      discountPrice,
      promoLabel: isPromo && discountPrice ? `HEMAT ${Math.round((1 - discountPrice / Number(document.getElementById('prod-sellingPrice').value)) * 100)}%` : '',
      isBestSeller: document.getElementById('prod-isBestSeller').checked,
      isNew: document.getElementById('prod-isNew').checked,
      isFeatured: document.getElementById('prod-isFeatured').checked,
      image: document.getElementById('prod-image-data').value,
      imageSource: document.getElementById('prod-image-data').value ? 'admin-upload' : 'generated-illustration',
      supplier: document.getElementById('prod-supplier').value,
      description: document.getElementById('prod-description').value.trim(),
      status: document.getElementById('prod-status').value
    };
    if (!id) data.stock = Number(document.getElementById('prod-stock').value) || 0;

    const res = id ? Products.update(id, data) : Products.create(data);
    if (!res.success) { UI.toast(res.errors.join(' '), 'error'); return; }
    UI.toast('Produk disimpan', 'success');
    UI.closeModal('modal-product-form');
    renderProdukTable();
  });
}

// ================= STOK =================
function renderStokView() {
  if (!document.getElementById('stok-search').dataset.bound) {
    document.getElementById('stok-search').dataset.bound = '1';
    document.getElementById('stok-search').addEventListener('input', UI.debounce(() => renderStokTable(), 250));
    document.getElementById('stok-filter-status').addEventListener('change', () => renderStokTable());
  }
  renderStokTable();
}

function renderStokTable() {
  const q = document.getElementById('stok-search').value;
  const status = document.getElementById('stok-filter-status').value;
  let list = Products.search(q);
  if (status === 'ok') list = list.filter(p => p.stock > p.minimumStock);
  if (status === 'low') list = list.filter(p => p.stock > 0 && p.stock <= p.minimumStock);
  if (status === 'out') list = list.filter(p => p.stock <= 0);

  const wrap = document.getElementById('stok-table-wrap');
  if (!list.length) { wrap.innerHTML = UI.emptyStateHTML({ icon: '📦', title: 'Tidak ada produk' }); return; }

  wrap.innerHTML = `<table class="data-table"><thead><tr><th>Produk</th><th>Kategori</th><th>Stok Total</th><th>Level</th><th>Lokasi (per cabang)</th></tr></thead><tbody>
    ${list.slice(0, 150).map(p => {
      const pct = p.minimumStock > 0 ? Math.min(100, (p.stock / (p.minimumStock * 3)) * 100) : 100;
      const cls = p.stock <= 0 ? 'out' : (p.stock <= p.minimumStock ? 'low' : 'ok');
      const branchStockStr = Object.entries(p.branchStock || {}).map(([bid, qty]) => `${Branches.getById(bid)?.name?.replace('Cabang ', '') || bid}: ${qty}`).join(', ');
      return `
      <tr>
        <td data-label="Produk">${UI.escapeHTML(p.name)}</td>
        <td data-label="Kategori">${UI.escapeHTML(p.category)}</td>
        <td data-label="Stok Total"><b>${p.stock}</b> ${UI.escapeHTML(p.unit)}
          <div class="stock-level-bar ${cls}"><span style="width:${pct}%"></span></div>
        </td>
        <td data-label="Level"><span class="status-pill ${cls === 'ok' ? 'aktif' : (cls === 'low' ? 'pending' : 'dibatalkan')}">${cls === 'ok' ? 'Aman' : (cls === 'low' ? 'Kritis' : 'Habis')}</span></td>
        <td data-label="Lokasi" class="text-sm text-muted">${branchStockStr || '-'}</td>
      </tr>`;
    }).join('')}
  </tbody></table>`;
}

// ================= BARANG MASUK =================
function renderMasukView() {
  const wrap = document.getElementById('masuk-table-wrap');
  const list = DB.get('stockMovements').filter(m => m.type === 'masuk' && m.reason === 'Pembelian').sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  if (!list.length) { wrap.innerHTML = UI.emptyStateHTML({ icon: '⬇️', title: 'Belum ada barang masuk' }); return; }
  wrap.innerHTML = movementTableHTML(list, true);
}

function bindStockInForm() {
  document.getElementById('btn-add-masuk').addEventListener('click', () => {
    fillProductSelect(document.getElementById('masuk-product'));
    fillSupplierSelect(document.getElementById('masuk-supplier'));
    fillBranchSelect(document.getElementById('masuk-branch'));
    if (gSession.role !== 'superadmin') document.getElementById('masuk-branch').value = gSession.branchId;
    UI.openModal('modal-masuk-form');
  });
  document.getElementById('form-masuk').addEventListener('submit', (e) => {
    e.preventDefault();
    const res = Transactions.stockIn({
      productId: document.getElementById('masuk-product').value,
      supplierId: document.getElementById('masuk-supplier').value,
      branchId: document.getElementById('masuk-branch').value,
      quantity: Number(document.getElementById('masuk-qty').value),
      purchasePrice: Number(document.getElementById('masuk-price').value) || undefined,
      note: document.getElementById('masuk-note').value.trim()
    });
    if (!res.success) { UI.toast(res.message, 'error'); return; }
    UI.toast('Barang masuk dicatat, stok diperbarui', 'success');
    UI.closeModal('modal-masuk-form');
    e.target.reset();
    renderMasukView();
  });
}

// ================= BARANG KELUAR =================
function renderKeluarView() {
  const wrap = document.getElementById('keluar-table-wrap');
  const list = DB.get('stockMovements').filter(m => m.type === 'keluar' && !['Penjualan', 'Order Online'].includes(m.reason) && !(m.reason || '').startsWith('Transfer')).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  if (!list.length) { wrap.innerHTML = UI.emptyStateHTML({ icon: '⬆️', title: 'Belum ada catatan barang keluar' }); return; }
  wrap.innerHTML = movementTableHTML(list, false);
}

function bindStockOutForm() {
  document.getElementById('btn-add-keluar').addEventListener('click', () => {
    fillProductSelect(document.getElementById('keluar-product'));
    fillBranchSelect(document.getElementById('keluar-branch'));
    if (gSession.role !== 'superadmin') document.getElementById('keluar-branch').value = gSession.branchId;
    UI.openModal('modal-keluar-form');
  });
  document.getElementById('form-keluar').addEventListener('submit', (e) => {
    e.preventDefault();
    const res = Transactions.stockOut({
      productId: document.getElementById('keluar-product').value,
      branchId: document.getElementById('keluar-branch').value,
      quantity: Number(document.getElementById('keluar-qty').value),
      reason: document.getElementById('keluar-reason').value,
      note: document.getElementById('keluar-note').value.trim()
    });
    if (!res.success) { UI.toast(res.message, 'error'); return; }
    UI.toast('Barang keluar dicatat, stok diperbarui', 'success');
    UI.closeModal('modal-keluar-form');
    e.target.reset();
    renderKeluarView();
  });
}

function movementTableHTML(list, isMasuk) {
  return `<table class="data-table"><thead><tr><th>Dokumen</th><th>Tanggal</th><th>Produk</th><th>Qty</th><th>Cabang</th><th>${isMasuk ? 'Supplier' : 'Alasan'}</th><th>Keterangan</th></tr></thead><tbody>
    ${list.slice(0, 150).map(m => `
      <tr>
        <td data-label="Dokumen" class="mono">${m.docNumber || '-'}</td>
        <td data-label="Tanggal">${formatTanggalJamIndonesia(m.createdAt)}</td>
        <td data-label="Produk">${UI.escapeHTML(Products.getById(m.productId)?.name || m.productId)}</td>
        <td data-label="Qty">${m.quantity}</td>
        <td data-label="Cabang">${UI.escapeHTML(Branches.getById(m.branchId)?.name || '-')}</td>
        <td data-label="${isMasuk ? 'Supplier' : 'Alasan'}">${isMasuk ? UI.escapeHTML(DB.find('suppliers', m.supplierId)?.name || '-') : UI.escapeHTML(m.reason)}</td>
        <td data-label="Keterangan" class="text-sm text-muted">${UI.escapeHTML(m.note || '-')}</td>
      </tr>`).join('')}
  </tbody></table>`;
}

// ================= TRANSFER =================
function renderTransferView() {
  const wrap = document.getElementById('transfer-table-wrap');
  const list = DB.get('stockMovements').filter(m => m.reason === 'Transfer Keluar').sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  if (!list.length) { wrap.innerHTML = UI.emptyStateHTML({ icon: '🔁', title: 'Belum ada transfer stok' }); return; }
  wrap.innerHTML = `<table class="data-table"><thead><tr><th>Dokumen</th><th>Tanggal</th><th>Produk</th><th>Qty</th><th>Rute</th></tr></thead><tbody>
    ${list.slice(0, 100).map(m => {
      const toNote = (m.note || '').match(/Ke (\S+)/);
      const toBranch = toNote ? Branches.getById(toNote[1])?.name : '-';
      return `<tr>
        <td data-label="Dokumen" class="mono">${m.docNumber}</td>
        <td data-label="Tanggal">${formatTanggalJamIndonesia(m.createdAt)}</td>
        <td data-label="Produk">${UI.escapeHTML(Products.getById(m.productId)?.name || m.productId)}</td>
        <td data-label="Qty">${m.quantity}</td>
        <td data-label="Rute" class="transfer-arrow">${UI.escapeHTML(Branches.getById(m.branchId)?.name || '-')} <span class="arrow">→</span> ${UI.escapeHTML(toBranch || '-')}</td>
      </tr>`;
    }).join('')}
  </tbody></table>`;
}

function bindTransferForm() {
  document.getElementById('btn-add-transfer').addEventListener('click', () => {
    fillProductSelect(document.getElementById('transfer-product'));
    fillBranchSelect(document.getElementById('transfer-from'));
    fillBranchSelect(document.getElementById('transfer-to'));
    UI.openModal('modal-transfer-form');
  });
  document.getElementById('form-transfer').addEventListener('submit', (e) => {
    e.preventDefault();
    const res = Transactions.transferStock({
      productId: document.getElementById('transfer-product').value,
      fromBranchId: document.getElementById('transfer-from').value,
      toBranchId: document.getElementById('transfer-to').value,
      quantity: Number(document.getElementById('transfer-qty').value),
      note: document.getElementById('transfer-note').value.trim()
    });
    if (!res.success) { UI.toast(res.message, 'error'); return; }
    UI.toast('Transfer stok berhasil', 'success');
    UI.closeModal('modal-transfer-form');
    e.target.reset();
    renderTransferView();
  });
}

// ================= STOCK OPNAME =================
function renderOpnameView() {
  const branchSelect = document.getElementById('opname-branch');
  if (!branchSelect.dataset.bound) {
    fillBranchSelect(branchSelect);
    if (gSession.role !== 'superadmin') branchSelect.value = gSession.branchId;
    branchSelect.dataset.bound = '1';
    branchSelect.addEventListener('change', renderOpnameList);
    document.getElementById('opname-search').addEventListener('input', UI.debounce(renderOpnameList, 250));
  }
  renderOpnameList();
}

function renderOpnameList() {
  const branchId = document.getElementById('opname-branch').value;
  const q = document.getElementById('opname-search').value;
  const list = Products.search(q);
  const wrap = document.getElementById('opname-list');
  if (!list.length) { wrap.innerHTML = UI.emptyStateHTML({ title: 'Produk tidak ditemukan' }); return; }

  wrap.innerHTML = list.slice(0, 60).map(p => {
    const currentQty = (p.branchStock || {})[branchId] || 0;
    return `
    <div class="opname-row">
      <div><b class="text-sm">${UI.escapeHTML(p.name)}</b><div class="text-sm text-muted">Sistem: ${currentQty} ${UI.escapeHTML(p.unit)}</div></div>
      <input type="number" min="0" placeholder="${currentQty}" data-opname-input="${p.id}">
      <button class="btn btn-primary btn-sm" data-opname-save="${p.id}">Simpan</button>
    </div>`;
  }).join('');

  wrap.querySelectorAll('[data-opname-save]').forEach(btn => {
    btn.addEventListener('click', () => {
      const productId = btn.getAttribute('data-opname-save');
      const input = wrap.querySelector(`[data-opname-input="${productId}"]`);
      const newQty = Number(input.value);
      if (input.value === '' || isNaN(newQty) || newQty < 0) { UI.toast('Masukkan jumlah stok fisik yang valid.', 'error'); return; }
      const res = Transactions.adjustStock({ productId, branchId, newQuantity: newQty });
      if (!res.success) { UI.toast(res.message, 'error'); return; }
      UI.toast('Stok diperbarui', 'success');
      renderOpnameList();
    });
  });
}

// ================= SUPPLIER =================
function renderSupplierView() {
  const wrap = document.getElementById('supplier-list');
  const suppliers = DB.get('suppliers');
  if (!suppliers.length) { wrap.innerHTML = UI.emptyStateHTML({ icon: 'truck', title: 'Belum ada supplier' }); return; }
  wrap.innerHTML = suppliers.map(s => `
    <div class="card supplier-card">
      <h4>${UI.escapeHTML(s.name)}</h4>
      <p>📞 ${UI.escapeHTML(s.contact || '-')}</p>
      <p>📍 ${UI.escapeHTML(s.address || '-')}</p>
      <button class="btn btn-outline btn-sm mt-8" data-delete-supplier="${s.id}">${ic('trash', { size: 14 })} Hapus</button>
    </div>`).join('');
  wrap.querySelectorAll('[data-delete-supplier]').forEach(b => b.addEventListener('click', () => {
    if (!confirm('Hapus supplier ini?')) return;
    DB.delete('suppliers', b.getAttribute('data-delete-supplier'));
    renderSupplierView();
  }));
}

function bindSupplierForm() {
  document.getElementById('btn-add-supplier').addEventListener('click', () => UI.openModal('modal-supplier-form'));
  document.getElementById('form-supplier').addEventListener('submit', (e) => {
    e.preventDefault();
    DB.insert('suppliers', {
      name: document.getElementById('supplier-name').value.trim(),
      contact: document.getElementById('supplier-contact').value.trim(),
      address: document.getElementById('supplier-address').value.trim()
    });
    UI.toast('Supplier ditambahkan', 'success');
    UI.closeModal('modal-supplier-form');
    e.target.reset();
    renderSupplierView();
  });
}

// ================= LAPORAN GUDANG =================
function renderLaporanGudangView() {
  const wh = Reports.warehouseReport();
  document.getElementById('gudang-laporan-stats').innerHTML = `
    <div class="card stat-card"><div class="card-stat"><span class="label">Total Barang Masuk</span><span class="value">${wh.totalMasuk}</span></div></div>
    <div class="card stat-card"><div class="card-stat"><span class="label">Total Barang Keluar</span><span class="value">${wh.totalKeluar}</span></div></div>`;

  const { terlaris, palingSedikit } = Reports.productReport();
  document.getElementById('laporan-terlaris').innerHTML = `<table class="data-table"><thead><tr><th>Produk</th><th>Terjual</th><th>Stok</th></tr></thead><tbody>
    ${terlaris.slice(0, 10).map(p => `<tr><td data-label="Produk">${UI.escapeHTML(p.name)}</td><td data-label="Terjual">${p.sold}</td><td data-label="Stok">${p.stock}</td></tr>`).join('')}
  </tbody></table>`;
  document.getElementById('laporan-paling-sedikit').innerHTML = `<table class="data-table"><thead><tr><th>Produk</th><th>Terjual</th><th>Stok</th></tr></thead><tbody>
    ${palingSedikit.slice(0, 10).map(p => `<tr><td data-label="Produk">${UI.escapeHTML(p.name)}</td><td data-label="Terjual">${p.sold}</td><td data-label="Stok">${p.stock}</td></tr>`).join('')}
  </tbody></table>`;
}

// ================= PURCHASE ORDER =================
let poLineCount = 0;

function renderPOView() {
  if (!document.getElementById('po-filter-status').dataset.bound) {
    document.getElementById('po-filter-status').dataset.bound = '1';
    document.getElementById('po-filter-status').addEventListener('change', renderPOTable);
    document.getElementById('btn-add-po').addEventListener('click', openPOForm);
  }
  renderPOTable();
}

function renderPOTable() {
  const status = document.getElementById('po-filter-status').value;
  let list = DB.get('purchaseOrders').sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  if (status) list = list.filter(po => po.status === status);

  const wrap = document.getElementById('po-table-wrap');
  if (!list.length) { wrap.innerHTML = UI.emptyStateHTML({ icon: 'clipboard', title: 'Belum ada Purchase Order', desc: 'Buat PO untuk memesan stok ke supplier.' }); return; }

  const statusLabel = { draft: 'Draft', dipesan: 'Dipesan', diterima: 'Diterima', dibatalkan: 'Dibatalkan' };
  const statusClass = { draft: 'pending', dipesan: 'proses', diterima: 'aktif', dibatalkan: 'dibatalkan' };

  wrap.innerHTML = `<table class="data-table"><thead><tr>
    <th>No. PO</th><th>Supplier</th><th>Cabang</th><th>Item</th><th>Estimasi Total</th><th>Status</th><th>Tanggal</th><th>Aksi</th>
  </tr></thead><tbody>
    ${list.map(po => `
      <tr>
        <td data-label="No. PO" class="mono">${po.poNumber}</td>
        <td data-label="Supplier">${UI.escapeHTML(DB.find('suppliers', po.supplierId)?.name || '-')}</td>
        <td data-label="Cabang">${UI.escapeHTML(Branches.getById(po.branchId)?.name || '-')}</td>
        <td data-label="Item">${po.items.length} produk</td>
        <td data-label="Estimasi Total" class="mono">${formatRupiah(po.estimatedTotal)}</td>
        <td data-label="Status"><span class="status-pill ${statusClass[po.status]}">${statusLabel[po.status]}</span></td>
        <td data-label="Tanggal">${formatTanggalIndonesia(po.createdAt)}</td>
        <td data-label="Aksi"><button class="icon-action-btn" data-po-detail="${po.id}" title="Lihat Detail">${ic('eye', { size: 15 })}</button></td>
      </tr>`).join('')}
  </tbody></table>`;

  wrap.querySelectorAll('[data-po-detail]').forEach(b => b.addEventListener('click', () => openPODetail(b.getAttribute('data-po-detail'))));
}

function openPOForm() {
  fillSupplierSelect(document.getElementById('po-supplier'));
  fillBranchSelect(document.getElementById('po-branch'));
  if (gSession.role !== 'superadmin') document.getElementById('po-branch').value = gSession.branchId;
  document.getElementById('po-items-list').innerHTML = '';
  poLineCount = 0;
  addPOLine();
  UI.openModal('modal-po-form');
}

function addPOLine() {
  const id = `poline-${poLineCount++}`;
  const wrap = document.getElementById('po-items-list');
  const row = document.createElement('div');
  row.className = 'po-line';
  row.id = id;
  const productOptions = Products.getAll().map(p => `<option value="${p.id}" data-price="${p.purchasePrice}">${UI.escapeHTML(p.name)}</option>`).join('');
  row.innerHTML = `
    <select class="form-control po-line-product">${productOptions}</select>
    <input type="number" class="form-control po-line-qty" value="10" min="1">
    <input type="number" class="form-control po-line-price" placeholder="Harga satuan">
    <button type="button" class="icon-action-btn danger" data-remove-line="${id}">${ic('trash', { size: 14 })}</button>`;
  wrap.appendChild(row);

  const productSelect = row.querySelector('.po-line-product');
  const priceInput = row.querySelector('.po-line-price');
  const qtyInput = row.querySelector('.po-line-qty');
  const syncPrice = () => { priceInput.value = productSelect.selectedOptions[0]?.dataset.price || 0; updatePOEstimatedTotal(); };
  syncPrice();
  productSelect.addEventListener('change', syncPrice);
  priceInput.addEventListener('input', updatePOEstimatedTotal);
  qtyInput.addEventListener('input', updatePOEstimatedTotal);
  row.querySelector('[data-remove-line]').addEventListener('click', () => { row.remove(); updatePOEstimatedTotal(); });
  updatePOEstimatedTotal();
}

function updatePOEstimatedTotal() {
  let total = 0;
  document.querySelectorAll('#po-items-list .po-line').forEach(row => {
    const qty = Number(row.querySelector('.po-line-qty').value) || 0;
    const price = Number(row.querySelector('.po-line-price').value) || 0;
    total += qty * price;
  });
  document.getElementById('po-estimated-total').textContent = formatRupiah(total);
}

function bindPOForm() {
  document.getElementById('btn-add-po-line').addEventListener('click', addPOLine);
  document.getElementById('form-po').addEventListener('submit', (e) => {
    e.preventDefault();
    const rows = document.querySelectorAll('#po-items-list .po-line');
    if (!rows.length) { UI.toast('Tambahkan minimal 1 item.', 'error'); return; }

    const items = Array.from(rows).map(row => {
      const productId = row.querySelector('.po-line-product').value;
      const product = Products.getById(productId);
      const qty = Number(row.querySelector('.po-line-qty').value) || 0;
      const price = Number(row.querySelector('.po-line-price').value) || 0;
      return { productId, name: product?.name || '', qty, price, lineTotal: qty * price };
    }).filter(i => i.qty > 0);

    const estimatedTotal = items.reduce((s, i) => s + i.lineTotal, 0);
    const poNumber = DB.nextDocNumber('PO', 'purchaseOrders', 'createdAt');

    DB.insert('purchaseOrders', {
      poNumber,
      supplierId: document.getElementById('po-supplier').value,
      branchId: document.getElementById('po-branch').value,
      expectedDate: document.getElementById('po-expected-date').value,
      note: document.getElementById('po-note').value.trim(),
      items, estimatedTotal,
      status: 'draft',
      createdAt: new Date().toISOString()
    });

    UI.toast('Purchase Order disimpan sebagai draft', 'success');
    UI.closeModal('modal-po-form');
    e.target.reset();
    renderPOTable();
  });
}

function openPODetail(id) {
  const po = DB.find('purchaseOrders', id);
  if (!po) return;
  const supplier = DB.find('suppliers', po.supplierId);
  const branch = Branches.getById(po.branchId);
  const statusLabel = { draft: 'Draft', dipesan: 'Dipesan ke Supplier', diterima: 'Diterima', dibatalkan: 'Dibatalkan' };

  document.getElementById('modal-po-detail-body').innerHTML = `
    <div class="modal-head"><h3>${po.poNumber}</h3><button class="modal-close" onclick="UI.closeModal('modal-po-detail')">${ic('x', { size: 16 })}</button></div>
    <p class="text-sm text-muted">Supplier: <b>${UI.escapeHTML(supplier?.name || '-')}</b> &nbsp;•&nbsp; Cabang: <b>${UI.escapeHTML(branch?.name || '-')}</b></p>
    <p class="text-sm text-muted">Status saat ini: <span class="status-pill pending">${statusLabel[po.status]}</span></p>
    ${po.note ? `<p class="text-sm text-muted">Catatan: ${UI.escapeHTML(po.note)}</p>` : ''}
    <div class="barcode-divider"></div>
    ${po.items.map(i => `<div class="flex justify-between text-sm" style="padding:4px 0;"><span>${UI.escapeHTML(i.name)} x${i.qty}</span><span>${formatRupiah(i.lineTotal)}</span></div>`).join('')}
    <div class="barcode-divider"></div>
    <div class="cart-summary-row total"><span>Estimasi Total</span><span>${formatRupiah(po.estimatedTotal)}</span></div>
    <div class="flex gap-8 mt-16" style="flex-wrap:wrap;">
      ${po.status === 'draft' ? `<button class="btn btn-primary btn-sm" data-po-action="dipesan">Tandai Dipesan</button>` : ''}
      ${po.status === 'dipesan' ? `<button class="btn btn-primary btn-sm" data-po-action="diterima">Terima Barang (Update Stok)</button>` : ''}
      ${(po.status === 'draft' || po.status === 'dipesan') ? `<button class="btn btn-outline btn-sm" data-po-action="dibatalkan">Batalkan PO</button>` : ''}
    </div>`;

  document.querySelectorAll('[data-po-action]').forEach(btn => {
    btn.addEventListener('click', () => {
      const action = btn.getAttribute('data-po-action');
      if (action === 'diterima') {
        po.items.forEach(i => {
          Transactions.stockIn({
            productId: i.productId, quantity: i.qty, branchId: po.branchId,
            supplierId: po.supplierId, purchasePrice: i.price, note: `Penerimaan ${po.poNumber}`
          });
        });
        UI.toast('Barang diterima, stok diperbarui otomatis', 'success');
      } else if (action === 'dibatalkan') {
        if (!confirm('Batalkan Purchase Order ini?')) return;
        UI.toast('Purchase Order dibatalkan', 'info');
      } else {
        UI.toast('Status PO diperbarui', 'success');
      }
      DB.update('purchaseOrders', po.id, { status: action });
      UI.closeModal('modal-po-detail');
      renderPOTable();
    });
  });

  UI.openModal('modal-po-detail');
}
