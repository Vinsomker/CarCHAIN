/**
 * CarChain UI Utilities
 * Toast notifications, form helpers, loading states, etc.
 */

// ─── Toast Notification System ────────────────────────────────────────────────
const Toast = (() => {
  let container;

  function getContainer() {
    if (!container) {
      container = document.getElementById('toast-container');
      if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
      }
    }
    return container;
  }

  function show(message, type = 'info', duration = 4500) {
    const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
    const c = getContainer();

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <span class="toast-icon">${icons[type] || 'ℹ️'}</span>
      <span class="toast-message">${escapeHtml(message)}</span>
      <button class="toast-close" onclick="this.closest('.toast').remove()">✕</button>
    `;

    c.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('hiding');
      setTimeout(() => toast.remove(), 300);
    }, duration);

    return toast;
  }

  return {
    success: (msg, dur) => show(msg, 'success', dur),
    error: (msg, dur) => show(msg, 'error', dur || 6000),
    warning: (msg, dur) => show(msg, 'warning', dur),
    info: (msg, dur) => show(msg, 'info', dur),
  };
})();

// ─── HTML Escape ─────────────────────────────────────────────────────────────
function escapeHtml(str) {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(String(str)));
  return div.innerHTML;
}

// ─── Form Helpers ─────────────────────────────────────────────────────────────
const FormHelper = {
  /**
   * Display validation errors returned by the backend.
   * errors: [{ field, message }]
   */
  showErrors(errors, formEl) {
    // Clear existing errors
    this.clearErrors(formEl);

    errors.forEach(({ field, message }) => {
      // Try to find the input by name
      const input = formEl ? formEl.querySelector(`[name="${field}"]`) : null;
      if (input) {
        input.classList.add('error');

        // Create error element
        let errorEl = input.closest('.form-group')?.querySelector('.form-error');
        if (!errorEl) {
          errorEl = document.createElement('div');
          errorEl.className = 'form-error';
          input.closest('.form-group')?.appendChild(errorEl);
        }
        errorEl.textContent = message;
      }
    });
  },

  clearErrors(formEl) {
    if (!formEl) return;
    formEl.querySelectorAll('.form-control.error').forEach(el => el.classList.remove('error'));
    formEl.querySelectorAll('.form-error').forEach(el => el.textContent = '');
  },

  setFieldError(input, message) {
    if (!input) return;
    input.classList.add('error');
    let errorEl = input.closest('.form-group')?.querySelector('.form-error');
    if (!errorEl) {
      errorEl = document.createElement('div');
      errorEl.className = 'form-error';
      input.closest('.form-group')?.appendChild(errorEl);
    }
    errorEl.textContent = message;
  },

  clearFieldError(input) {
    if (!input) return;
    input.classList.remove('error');
    const errorEl = input.closest('.form-group')?.querySelector('.form-error');
    if (errorEl) errorEl.textContent = '';
  },

  /**
   * Get all form field values as an object
   */
  serialize(formEl) {
    const data = {};
    const inputs = formEl.querySelectorAll('input, select, textarea');
    inputs.forEach(input => {
      if (input.name) {
        if (input.type === 'checkbox') {
          data[input.name] = input.checked;
        } else if (input.type === 'radio') {
          if (input.checked) data[input.name] = input.value;
        } else {
          data[input.name] = input.value.trim();
        }
      }
    });
    return data;
  },
};

// ─── Button Loading State ─────────────────────────────────────────────────────
const ButtonHelper = {
  setLoading(btn, loading, originalText) {
    if (!btn) return;
    btn.disabled = loading;
    if (loading) {
      btn.dataset.originalText = btn.textContent;
      btn.textContent = '';
      btn.classList.add('loading');
    } else {
      btn.classList.remove('loading');
      btn.textContent = originalText || btn.dataset.originalText || 'Submit';
    }
  },
};

// ─── Page Loading Overlay ─────────────────────────────────────────────────────
const LoadingOverlay = {
  show() {
    let overlay = document.getElementById('loading-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'loading-overlay';
      overlay.className = 'loading-overlay';
      overlay.innerHTML = '<div class="spinner spinner-lg"></div>';
      document.body.appendChild(overlay);
    }
    overlay.style.display = 'flex';
  },
  hide() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) overlay.style.display = 'none';
  },
};

// ─── Navbar Logic ─────────────────────────────────────────────────────────────
function initNavbar() {
  const navbar = document.querySelector('.navbar');
  const toggle = document.querySelector('.navbar-toggle');
  const nav = document.querySelector('.navbar-nav');

  // Scroll effect
  if (navbar) {
    window.addEventListener('scroll', () => {
      navbar.classList.toggle('scrolled', window.scrollY > 20);
    });
  }

  // Mobile menu toggle
  if (toggle && nav) {
    toggle.addEventListener('click', () => {
      nav.classList.toggle('open');
      const isOpen = nav.classList.contains('open');
      toggle.setAttribute('aria-expanded', isOpen);
    });

    // Close on outside click
    document.addEventListener('click', (e) => {
      if (!toggle.contains(e.target) && !nav.contains(e.target)) {
        nav.classList.remove('open');
      }
    });
  }

  // Update navbar based on auth state
  updateNavbarAuth();
}

// ─── Path Routing Helper ──────────────────────────────────────────────────────
function getAppPath(target) {
  // Target is specified from root, e.g. 'index.html', 'pages/login.html'
  const isInsidePages = window.location.pathname.includes('/pages/') || 
                        window.location.href.includes('/pages/');

  if (isInsidePages) {
    if (target === 'index.html') return '../index.html';
    if (target.startsWith('pages/')) return target.substring(6); // remove 'pages/'
    return target;
  } else {
    return target;
  }
}

function updateNavbarAuth() {
  const { SessionManager } = window.CarChainAPI || {};
  if (!SessionManager) return;

  const actionsEl = document.querySelector('.navbar-actions');
  if (!actionsEl) return;

  if (SessionManager.isLoggedIn()) {
    const user = SessionManager.getUser();
    const role = user?.role || 'buyer';
    const dashboardUrl = getDashboardUrl(role);

    actionsEl.innerHTML = `
      <a href="${dashboardUrl}" class="btn btn-secondary btn-sm">Dashboard</a>
      <button onclick="logout()" class="btn btn-primary btn-sm">Sign Out</button>
    `;
  } else {
    actionsEl.innerHTML = `
      <a href="${getAppPath('pages/login.html')}" class="btn btn-secondary btn-sm">Sign In</a>
      <a href="${getAppPath('pages/register.html')}" class="btn btn-primary btn-sm">Get Started</a>
    `;
  }
}

function getDashboardUrl(role) {
  const urls = {
    admin: 'pages/admin-dashboard.html',
    seller: 'pages/seller-dashboard.html',
    garage: 'pages/garage-dashboard.html',
    inspector: 'pages/inspector-dashboard.html',
    buyer: 'pages/dashboard.html',
  };
  return getAppPath(urls[role] || 'pages/dashboard.html');
}

// ─── Logout ───────────────────────────────────────────────────────────────────
window.logout = function () {
  const { TokenManager, SessionManager } = window.CarChainAPI;
  TokenManager.remove();
  SessionManager.removeUser();
  Toast.success('Signed out successfully.');
  setTimeout(() => { window.location.href = getAppPath('index.html'); }, 800);
};

// ─── Auth Guard (for protected pages) ────────────────────────────────────────
function requireAuth(allowedRoles = []) {
  const { SessionManager } = window.CarChainAPI || {};
  if (!SessionManager) return false;

  if (!SessionManager.isLoggedIn()) {
    window.location.href = getAppPath('pages/login.html') + '?redirect=' + encodeURIComponent(window.location.href);
    return false;
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(SessionManager.getRole())) {
    Toast.error('You do not have permission to access this page.');
    setTimeout(() => { window.location.href = getDashboardUrl(SessionManager.getRole()); }, 1500);
    return false;
  }

  return true;
}

// ─── Date Formatting ─────────────────────────────────────────────────────────
function formatDate(dateStr, options = {}) {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '—';

  const defaults = { year: 'numeric', month: 'short', day: 'numeric' };
  return date.toLocaleDateString('en-US', { ...defaults, ...options });
}

function formatDateTime(dateStr) {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(dateStr);
}

// ─── Currency / Number Formatting ────────────────────────────────────────────
function formatCurrency(amount, currency = 'USD') {
  if (amount === undefined || amount === null) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatNumber(num) {
  if (num === undefined || num === null) return '—';
  return new Intl.NumberFormat('en-US').format(num);
}

// ─── Role Badge ───────────────────────────────────────────────────────────────
function getRoleBadge(role) {
  const config = {
    admin:     { label: 'Admin',     class: 'badge-danger' },
    seller:    { label: 'Seller',    class: 'badge-accent' },
    buyer:     { label: 'Buyer',     class: 'badge-info' },
    garage:    { label: 'Garage',    class: 'badge-success' },
    inspector: { label: 'Inspector', class: 'badge-warning' },
  };
  const c = config[role] || { label: role, class: 'badge-muted' };
  return `<span class="badge ${c.class}">${c.label}</span>`;
}

function getStatusBadge(status) {
  const config = {
    approved:  { label: 'Approved',  class: 'badge-success' },
    pending:   { label: 'Pending',   class: 'badge-warning' },
    rejected:  { label: 'Rejected',  class: 'badge-danger' },
    active:    { label: 'Active',    class: 'badge-success' },
    inactive:  { label: 'Inactive',  class: 'badge-muted' },
    sold:      { label: 'Sold',      class: 'badge-muted' },
    pass:      { label: 'Pass',      class: 'badge-success' },
    fail:      { label: 'Fail',      class: 'badge-danger' },
    conditional_pass: { label: 'Conditional', class: 'badge-warning' },
    verified:  { label: 'Verified',  class: 'badge-success' },
    unverified:{ label: 'Unverified',class: 'badge-muted' },
  };
  const c = config[status] || { label: status, class: 'badge-muted' };
  return `<span class="badge ${c.class}">${c.label}</span>`;
}

// ─── Avatar / Initials ────────────────────────────────────────────────────────
function getInitials(firstName, lastName) {
  return `${(firstName || '?')[0]}${(lastName || '')[0] || ''}`.toUpperCase();
}

// ─── Shorten Blockchain Address ──────────────────────────────────────────────
function shortenAddress(addr, chars = 4) {
  if (!addr || typeof addr !== 'string') return '';
  if (addr.length <= chars * 2 + 2) return addr;
  return `${addr.substring(0, chars + 2)}...${addr.substring(addr.length - chars)}`;
}

// ─── Global Init ─────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initNavbar();

  // Check session expiry param
  const params = new URLSearchParams(window.location.search);
  if (params.get('session') === 'expired') {
    Toast.warning('Your session has expired. Please log in again.');
  }
});

// Expose globally
window.Toast = Toast;
window.FormHelper = FormHelper;
window.ButtonHelper = ButtonHelper;
window.LoadingOverlay = LoadingOverlay;
window.requireAuth = requireAuth;
window.formatDate = formatDate;
window.formatDateTime = formatDateTime;
window.timeAgo = timeAgo;
window.formatCurrency = formatCurrency;
window.formatNumber = formatNumber;
window.getRoleBadge = getRoleBadge;
window.getStatusBadge = getStatusBadge;
window.getInitials = getInitials;
window.shortenAddress = shortenAddress;
window.getAppPath = getAppPath;
window.getDashboardUrl = getDashboardUrl;
