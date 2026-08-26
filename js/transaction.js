/**
 * transaction.js
 * ------------------------------------------------------------------
 * Semua logika transaksi: penjualan kasir (POS), pergerakan stok
 * (masuk/keluar/transfer), kas masuk/keluar, dan order online.
 * Modul ini adalah satu-satunya tempat yang boleh mengubah field
 * `stock` pada produk, supaya konsistensi data terjaga.
 * ------------------------------------------------------------------
 */

const Transactions = (() => {

  // ---------------- POS / PENJUALAN KASIR ----------------

  function createSale({ items, discount = 0, tax = 0, paymentMethod, cashReceived, branchId, cashierId, cashierName }) {
    if (!items || items.length === 0) {
      return { success: false, message: 'Keranjang masih kosong.' };
    }
    // Validasi stok
    for (const it of items) {
      const product = Products.getById(it.productId);
      if (!product) return { success: false, message: `Produk ${it.name} tidak ditemukan.` };
      if (product.stock < it.qty) return { success: false, message: `Stok ${product.name} tidak mencukupi.` };
    }

    const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
    const total = subtotal - discount + tax;
    const change = paymentMethod === 'Cash' ? (cashReceived - total) : 0;
    if (paymentMethod === 'Cash' && cashReceived < total) {
      return { success: false, message: 'Uang diterima kurang dari total belanja.' };
    }

    const transactionNumber = DB.nextDocNumber('TRX', 'transactions');
    const createdAt = new Date().toISOString();

    const transaction = DB.insert('transactions', {
      transactionNumber, items, subtotal, discount, tax, total,
      paymentMethod, cashReceived: cashReceived || total, change,
      cashierId, cashierName, branchId, createdAt
    });

    // Kurangi stok + catat pergerakan stok
    items.forEach(it => {
      const product = Products.getById(it.productId);
      const newBranchStock = { ...(product.branchStock || {}) };
      if (newBranchStock[branchId] !== undefined) {
        newBranchStock[branchId] = Math.max(0, newBranchStock[branchId] - it.qty);
      }
      Products.update(it.productId, {
        stock: Math.max(0, product.stock - it.qty),
        branchStock: newBranchStock
      });
      recordStockMovement({
        type: 'keluar', reason: 'Penjualan', productId: it.productId,
        quantity: it.qty, branchId, refId: transactionNumber
      });
    });

    // Catat kas masuk
    recordCashTransaction({
      type: 'masuk', category: 'Penjualan',
      description: `Penjualan ${transactionNumber}`,
      amount: total, branchId, staffName: cashierName
    });

    return { success: true, transaction };
  }

  function cancelSale(transactionId) {
    const trx = DB.find('transactions', transactionId);
    if (!trx) return { success: false, message: 'Transaksi tidak ditemukan.' };
    if (trx.status === 'dibatalkan') return { success: false, message: 'Transaksi sudah dibatalkan.' };

    // Kembalikan stok
    trx.items.forEach(it => {
      const product = Products.getById(it.productId);
      if (product) {
        const newBranchStock = { ...(product.branchStock || {}) };
        if (newBranchStock[trx.branchId] !== undefined) {
          newBranchStock[trx.branchId] += it.qty;
        }
        Products.update(it.productId, { stock: product.stock + it.qty, branchStock: newBranchStock });
        recordStockMovement({
          type: 'masuk', reason: 'Pembatalan Transaksi', productId: it.productId,
          quantity: it.qty, branchId: trx.branchId, refId: trx.transactionNumber
        });
      }
    });

    recordCashTransaction({
      type: 'keluar', category: 'Pengembalian Dana',
      description: `Pembatalan ${trx.transactionNumber}`,
      amount: trx.total, branchId: trx.branchId, staffName: trx.cashierName
    });

    DB.update('transactions', transactionId, { status: 'dibatalkan' });
    return { success: true };
  }

  function getSalesToday(branchId = null) {
    const today = new Date().toDateString();
    let list = DB.get('transactions').filter(t => new Date(t.createdAt).toDateString() === today && t.status !== 'dibatalkan');
    if (branchId) list = list.filter(t => t.branchId === branchId);
    return list;
  }

  function getSalesInRange(startDate, endDate, branchId = null) {
    let list = DB.get('transactions').filter(t => {
      const d = new Date(t.createdAt);
      return d >= startDate && d <= endDate && t.status !== 'dibatalkan';
    });
    if (branchId) list = list.filter(t => t.branchId === branchId);
    return list;
  }

  // ---------------- STOK ----------------

  function recordStockMovement({ type, reason, productId, quantity, branchId, refId = '', supplierId = '', docNumber = '', note = '' }) {
    return DB.insert('stockMovements', {
      type, reason, productId, quantity, branchId, refId, supplierId, docNumber, note,
      createdAt: new Date().toISOString()
    });
  }

  // Barang masuk (dari supplier / pembelian)
  function stockIn({ productId, quantity, branchId, supplierId, purchasePrice, note = '' }) {
    const product = Products.getById(productId);
    if (!product) return { success: false, message: 'Produk tidak ditemukan.' };
    if (quantity <= 0) return { success: false, message: 'Jumlah harus lebih dari 0.' };

    const docNumber = DB.nextDocNumber('IN', 'stockMovements', 'createdAt');
    const newBranchStock = { ...(product.branchStock || {}) };
    newBranchStock[branchId] = (newBranchStock[branchId] || 0) + quantity;

    Products.update(productId, {
      stock: product.stock + quantity,
      branchStock: newBranchStock,
      ...(purchasePrice ? { purchasePrice: Number(purchasePrice) } : {})
    });

    const movement = recordStockMovement({
      type: 'masuk', reason: 'Pembelian', productId, quantity, branchId, supplierId, docNumber, note
    });

    if (purchasePrice) {
      recordCashTransaction({
        type: 'keluar', category: 'Belanja Barang',
        description: `Pembelian ${quantity} ${product.unit} ${product.name} (${docNumber})`,
        amount: purchasePrice * quantity, branchId, staffName: 'Admin Gudang'
      });
    }

    return { success: true, movement };
  }

  // Barang keluar (rusak, kadaluarsa, hilang, pemakaian internal, dll — bukan penjualan POS)
  function stockOut({ productId, quantity, branchId, reason = 'Pemakaian Internal', note = '' }) {
    const product = Products.getById(productId);
    if (!product) return { success: false, message: 'Produk tidak ditemukan.' };
    if (quantity <= 0) return { success: false, message: 'Jumlah harus lebih dari 0.' };
    if (product.stock < quantity) return { success: false, message: 'Stok tidak mencukupi.' };

    const docNumber = DB.nextDocNumber('OUT', 'stockMovements', 'createdAt');
    const newBranchStock = { ...(product.branchStock || {}) };
    if (newBranchStock[branchId] !== undefined) {
      newBranchStock[branchId] = Math.max(0, newBranchStock[branchId] - quantity);
    }

    Products.update(productId, { stock: product.stock - quantity, branchStock: newBranchStock });

    const movement = recordStockMovement({
      type: 'keluar', reason, productId, quantity, branchId, docNumber, note
    });

    return { success: true, movement };
  }

  // Transfer antar cabang
  function transferStock({ productId, quantity, fromBranchId, toBranchId, note = '' }) {
    const product = Products.getById(productId);
    if (!product) return { success: false, message: 'Produk tidak ditemukan.' };
    if (fromBranchId === toBranchId) return { success: false, message: 'Cabang asal dan tujuan tidak boleh sama.' };
    const branchStock = product.branchStock || {};
    const fromStock = branchStock[fromBranchId] || 0;
    if (fromStock < quantity) return { success: false, message: 'Stok cabang asal tidak mencukupi.' };

    const docNumber = DB.nextDocNumber('TRF', 'stockMovements', 'createdAt');
    const newBranchStock = { ...branchStock };
    newBranchStock[fromBranchId] = fromStock - quantity;
    newBranchStock[toBranchId] = (newBranchStock[toBranchId] || 0) + quantity;
    Products.update(productId, { branchStock: newBranchStock });

    recordStockMovement({ type: 'keluar', reason: 'Transfer Keluar', productId, quantity, branchId: fromBranchId, docNumber, note: `Ke ${toBranchId}. ${note}` });
    recordStockMovement({ type: 'masuk', reason: 'Transfer Masuk', productId, quantity, branchId: toBranchId, docNumber, note: `Dari ${fromBranchId}. ${note}` });

    return { success: true, docNumber };
  }

  // Penyesuaian stok manual (stock opname)
  function adjustStock({ productId, branchId, newQuantity, note = 'Stock opname' }) {
    const product = Products.getById(productId);
    if (!product) return { success: false, message: 'Produk tidak ditemukan.' };
    const branchStock = product.branchStock || {};
    const currentQty = branchStock[branchId] || 0;
    const diff = newQuantity - currentQty;
    if (diff === 0) return { success: true, message: 'Tidak ada perubahan.' };

    const newBranchStock = { ...branchStock, [branchId]: newQuantity };
    Products.update(productId, { stock: product.stock + diff, branchStock: newBranchStock });

    recordStockMovement({
      type: diff > 0 ? 'masuk' : 'keluar', reason: 'Penyesuaian Stok (Opname)',
      productId, quantity: Math.abs(diff), branchId, note
    });

    return { success: true };
  }

  function getStockMovements(filters = {}) {
    let list = DB.get('stockMovements');
    if (filters.productId) list = list.filter(m => m.productId === filters.productId);
    if (filters.branchId) list = list.filter(m => m.branchId === filters.branchId);
    if (filters.type) list = list.filter(m => m.type === filters.type);
    return list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  // ---------------- KAS ----------------

  function recordCashTransaction({ type, category, description, amount, branchId, staffName }) {
    const prefix = type === 'masuk' ? 'IN' : 'OUT';
    const docNumber = DB.nextDocNumber(prefix, 'cashTransactions', 'createdAt');
    return DB.insert('cashTransactions', {
      docNumber, type, category, description, amount, branchId, staffName,
      createdAt: new Date().toISOString()
    });
  }

  function getCashSummary(branchId = null, startDate = null, endDate = null) {
    let list = DB.get('cashTransactions');
    if (branchId) list = list.filter(c => c.branchId === branchId);
    if (startDate && endDate) {
      list = list.filter(c => {
        const d = new Date(c.createdAt);
        return d >= startDate && d <= endDate;
      });
    }
    const totalMasuk = list.filter(c => c.type === 'masuk').reduce((s, c) => s + c.amount, 0);
    const totalKeluar = list.filter(c => c.type === 'keluar').reduce((s, c) => s + c.amount, 0);
    return { totalMasuk, totalKeluar, saldo: totalMasuk - totalKeluar, transactions: list };
  }

  // ---------------- ORDER ONLINE (customer) ----------------

  function createOrder({ customerId, customerName, whatsapp, items, discount = 0, deliveryFee = 0, paymentMethod, fulfillmentType, branchId, address = '', pickupDate = '', pickupTime = '', note = '' }) {
    if (!items || items.length === 0) return { success: false, message: 'Keranjang masih kosong.' };
    if (!whatsapp) return { success: false, message: 'Nomor WhatsApp wajib diisi.' };

    for (const it of items) {
      const product = Products.getById(it.productId);
      if (!product) return { success: false, message: `Produk ${it.name} tidak ditemukan.` };
      if (product.stock < it.qty) return { success: false, message: `Stok ${product.name} tidak mencukupi.` };
    }

    const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
    const grandTotal = subtotal - discount + deliveryFee;
    const orderId = DB.nextDocNumber('ORD', 'orders', 'createdAt');

    const order = DB.insert('orders', {
      orderId, customerId, customerName, whatsapp, items, subtotal, discount, deliveryFee, grandTotal,
      paymentMethod, fulfillmentType, branchId, address, pickupDate, pickupTime, note,
      status: 'Pesanan masuk', createdAt: new Date().toISOString()
    });

    // Kurangi stok cadangan (reserve) — dianggap langsung terpakai untuk kesederhanaan prototype
    items.forEach(it => {
      const product = Products.getById(it.productId);
      const newBranchStock = { ...(product.branchStock || {}) };
      if (newBranchStock[branchId] !== undefined) {
        newBranchStock[branchId] = Math.max(0, newBranchStock[branchId] - it.qty);
      }
      Products.update(it.productId, { stock: Math.max(0, product.stock - it.qty), branchStock: newBranchStock });
      recordStockMovement({ type: 'keluar', reason: 'Order Online', productId: it.productId, quantity: it.qty, branchId, refId: orderId });
    });

    return { success: true, order };
  }

  function updateOrderStatus(orderId, status) {
    const order = DB.find('orders', o => o.orderId === orderId || o.id === orderId);
    if (!order) return { success: false, message: 'Pesanan tidak ditemukan.' };
    if (status === 'Dibatalkan' && order.status !== 'Dibatalkan') {
      // kembalikan stok
      order.items.forEach(it => {
        const product = Products.getById(it.productId);
        if (product) {
          const newBranchStock = { ...(product.branchStock || {}) };
          if (newBranchStock[order.branchId] !== undefined) newBranchStock[order.branchId] += it.qty;
          Products.update(it.productId, { stock: product.stock + it.qty, branchStock: newBranchStock });
        }
      });
    }
    DB.update('orders', order.id, { status });
    return { success: true };
  }

  function getOrdersByCustomer(customerId) {
    return DB.get('orders').filter(o => o.customerId === customerId).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  function buildWhatsAppMessage(order, storeName = 'KOPDAR') {
    const lines = [
      'PESANAN BARU',
      '',
      `Nomor Order: ${order.orderId}`,
      '',
      `Nama: ${order.customerName}`,
      '',
      'Produk:',
      ...order.items.map(i => `- ${i.name} x${i.qty} = ${formatRupiah(i.lineTotal ?? i.price * i.qty)}`),
      '',
      `Total: ${formatRupiah(order.grandTotal)}`,
      `Metode: ${order.fulfillmentType}`,
      '',
      'Terima kasih.'
    ];
    return lines.join('\n');
  }

  function whatsappLink(phoneNumber, message) {
    const cleaned = String(phoneNumber || '').replace(/\D/g, '');
    return `https://wa.me/${cleaned}?text=${encodeURIComponent(message)}`;
  }

  return {
    createSale, cancelSale, getSalesToday, getSalesInRange,
    recordStockMovement, stockIn, stockOut, transferStock, adjustStock, getStockMovements,
    recordCashTransaction, getCashSummary,
    createOrder, updateOrderStatus, getOrdersByCustomer, buildWhatsAppMessage, whatsappLink
  };
})();

// Helper format Rupiah dipakai di banyak tempat
function formatRupiah(num) {
  const n = Math.round(Number(num) || 0);
  return 'Rp ' + n.toLocaleString('id-ID');
}

function formatTanggalIndonesia(isoStr) {
  const d = new Date(isoStr);
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
}

function formatTanggalJamIndonesia(isoStr) {
  const d = new Date(isoStr);
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }) +
    ', ' + d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}
