(function () {
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => [...(root || document).querySelectorAll(sel)];

  document.getElementById('year').textContent = new Date().getFullYear();

  // Mobile nav
  const toggle = $('#menuToggle');
  const nav = $('#mainNav');
  if (toggle && nav) {
    toggle.addEventListener('click', () => nav.classList.toggle('open'));
    $$('.main-nav a').forEach((a) =>
      a.addEventListener('click', () => nav.classList.remove('open')),
    );
  }

  const statusEl = $('#apiStatus');
  async function loadStatus() {
    if (!window.MiraApi || !statusEl) return;
    try {
      await MiraApi.health();
      statusEl.classList.add('ok');
      statusEl.innerHTML = '<span class="dot"></span> API متصل';
    } catch {
      statusEl.classList.add('err');
      statusEl.innerHTML = '<span class="dot"></span> API غير متاح';
    }
  }

  async function loadStats() {
    if (!window.MiraApi) return;
    try {
      const s = await MiraApi.stats();
      $$('[data-stat]').forEach((el) => {
        const key = el.getAttribute('data-stat');
        if (s[key] != null) el.textContent = s[key];
      });
    } catch (_) {
      /* keep placeholders */
    }
  }

  function renderFeatures(features) {
    const grid = $('#featuresGrid');
    if (!grid) return;
    grid.innerHTML = features
      .map(
        (f) => `
      <article class="feature-card">
        <span class="feature-icon">${f.icon}</span>
        <span class="tag ${f.status}">${f.status === 'live' ? 'متاح' : f.status === 'beta' ? 'تجريبي' : 'قريباً'}</span>
        <h3>${f.titleAr}</h3>
        <p>${f.summaryAr}</p>
        <ul>${f.bulletsAr.map((b) => `<li>${b}</li>`).join('')}</ul>
      </article>`,
      )
      .join('');
  }

  async function loadFeatures() {
    if (!window.MiraApi) return;
    try {
      const data = await MiraApi.features();
      renderFeatures(data.features || []);
    } catch {
      $('#featuresGrid').innerHTML =
        '<p style="grid-column:1/-1;text-align:center;color:var(--muted)">تعذّر تحميل المميزات — تحققي من اتصال API.</p>';
    }
  }

  async function loadPartners(type) {
    const grid = $('#partnersGrid');
    if (!grid || !window.MiraApi) return;
    grid.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:var(--muted)">جاري التحميل…</p>';
    try {
      const list = await MiraApi.partnersPreview(type || undefined);
      if (!list.length) {
        grid.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:var(--muted)">لا شركاء في هذه الفئة بعد.</p>';
        return;
      }
      grid.innerHTML = list
        .map(
          (p) => `
        <article class="partner-card">
          <div class="emoji">${p.logoEmoji || '✨'}</div>
          <h4>${p.nameAr}</h4>
          <p>${p.type === 'brand' ? 'ماركة' : p.type === 'clinic' ? 'عيادة' : 'صالون'} · ${p.city || 'الرياض'}</p>
        </article>`,
        )
        .join('');
    } catch {
      grid.innerHTML =
        '<p style="grid-column:1/-1;text-align:center;color:var(--muted)">تعذّر تحميل الشركاء.</p>';
    }
  }

  $$('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      $$('.tab-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      loadPartners(btn.getAttribute('data-type') || '');
    });
  });

  const form = $('#contactForm');
  const formMsg = $('#formMsg');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      formMsg.hidden = true;
      const fd = new FormData(form);
      const payload = {
        name: fd.get('name'),
        email: fd.get('email'),
        phone: fd.get('phone') || undefined,
        type: fd.get('type') || 'contact',
        message: fd.get('message'),
      };
      try {
        const res = await MiraApi.submitLead(payload);
        formMsg.textContent = res.message || 'تم الإرسال بنجاح';
        formMsg.className = 'form-msg ok';
        formMsg.hidden = false;
        form.reset();
      } catch (err) {
        formMsg.textContent = err.message || 'فشل الإرسال';
        formMsg.className = 'form-msg err';
        formMsg.hidden = false;
      }
    });
  }

  loadStatus();
  loadStats();
  loadFeatures();
  loadPartners('');
})();
