/* ==========================================================================
   api.js — thin fetch wrapper around the Money Heist backend.
   All requests send credentials (httpOnly JWT cookie). No API keys or
   secrets ever live in this file — auth is entirely cookie-based.
   ========================================================================== */

const API_BASE = (() => {
  // Same-origin by default. If you deploy the frontend separately from the
  // backend (e.g. Netlify + Render), set window.PAISA_API_BASE before this
  // script loads, e.g. <script>window.PAISA_API_BASE='https://api.example.com/api'</script>
  if (window.PAISA_API_BASE) return window.PAISA_API_BASE;
  return '/api';
})();

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function request(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    credentials: 'include',
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });

  let data = null;
  try {
    data = await res.json();
  } catch (_) {
    /* empty body */
  }

  if (!res.ok) {
    throw new ApiError((data && data.error) || 'Something went wrong. Please try again.', res.status);
  }
  return data;
}

const Api = {
  // ---------- Auth ----------
  register: (email, password, displayName) =>
    request('/auth/register', { method: 'POST', body: { email, password, displayName } }),
  login: (email, password) => request('/auth/login', { method: 'POST', body: { email, password } }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  me: () => request('/auth/me'),

  // ---------- Budgets ----------
  createBudget: (payload) => request('/budgets', { method: 'POST', body: payload }),
  listBudgets: () => request('/budgets'),
  getBudget: (month) => request(`/budgets/${month}`),

  // ---------- Categories ----------
  createCategory: (payload) => request('/categories', { method: 'POST', body: payload }),
  updateCategory: (id, payload) => request(`/categories/${id}`, { method: 'PATCH', body: payload }),

  // ---------- Transactions ----------
  createTransaction: (payload) => request('/transactions', { method: 'POST', body: payload }),
  listTransactions: (filters = {}) => {
    const qs = new URLSearchParams(Object.entries(filters).filter(([, v]) => v)).toString();
    return request(`/transactions${qs ? `?${qs}` : ''}`);
  },
  deleteTransaction: (id) => request(`/transactions/${id}`, { method: 'DELETE' }),
  balances: (month) => request(`/transactions/balances/${month}`),

  // ---------- Goals ----------
  listGoals: () => request('/goals'),
  createGoal: (payload) => request('/goals', { method: 'POST', body: payload }),
  updateGoal: (id, payload) => request(`/goals/${id}`, { method: 'PATCH', body: payload }),
  addMoneyToGoal: (id, payload) => request(`/goals/${id}/add-money`, { method: 'POST', body: payload }),
  deleteGoal: (id) => request(`/goals/${id}`, { method: 'DELETE' }),

  // ---------- Analysis ----------
  analysis: (month) => request(`/analysis/${month}`),
};

window.Api = Api;
window.ApiError = ApiError;
