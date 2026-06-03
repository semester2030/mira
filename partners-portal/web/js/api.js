(function () {
  const meta = document.querySelector('meta[name="mira-api-base"]');
  const API_BASE =
    (meta && meta.getAttribute('content')) ||
    'https://mira-api-n4p3.onrender.com/api/v1';

  function authHeaders() {
    const token = localStorage.getItem('mira_partner_token');
    return token
      ? { Authorization: `Bearer ${token}` }
      : {};
  }

  async function request(method, path, body, extraHeaders) {
    const res = await fetch(`${API_BASE}${path}`, {
      method,
      headers: {
        Accept: 'application/json',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...extraHeaders,
        ...authHeaders(),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = data.message || data.error || `HTTP ${res.status}`;
      throw new Error(Array.isArray(msg) ? msg.join(' ') : msg);
    }
    return data;
  }

  window.PartnersApi = {
    base: API_BASE,
    apply: (payload) => request('POST', '/partners-portal/apply', payload),
    status: (token) =>
      request('GET', `/partners-portal/apply/status/${encodeURIComponent(token)}`),
    login: (email, accessToken) =>
      request('POST', '/partners-portal/login', { email, accessToken }),
    dashboard: () => request('GET', '/partners-portal/me'),
    createProduct: (payload) =>
      request('POST', '/partners-portal/products', payload),
    updateProduct: (id, payload) =>
      request('PATCH', `/partners-portal/products/${id}`, payload),
    deleteProduct: (id) =>
      request('DELETE', `/partners-portal/products/${id}`),
    createService: (payload) =>
      request('POST', '/partners-portal/services', payload),
    updateService: (id, payload) =>
      request('PATCH', `/partners-portal/services/${id}`, payload),
    deleteService: (id) =>
      request('DELETE', `/partners-portal/services/${id}`),
    track: (payload) =>
      request('POST', '/partners-portal/track', payload),
    adminList: (adminKey, status) =>
      request(
        'GET',
        `/partners-portal/admin/applications?status=${encodeURIComponent(status || 'pending')}`,
        null,
        { 'X-Admin-Key': adminKey },
      ),
    adminApprove: (adminKey, id) =>
      request('POST', `/partners-portal/admin/applications/${id}/approve`, {}, {
        'X-Admin-Key': adminKey,
      }),
    adminReject: (adminKey, id, reason) =>
      request('POST', `/partners-portal/admin/applications/${id}/reject`, { reason }, {
        'X-Admin-Key': adminKey,
      }),
    saveSession: (email, token) => {
      localStorage.setItem('mira_partner_email', email);
      localStorage.setItem('mira_partner_token', token);
    },
    clearSession: () => {
      localStorage.removeItem('mira_partner_email');
      localStorage.removeItem('mira_partner_token');
    },
    isLoggedIn: () => !!localStorage.getItem('mira_partner_token'),
  };
})();
