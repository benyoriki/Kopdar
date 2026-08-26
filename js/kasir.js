/**
 * kasir.js
 * ------------------------------------------------------------------
 * Logika halaman kasir.html: dashboard, POS, transaksi, pesanan
 * online, kas, laporan, dan (untuk superadmin) manajemen cabang &
 * pengaturan toko.
 * ------------------------------------------------------------------
 */

// Cek akses admin SEBELUM apa pun dirender.
const HAS_ACCESS = Auth.requireAdminAccess('admin_kasir');
const session = HAS_ACCESS ? Auth.getAdminSession() : null;
let posPaymentMethod = 'Cash';
let posDiscount = 0;
let currentView = 'dashboard';

document.addEventListener('DOMContentLoaded', () => {
  // requireAdminAccess sudah menampilkan halaman Access Denied bila gagal;
  // hentikan inisialisasi lebih lanjut secara diam-diam (tanpa error console).
  if (!HAS_ACCESS) return;
  setupRoleUI();
  bindNav();
  bindLogout();
  bindPOS();
  bindKasModal();
  bindBranchModal();
  bindSettingsForm();
  bindDbTools();
  bindNotifDropdown();
  renderNotifications();
  switchView('dashboard');
});

function setupRoleUI() {
  document.getElementById('sidebar-role-label').textContent =
    session.role === 'superadmin' ? 'Super Admin' : (session.role === 'admin_kasir' ? 'Admin Kasir' : session.role);
  const isSuperadmin = session.role === 'superadmin';
  document.getElementById('superadmin-section-label').classList.toggle('hidden', !isSuperadmin);
  document.querySelector('[data-view="cabang"]').classList.toggle('hidden', !isSuperadmin);
  document.querySelector('[data-view="pengaturan"]').classList.toggle('hidden', !isSuperadmin);
  document.getElementById('link-to-gudang').classList.toggle('hidden', !isSuperadmin);
}

// ---------------- NAVIGASI ----------------
function bindNav() {
  document.querySelectorAll('.admin-nav [data-view]').forEach(btn => {
    btn.addEventListener('click', () => switchView(btn.getAttribute('data-view')));
  });
}

const VIEW_TITLES = {
  dashboard: 'Dashboard', pos: 'Kasir / POS', transaksi: 'Transaksi',
  pesanan: 'Pesanan Online', kas: 'Kas / Cash Management', laporan: 'Laporan',
  cabang: 'Manajemen Cabang', pengaturan: 'Pengaturan Toko'
};

function switchView(view) {
  currentView = view;
  renderNotifications();
  document.querySelectorAll('.view-section').forEach(v => v.classList.add('hidden'));
  document.getElementById(`view-${view}`).classList.remove('hidden');
  document.querySelectorAll('.admin-nav [data-view]').forEach(b => b.classList.toggle('active', b.getAttribute('data-view') === view));
  document.getElementById('topbar-title').textContent = VIEW_TITLES[view] || view;
  document.querySelector('.admin-sidebar').classList.remove('open');
  document.querySelector('.sidebar-overlay').classList.remove('show');

  if (view === 'dashboard') renderDashboard();
  if (view === 'pos') { renderPOSCategoryRow(); renderPOS(); }
  if (view === 'transaksi') renderTransaksiView();
  if (view === 'pesanan') renderPesananView();
  if (view === 'kas') renderKasView();
  if (view === 'laporan') renderLaporanView();
  if (view === 'cabang') renderCabangView();
  if (view === 'pengaturan') renderPengaturanView();
}

function bindLogout() {
  document.getElementById('btn-logout').addEventListener('click', () => {
    Auth.logoutAdmin();
    window.location.href = './index.html';
  });
}

