/**
 * ui.js
 * ------------------------------------------------------------------
 * Helper UI yang dipakai bersama di semua halaman: toast notification,
 * kontrol modal, dark/light theme toggle, dan trigger "klik logo 5x"
 * untuk membuka login admin secara tersembunyi.
 * ------------------------------------------------------------------
 */

const UI = (() => {

  // ---------------- TOAST ----------------
  function ensureToastContainer() {
    let el = document.getElementById('toast-container');
    if (!el) {
      el = document.createElement('div');
      el.id = 'toast-container';
      document.body.appendChild(el);
    }
    return el;
  }

  const ICONS = { success: 'check-circle', error: 'x', warning: 'alert-triangle', info: 'bell' };

  function toast(message, type = 'info', duration = 3000) {
    const container = ensureToastContainer();
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `<span class="toast-icon">${Icon.svg(ICONS[type] || 'bell', { size: 17 })}</span><span>${escapeHTML(message)}</span>`;
    container.appendChild(el);
    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transition = 'opacity .2s ease';
      setTimeout(() => el.remove(), 200);
    }, duration);
  }

  function escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ---------------- MODAL ----------------
  function openModal(id) {
    const overlay = document.getElementById(id);
    if (overlay) overlay.classList.add('open');
  }
  function closeModal(id) {
    const overlay = document.getElementById(id);
    if (overlay) overlay.classList.remove('open');
  }
  function bindModalOverlayClose() {
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', e => {
        if (e.target === overlay) overlay.classList.remove('open');
      });
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        document.querySelectorAll('.modal-overlay.open').forEach(o => o.classList.remove('open'));
      }
    });
  }

  // ---------------- THEME ----------------
  function initTheme() {
    const saved = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', saved);
    updateThemeToggleUI(saved);
  }

  function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    updateThemeToggleUI(theme);
    document.dispatchEvent(new CustomEvent('theme:changed', { detail: { theme } }));
  }

  function updateThemeToggleUI(theme) {
    document.querySelectorAll('[data-theme-btn]').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-theme-btn') === theme);
    });
  }

  function bindThemeToggle() {
    document.querySelectorAll('[data-theme-btn]').forEach(btn => {
      btn.addEventListener('click', () => setTheme(btn.getAttribute('data-theme-btn')));
    });
  }

  // ---------------- LOGO 5x CLICK -> ADMIN LOGIN ----------------
  function bindSecretAdminTrigger(logoSelector, onSuccess) {
    const logo = document.querySelector(logoSelector);
    if (!logo) return;
    let clicks = 0;
    let timer = null;

    logo.addEventListener('click', () => {
      clicks++;
      logo.classList.add('clicking');
      setTimeout(() => logo.classList.remove('clicking'), 300);

      if (timer) clearTimeout(timer);
      timer = setTimeout(() => { clicks = 0; }, 3000);

      if (clicks >= 5) {
        clicks = 0;
        clearTimeout(timer);
        onSuccess();
      }
    });
  }

  // ---------------- EMPTY STATE HELPER ----------------
  // Peta emoji legacy -> nama ikon SVG, supaya seluruh pemanggilan emptyStateHTML()
  // yang sudah ada (masih mengirim emoji) otomatis ter-upgrade ke ikon SVG tanpa
  // perlu mengubah satu-satu call site di app.js/kasir.js/gudang.js.
  const EMPTY_ICON_MAP = {
    '📦': 'package', '🔍': 'search', '🛒': 'cart', '🧾': 'receipt', '🛍️': 'shopping-bag',
    '💰': 'wallet', '⚠️': 'alert-triangle', '✅': 'check-circle', '🕒': 'clock', '🔁': 'transfer'
  };

  function emptyStateHTML({ icon = 'package', title = 'Belum ada data', desc = '', actionLabel = '', actionAttr = '' }) {
    const iconName = Icon.PATHS[icon] ? icon : (EMPTY_ICON_MAP[icon] || 'package');
    return `
      <div class="empty-state">
        <div class="icon">${Icon.svg(iconName, { size: 26 })}</div>
        <h4>${title}</h4>
        ${desc ? `<p>${desc}</p>` : ''}
        ${actionLabel ? `<button class="btn btn-primary btn-sm" ${actionAttr}>${actionLabel}</button>` : ''}
      </div>`;
  }

  // ---------------- SIDEBAR DRAWER (admin pages) ----------------
  function bindSidebarDrawer() {
    const sidebar = document.querySelector('.admin-sidebar');
    const overlay = document.querySelector('.sidebar-overlay');
    const hamburger = document.querySelector('.hamburger');
    if (!sidebar || !overlay || !hamburger) return;
    hamburger.addEventListener('click', () => {
      sidebar.classList.add('open');
      overlay.classList.add('show');
    });
    overlay.addEventListener('click', () => {
      sidebar.classList.remove('open');
      overlay.classList.remove('show');
    });
  }

  // ---------------- DEBOUNCE ----------------
  function debounce(fn, wait = 300) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), wait);
    };
  }

  // ---------------- COUNT-UP ANIMATION ----------------
  function countUp(el, target, opts = {}) {
    if (!el) return;
    const duration = opts.duration || 900;
    const start = 0;
    const startTime = performance.now();
    const suffix = opts.suffix || '';
    function tick(now) {
      const progress = Math.min(1, (now - startTime) / duration);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      const value = Math.round(start + (target - start) * eased);
      el.textContent = value.toLocaleString('id-ID') + suffix;
      if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  // ---------------- APP LOADER (splash screen) ----------------
  function initAppLoader() {
    const loader = document.getElementById('app-loader');
    if (!loader) return;
    const MIN_DISPLAY_MS = 900;
    const MAX_WAIT_MS = 3500; // jaring pengaman: paksa hilang walau event 'load' tidak pernah tembak
    const startedAt = performance.now();

    let hidden = false;
    function hideLoader() {
      if (hidden) return;
      hidden = true;
      const elapsed = performance.now() - startedAt;
      const remaining = Math.max(0, MIN_DISPLAY_MS - elapsed);
      setTimeout(() => {
        loader.classList.add('loader-hide');
        setTimeout(() => loader.remove(), 550);
      }, remaining);
    }

    if (document.readyState === 'complete') hideLoader();
    else window.addEventListener('load', hideLoader, { once: true });
    setTimeout(hideLoader, MAX_WAIT_MS);
  }

  return {
    toast, escapeHTML, openModal, closeModal, bindModalOverlayClose,
    initTheme, setTheme, bindThemeToggle,
    bindSecretAdminTrigger, emptyStateHTML, bindSidebarDrawer, debounce, countUp, initAppLoader
  };
})();

document.addEventListener('DOMContentLoaded', () => {
  UI.initTheme();
  UI.bindThemeToggle();
  UI.bindModalOverlayClose();
  UI.bindSidebarDrawer();
  UI.initAppLoader();
});
