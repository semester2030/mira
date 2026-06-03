/**
 * Mira public website → mira-api
 * Override: <meta name="mira-api-base" content="https://your-api.onrender.com/api/v1" />
 */
(function () {
  const meta = document.querySelector('meta[name="mira-api-base"]');
  const API_BASE =
    (meta && meta.getAttribute('content')) ||
    'https://mira-api-n4p3.onrender.com/api/v1';

  async function get(path) {
    const res = await fetch(`${API_BASE}${path}`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  async function post(path, body) {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = data.message || data.error || `HTTP ${res.status}`;
      throw new Error(Array.isArray(msg) ? msg.join(' ') : msg);
    }
    return data;
  }

  window.MiraApi = {
    base: API_BASE,
    health: () => get('/health'),
    features: () => get('/website/features'),
    stats: () => get('/website/stats'),
    partnersPreview: (type) =>
      get(`/website/partners-preview${type ? `?type=${encodeURIComponent(type)}` : ''}`),
    submitLead: (payload) => post('/website/leads', payload),
  };
})();