function renderNotifications() {
  const lowStock = Products.lowStock();
  const outOfStock = Products.outOfStock();
  const newOrders = DB.get('orders').filter(o => o.status === 'Pesanan masuk' && (session.role === 'superadmin' || o.branchId === session.branchId));

  const items = [
    ...outOfStock.slice(0, 5).map(p => ({ danger: true, icon: 'x', title: `${p.name} habis`, desc: 'Stok perlu diisi ulang segera' })),
    ...lowStock.slice(0, 5).map(p => ({ danger: false, icon: 'alert-triangle', title: `${p.name} stok kritis`, desc: `Tersisa ${p.stock} ${p.unit}` })),
    ...newOrders.slice(0, 5).map(o => ({ danger: false, icon: 'shopping-bag', title: `Pesanan baru ${o.orderId}`, desc: o.customerName }))
  ];

  const total = outOfStock.length + lowStock.length + newOrders.length;
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

function renderQuickActions() {
  const actions = [
    { icon: 'receipt', label: 'Transaksi Baru', sub: 'Mulai penjualan di POS', view: 'pos', accent: true },
    { icon: 'wallet', label: 'Catat Kas', sub: 'Uang masuk / keluar', view: 'kas' },
    { icon: 'shopping-bag', label: 'Cek Pesanan', sub: 'Pesanan online masuk', view: 'pesanan' },
    { icon: 'trend-up', label: 'Lihat Laporan', sub: 'Ringkasan penjualan', view: 'laporan' }
  ];
  document.getElementById('dashboard-quick-actions').innerHTML = actions.map(a => `
    <button class="quick-action-btn ${a.accent ? 'accent' : ''}" data-view-jump="${a.view}">
      <span class="qa-icon">${ic(a.icon, { size: 17 })}</span>
      <span><span class="qa-label" style="display:block;">${a.label}</span><span class="qa-sub">${a.sub}</span></span>
    </button>`).join('');
  document.querySelectorAll('[data-view-jump]').forEach(btn => {
    btn.addEventListener('click', () => switchView(btn.getAttribute('data-view-jump')));
  });
}

function renderActivityFeed() {
  const sales = DB.get('transactions').filter(t => session.role === 'superadmin' || t.branchId === session.branchId);
  const cash = DB.get('cashTransactions').filter(c => (session.role === 'superadmin' || c.branchId === session.branchId) && c.category !== 'Penjualan');
  const orders = DB.get('orders').filter(o => session.role === 'superadmin' || o.branchId === session.branchId);

  const feed = [
    ...sales.map(t => ({ type: 'in', icon: 'receipt', title: `Transaksi ${t.transactionNumber}`, amount: t.total, time: t.createdAt })),
    ...cash.map(c => ({ type: c.type === 'masuk' ? 'in' : 'out', icon: c.type === 'masuk' ? 'download' : 'upload', title: c.description, amount: c.amount, time: c.createdAt })),
    ...orders.map(o => ({ type: 'in', icon: 'shopping-bag', title: `Pesanan online ${o.orderId}`, amount: o.grandTotal, time: o.createdAt }))
  ].sort((a, b) => new Date(b.time) - new Date(a.time)).slice(0, 8);

  const wrap = document.getElementById('dashboard-activity-feed');
  if (!feed.length) { wrap.innerHTML = UI.emptyStateHTML({ icon: '🕒', title: 'Belum ada aktivitas' }); return; }
  wrap.innerHTML = feed.map(f => `
    <div class="activity-item ${f.type}">
      <div class="act-icon">${ic(f.icon,{size:16})}</div>
      <div class="act-body"><div class="act-title">${UI.escapeHTML(f.title)}</div><div class="act-time">${formatTanggalJamIndonesia(f.time)}</div></div>
      <div class="act-amount" style="color:${f.type === 'in' ? 'var(--success)' : 'var(--danger)'}">${f.type === 'in' ? '+' : '-'}${formatRupiah(f.amount)}</div>
    </div>`).join('');
}

// ================= DASHBOARD =================
function renderGreeting() {
  const hour = new Date().getHours();
  const greetLabel = hour < 11 ? 'Selamat Pagi' : hour < 15 ? 'Selamat Siang' : hour < 18 ? 'Selamat Sore' : 'Selamat Malam';
  document.getElementById('dashboard-greeting-text').textContent = `${greetLabel}, ${session.name}`;
  document.getElementById('dashboard-greeting-sub').textContent = `Berikut ringkasan ${Branches.getById(session.branchId)?.name || 'toko'} hari ini`;
  document.getElementById('dashboard-greeting-date').textContent = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
}

function renderDashboard() {
  renderGreeting();
  const sales = Transactions.getSalesToday(session.branchId);
  const totalOmzet = sales.reduce((s, t) => s + t.total, 0);
  const totalItemTerjual = sales.reduce((s, t) => s + t.items.reduce((a, i) => a + i.qty, 0), 0);
  const cashCount = sales.filter(t => t.paymentMethod === 'Cash').length;
  const nonCashCount = sales.length - cashCount;
  const orders = DB.get('orders').filter(o => new Date(o.createdAt).toDateString() === new Date().toDateString());
  const lowStock = Products.lowStock().length;
  const kasSummary = Transactions.getCashSummary(session.role === 'superadmin' ? null : session.branchId);

  const { values: weekValues } = Reports.dailySalesSeries(7, session.branchId);
  const yesterday = weekValues[weekValues.length - 2] || 0;
  const trendPct = yesterday > 0 ? Math.round(((totalOmzet - yesterday) / yesterday) * 100) : (totalOmzet > 0 ? 100 : 0);

  const stats = [
    { label: 'Penjualan Hari Ini', value: formatRupiah(totalOmzet), raw: totalOmzet, icon: 'wallet', spark: weekValues, trend: trendPct, money: true },
    { label: 'Jumlah Transaksi', value: sales.length, raw: sales.length, icon: 'receipt', countUp: true },
    { label: 'Produk Terjual', value: totalItemTerjual, raw: totalItemTerjual, icon: 'package', countUp: true },
    { label: 'Saldo Kas', value: formatRupiah(kasSummary.saldo), icon: 'banknote', money: true, danger: kasSummary.saldo < 0 },
    { label: 'Pesanan Online Hari Ini', value: orders.length, raw: orders.length, icon: 'shopping-bag', countUp: true },
    { label: 'Stok Menipis', value: lowStock, raw: lowStock, icon: 'alert-triangle', countUp: true }
  ];
  document.getElementById('dashboard-stats').innerHTML = stats.map((s, i) => `
    <div class="card stat-card ${s.spark ? 'has-spark' : ''}">
      ${s.trend !== undefined ? `<span class="trend-badge ${s.trend >= 0 ? 'up' : 'down'}"><span style="${s.trend >= 0 ? '' : 'display:inline-flex;transform:scaleY(-1);'}">${ic('trend-up', { size: 11 })}</span> ${Math.abs(s.trend)}%</span>` : ''}
      <div class="icon-badge">${ic(s.icon, { size: 18 })}</div>
      <div class="card-stat"><span class="label">${s.label}</span><span class="value ${s.money ? 'value-sm' : ''}" style="${s.danger ? 'color:var(--danger)' : ''}" ${s.countUp ? `id="stat-val-${i}"` : ''} title="${s.value}">${s.countUp ? '0' : s.value}</span></div>
      ${s.spark ? Reports.sparklineSVG(s.spark) : ''}
    </div>`).join('');

  stats.forEach((s, i) => { if (s.countUp) UI.countUp(document.getElementById(`stat-val-${i}`), s.raw); });

  renderQuickActions();
  renderActivityFeed();

  const { labels, values } = Reports.dailySalesSeries(7, session.branchId);
  Reports.renderLineChart(document.getElementById('chart-weekly'), labels, values);

  const { terlaris } = Reports.productReport();
  const topList = terlaris.filter(p => p.sold > 0).slice(0, 5);
  document.getElementById('dashboard-top-products').innerHTML = topList.length
    ? topList.map((p, i) => `
      <div class="flex justify-between items-center" style="padding:9px 0;border-bottom:1px solid var(--border);">
        <span class="text-sm">${i + 1}. ${UI.escapeHTML(p.name)}</span>
        <b class="mono text-sm">${p.sold} terjual</b>
      </div>`).join('')
    : UI.emptyStateHTML({ title: 'Belum ada transaksi' });
}

// ================= POS =================
let posCurrentCategory = '';

function renderPOSCategoryRow() {
  const wrap = document.getElementById('pos-category-row');
  const categories = Products.getCategories();
  wrap.innerHTML = `<button class="active" data-pos-cat="">Semua</button>` +
    categories.map(c => `<button data-pos-cat="${UI.escapeHTML(c.name)}">${UI.escapeHTML(c.name)}</button>`).join('');
  wrap.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      wrap.querySelectorAll('button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      posCurrentCategory = btn.getAttribute('data-pos-cat') || '';
      renderPOS(document.getElementById('pos-search').value);
    });
  });
}

