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

  function requestProgress(method, path, body, hooks) {
    if (labeledPreview()) {
      return Promise.reject(new Error('محاكاة: لم يُرسل طلب ولم تُستخدم الجلسة'));
    }
    const notify = hooks || {};
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const fail = (error) => reject(error);
      if (notify.signal) {
        if (notify.signal.aborted) {
          fail(Object.assign(new Error('أُلغي الرفع'), { name: 'AbortError' }));
          return;
        }
        notify.signal.addEventListener('abort', () => xhr.abort(), { once: true });
      }
      xhr.open(method, `${API_BASE}${path}`);
      xhr.setRequestHeader('Accept', 'application/json');
      xhr.setRequestHeader('Content-Type', 'application/json');
      const headers = authHeaders();
      Object.keys(headers).forEach((key) => xhr.setRequestHeader(key, headers[key]));
      xhr.upload.onprogress = (event) => {
        if (typeof notify.onProgress !== 'function') return;
        if (event.lengthComputable && event.total > 0) notify.onProgress(event.loaded / event.total);
        else notify.onProgress(null);
      };
      xhr.upload.onload = () => {
        if (typeof notify.onProcessing === 'function') notify.onProcessing();
      };
      xhr.onabort = () => fail(Object.assign(new Error('أُلغي الرفع'), { name: 'AbortError' }));
      xhr.onerror = () => fail(new Error('تعذر الاتصال'));
      xhr.onload = () => {
        let data = {};
        try { data = JSON.parse(xhr.responseText || '{}'); } catch (error) { data = {}; }
        if (xhr.status < 200 || xhr.status >= 300) {
          const msg = data.message || data.error || `HTTP ${xhr.status}`;
          fail(new Error(Array.isArray(msg) ? msg.join(' ') : msg));
          return;
        }
        resolve(data);
      };
      xhr.send(JSON.stringify(body));
    });
  }

  window.PartnersApi = {
    base: API_BASE,
    apply: (payload) => request('POST', '/partners-portal/apply', payload),
    status: (token) =>
      request('GET', `/partners-portal/apply/status/${encodeURIComponent(token)}`),
    login: (email, password) =>
      request('POST', '/partners-portal/login', { email, password }),
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
    addMedia: (kind, id, mimeType, dataBase64, placement) =>
      request('POST', `/partners-portal/${kind}/${id}/media`, { mimeType, dataBase64, placement: placement || 'main' }),
    addMediaProgress: (kind, id, mimeType, dataBase64, hooks) =>
      requestProgress('POST', `/partners-portal/${kind}/${id}/media`, { mimeType, dataBase64, placement: (hooks && hooks.placement) || 'main' }, hooks),
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
    commerceOrders: (query) =>
      request('GET', `/partners/me/commerce/orders${query ? '?' + query : ''}`),
    commerceOrder: (id) => request('GET', `/partners/me/commerce/orders/${id}`),
    commerceOrderTransition: (id, body) =>
      request('POST', `/partners/me/commerce/orders/${id}/transition`, body),
    commerceCollectPayment: (id, body) =>
      request('POST', `/partners/me/commerce/orders/${id}/collect-payment`, body || {}),
    commerceBookings: (query) =>
      request('GET', `/partners/me/commerce/bookings${query ? '?' + query : ''}`),
    commerceBookingTransition: (id, body) =>
      request('POST', `/partners/me/commerce/bookings/${id}/transition`, body),
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
