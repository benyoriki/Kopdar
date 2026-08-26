/**
 * reports.js
 * ------------------------------------------------------------------
 * Modul laporan: penjualan, produk, gudang, kas, dan per cabang.
 * Termasuk renderer chart ringan berbasis <canvas> tanpa dependency
 * library eksternal, agar tetap ringan & cepat sesuai requirement.
 * ------------------------------------------------------------------
 */

const Reports = (() => {

  function dateRangeFor(period) {
    const now = new Date();
    let start;
    if (period === 'today') {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (period === 'week') {
      start = new Date(now);
      start.setDate(now.getDate() - 6);
      start.setHours(0, 0, 0, 0);
    } else if (period === 'month') {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
    } else {
      start = new Date(0);
    }
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    return { start, end };
  }

  function salesReport({ period = 'today', branchId = null, startDate = null, endDate = null } = {}) {
    const range = (startDate && endDate) ? { start: new Date(startDate), end: new Date(endDate) } : dateRangeFor(period);
    const sales = Transactions.getSalesInRange(range.start, range.end, branchId);
    const totalOmzet = sales.reduce((s, t) => s + t.total, 0);
    const totalTransaksi = sales.length;
    const totalItemTerjual = sales.reduce((s, t) => s + t.items.reduce((a, i) => a + i.qty, 0), 0);
    const cashCount = sales.filter(t => t.paymentMethod === 'Cash').length;
    const nonCashCount = totalTransaksi - cashCount;
    return { sales, totalOmzet, totalTransaksi, totalItemTerjual, cashCount, nonCashCount };
  }

  function productReport() {
    const products = Products.getAll();
    const sales = DB.get('transactions').filter(t => t.status !== 'dibatalkan');
    const salesByProduct = {};
    sales.forEach(t => {
      t.items.forEach(i => {
        salesByProduct[i.productId] = (salesByProduct[i.productId] || 0) + i.qty;
      });
    });
    const terlaris = products
      .map(p => ({ ...p, sold: salesByProduct[p.id] || 0 }))
      .sort((a, b) => b.sold - a.sold)
      .slice(0, 10);
    const palingSedikit = products
      .map(p => ({ ...p, sold: salesByProduct[p.id] || 0 }))
      .sort((a, b) => a.sold - b.sold)
      .slice(0, 10);
    const stokHabis = Products.outOfStock();
    const stokKritis = Products.lowStock();
    return { terlaris, palingSedikit, stokHabis, stokKritis };
  }

  function warehouseReport({ branchId = null } = {}) {
    let movements = DB.get('stockMovements');
    if (branchId) movements = movements.filter(m => m.branchId === branchId);
    const masuk = movements.filter(m => m.type === 'masuk');
    const keluar = movements.filter(m => m.type === 'keluar');
    const transfer = movements.filter(m => (m.reason || '').startsWith('Transfer'));
    return {
      masuk: masuk.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
      keluar: keluar.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
      transfer: transfer.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
      totalMasuk: masuk.reduce((s, m) => s + m.quantity, 0),
      totalKeluar: keluar.reduce((s, m) => s + m.quantity, 0)
    };
  }

  function cashReport({ period = 'today', branchId = null } = {}) {
    const range = dateRangeFor(period);
    return Transactions.getCashSummary(branchId, range.start, range.end);
  }

  function branchReport({ period = 'month' } = {}) {
    const range = dateRangeFor(period);
    const branches = Branches.getAll();
    return branches.map(b => {
      const sales = Transactions.getSalesInRange(range.start, range.end, b.id);
      const omzet = sales.reduce((s, t) => s + t.total, 0);
      const productCount = {};
      sales.forEach(t => t.items.forEach(i => { productCount[i.name] = (productCount[i.name] || 0) + i.qty; }));
      const topProduct = Object.entries(productCount).sort((a, b) => b[1] - a[1])[0];
      return {
        branch: b, omzet, totalTransaksi: sales.length,
        produkTerlaris: topProduct ? topProduct[0] : '-'
      };
    }).sort((a, b) => b.omzet - a.omzet);
  }

  function dailySalesSeries(days = 7, branchId = null) {
    const labels = [];
    const values = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const dayEnd = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59);
      const sales = Transactions.getSalesInRange(dayStart, dayEnd, branchId);
      labels.push(d.toLocaleDateString('id-ID', { weekday: 'short' }));
      values.push(sales.reduce((s, t) => s + t.total, 0));
    }
    return { labels, values };
  }

  // ---------------- CANVAS CHART RENDERER (ringan, tanpa library) ----------------

  function renderBarChart(canvas, labels, values, opts = {}) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const cssW = canvas.clientWidth || 320;
    const cssH = canvas.clientHeight || 180;
    canvas.width = cssW * dpr;
    canvas.height = cssH * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);

    const color = opts.color || getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#FF7A1A';
    const textColor = opts.textColor || getComputedStyle(document.documentElement).getPropertyValue('--text-muted').trim() || '#888';
    const max = Math.max(...values, 1);
    const padding = { top: 16, right: 8, bottom: 24, left: 8 };
    const chartW = cssW - padding.left - padding.right;
    const chartH = cssH - padding.top - padding.bottom;
    const barGap = 10;
    const barW = (chartW - barGap * (values.length - 1)) / values.length;

    values.forEach((v, i) => {
      const barH = max > 0 ? (v / max) * chartH : 0;
      const x = padding.left + i * (barW + barGap);
      const y = padding.top + (chartH - barH);
      const grad = ctx.createLinearGradient(0, y, 0, y + barH);
      grad.addColorStop(0, color);
      grad.addColorStop(1, color + '88');
      ctx.fillStyle = grad;
      roundRect(ctx, x, y, barW, Math.max(barH, 2), 6);
      ctx.fill();

      ctx.fillStyle = textColor;
      ctx.font = '11px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(labels[i] || '', x + barW / 2, cssH - 6);
    });
  }

  function renderLineChart(canvas, labels, values, opts = {}) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const cssW = canvas.clientWidth || 320;
    const cssH = canvas.clientHeight || 180;
    canvas.width = cssW * dpr;
    canvas.height = cssH * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);

    const color = opts.color || '#0F6E5C';
    const textColor = opts.textColor || '#888';
    const max = Math.max(...values, 1);
    const padding = { top: 16, right: 12, bottom: 24, left: 12 };
    const chartW = cssW - padding.left - padding.right;
    const chartH = cssH - padding.top - padding.bottom;
    const stepX = values.length > 1 ? chartW / (values.length - 1) : 0;

    const points = values.map((v, i) => ({
      x: padding.left + i * stepX,
      y: padding.top + (chartH - (max > 0 ? (v / max) * chartH : 0))
    }));

    // area fill
    ctx.beginPath();
    ctx.moveTo(points[0].x, padding.top + chartH);
    points.forEach(p => ctx.lineTo(p.x, p.y));
    ctx.lineTo(points[points.length - 1].x, padding.top + chartH);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, padding.top, 0, padding.top + chartH);
    grad.addColorStop(0, color + '55');
    grad.addColorStop(1, color + '05');
    ctx.fillStyle = grad;
    ctx.fill();

    // line
    ctx.beginPath();
    points.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.stroke();

    // dots
    points.forEach(p => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    });

    // labels
    ctx.fillStyle = textColor;
    ctx.font = '11px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    labels.forEach((l, i) => ctx.fillText(l, points[i].x, cssH - 6));
  }

  // Sparkline SVG ringan untuk stat card dashboard (tanpa canvas/library)
  function sparklineSVG(values, opts = {}) {
    const w = opts.width || 84, h = opts.height || 34;
    const max = Math.max(...values, 1);
    const min = Math.min(...values, 0);
    const range = (max - min) || 1;
    const stepX = values.length > 1 ? w / (values.length - 1) : 0;
    const points = values.map((v, i) => {
      const x = i * stepX;
      const y = h - ((v - min) / range) * (h - 4) - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    const areaPoints = `0,${h} ${points.join(' ')} ${w},${h}`;
    const id = 'spark' + Math.random().toString(36).slice(2, 8);
    return `<svg class="sparkline" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
      <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="currentColor" stop-opacity=".35"/>
        <stop offset="100%" stop-color="currentColor" stop-opacity="0"/>
      </linearGradient></defs>
      <polygon points="${areaPoints}" fill="url(#${id})" stroke="none"/>
      <polyline points="${points.join(' ')}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  return {
    dateRangeFor, salesReport, productReport, warehouseReport, cashReport, branchReport,
    dailySalesSeries, renderBarChart, renderLineChart, sparklineSVG
  };
})();