function renderPOS(query = '') {
  document.getElementById('pos-branch-label').textContent = Branches.getById(session.branchId)?.name || '';
  const products = Products.search(query, { category: posCurrentCategory });
  const grid = document.getElementById('pos-products');
  if (!products.length) { grid.innerHTML = UI.emptyStateHTML({ icon: 'search', title: 'Produk tidak ditemukan' }); }
  else {
    grid.innerHTML = products.slice(0, 60).map(p => `
      <button class="pos-product-card" data-pos-add="${p.id}" ${p.stock <= 0 ? 'disabled' : ''}>
        <div class="thumb" style="--thumb-bg:${ProductImage.categoryGradientCSS(p.category)}">
          <img src="${ProductImage.getProductImage(p)}" alt="" loading="lazy" ${ProductImage.fallbackAttr(p)}>
        </div>
        <div class="name">${UI.escapeHTML(p.name)}</div>
        <div class="price">${formatRupiah(p.promo && p.discountPrice ? p.discountPrice : p.sellingPrice)}</div>
        <div class="stock">${p.stock <= 0 ? 'Stok habis' : `Stok ${p.stock}`}</div>
      </button>`).join('');
    grid.querySelectorAll('[data-pos-add]').forEach(btn => {
      btn.addEventListener('click', () => addToPosCart(btn.getAttribute('data-pos-add')));
    });
  }
  renderPosCart();
}

function addToPosCart(productId) {
  const product = Products.getById(productId);
  const res = KasirCart.addItem(product, 1);
  if (!res.success) { UI.toast(res.message, 'error'); return; }
  UI.toast('Produk ditambahkan', 'success');
  renderPosCart();
}

function renderPosCart() {
  const { items, subtotal } = KasirCart.getSummary();
  const container = document.getElementById('pos-cart-items');
  if (!items.length) {
    container.innerHTML = UI.emptyStateHTML({ icon: '🛒', title: 'Keranjang kosong', desc: 'Pilih produk untuk memulai transaksi.' });
  } else {
    container.innerHTML = items.map(i => `
      <div class="pos-cart-item">
        <div class="name">${UI.escapeHTML(i.name)}<div class="price-sm">${formatRupiah(i.price)}</div></div>
        <div class="qty-control">
          <button data-pos-dec="${i.productId}">-</button><span>${i.qty}</span><button data-pos-inc="${i.productId}">+</button>
        </div>
        <div class="line-total">${formatRupiah(i.price * i.qty)}</div>
        <button class="remove-btn" data-pos-remove="${i.productId}">${ic('trash',{size:14})}</button>
      </div>`).join('');
    container.querySelectorAll('[data-pos-inc]').forEach(b => b.addEventListener('click', () => { addToPosCart(b.getAttribute('data-pos-inc')); }));
    container.querySelectorAll('[data-pos-dec]').forEach(b => b.addEventListener('click', () => {
      const id = b.getAttribute('data-pos-dec');
      const item = KasirCart.getItems().find(i => i.productId === id);
      KasirCart.updateQty(id, (item ? item.qty : 1) - 1);
      renderPosCart();
    }));
    container.querySelectorAll('[data-pos-remove]').forEach(b => b.addEventListener('click', () => {
      KasirCart.removeItem(b.getAttribute('data-pos-remove'));
      renderPosCart();
    }));
  }

  const total = Math.max(0, subtotal - posDiscount);
  document.getElementById('pos-subtotal').textContent = formatRupiah(subtotal);
  document.getElementById('pos-total').textContent = formatRupiah(total);
  updatePosChange();
}

