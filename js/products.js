/**
 * products.js
 * ------------------------------------------------------------------
 * Manajemen data produk: CRUD, pencarian, filter, import/export CSV.
 * ------------------------------------------------------------------
 */

const Products = (() => {

  function getAll() {
    return DB.get('products');
  }

  function getById(id) {
    return DB.find('products', id);
  }

  function getByBarcode(barcode) {
    return DB.find('products', p => p.barcode === barcode || p.sku === barcode);
  }

  // Pencarian mendukung: nama, sku, barcode, brand, kategori
  function search(query, opts = {}) {
    const q = (query || '').trim().toLowerCase();
    let list = getAll();
    if (opts.category) list = list.filter(p => p.category === opts.category);
    if (opts.status) list = list.filter(p => p.status === opts.status);
    if (!q) return list;
    return list.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q) ||
      p.barcode.toLowerCase().includes(q) ||
      (p.brand || '').toLowerCase().includes(q) ||
      (p.category || '').toLowerCase().includes(q)
    );
  }

  function create(data) {
    const errors = validate(data);
    if (errors.length) return { success: false, errors };
    const today = new Date().toISOString().slice(0, 10);
    const product = DB.insert('products', {
      sku: data.sku || `SKU${Date.now()}`,
      barcode: data.barcode || `AUTO${Date.now()}`,
      name: sanitize(data.name),
      category: data.category || 'Lainnya',
      subcategory: sanitize(data.subcategory || ''),
      brand: sanitize(data.brand || ''),
      description: sanitize(data.description || ''),
      image: data.image || '',
      imageSource: data.imageSource || (data.image ? 'admin-upload' : 'generated-illustration'),
      purchasePrice: Number(data.purchasePrice) || 0,
      sellingPrice: Number(data.sellingPrice) || 0,
      discountPrice: data.discountPrice ? Number(data.discountPrice) : null,
      stock: Number(data.stock) || 0,
      minimumStock: Number(data.minimumStock) || 5,
      unit: data.unit || 'pcs',
      weight: data.weight || '',
      supplier: data.supplier || '',
      branchStock: data.branchStock || {},
      promo: !!data.promo,
      isPromo: !!(data.isPromo ?? data.promo),
      promoLabel: data.promoLabel || '',
      rating: data.rating ?? 4.5,
      sold: data.sold ?? 0,
      isFeatured: !!data.isFeatured,
      isBestSeller: !!data.isBestSeller,
      isNew: data.isNew ?? true, // produk baru ditambahkan admin wajar ditandai baru secara default
      status: data.status || 'aktif',
      priceSource: data.priceSource || 'Harga referensi retail Indonesia (estimasi demo)',
      priceCheckedAt: data.priceCheckedAt || today,
      sourceType: data.sourceType || 'internal-admin',
      sourceName: data.sourceName || 'Input Admin Gudang',
      lastVerified: today
    });
    return { success: true, product };
  }

  function update(id, data) {
    const patch = { ...data };
    if (patch.name) patch.name = sanitize(patch.name);
    if (patch.brand) patch.brand = sanitize(patch.brand);
    if (patch.description) patch.description = sanitize(patch.description);
    if (patch.subcategory !== undefined) patch.subcategory = sanitize(patch.subcategory);
    if (patch.purchasePrice !== undefined) patch.purchasePrice = Number(patch.purchasePrice);
    if (patch.sellingPrice !== undefined) patch.sellingPrice = Number(patch.sellingPrice);
    if (patch.discountPrice !== undefined) patch.discountPrice = patch.discountPrice ? Number(patch.discountPrice) : null;
    if (patch.stock !== undefined) patch.stock = Number(patch.stock);
    if (patch.minimumStock !== undefined) patch.minimumStock = Number(patch.minimumStock);
    const updated = DB.update('products', id, patch);
    return updated ? { success: true, product: updated } : { success: false, errors: ['Produk tidak ditemukan.'] };
  }

  function remove(id) {
    return DB.delete('products', id);
  }

  function validate(data) {
    const errors = [];
    if (!data.name || !data.name.trim()) errors.push('Nama produk wajib diisi.');
    if (data.sellingPrice === undefined || Number(data.sellingPrice) <= 0) errors.push('Harga jual harus lebih dari 0.');
    return errors;
  }

  function sanitize(str) {
    const div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
  }

  function lowStock() {
    return getAll().filter(p => p.stock <= p.minimumStock && p.stock > 0);
  }

  function outOfStock() {
    return getAll().filter(p => p.stock <= 0);
  }

  function getCategories() {
    return DB.get('categories');
  }

  // ---------------- CSV EXPORT/IMPORT ----------------

  function exportCSV() {
    const products = getAll();
    const headers = ['id', 'sku', 'barcode', 'name', 'category', 'brand', 'purchasePrice', 'sellingPrice', 'stock', 'minimumStock', 'unit', 'supplier', 'status'];
    const rows = [headers.join(',')];
    products.forEach(p => {
      const row = headers.map(h => csvEscape(p[h] ?? ''));
      rows.push(row.join(','));
    });
    return rows.join('\n');
  }

  function csvEscape(val) {
    const s = String(val);
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  }

  function parseCSV(text) {
    const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
    if (lines.length < 2) return { rows: [], errors: ['File CSV kosong atau tidak valid.'] };
    const headers = parseCSVLine(lines[0]);
    const rows = [];
    const errors = [];
    for (let i = 1; i < lines.length; i++) {
      const cells = parseCSVLine(lines[i]);
      if (cells.length !== headers.length) {
        errors.push(`Baris ${i + 1}: jumlah kolom tidak sesuai header.`);
        continue;
      }
      const obj = {};
      headers.forEach((h, idx) => { obj[h.trim()] = cells[idx]; });
      rows.push(obj);
    }
    return { rows, errors };
  }

  function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (inQuotes) {
        if (char === '"' && line[i + 1] === '"') { current += '"'; i++; }
        else if (char === '"') { inQuotes = false; }
        else { current += char; }
      } else {
        if (char === '"') inQuotes = true;
        else if (char === ',') { result.push(current); current = ''; }
        else current += char;
      }
    }
    result.push(current);
    return result;
  }

  function importCSV(text) {
    const { rows, errors } = parseCSV(text);
    let imported = 0, updated = 0;
    rows.forEach(row => {
      if (!row.name) return;
      const existing = row.sku ? DB.find('products', p => p.sku === row.sku) : null;
      const payload = {
        sku: row.sku || `SKU${Date.now()}${imported}`,
        barcode: row.barcode || `AUTO${Date.now()}${imported}`,
        name: row.name,
        category: row.category || 'Lainnya',
        brand: row.brand || '',
        purchasePrice: Number(row.purchasePrice) || 0,
        sellingPrice: Number(row.sellingPrice) || 0,
        stock: Number(row.stock) || 0,
        minimumStock: Number(row.minimumStock) || 5,
        unit: row.unit || 'pcs',
        supplier: row.supplier || '',
        status: row.status || 'aktif'
      };
      if (existing) {
        DB.update('products', existing.id, payload);
        updated++;
      } else {
        create(payload);
        imported++;
      }
    });
    return { imported, updated, errors };
  }

  function downloadCSV(filename, csvContent) {
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return {
    getAll, getById, getByBarcode, search, create, update, remove,
    lowStock, outOfStock, getCategories,
    exportCSV, importCSV, downloadCSV, parseCSV
  };
})();
