/**
 * cart.js
 * ------------------------------------------------------------------
 * Modul keranjang belanja. Dipakai oleh index.html (customer) dan
 * kasir.html (POS) dengan key localStorage yang berbeda supaya tidak
 * saling bentrok.
 * ------------------------------------------------------------------
 */

function createCart(storageKey) {
  function read() {
    try {
      const raw = localStorage.getItem(storageKey);
      return raw ? JSON.parse(raw) : [];
    } catch (e) { return []; }
  }

  function write(items) {
    localStorage.setItem(storageKey, JSON.stringify(items));
    document.dispatchEvent(new CustomEvent('cart:changed', { detail: { storageKey, items } }));
  }

  function getItems() {
    return read();
  }

  function addItem(product, qty = 1) {
    if (!product) return { success: false, message: 'Produk tidak ditemukan.' };
    if (product.stock <= 0) return { success: false, message: 'Stok habis.' };
    const items = read();
    const existing = items.find(i => i.productId === product.id);
    const currentQty = existing ? existing.qty : 0;
    if (currentQty + qty > product.stock) {
      return { success: false, message: 'Stok tidak mencukupi.' };
    }
    if (existing) {
      existing.qty += qty;
    } else {
      items.push({
        productId: product.id, name: product.name, price: product.sellingPrice,
        image: product.image, unit: product.unit, qty
      });
    }
    write(items);
    return { success: true, items };
  }

  function updateQty(productId, qty) {
    let items = read();
    if (qty <= 0) {
      items = items.filter(i => i.productId !== productId);
    } else {
      const item = items.find(i => i.productId === productId);
      if (item) {
        const product = Products.getById(productId);
        if (product && qty > product.stock) {
          return { success: false, message: 'Stok tidak mencukupi.' };
        }
        item.qty = qty;
      }
    }
    write(items);
    return { success: true, items };
  }

  function removeItem(productId) {
    const items = read().filter(i => i.productId !== productId);
    write(items);
    return items;
  }

  function clear() {
    write([]);
  }

  function getSummary(discount = 0, taxRate = 0) {
    const items = read();
    const subtotal = items.reduce((sum, i) => sum + (i.price * i.qty), 0);
    const tax = Math.round(subtotal * taxRate);
    const total = subtotal - discount + tax;
    const totalItems = items.reduce((sum, i) => sum + i.qty, 0);
    return { items, subtotal, discount, tax, total, totalItems };
  }

  return { getItems, addItem, updateQty, removeItem, clear, getSummary };
}

// Instance terpisah untuk customer & kasir agar tidak bentrok
const CustomerCart = createCart('cart_customer_v1');
const KasirCart = createCart('cart_kasir_v1');