function updatePosChange() {
  const { subtotal } = KasirCart.getSummary();
  const total = Math.max(0, subtotal - posDiscount);
  const cashReceived = Number(document.getElementById('pos-cash-received').value) || 0;
  const change = cashReceived - total;
  document.getElementById('pos-change').textContent = formatRupiah(Math.max(0, change));
}

function bindPOS() {
  const searchHandler = UI.debounce((val) => renderPOS(val), 250);
  document.getElementById('pos-search').addEventListener('input', (e) => searchHandler(e.target.value));
  document.getElementById('pos-search').addEventListener('keydown', (e) => {
    // Mendukung scan barcode: barcode scanner umumnya mengirim Enter setelah input
    if (e.key === 'Enter') {
      const val = e.target.value.trim();
      const product = Products.getByBarcode(val);
      if (product) { addToPosCart(product.id); e.target.value = ''; renderPOS(''); }
    }
  });

  document.getElementById('pos-clear-cart').addEventListener('click', () => {
    KasirCart.clear();
    posDiscount = 0;
    document.getElementById('pos-discount').value = 0;
    renderPosCart();
    UI.toast('Keranjang dikosongkan', 'info');
  });

  document.getElementById('pos-discount').addEventListener('input', (e) => {
    posDiscount = Number(e.target.value) || 0;
    renderPosCart();
  });

  document.querySelectorAll('#pos-payment-methods [data-pay]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#pos-payment-methods [data-pay]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      posPaymentMethod = btn.getAttribute('data-pay');
      document.getElementById('pos-cash-group').classList.toggle('hidden', posPaymentMethod !== 'Cash');
      updatePosChange();
    });
  });

  document.getElementById('pos-cash-received').addEventListener('input', updatePosChange);

  document.getElementById('pos-checkout-btn').addEventListener('click', () => {
    const { items, subtotal } = KasirCart.getSummary();
    if (!items.length) { UI.toast('Keranjang masih kosong.', 'error'); return; }
    const total = Math.max(0, subtotal - posDiscount);
    const cashReceived = posPaymentMethod === 'Cash' ? (Number(document.getElementById('pos-cash-received').value) || 0) : total;

    const res = Transactions.createSale({
      items, discount: posDiscount, tax: 0, paymentMethod: posPaymentMethod,
      cashReceived, branchId: session.branchId, cashierId: session.userId, cashierName: session.name
    });

    if (!res.success) { UI.toast(res.message, 'error'); return; }
    UI.toast('Transaksi berhasil', 'success');
    KasirCart.clear();
    posDiscount = 0;
    document.getElementById('pos-discount').value = 0;
    document.getElementById('pos-cash-received').value = 0;
    renderPOS(document.getElementById('pos-search').value);
    showReceipt(res.transaction);
  });
}

function showReceipt(trx) {
  const settings = DB.get('settings')[0] || { storeName: 'KOPDAR' };
  const branch = Branches.getById(trx.branchId);
  document.getElementById('receipt-container').innerHTML = `
    <div class="receipt">
      <img class="receipt-logo-img" src="./assets/images/kopdar-app-icon.png" alt="KOPDAR">
      <div class="center"><b class="receipt-store-name">${UI.escapeHTML(settings.storeName)}</b><br>${UI.escapeHTML(branch?.name || '')}<br>${UI.escapeHTML(branch?.address || '')}</div>
      <div class="receipt-dash"></div>
      <div class="row"><span>No. Transaksi</span><span>${trx.transactionNumber}</span></div>
      <div class="row"><span>Tanggal</span><span>${formatTanggalJamIndonesia(trx.createdAt)}</span></div>
      <div class="receipt-dash"></div>
      ${trx.items.map(i => `
        <div class="item-row">${UI.escapeHTML(i.name)}<div class="row"><span>${i.qty} x ${formatRupiah(i.price)}</span><span>${formatRupiah(i.qty * i.price)}</span></div></div>
      `).join('')}
      <div class="receipt-dash"></div>
      <div class="row"><span>Subtotal</span><span>${formatRupiah(trx.subtotal)}</span></div>
      <div class="row"><span>Diskon</span><span>${formatRupiah(trx.discount)}</span></div>
      <div class="row receipt-total"><b>TOTAL</b><b>${formatRupiah(trx.total)}</b></div>
      ${trx.paymentMethod === 'Cash' ? `
        <div class="row"><span>Tunai</span><span>${formatRupiah(trx.cashReceived)}</span></div>
        <div class="row"><span>Kembalian</span><span>${formatRupiah(trx.change)}</span></div>` : `<div class="row"><span>Metode</span><span>${trx.paymentMethod}</span></div>`}
      <div class="receipt-dash"></div>
      <div class="center">Kasir: ${UI.escapeHTML(trx.cashierName)}<br>Cabang: ${UI.escapeHTML(branch?.name || '')}</div>
      <div class="receipt-barcode-visual"></div>
      <div class="center" style="margin-top:6px;">Terima kasih telah berbelanja</div>
    </div>`;
  UI.openModal('modal-receipt');
}

