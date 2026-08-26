/**
 * auth.js
 * ------------------------------------------------------------------
 * Modul autentikasi & session untuk admin (superadmin, admin_kasir,
 * admin_gudang) dan customer.
 *
 * CATATAN KEAMANAN:
 * Ini adalah prototype berbasis localStorage. Password disimpan
 * dalam bentuk plain text di database demo dan session hanya
 * disimpan di localStorage browser. Ini TIDAK aman untuk produksi.
 * Untuk produksi, autentikasi wajib dipindahkan ke backend (mis.
 * Firebase Auth / Supabase Auth / REST API dengan hashing password
 * dan JWT/session token yang divalidasi server).
 * ------------------------------------------------------------------
 */

const SESSION_KEY = 'app_session_v1';
const CUSTOMER_SESSION_KEY = 'app_customer_session_v1';

const Auth = (() => {

  // ---------------- ADMIN AUTH ----------------

  function loginAdmin(email, password, requestedRole) {
    const user = DB.find('users', u => u.email.toLowerCase() === String(email).toLowerCase());
    if (!user) return { success: false, message: 'Email tidak ditemukan.' };
    if (user.password !== password) return { success: false, message: 'Password salah.' };
    if (user.status !== 'aktif') return { success: false, message: 'Akun tidak aktif.' };

    // superadmin boleh masuk ke akses manapun; role lain harus cocok
    if (requestedRole && user.role !== 'superadmin' && user.role !== requestedRole) {
      return { success: false, message: 'Akun ini tidak memiliki akses ke halaman tersebut.' };
    }

    const session = {
      userId: user.id, name: user.name, email: user.email,
      role: user.role, branchId: user.branchId,
      loginAt: new Date().toISOString()
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return { success: true, session };
  }

  function getAdminSession() {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function logoutAdmin() {
    localStorage.removeItem(SESSION_KEY);
  }

  function isAdminLoggedIn() {
    return !!getAdminSession();
  }

  function hasRole(...roles) {
    const s = getAdminSession();
    if (!s) return false;
    if (s.role === 'superadmin') return true;
    return roles.includes(s.role);
  }

  // Panggil di awal kasir.html / gudang.html untuk memblokir akses langsung
  function requireAdminAccess(requiredRole) {
    const s = getAdminSession();
    if (!s || (requiredRole && s.role !== 'superadmin' && s.role !== requiredRole)) {
      document.body.innerHTML = `
        <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;
        flex-direction:column;gap:16px;font-family:'Plus Jakarta Sans',sans-serif;background:#0D1512;color:#fff;text-align:center;padding:24px;">
          <div style="font-size:56px;">🔒</div>
          <h1 style="margin:0;font-size:24px;">Access Denied</h1>
          <p style="opacity:.7;max-width:360px;">Anda harus login sebagai admin yang sesuai untuk mengakses halaman ini.</p>
          <a href="./index.html" style="background:#FF7A1A;color:#111;padding:12px 24px;border-radius:999px;text-decoration:none;font-weight:600;">Kembali ke Beranda</a>
        </div>`;
      setTimeout(() => { window.location.href = './index.html'; }, 2500);
      return false;
    }
    return true;
  }

  // ---------------- CUSTOMER AUTH ----------------

  function registerCustomer({ name, whatsapp, address, password }) {
    if (!name || !whatsapp || !password) {
      return { success: false, message: 'Nama, nomor WhatsApp, dan password wajib diisi.' };
    }
    const exists = DB.find('customers', c => c.whatsapp === whatsapp);
    if (exists) return { success: false, message: 'Nomor WhatsApp sudah terdaftar.' };

    const customer = DB.insert('customers', {
      name, whatsapp, address: address || '', password,
      registeredAt: new Date().toISOString()
    });
    return { success: true, customer };
  }

  function loginCustomer(whatsapp, password) {
    const customer = DB.find('customers', c => c.whatsapp === whatsapp);
    if (!customer) return { success: false, message: 'Nomor WhatsApp belum terdaftar.' };
    if (customer.password !== password) return { success: false, message: 'Password salah.' };
    localStorage.setItem(CUSTOMER_SESSION_KEY, JSON.stringify({
      customerId: customer.id, name: customer.name, whatsapp: customer.whatsapp,
      loginAt: new Date().toISOString()
    }));
    return { success: true, customer };
  }

  function getCustomerSession() {
    try {
      const raw = localStorage.getItem(CUSTOMER_SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function logoutCustomer() {
    localStorage.removeItem(CUSTOMER_SESSION_KEY);
  }

  function isCustomerLoggedIn() {
    return !!getCustomerSession();
  }

  function getCurrentCustomer() {
    const session = getCustomerSession();
    if (!session) return null;
    return DB.find('customers', session.customerId);
  }

  return {
    loginAdmin, getAdminSession, logoutAdmin, isAdminLoggedIn, hasRole, requireAdminAccess,
    registerCustomer, loginCustomer, getCustomerSession, logoutCustomer, isCustomerLoggedIn, getCurrentCustomer
  };
})();
