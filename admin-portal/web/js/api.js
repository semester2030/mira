(function () {
  const meta = document.querySelector('meta[name="mira-api-base"]');
  const API_BASE =
    (meta && meta.getAttribute('content')) ||
    'http://localhost:3000/api/v1';

  function adminKey() {
    return localStorage.getItem('mira_admin_key') || '';
  }

  async function request(method, path, body) {
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
      throw new Error(Array.isArray(msg) ? msg.join(' ') : String(msg));
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
  };
})();