// ================= TRANSAKSI =================
function renderTransaksiView() {
  const branchSelect = document.getElementById('trx-filter-branch');
  if (!branchSelect.dataset.bound) {
    branchSelect.innerHTML = `<option value="">Semua Cabang</option>` + Branches.getAll().map(b => `<option value="${b.id}">${UI.escapeHTML(b.name)}</option>`).join('');
    branchSelect.dataset.bound = '1';
    branchSelect.addEventListener('change', () => renderTransaksiTable());
    document.getElementById('trx-search').addEventListener('input', UI.debounce(() => renderTransaksiTable(), 250));
    document.getElementById('trx-export-csv').addEventListener('click', () => {
      const rows = DB.get('transactions').map(t => `${t.transactionNumber},${t.createdAt},${t.branchId},${t.paymentMethod},${t.total},${t.status || 'selesai'}`);
      const csv = 'transactionNumber,createdAt,branchId,paymentMethod,total,status\n' + rows.join('\n');
      Products.downloadCSV('transaksi.csv', csv);
    });
  }
  if (session.role !== 'superadmin') { branchSelect.value = session.branchId; branchSelect.disabled = true; }
  renderTransaksiTable();
}

function renderTransaksiTable() {
  const q = document.getElementById('trx-search').value.toLowerCase();
  const branchId = document.getElementById('trx-filter-branch').value;
  let list = DB.get('transactions').sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  if (session.role !== 'superadmin') list = list.filter(t => t.branchId === session.branchId);
  if (branchId) list = list.filter(t => t.branchId === branchId);
  if (q) list = list.filter(t => t.transactionNumber.toLowerCase().includes(q));

  const wrap = document.getElementById('trx-table-wrap');
  if (!list.length) { wrap.innerHTML = UI.emptyStateHTML({ icon: 'receipt', title: 'Belum ada transaksi' }); return; }

  wrap.innerHTML = `<table class="data-table"><thead><tr>
    <th>No. Transaksi</th><th>Tanggal</th><th>Kasir</th><th>Cabang</th><th>Metode</th><th>Total</th><th>Status</th><th>Aksi</th>
  </tr></thead><tbody>
    ${list.slice(0, 100).map(t => `
      <tr>
        <td data-label="No. Transaksi" class="mono">${t.transactionNumber}</td>
        <td data-label="Tanggal">${formatTanggalJamIndonesia(t.createdAt)}</td>
        <td data-label="Kasir">${UI.escapeHTML(t.cashierName)}</td>
        <td data-label="Cabang">${UI.escapeHTML(Branches.getById(t.branchId)?.name || '-')}</td>
        <td data-label="Metode">${t.paymentMethod}</td>
        <td data-label="Total" class="mono">${formatRupiah(t.total)}</td>
        <td data-label="Status"><span class="status-pill ${t.status === 'dibatalkan' ? 'dibatalkan' : 'selesai'}">${t.status === 'dibatalkan' ? 'Dibatalkan' : 'Selesai'}</span></td>
        <td data-label="Aksi">
          <div class="row-actions"><button class="icon-action-btn" data-view-receipt="${t.id}" title="Lihat Struk">${ic('receipt',{size:15})}</button>${t.status !== 'dibatalkan' ? `<button class="icon-action-btn danger" data-cancel-trx="${t.id}" title="Batalkan Transaksi">${ic('x',{size:15})}</button>` : ''}</div>
        </td>
      </tr>`).join('')}
  </tbody></table>`;

  wrap.querySelectorAll('[data-view-receipt]').forEach(b => b.addEventListener('click', () => {
    const trx = DB.find('transactions', b.getAttribute('data-view-receipt'));
    if (trx) showReceipt(trx);
  }));
  wrap.querySelectorAll('[data-cancel-trx]').forEach(b => b.addEventListener('click', () => {
    if (!confirm('Batalkan transaksi ini? Stok akan dikembalikan.')) return;
    const res = Transactions.cancelSale(b.getAttribute('data-cancel-trx'));
    if (res.success) { UI.toast('Transaksi dibatalkan', 'success'); renderTransaksiTable(); }
    else UI.toast(res.message, 'error');
  }));
}

// ================= PESANAN ONLINE =================
const ORDER_STATUSES = ['Pesanan masuk', 'Diproses', 'Disiapkan', 'Dikirim', 'Siap diambil', 'Selesai', 'Dibatalkan'];

function renderPesananView() {
  if (!document.getElementById('order-search').dataset.bound) {
    document.getElementById('order-search').dataset.bound = '1';
    document.getElementById('order-search').addEventListener('input', UI.debounce(() => renderOrderTable(), 250));
    document.getElementById('order-filter-status').addEventListener('change', () => renderOrderTable());
  }
  renderOrderTable();
}

