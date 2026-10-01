(function () {
  const meta = document.querySelector('meta[name="mira-api-base"]');
  const API_BASE = localApiBase(
    (meta && meta.getAttribute('content')) ||
    'http://localhost:3000/api/v1',
  );

  function localApiBase(fallback) {
    const override = new URLSearchParams(location.search).get('api-base');
    const localPage = location.hostname === '127.0.0.1' || location.hostname === 'localhost';
    if (localPage && override && /^https?:\/\/(127\.0\.0\.1|localhost):\d+(?:\/.*)?$/.test(override)) {
      return override.replace(/\/$/, '');
    }
    return fallback;
  }

  function adminKey() {
    return localStorage.getItem('mira_admin_key') || '';
  }

  function labeledPreview() {
    return new URLSearchParams(location.search).get('ui-fixture') === 'labeled';
  }

  async function request(method, path, body) {
    if (labeledPreview()) {
      throw new Error('محاكاة: لم يُرسل طلب ولم يُستخدم مفتاح الإدارة');
    }
    const key = adminKey();
    if (!key && path !== '/health') {
      throw new Error('أدخلي مفتاح الإدارة أولاً');
    }
    const res = await fetch(`${API_BASE}${path}`, {
      method,
      headers: {
        Accept: 'application/json',
        'X-Admin-Key': key,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = data.message || data.error || `HTTP ${res.status}`;
      const error = new Error(Array.isArray(msg) ? msg.join(' ') : String(msg));
      error.status = res.status;
      throw error;
    }
    return data;
  }

  window.MiraAdminApi = {
    base: API_BASE,
    setKey: (key) => localStorage.setItem('mira_admin_key', key),
    clearKey: () => localStorage.removeItem('mira_admin_key'),
    hasKey: () => !!adminKey(),
    verifyKey: () => request('GET', '/admin/stats/overview'),
    overview: () => request('GET', '/admin/stats/overview'),
    analysesTrend: (days) =>
      request('GET', `/admin/stats/analyses-trend?days=${days || 14}`),
    auditActions: () => request('GET', '/admin/stats/audit-actions'),
    users: (page, limit, search) => {
      const q = new URLSearchParams({ page: page || 1, limit: limit || 20 });
      if (search) q.set('search', search);
      return request('GET', `/admin/users?${q}`);
    },
    userDetail: (id) => request('GET', `/admin/users/${id}`),
    auditLogs: (page, limit, action, userId) => {
      const q = new URLSearchParams({ page: page || 1, limit: limit || 30 });
      if (action) q.set('action', action);
      if (userId) q.set('userId', userId);
      return request('GET', `/admin/audit-logs?${q}`);
    },
    feedback: (page, limit) =>
      request('GET', `/admin/feedback?page=${page || 1}&limit=${limit || 20}`),
    partners: (page, limit, status) => {
      const q = new URLSearchParams({ page: page || 1, limit: limit || 20 });
      if (status) q.set('status', status);
      return request('GET', `/admin/partners?${q}`);
    },
    partnerStatus: (id, status) =>
      request('PATCH', `/admin/partners/${id}/status`, { status }),
    applications: (status) =>
      request(
        'GET',
        `/admin/partners/applications?status=${encodeURIComponent(status || 'pending')}`,
      ),
    approveApplication: (id) =>
      request('POST', `/admin/partners/applications/${id}/approve`, {}),
    rejectApplication: (id, reason) =>
      request('POST', `/admin/partners/applications/${id}/reject`, { reason }),
    leads: (page, limit, type) => {
      const q = new URLSearchParams({ page: page || 1, limit: limit || 20 });
      if (type) q.set('type', type);
      return request('GET', `/admin/leads?${q}`);
    },
    systemConfig: () => request('GET', '/admin/system/config'),
    catalogReviews: () => request('GET', '/admin/catalog-reviews'),
    catalogPreview: (kind, id) => request('GET', `/admin/catalog-reviews/${kind}/${id}`),
    catalogDecision: (kind, id, decision, note, revision) =>
      request('POST', `/admin/catalog-reviews/${kind}/${id}/decision`, { decision, note, revision }),
    commerceOrders: (status, q) => {
      const params = new URLSearchParams({ limit: '50' });
      if (status) params.set('status', status);
      if (q) params.set('q', q);
      return request('GET', `/admin/commerce/orders?${params}`);
    },
    adReviews: () => request('GET', '/admin/catalog-ads'),
    adPreview: (id) => request('GET', `/admin/catalog-ads/${id}`),
    adDecision: (id, decision, note, revision) =>
      request('POST', `/admin/catalog-ads/${id}/decision`, { decision, note, revision }),
  };
})();
