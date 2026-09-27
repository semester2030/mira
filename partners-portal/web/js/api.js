(function () {
  const meta = document.querySelector('meta[name="mira-api-base"]');
  const API_BASE = localApiBase(
    (meta && meta.getAttribute('content')) ||
    'https://mira-api-n4p3.onrender.com/api/v1',
  );

  function localApiBase(fallback) {
    const override = new URLSearchParams(location.search).get('api-base');
    const localPage = location.hostname === '127.0.0.1' || location.hostname === 'localhost';
    if (localPage && override && /^https?:\/\/(127\.0\.0\.1|localhost):\d+(?:\/.*)?$/.test(override)) {
      return override.replace(/\/$/, '');
    }
    return fallback;
  }

  function authHeaders() {
    const token = localStorage.getItem('mira_partner_token');
    return token
      ? { Authorization: `Bearer ${token}` }
      : {};
  }

  function labeledPreview() {
    return new URLSearchParams(location.search).get('ui-fixture') === 'labeled';
  }

  async function request(method, path, body, extraHeaders) {
    if (labeledPreview()) {
      throw new Error('محاكاة: لم يُرسل طلب ولم تُستخدم الجلسة');
    }
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
    addMedia: (kind, id, mimeType, dataBase64) =>
      request('POST', `/partners-portal/${kind}/${id}/media`, { mimeType, dataBase64 }),
    submitReview: (kind, id) =>
      request('POST', `/partners-portal/${kind}/${id}/submit-review`, {}),
    preview: (kind, id) =>
      request('GET', `/partners-portal/${kind}/${id}/preview`),
    reorderMedia: (kind, id, ids) =>
      request('PATCH', `/partners-portal/${kind}/${id}/media/order`, { ids }),
    setPrimary: (kind, id, mediaId) =>
      request('PATCH', `/partners-portal/${kind}/${id}/media/${mediaId}/primary`, {}),
    removeMedia: (kind, id, mediaId) =>
      request('DELETE', `/partners-portal/${kind}/${id}/media/${mediaId}`),
    ads: () => request('GET', '/partners-portal/ads'),
    ad: (id) => request('GET', `/partners-portal/ads/${id}`),
    createAd: (payload) => request('POST', '/partners-portal/ads', payload),
    updateAd: (id, payload) => request('PATCH', `/partners-portal/ads/${id}`, payload),
    submitAd: (id) => request('POST', `/partners-portal/ads/${id}/submit-review`, {}),
    withdrawAd: (id) => request('POST', `/partners-portal/ads/${id}/withdraw`, {}),
    adStats: (id) => request('GET', `/partners-portal/ads/${id}/stats`),
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