function renderOrderTable() {
  const q = document.getElementById('order-search').value.toLowerCase();
  const status = document.getElementById('order-filter-status').value;
  let list = DB.get('orders').sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  if (session.role !== 'superadmin') list = list.filter(o => o.branchId === session.branchId);
  if (status) list = list.filter(o => o.status === status);
  if (q) list = list.filter(o => o.orderId.toLowerCase().includes(q) || o.customerName.toLowerCase().includes(q));

  const wrap = document.getElementById('order-table-wrap');
  if (!list.length) { wrap.innerHTML = UI.emptyStateHTML({ icon: 'shopping-bag', title: 'Belum ada pesanan online' }); return; }

  wrap.innerHTML = `<table class="data-table"><thead><tr>
    <th>Order</th><th>Customer</th><th>Tipe</th><th>Total</th><th>Status</th><th>Tanggal</th><th>Aksi</th>
  </tr></thead><tbody>
    ${list.slice(0, 100).map(o => `
      <tr>
        <td data-label="Order" class="mono">${o.orderId}</td>
        <td data-label="Customer">${UI.escapeHTML(o.customerName)}</td>
        <td data-label="Tipe">${o.fulfillmentType}</td>
        <td data-label="Total" class="mono">${formatRupiah(o.grandTotal)}</td>
        <td data-label="Status"><span class="status-pill ${o.status === 'Selesai' ? 'selesai' : (o.status === 'Dibatalkan' ? 'dibatalkan' : 'pending')}">${o.status}</span></td>
        <td data-label="Tanggal">${formatTanggalIndonesia(o.createdAt)}</td>
        <td data-label="Aksi"><button class="icon-action-btn" data-order-detail="${o.orderId}" title="Lihat Detail">${ic('eye',{size:15})}</button></td>
      </tr>`).join('')}
  </tbody></table>`;

  wrap.querySelectorAll('[data-order-detail]').forEach(b => b.addEventListener('click', () => openOrderDetail(b.getAttribute('data-order-detail'))));
}

function openOrderDetail(orderId) {
  const o = DB.find('orders', ord => ord.orderId === orderId);
  if (!o) return;
  document.getElementById('modal-order-detail-body').innerHTML = `
    <div class="modal-head"><h3>${o.orderId}</h3><button class="modal-close" onclick="UI.closeModal('modal-order-detail')">${ic('x',{size:16})}</button></div>
    <p><b>${UI.escapeHTML(o.customerName)}</b> — ${UI.escapeHTML(o.whatsapp)}</p>
    <p class="text-sm text-muted">${o.fulfillmentType}${o.address ? ' • ' + UI.escapeHTML(o.address) : ''}</p>
    <div class="barcode-divider"></div>
    ${o.items.map(i => `<div class="flex justify-between text-sm" style="padding:4px 0;"><span>${UI.escapeHTML(i.name)} x${i.qty}</span><span>${formatRupiah(i.lineTotal ?? i.price * i.qty)}</span></div>`).join('')}
    <div class="barcode-divider"></div>
    <div class="cart-summary-row total"><span>Total</span><span>${formatRupiah(o.grandTotal)}</span></div>
    <div class="form-group mt-16"><label>Ubah Status</label>
      <select class="form-control" id="order-status-select">
        ${ORDER_STATUSES.map(s => `<option ${s === o.status ? 'selected' : ''}>${s}</option>`).join('')}
      </select>
    </div>
    <button class="btn btn-primary btn-block" id="btn-save-order-status">Simpan Status</button>`;

  document.getElementById('btn-save-order-status').addEventListener('click', () => {
    const status = document.getElementById('order-status-select').value;
    Transactions.updateOrderStatus(o.orderId, status);
    UI.toast('Status pesanan diperbarui', 'success');
    UI.closeModal('modal-order-detail');
    renderOrderTable();
  });

  UI.openModal('modal-order-detail');
}

// ================= KAS =================
function renderKasView() {
  const branchId = session.role === 'superadmin' ? null : session.branchId;
  const summary = Transactions.getCashSummary(branchId);
  const saldoColor = summary.saldo < 0 ? 'var(--danger)' : 'var(--text)';
  document.getElementById('kas-stats').innerHTML = `
    <div class="card stat-card"><div class="card-stat"><span class="label">Saldo Kas</span><span class="value" style="color:${saldoColor}" title="${formatRupiah(summary.saldo)}">${formatRupiah(summary.saldo)}</span></div></div>
    <div class="card stat-card"><div class="card-stat"><span class="label">Total Uang Masuk</span><span class="value" style="color:var(--success)" title="${formatRupiah(summary.totalMasuk)}">${formatRupiah(summary.totalMasuk)}</span></div></div>
    <div class="card stat-card"><div class="card-stat"><span class="label">Total Uang Keluar</span><span class="value" style="color:var(--danger)" title="${formatRupiah(summary.totalKeluar)}">${formatRupiah(summary.totalKeluar)}</span></div></div>`;

  const wrap = document.getElementById('kas-table-wrap');
  const list = summary.transactions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  if (!list.length) { wrap.innerHTML = UI.emptyStateHTML({ icon: 'wallet', title: 'Belum ada transaksi kas' }); return; }
  wrap.innerHTML = `<table class="data-table"><thead><tr><th>No. Dokumen</th><th>Tanggal</th><th>Jenis</th><th>Kategori</th><th>Keterangan</th><th>Nominal</th><th>Petugas</th></tr></thead><tbody>
    ${list.slice(0, 100).map(c => `
      <tr>
        <td data-label="No. Dokumen" class="mono">${c.docNumber}</td>
        <td data-label="Tanggal">${formatTanggalJamIndonesia(c.createdAt)}</td>
        <td data-label="Jenis"><span class="movement-type-badge ${c.type === 'masuk' ? 'masuk' : 'keluar'}">${c.type === 'masuk' ? '↓ Masuk' : '↑ Keluar'}</span></td>
        <td data-label="Kategori">${UI.escapeHTML(c.category)}</td>
        <td data-label="Keterangan">${UI.escapeHTML(c.description)}</td>
        <td data-label="Nominal" class="mono">${formatRupiah(c.amount)}</td>
        <td data-label="Petugas">${UI.escapeHTML(c.staffName || '-')}</td>
      </tr>`).join('')}
  </tbody></table>`;
}

