/**
 * CarChain API Client
 * Central module for all API communication with the backend.
 */

const API_BASE_URL = (typeof window !== 'undefined' && window.location.protocol.startsWith('http') && window.location.port === '5000')
  ? '/api'
  : 'http://localhost:5000/api';

// ─── Token Management ─────────────────────────────────────────────────────────
const TokenManager = {
  get: () => localStorage.getItem('carchain_token'),
  set: (token) => localStorage.setItem('carchain_token', token),
  remove: () => localStorage.removeItem('carchain_token'),
  isPresent: () => !!localStorage.getItem('carchain_token'),
};

// ─── User Session ─────────────────────────────────────────────────────────────
const SessionManager = {
  getUser: () => {
    try {
      const raw = localStorage.getItem('carchain_user');
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  },
  setUser: (user) => localStorage.setItem('carchain_user', JSON.stringify(user)),
  removeUser: () => localStorage.removeItem('carchain_user'),
  isLoggedIn: () => !!TokenManager.get() && !!SessionManager.getUser(),
  getRole: () => {
    const user = SessionManager.getUser();
    return user ? user.role : null;
  },
};

// ─── Core Fetch Wrapper ───────────────────────────────────────────────────────
async function apiFetch(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;

  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  const token = TokenManager.get();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    const data = await response.json();

    if (!response.ok) {
      // Handle token expiry
      if (response.status === 401) {
        TokenManager.remove();
        SessionManager.removeUser();
        // Redirect to login only if we're on a protected page
        const publicPages = ['index.html', 'login.html', 'register.html', 'marketplace.html', ''];
        const currentPath = window.location.pathname.replace(/\/$/, '');
        const currentPage = currentPath.split('/').pop();
        if (!publicPages.includes(currentPage)) {
          const isInsidePages = window.location.pathname.includes('/pages/') || window.location.href.includes('/pages/');
          window.location.href = (isInsidePages ? 'login.html' : 'pages/login.html') + '?session=expired';
        }
      }
      const error = new Error(data.message || 'An error occurred');
      error.statusCode = response.status;
      error.data = data;
      throw error;
    }

    return data;
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error('Cannot connect to the server. Please make sure the backend is running on port 5000.');
    }
    throw error;
  }
}

// ─── Auth API ─────────────────────────────────────────────────────────────────
const AuthAPI = {
  register: (data) => apiFetch('/auth/register', { method: 'POST', body: data }),
  login: (data) => apiFetch('/auth/login', { method: 'POST', body: data }),
  getMe: () => apiFetch('/auth/me'),
  updateProfile: (data) => apiFetch('/auth/profile', { method: 'PUT', body: data }),
  changePassword: (data) => apiFetch('/auth/change-password', { method: 'PUT', body: data }),
};

// ─── Admin API ────────────────────────────────────────────────────────────────
const AdminAPI = {
  getStats: () => apiFetch('/admin/stats'),
  getUsers: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiFetch(`/admin/users${qs ? '?' + qs : ''}`);
  },
  getUserById: (id) => apiFetch(`/admin/users/${id}`),
  approveUser: (id, note) => apiFetch(`/admin/users/${id}/approve`, { method: 'PUT', body: { note } }),
  rejectUser: (id, note) => apiFetch(`/admin/users/${id}/reject`, { method: 'PUT', body: { note } }),
  toggleUserActive: (id) => apiFetch(`/admin/users/${id}/toggle-active`, { method: 'PUT' }),
};

// ─── Vehicles API ─────────────────────────────────────────────────────────────
const VehiclesAPI = {
  create: (data) => apiFetch('/vehicles', { method: 'POST', body: data }),
  getMyVehicles: () => apiFetch('/vehicles/user/my-vehicles'),
  getById: (id) => apiFetch(`/vehicles/${id}`),
  getPassport: (id) => apiFetch(`/vehicles/${id}/passport`),
  getByVin: (vin) => apiFetch(`/vehicles/vin/${encodeURIComponent(vin)}`),
  uploadImage: async (formData) => {
    const token = TokenManager.get();
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const url = `${API_BASE_URL}/vehicles/upload-image`;
    const res = await fetch(url, { method: 'POST', headers, body: formData });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Image upload failed');
    return data;
  },
  recordBlockchainMint: (id, data) => apiFetch(`/vehicles/${id}/blockchain-mint`, { method: 'POST', body: data }),
};

// ─── Transactions API (Escrow & Purchase) ───────────────────────────────────
const TransactionsAPI = {
  initiate: (data) => apiFetch('/transactions', { method: 'POST', body: data }),
  confirmHandover: (id, data = {}) => apiFetch(`/transactions/${id}/confirm-handover`, { method: 'POST', body: data }),
  complete: (id) => apiFetch(`/transactions/${id}/complete`, { method: 'POST' }),
  cancel: (id, data = {}) => apiFetch(`/transactions/${id}/cancel`, { method: 'POST', body: data }),
  getMyPurchases: () => apiFetch('/transactions/my-purchases'),
  getMySales: () => apiFetch('/transactions/my-sales'),
  getById: (id) => apiFetch(`/transactions/${id}`),
};

// ─── Listings API ─────────────────────────────────────────────────────────────
const ListingsAPI = {
  getAll: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiFetch(`/listings${qs ? '?' + qs : ''}`);
  },
  getById: (id) => apiFetch(`/listings/${id}`),
  getMyListings: () => apiFetch('/listings/user/my-listings'),
  create: (data) => apiFetch('/listings', { method: 'POST', body: data }),
  update: (id, data) => apiFetch(`/listings/${id}`, { method: 'PUT', body: data }),
  delete: (id) => apiFetch(`/listings/${id}`, { method: 'DELETE' }),
};

// ─── Maintenance API ──────────────────────────────────────────────────────────
const MaintenanceAPI = {
  create: (data) => apiFetch('/maintenance', { method: 'POST', body: data }),
  getMyRecords: () => apiFetch('/maintenance/user/my-records'),
  getByVehicle: (vehicleId) => apiFetch(`/maintenance/vehicle/${vehicleId}`),
  getById: (id) => apiFetch(`/maintenance/${id}`),
};

// ─── Inspections API ──────────────────────────────────────────────────────────
const InspectionsAPI = {
  create: (data) => apiFetch('/inspections', { method: 'POST', body: data }),
  getMyInspections: () => apiFetch('/inspections/user/my-inspections'),
  getByVehicle: (vehicleId) => apiFetch(`/inspections/vehicle/${vehicleId}`),
  getById: (id) => apiFetch(`/inspections/${id}`),
};

// ─── Health API ───────────────────────────────────────────────────────────────
const HealthAPI = {
  check: () => apiFetch('/health'),
};

// Export all
window.CarChainAPI = {
  TokenManager,
  SessionManager,
  Auth: AuthAPI,
  Admin: AdminAPI,
  Vehicles: VehiclesAPI,
  Listings: ListingsAPI,
  Maintenance: MaintenanceAPI,
  Inspections: InspectionsAPI,
  Transactions: TransactionsAPI,
  Health: HealthAPI,
};