function bindKasModal() {
  const catMasuk = ['Modal Kas', 'Penjualan', 'Pendapatan Lain', 'Setoran', 'Pengembalian Dana'];
  const catKeluar = ['Belanja Barang', 'Operasional', 'Transport', 'Listrik', 'Pengeluaran Lain'];

  document.getElementById('btn-kas-masuk').addEventListener('click', () => openKasModal('masuk', catMasuk));
  document.getElementById('btn-kas-keluar').addEventListener('click', () => openKasModal('keluar', catKeluar));

  document.getElementById('form-kas').addEventListener('submit', (e) => {
    e.preventDefault();
    const type = document.getElementById('kas-type').value;
    Transactions.recordCashTransaction({
      type, category: document.getElementById('kas-category').value,
      description: document.getElementById('kas-desc').value,
      amount: Number(document.getElementById('kas-amount').value),
      branchId: document.getElementById('kas-branch').value,
      staffName: session.name
    });
    UI.toast('Transaksi kas disimpan', 'success');
    UI.closeModal('modal-kas-form');
    e.target.reset();
    renderKasView();
  });
}

function openKasModal(type, categories) {
  document.getElementById('kas-modal-title').textContent = type === 'masuk' ? 'Tambah Uang Masuk' : 'Tambah Uang Keluar';
  document.getElementById('kas-type').value = type;
  document.getElementById('kas-category').innerHTML = categories.map(c => `<option>${c}</option>`).join('');
  const branchSelect = document.getElementById('kas-branch');
  branchSelect.innerHTML = Branches.getAll().map(b => `<option value="${b.id}">${UI.escapeHTML(b.name)}</option>`).join('');
  if (session.role !== 'superadmin') { branchSelect.value = session.branchId; branchSelect.disabled = true; }
  UI.openModal('modal-kas-form');
}

// ================= LAPORAN =================
function renderLaporanView() {
  const branchSelect = document.getElementById('laporan-branch');
  if (!branchSelect.dataset.bound) {
    branchSelect.innerHTML = `<option value="">Semua Cabang</option>` + Branches.getAll().map(b => `<option value="${b.id}">${UI.escapeHTML(b.name)}</option>`).join('');
    branchSelect.dataset.bound = '1';
    branchSelect.addEventListener('change', renderLaporanContent);
    document.getElementById('laporan-period').addEventListener('change', renderLaporanContent);
  }
  if (session.role !== 'superadmin') { branchSelect.value = session.branchId; branchSelect.disabled = true; }
  renderLaporanContent();
}

function renderLaporanContent() {
  const period = document.getElementById('laporan-period').value;
  const branchId = document.getElementById('laporan-branch').value || null;
  const report = Reports.salesReport({ period, branchId });

  document.getElementById('laporan-stats').innerHTML = `
    <div class="card stat-card"><div class="card-stat"><span class="label">Total Omzet</span><span class="value">${formatRupiah(report.totalOmzet)}</span></div></div>
    <div class="card stat-card"><div class="card-stat"><span class="label">Total Transaksi</span><span class="value">${report.totalTransaksi}</span></div></div>
    <div class="card stat-card"><div class="card-stat"><span class="label">Produk Terjual</span><span class="value">${report.totalItemTerjual}</span></div></div>`;

  const branchReport = Reports.branchReport({ period });
  document.getElementById('laporan-branch-table').innerHTML = `<table class="data-table"><thead><tr><th>Cabang</th><th>Omzet</th><th>Transaksi</th><th>Produk Terlaris</th></tr></thead><tbody>
    ${branchReport.map(r => `<tr><td data-label="Cabang">${UI.escapeHTML(r.branch.name)}</td><td data-label="Omzet" class="mono">${formatRupiah(r.omzet)}</td><td data-label="Transaksi">${r.totalTransaksi}</td><td data-label="Produk Terlaris">${UI.escapeHTML(r.produkTerlaris)}</td></tr>`).join('')}
  </tbody></table>`;

  const { terlaris } = Reports.productReport();
  document.getElementById('laporan-product-table').innerHTML = `<table class="data-table"><thead><tr><th>Produk</th><th>Kategori</th><th>Terjual</th><th>Stok</th></tr></thead><tbody>
    ${terlaris.slice(0, 10).map(p => `<tr><td data-label="Produk">${UI.escapeHTML(p.name)}</td><td data-label="Kategori">${UI.escapeHTML(p.category)}</td><td data-label="Terjual">${p.sold}</td><td data-label="Stok">${p.stock}</td></tr>`).join('')}
  </tbody></table>`;
}

// ================= CABANG =================
function renderCabangView() {
  if (session.role !== 'superadmin') { document.getElementById('view-cabang').innerHTML = UI.emptyStateHTML({ title: 'Akses ditolak' }); return; }
  const wrap = document.getElementById('branch-manage-list');
  const branches = Branches.getAll();
  wrap.innerHTML = branches.map(b => `
    <div class="card branch-card">
      <h4>${UI.escapeHTML(b.name)}</h4>
      <p>📍 ${UI.escapeHTML(b.address)}</p>
      <p>👤 ${UI.escapeHTML(b.headName)}</p>
      <p>📞 ${UI.escapeHTML(b.whatsapp)}</p>
      <div class="flex gap-8 mt-8">
        <button class="icon-action-btn" data-edit-branch="${b.id}" title="Edit Cabang">${ic('edit',{size:15})}</button>
        <button class="icon-action-btn danger" data-delete-branch="${b.id}" title="Hapus Cabang">${ic('trash',{size:15})}</button>
      </div>
    </div>`).join('');

  wrap.querySelectorAll('[data-edit-branch]').forEach(btn => btn.addEventListener('click', () => openBranchModal(btn.getAttribute('data-edit-branch'))));
  wrap.querySelectorAll('[data-delete-branch]').forEach(btn => btn.addEventListener('click', () => {
    if (!confirm('Hapus cabang ini?')) return;
    Branches.remove(btn.getAttribute('data-delete-branch'));
    UI.toast('Cabang dihapus', 'success');
    renderCabangView();
  }));
}

function bindBranchModal() {
  document.getElementById('btn-add-branch')?.addEventListener('click', () => openBranchModal(null));
  document.getElementById('form-branch').addEventListener('submit', (e) => {
    e.preventDefault();
    const id = document.getElementById('branch-id').value;
    const data = {
      name: document.getElementById('branch-name').value.trim(),
      address: document.getElementById('branch-address').value.trim(),
      whatsapp: document.getElementById('branch-whatsapp').value.trim(),
      headName: document.getElementById('branch-head').value.trim()
    };
    if (id) Branches.update(id, data); else Branches.create(data);
    UI.toast('Cabang disimpan', 'success');
    UI.closeModal('modal-branch-form');
    renderCabangView();
  });
}

function openBranchModal(id) {
  const branch = id ? Branches.getById(id) : null;
  document.getElementById('branch-modal-title').textContent = branch ? 'Edit Cabang' : 'Tambah Cabang';
  document.getElementById('branch-id').value = id || '';
  document.getElementById('branch-name').value = branch?.name || '';
  document.getElementById('branch-address').value = branch?.address || '';
  document.getElementById('branch-whatsapp').value = branch?.whatsapp || '';
  document.getElementById('branch-head').value = branch?.headName || '';
  UI.openModal('modal-branch-form');
}

// ================= PENGATURAN =================
function renderPengaturanView() {
  if (session.role !== 'superadmin') { document.getElementById('view-pengaturan').innerHTML = UI.emptyStateHTML({ title: 'Akses ditolak' }); return; }
  const settings = DB.get('settings')[0] || {};
  document.getElementById('set-storeName').value = settings.storeName || '';
  document.getElementById('set-address').value = settings.address || '';
  document.getElementById('set-whatsapp').value = settings.whatsapp || '';
  document.getElementById('set-openHours').value = settings.openHours || '';
  document.getElementById('set-deliveryFee').value = settings.deliveryFee || 0;
  document.getElementById('set-minOrder').value = settings.minOrder || 0;
  document.getElementById('set-tax').value = settings.tax || 0;
}

function bindSettingsForm() {
  document.getElementById('form-settings').addEventListener('submit', (e) => {
    e.preventDefault();
    const settings = DB.get('settings')[0];
    DB.update('settings', settings.id, {
      storeName: document.getElementById('set-storeName').value,
      address: document.getElementById('set-address').value,
      whatsapp: document.getElementById('set-whatsapp').value,
      openHours: document.getElementById('set-openHours').value,
      deliveryFee: Number(document.getElementById('set-deliveryFee').value),
      minOrder: Number(document.getElementById('set-minOrder').value),
      tax: Number(document.getElementById('set-tax').value)
    });
    UI.toast('Pengaturan disimpan', 'success');
  });
}

function bindDbTools() {
  document.getElementById('btn-export-db')?.addEventListener('click', () => {
    const json = DB.exportDatabase();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'database-export.json'; a.click();
    URL.revokeObjectURL(url);
  });
  document.getElementById('input-import-db')?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const ok = DB.importDatabase(reader.result);
      if (ok) { UI.toast('Database berhasil diimpor', 'success'); setTimeout(() => location.reload(), 800); }
      else UI.toast('Gagal mengimpor database', 'error');
    };
    reader.readAsText(file);
  });
  document.getElementById('btn-reset-db')?.addEventListener('click', () => {
    if (!confirm('Reset seluruh data demo? Tindakan ini tidak dapat dibatalkan.')) return;
    DB.resetDatabase();
    UI.toast('Data demo direset', 'success');
    setTimeout(() => location.reload(), 800);
  });
}
