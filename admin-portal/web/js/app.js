(function () {
  const VIEWS = {
    dashboard: { title: 'لوحة التحكم', subtitle: 'نظرة شاملة على التطبيق' },
    users: { title: 'المستخدمات', subtitle: 'إدارة ومتابعة حسابات المستخدمات' },
    audit: { title: 'سجل التدقيق', subtitle: 'جميع الأحداث المسجّلة' },
    feedback: { title: 'التقييمات', subtitle: 'آراء وتقييمات المستخدمات' },
    applications: { title: 'طلبات الشركاء', subtitle: 'اعتماد ورفض طلبات الانضمام' },
    reviews: { title: 'مراجعة المحتوى', subtitle: 'نشر أو رفض محتوى المنتجات والخدمات' },
    ads: { title: 'مراجعة الإعلانات', subtitle: 'اعتماد النسخة المعروضة فقط' },
    orders: { title: 'الطلبات والحجوزات', subtitle: 'متابعة COD والتحصيل والحجوزات مع سبب لكل تدخل' },
    partners: { title: 'الشركاء', subtitle: 'إدارة حالة الشركاء النشطين' },
    leads: { title: 'رسائل الموقع', subtitle: 'Leads من الموقع التعريفي' },
    system: { title: 'النظام', subtitle: 'Providers · Feature flags · Security' },
  };

  const state = {
    view: 'dashboard',
    usersPage: 1,
    usersSearch: '',
    auditPage: 1,
    auditAction: '',
    feedbackPage: 1,
    partnersPage: 1,
    partnersStatus: '',
    leadsPage: 1,
    appStatus: 'pending',
    ordersStatus: '',
    ordersQuery: '',
  };

  const $ = (sel) => document.querySelector(sel);
  const root = $('#viewRoot');
  const loginScreen = $('#loginScreen');
  const appShell = $('#appShell');
  const loginError = $('#loginError');
  const adminKeyInput = $('#adminKey');

  function fmtDate(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('ar-SA', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  }

  function fmtShortDate(iso) {
    if (!iso) return '';
    return iso.slice(5).replace('-', '/');
  }

  function badgeStatus(status) {
    const map = {
      active: 'ok',
      pending: 'warn',
      suspended: 'err',
      approved: 'ok',
      rejected: 'err',
      premium: 'purple',
      free: 'purple',
    };
    const cls = map[status] || 'purple';
    return `<span class="badge ${cls}">${status}</span>`;
  }

  function loading() {
    return '<div class="loading"><div class="spinner"></div></div>';
  }

  function showError(el, msg) {
    el.textContent = msg;
    el.classList.remove('hidden');
  }

  function hideError(el) {
    el.classList.add('hidden');
  }

  async function tryAutoLogin() {
    if (!MiraAdminApi.hasKey()) return false;
    try {
      await MiraAdminApi.verifyKey();
      return true;
    } catch {
      MiraAdminApi.clearKey();
      return false;
    }
  }

  function showApp() {
    loginScreen.classList.add('hidden');
    appShell.classList.remove('hidden');
  }

  function showLogin() {
    appShell.classList.add('hidden');
    loginScreen.classList.remove('hidden');
  }

  async function login() {
    const key = adminKeyInput.value.trim();
    if (!key) {
      showError(loginError, 'أدخلي مفتاح الإدارة');
      return;
    }
    hideError(loginError);
    MiraAdminApi.setKey(key);
    try {
      await MiraAdminApi.verifyKey();
      showApp();
      navigate('dashboard');
    } catch (e) {
      MiraAdminApi.clearKey();
      showError(loginError, e.message);
    }
  }

  function setActiveNav(view) {
    document.querySelectorAll('.nav-item[data-view]').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.view === view);
    });
    $('#pageTitle').textContent = VIEWS[view].title;
    $('#pageSubtitle').textContent = VIEWS[view].subtitle;
  }

  function navigate(view) {
    state.view = view;
    setActiveNav(view);
    $('#sidebar').classList.remove('open');
    $('#menuToggle').setAttribute('aria-expanded', 'false');
    render();
  }

  function pagination(page, totalPages, onPage) {
    if (totalPages <= 1) return '';
    return `
      <div class="pagination">
        <button class="btn btn-ghost btn-sm" data-page="${page - 1}" ${page <= 1 ? 'disabled' : ''}>السابق</button>
        <span>${page} / ${totalPages}</span>
        <button class="btn btn-ghost btn-sm" data-page="${page + 1}" ${page >= totalPages ? 'disabled' : ''}>التالي</button>
      </div>`;
  }

  function bindPagination(container, current, callback) {
    container.querySelectorAll('[data-page]').forEach((btn) => {
      btn.onclick = () => {
        const p = Number(btn.dataset.page);
        if (p >= 1) callback(p);
      };
    });
  }

  function renderChart(series) {
    const max = Math.max(
      1,
      ...series.map((d) => d.skin + d.outfit + d.recommendations),
    );
    return series
      .map((d) => {
        const total = d.skin + d.outfit + d.recommendations;
        const h = Math.round((total / max) * 140);
        const hs = total ? Math.round((d.skin / total) * h) : 0;
        const ho = total ? Math.round((d.outfit / total) * h) : 0;
        const hr = Math.max(0, h - hs - ho);
        return `
          <div class="chart-col">
            <div class="chart-stack" style="height:${Math.max(h, 8)}px">
              ${hr ? `<div class="chart-seg rec" style="height:${hr}px"></div>` : ''}
              ${ho ? `<div class="chart-seg outfit" style="height:${ho}px"></div>` : ''}
              ${hs ? `<div class="chart-seg skin" style="height:${hs}px"></div>` : ''}
            </div>
            <div class="chart-label">${fmtShortDate(d.date)}</div>
          </div>`;
      })
      .join('');
  }

  async function renderDashboard() {
    root.innerHTML = loading();
    try {
      const [overview, trend, actions] = await Promise.all([
        MiraAdminApi.overview(),
        MiraAdminApi.analysesTrend(14),
        MiraAdminApi.auditActions(),
      ]);

      root.innerHTML = `
        <div class="grid-stats">
          <div class="stat-card">
            <div class="label">إجمالي المستخدمات</div>
            <div class="value">${overview.users.total}</div>
            <div class="sub">+${overview.users.newToday} اليوم · +${overview.users.newThisWeek} هذا الأسبوع</div>
          </div>
          <div class="stat-card">
            <div class="label">تحليلات اليوم</div>
            <div class="value">${overview.analyses.totalToday}</div>
            <div class="sub">بشرة ${overview.analyses.skinToday} · إطلالة ${overview.analyses.outfitToday} · توصيات ${overview.analyses.recommendationsToday}</div>
          </div>
          <div class="stat-card">
            <div class="label">الاشتراكات</div>
            <div class="value">${overview.subscriptions.premiumActive}</div>
            <div class="sub">Premium · Free ${overview.subscriptions.freeActive} · ${overview.subscriptions.enabled ? 'مفعّل' : 'معطّل'}</div>
          </div>
          <div class="stat-card">
            <div class="label">الشركاء</div>
            <div class="value">${overview.partners.active}</div>
            <div class="sub">${overview.partners.pendingApplications} طلب معلّق · ${overview.partners.eventsThisWeek} حدث/أسبوع</div>
          </div>
          <div class="stat-card">
            <div class="label">التقييمات</div>
            <div class="value">${overview.feedback.total}</div>
            <div class="sub">${overview.feedback.needsAttention} تحتاج متابعة</div>
          </div>
          <div class="stat-card">
            <div class="label">Leads الموقع</div>
            <div class="value">${overview.leads.total}</div>
            <div class="sub">${overview.auditEventsToday} حدث audit اليوم</div>
          </div>
        </div>

        <div class="panel">
          <div class="panel-head"><h3>اتجاه التحليلات — 14 يوم</h3></div>
          <div class="chart-bars">${renderChart(trend.series)}</div>
          <div class="legend">
            <span class="l-skin">بشرة</span>
            <span class="l-outfit">إطلالة</span>
            <span class="l-rec">توصيات</span>
          </div>
        </div>

        <div class="panel">
          <div class="panel-head"><h3>أكثر أحداث Audit (30 يوم)</h3></div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>الحدث</th><th>العدد</th></tr></thead>
              <tbody>
                ${actions.length ? actions.map((a) => `<tr><td><code>${a.action}</code></td><td>${a.count}</td></tr>`).join('') : '<tr><td colspan="2" class="empty">لا بيانات</td></tr>'}
              </tbody>
            </table>
          </div>
        </div>`;
    } catch (e) {
      root.innerHTML = `<div class="alert err">${e.message}</div>`;
    }
  }

  async function openUserDrawer(id) {
    const backdrop = document.createElement('div');
    backdrop.className = 'drawer-backdrop';
    const drawer = document.createElement('div');
    drawer.className = 'drawer';
    drawer.innerHTML = loading();
    document.body.append(backdrop, drawer);
    backdrop.onclick = () => { backdrop.remove(); drawer.remove(); };

    try {
      const data = await MiraAdminApi.userDetail(id);
      const u = data.user;
      drawer.innerHTML = `
        <button class="btn btn-ghost btn-sm drawer-close" id="closeDrawer">✕</button>
        <h3 style="margin-top:0">${u.displayName || 'مستخدمة'}</h3>
        <p style="color:var(--text-muted)">${u.email || '—'}</p>
        <div class="detail-grid" style="margin:1rem 0">
          <div class="detail-item"><div class="k">UID</div><div class="v">${u.id}</div></div>
          <div class="detail-item"><div class="k">Firebase</div><div class="v">${u.firebaseUid}</div></div>
          <div class="detail-item"><div class="k">الخطة</div><div class="v">${u.subscription?.plan || 'free'}</div></div>
          <div class="detail-item"><div class="k">بشرة</div><div class="v">${u.counts.skinAnalyses}</div></div>
          <div class="detail-item"><div class="k">إطلالة</div><div class="v">${u.counts.outfitAnalyses}</div></div>
          <div class="detail-item"><div class="k">توصيات</div><div class="v">${u.counts.recommendations}</div></div>
        </div>
        <h4>آخر Audit</h4>
        <div class="table-wrap"><table>
          <thead><tr><th>حدث</th><th>تاريخ</th></tr></thead>
          <tbody>${data.recentAudit.map((a) => `<tr><td><code>${a.action}</code></td><td>${fmtDate(a.createdAt)}</td></tr>`).join('') || '<tr><td colspan="2">—</td></tr>'}</tbody>
        </table></div>`;
      drawer.querySelector('#closeDrawer').onclick = () => { backdrop.remove(); drawer.remove(); };
    } catch (e) {
      drawer.innerHTML = `<div class="alert err">${e.message}</div>`;
    }
  }

  async function renderUsers() {
    root.innerHTML = loading();
    try {
      const data = await MiraAdminApi.users(state.usersPage, 20, state.usersSearch);
      root.innerHTML = `
        <div class="toolbar">
          <input id="userSearch" placeholder="بحث: email أو اسم..." value="${state.usersSearch}" />
          <button class="btn btn-primary btn-sm" id="userSearchBtn">بحث</button>
        </div>
        <div class="panel">
          <div class="table-wrap">
            <table>
              <thead><tr><th>الاسم</th><th>البريد</th><th>الخطة</th><th>تحليلات</th><th>تاريخ</th><th></th></tr></thead>
              <tbody>
                ${data.items.map((u) => `
                  <tr>
                    <td>${u.displayName || '—'}</td>
                    <td>${u.email || '—'}</td>
                    <td>${badgeStatus(u.plan)}</td>
                    <td>${u.counts.skinAnalyses + u.counts.outfitAnalyses}</td>
                    <td>${fmtDate(u.createdAt)}</td>
                    <td><button class="btn btn-ghost btn-sm" data-user="${u.id}">تفاصيل</button></td>
                  </tr>`).join('') || '<tr><td colspan="6" class="empty">لا مستخدمات</td></tr>'}
              </tbody>
            </table>
          </div>
          ${pagination(data.page, data.totalPages, '')}
        </div>`;

      $('#userSearchBtn').onclick = () => {
        state.usersSearch = $('#userSearch').value.trim();
        state.usersPage = 1;
        renderUsers();
      };
      root.querySelectorAll('[data-user]').forEach((btn) => {
        btn.onclick = () => openUserDrawer(btn.dataset.user);
      });
      bindPagination(root, data.page, (p) => {
        state.usersPage = p;
        renderUsers();
      });
    } catch (e) {
      root.innerHTML = `<div class="alert err">${e.message}</div>`;
    }
  }

  async function renderAudit() {
    root.innerHTML = loading();
    try {
      const data = await MiraAdminApi.auditLogs(state.auditPage, 30, state.auditAction);
      root.innerHTML = `
        <div class="toolbar">
          <input id="auditFilter" placeholder="فلتر action..." value="${state.auditAction}" />
          <button class="btn btn-primary btn-sm" id="auditFilterBtn">تطبيق</button>
        </div>
        <div class="panel">
          <div class="table-wrap">
            <table>
              <thead><tr><th>الحدث</th><th>مستخدم</th><th>metadata</th><th>التاريخ</th></tr></thead>
              <tbody>
                ${data.items.map((a) => `
                  <tr>
                    <td><code>${a.action}</code></td>
                    <td>${a.user?.email || a.userId || '—'}</td>
                    <td><small>${a.metadata ? JSON.stringify(a.metadata).slice(0, 80) : '—'}</small></td>
                    <td>${fmtDate(a.createdAt)}</td>
                  </tr>`).join('') || '<tr><td colspan="4" class="empty">لا سجلات</td></tr>'}
              </tbody>
            </table>
          </div>
          ${pagination(data.page, data.totalPages, '')}
        </div>`;
      $('#auditFilterBtn').onclick = () => {
        state.auditAction = $('#auditFilter').value.trim();
        state.auditPage = 1;
        renderAudit();
      };
      bindPagination(root, data.page, (p) => {
        state.auditPage = p;
        renderAudit();
      });
    } catch (e) {
      root.innerHTML = `<div class="alert err">${e.message}</div>`;
    }
  }

  async function renderFeedback() {
    root.innerHTML = loading();
    try {
      const data = await MiraAdminApi.feedback(state.feedbackPage);
      root.innerHTML = `
        <div class="panel">
          <div class="table-wrap">
            <table>
              <thead><tr><th>التقييم</th><th>الهدف</th><th>التعليق</th><th>مستخدم</th><th>التاريخ</th></tr></thead>
              <tbody>
                ${data.items.map((f) => `
                  <tr>
                    <td>${f.rating != null ? '★'.repeat(f.rating) : '—'}</td>
                    <td>${f.target}</td>
                    <td>${f.comment || '—'}</td>
                    <td>${f.user?.email || '—'}</td>
                    <td>${fmtDate(f.createdAt)}</td>
                  </tr>`).join('') || '<tr><td colspan="5" class="empty">لا تقييمات</td></tr>'}
              </tbody>
            </table>
          </div>
          ${pagination(data.page, data.totalPages, '')}
        </div>`;
      bindPagination(root, data.page, (p) => {
        state.feedbackPage = p;
        renderFeedback();
      });
    } catch (e) {
      root.innerHTML = `<div class="alert err">${e.message}</div>`;
    }
  }

  async function renderApplications() {
    root.innerHTML = loading();
    try {
      const apps = await MiraAdminApi.applications(state.appStatus);
      root.innerHTML = `
        <div class="toolbar">
          <select id="appStatus">
            <option value="pending" ${state.appStatus === 'pending' ? 'selected' : ''}>معلّق</option>
            <option value="approved" ${state.appStatus === 'approved' ? 'selected' : ''}>معتمد</option>
            <option value="rejected" ${state.appStatus === 'rejected' ? 'selected' : ''}>مرفوض</option>
          </select>
        </div>
        <div id="appsList">
          ${apps.length ? apps.map((a) => `
            <div class="panel" data-app="${a.id}">
              <div class="panel-head">
                <div><strong>${a.nameAr}</strong> <span class="badge purple">${a.type}</span></div>
                ${badgeStatus(a.status)}
              </div>
              <p>${a.contactName} · ${a.contactEmail} · ${a.contactPhone} · ${a.city}</p>
              ${a.message ? `<p style="color:var(--text-muted)">${a.message}</p>` : ''}
              ${a.status === 'pending' ? `
                <div style="display:flex;gap:0.5rem;margin-top:0.75rem">
                  <button class="btn btn-primary btn-sm approve">اعتماد</button>
                  <button class="btn btn-danger btn-sm reject">رفض</button>
                </div>` : ''}
              <div class="app-result hidden"></div>
            </div>`).join('') : '<div class="empty panel">لا طلبات</div>'}
        </div>`;

      $('#appStatus').onchange = (e) => {
        state.appStatus = e.target.value;
        renderApplications();
      };

      root.querySelectorAll('.approve').forEach((btn) => {
        btn.onclick = async () => {
          const panel = btn.closest('[data-app]');
          const id = panel.dataset.app;
          btn.disabled = true;
          try {
            const res = await MiraAdminApi.approveApplication(id);
            panel.querySelector('.app-result').className = 'alert ok';
            panel.querySelector('.app-result').textContent = `تم الاعتماد — token: ${res.accessToken?.slice(0, 12)}...`;
            renderApplications();
          } catch (e) {
            panel.querySelector('.app-result').className = 'alert err';
            panel.querySelector('.app-result').textContent = e.message;
          }
        };
      });

      root.querySelectorAll('.reject').forEach((btn) => {
        btn.onclick = async () => {
          const reason = prompt('سبب الرفض (اختياري):') || '';
          const panel = btn.closest('[data-app]');
          try {
            await MiraAdminApi.rejectApplication(panel.dataset.app, reason);
            renderApplications();
          } catch (e) {
            alert(e.message);
          }
        };
      });
    } catch (e) {
      root.innerHTML = `<div class="alert err">${e.message}</div>`;
    }
  }

  async function renderPartners() {
    root.innerHTML = loading();
    try {
      const data = await MiraAdminApi.partners(state.partnersPage, 20, state.partnersStatus || undefined);
      root.innerHTML = `
        <div class="toolbar">
          <select id="partnerStatus">
            <option value="">الكل</option>
            <option value="active">active</option>
            <option value="suspended">suspended</option>
          </select>
        </div>
        <div class="panel">
          <div class="table-wrap">
            <table>
              <thead><tr><th>الاسم</th><th>النوع</th><th>الحالة</th><th>المدينة</th><th>كتalog</th><th>إجراء</th></tr></thead>
              <tbody>
                ${data.items.map((p) => `
                  <tr>
                    <td>${p.nameAr}</td>
                    <td>${p.type}</td>
                    <td>${badgeStatus(p.status)}</td>
                    <td>${p.city}</td>
                    <td>${p.counts.products}P · ${p.counts.services}S</td>
                    <td>
                      ${p.status === 'active'
                        ? `<button class="btn btn-danger btn-sm" data-suspend="${p.id}">تعليق</button>`
                        : `<button class="btn btn-primary btn-sm" data-activate="${p.id}">تفعيل</button>`}
                    </td>
                  </tr>`).join('') || '<tr><td colspan="6" class="empty">لا شركاء</td></tr>'}
              </tbody>
            </table>
          </div>
          ${pagination(data.page, data.totalPages, '')}
        </div>`;

      $('#partnerStatus').value = state.partnersStatus;
      $('#partnerStatus').onchange = (e) => {
        state.partnersStatus = e.target.value;
        state.partnersPage = 1;
        renderPartners();
      };

      root.querySelectorAll('[data-suspend]').forEach((btn) => {
        btn.onclick = async () => {
          if (!confirm('تعليق هذا الشريك؟')) return;
          await MiraAdminApi.partnerStatus(btn.dataset.suspend, 'suspended');
          renderPartners();
        };
      });
      root.querySelectorAll('[data-activate]').forEach((btn) => {
        btn.onclick = async () => {
          await MiraAdminApi.partnerStatus(btn.dataset.activate, 'active');
          renderPartners();
        };
      });
      bindPagination(root, data.page, (p) => {
        state.partnersPage = p;
        renderPartners();
      });
    } catch (e) {
      root.innerHTML = `<div class="alert err">${e.message}</div>`;
    }
  }

  async function renderLeads() {
    root.innerHTML = loading();
    try {
      const data = await MiraAdminApi.leads(state.leadsPage);
      root.innerHTML = `
        <div class="panel">
          <div class="table-wrap">
            <table>
              <thead><tr><th>الاسم</th><th>البريد</th><th>النوع</th><th>الرسالة</th><th>التاريخ</th></tr></thead>
              <tbody>
                ${data.items.map((l) => `
                  <tr>
                    <td>${l.name}</td>
                    <td>${l.email}</td>
                    <td><span class="badge purple">${l.type}</span></td>
                    <td>${l.message.slice(0, 100)}${l.message.length > 100 ? '…' : ''}</td>
                    <td>${fmtDate(l.createdAt)}</td>
                  </tr>`).join('') || '<tr><td colspan="5" class="empty">لا رسائل</td></tr>'}
              </tbody>
            </table>
          </div>
          ${pagination(data.page, data.totalPages, '')}
        </div>`;
      bindPagination(root, data.page, (p) => {
        state.leadsPage = p;
        renderLeads();
      });
    } catch (e) {
      root.innerHTML = `<div class="alert err">${e.message}</div>`;
    }
  }

  async function renderSystem() {
    root.innerHTML = loading();
    try {
      const cfg = await MiraAdminApi.systemConfig();
      root.innerHTML = `
        <div class="grid-stats">
          <div class="stat-card"><div class="label">Skin Provider</div><div class="value" style="font-size:1.2rem">${cfg.providers.skinProvider}</div></div>
          <div class="stat-card"><div class="label">Outfit Provider</div><div class="value" style="font-size:1.2rem">${cfg.providers.outfitProvider}</div></div>
          <div class="stat-card"><div class="label">YouCam Key</div><div class="value" style="font-size:1.2rem">${cfg.providers.perfectCorpKeySet ? '✓' : '✗'}</div></div>
          <div class="stat-card"><div class="label">Vision Key</div><div class="value" style="font-size:1.2rem">${cfg.providers.googleVisionKeySet ? '✓' : '✗'}</div></div>
        </div>
        <div class="panel">
          <h3>Feature Flags (env)</h3>
          <div class="detail-grid">
            <div class="detail-item"><div class="k">Subscriptions</div><div class="v">${cfg.features.subscriptionsEnabled ? 'مفعّل' : 'معطّل'}</div></div>
            <div class="detail-item"><div class="k">Partner Auto Approve</div><div class="v">${cfg.features.partnerAutoApprove ? 'نعم' : 'لا'}</div></div>
            <div class="detail-item"><div class="k">Auth Skip</div><div class="v">${cfg.features.authSkip ? '⚠ نعم' : 'لا'}</div></div>
            <div class="detail-item"><div class="k">Rate Limit/h</div><div class="v">${cfg.features.rateLimitPerHour}</div></div>
            <div class="detail-item"><div class="k">Fallback Mock</div><div class="v">${cfg.providers.perfectCorpFallbackMock ? 'نعم' : 'لا'}</div></div>
            <div class="detail-item"><div class="k">Admin Key</div><div class="v">${cfg.security.adminKeyConfigured ? '✓ مضبوط' : '✗ غير مضبوط'}</div></div>
          </div>
          <p style="color:var(--text-muted);font-size:0.85rem;margin-top:1rem">Environment: ${cfg.environment} · ${fmtDate(cfg.timestamp)}</p>
        </div>`;
    } catch (e) {
      root.innerHTML = `<div class="alert err">${e.message}</div>`;
    }
  }

  function reviewText(parent, value, tag) {
    const node = document.createElement(tag || 'p');
    node.textContent = value == null ? '' : String(value);
    parent.appendChild(node);
    return node;
  }

  function summarizeOptions(json) {
    if (json == null) return 'لا خيارات';
    if (!Array.isArray(json) || !json.length) return 'فارغة';
    return json.map((group) => {
      const values = (group.values || []).map((v) => v.labelAr || v.id).join('، ');
      return (group.labelAr || group.id) + (values ? ': ' + values : '');
    }).join(' · ');
  }

  function summarizeVariants(json) {
    if (json == null) return 'لا تركيبات';
    if (!Array.isArray(json) || !json.length) return 'فارغة';
    return json.map((variant) => {
      const sel = variant.selections ? Object.values(variant.selections).join('/') : variant.id;
      const price = variant.priceHalalas != null ? ' (' + (variant.priceHalalas / 100) + ' ر.س)' : '';
      const avail = variant.available === false ? ' غير متاحة' : '';
      return sel + price + avail;
    }).join(' · ');
  }

  async function renderReviews() {
    root.replaceChildren();
    reviewText(root, 'جارٍ تحميل المراجعة');
    try {
      const data = await MiraAdminApi.catalogReviews();
      const items = data.items || [];
      root.replaceChildren();
      if (!items.length) {
        const panel = document.createElement('div');
        panel.className = 'panel';
        reviewText(panel, 'لا محتوى بانتظار المراجعة.');
        root.appendChild(panel);
        return;
      }
      for (const item of items) {
        const panel = document.createElement('article');
        panel.className = 'panel';
        reviewText(panel, item.kind === 'service' ? 'خدمة' : 'منتج', 'h3');
        reviewText(panel, item.nameAr);
        reviewText(panel, 'السعر بالهللة: ' + item.priceHalalas);
        const detail = document.createElement('div');
        const status = reviewText(panel, '');
        const previewButton = document.createElement('button');
        previewButton.className = 'btn btn-ghost btn-sm';
        previewButton.textContent = 'معاينة';
        const approve = document.createElement('button');
        approve.className = 'btn btn-primary btn-sm';
        approve.textContent = 'اعتماد';
        const reject = document.createElement('button');
        reject.className = 'btn btn-ghost btn-sm';
        reject.textContent = 'رفض';
        panel.append(previewButton, approve, reject, detail);
        root.appendChild(panel);
        const blobUrls = [];
        let shownRevision = null;
        let previewReady = false;
        approve.disabled = true;
        reject.disabled = true;
        function releaseBlobs() {
          while (blobUrls.length) URL.revokeObjectURL(blobUrls.pop());
        }
        async function show() {
          previewReady = false;
          approve.disabled = true;
          reject.disabled = true;
          releaseBlobs();
          detail.replaceChildren();
          status.textContent = 'جارٍ تحميل المعاينة';
          const preview = await MiraAdminApi.catalogPreview(item.kind, item.id);
          if (preview.submittedRevision == null) throw new Error('تعذرت معاينة النسخة المطلوبة');
          shownRevision = preview.submittedRevision;
          reviewText(detail, 'المنشور: ' + (preview.publishedNameAr || ''));
          reviewText(detail, 'التعديل المطلوب: ' + (preview.draftNameAr || 'لا تعديل على الاسم'));
          reviewText(detail, 'الإنجليزية المنشورة: ' + (preview.publishedNameEn || ''));
          reviewText(detail, 'مسودة الإنجليزية: ' + (preview.draftNameEn || 'لا تعديل'));
          reviewText(detail, preview.draftDescriptionAr === '' ? 'المسودة تطلب مسح الوصف' : 'وصف المسودة: ' + (preview.draftDescriptionAr || 'لا تعديل على الوصف'));
          reviewText(detail, 'الوصف المنشور: ' + (preview.publishedDescriptionAr || ''));
          if (item.kind === 'product') {
            reviewText(detail, 'خيارات منشورة: ' + summarizeOptions(preview.publishedOptionsJson));
            if (preview.draftOptionsCleared) reviewText(detail, 'مسودة الخيارات: طلب مسح الخيارات المنشورة');
            else if (preview.draftOptionsJson !== undefined) reviewText(detail, 'مسودة الخيارات: ' + summarizeOptions(preview.draftOptionsJson));
            else reviewText(detail, 'مسودة الخيارات: لا تغيير');
            reviewText(detail, 'تركيبات منشورة: ' + summarizeVariants(preview.publishedVariantsJson));
            if (preview.draftVariantsCleared) reviewText(detail, 'مسودة التركيبات: طلب مسح التركيبات المنشورة');
            else if (preview.draftVariantsJson !== undefined) reviewText(detail, 'مسودة التركيبات: ' + summarizeVariants(preview.draftVariantsJson));
            else reviewText(detail, 'مسودة التركيبات: لا تغيير');
          }
          reviewText(detail, 'رقم النسخة المعروضة: ' + shownRevision);
          let mediaFailed = false;
          for (const media of preview.media || []) {
            const row = document.createElement('div');
            const primary = media.draftIsPrimary == null ? media.isPrimary : media.draftIsPrimary;
            reviewText(row, (media.kind === 'video' ? 'فيديو' : 'صورة') + (primary ? ' · رئيسي' : '') + (media.pendingRemoval ? ' · طلب إزالة' : ''));
            const response = await fetch(MiraAdminApi.base + '/admin/catalog-review-media/' + media.id, {
              headers: { 'X-Admin-Key': localStorage.getItem('mira_admin_key') || '' },
            });
            if (response.ok) {
              const view = document.createElement(media.kind === 'video' ? 'video' : 'img');
              const objectUrl = URL.createObjectURL(await response.blob());
              blobUrls.push(objectUrl);
              view.src = objectUrl;
              if (media.kind === 'video') view.controls = true;
              view.style.maxWidth = '220px';
              view.style.maxHeight = '220px';
              row.appendChild(view);
            } else {
              mediaFailed = true;
              reviewText(row, 'تعذر عرض الوسيط');
            }
            detail.appendChild(row);
          }
          if (mediaFailed) {
            status.textContent = 'تعذرت معاينة وسيط. لا يمكن اعتماد هذه النسخة قبل إعادة المعاينة.';
            return;
          }
          previewReady = true;
          approve.disabled = false;
          reject.disabled = false;
          status.textContent = 'المعاينة جاهزة. القرار يخص هذه النسخة فقط.';
        }
        function staleDecision(error) {
          previewReady = false;
          shownRevision = null;
          approve.disabled = true;
          reject.disabled = true;
          status.textContent = error.status === 409
            ? 'تغير المحتوى بعد المعاينة. أعيدي المعاينة ثم اضغطي القرار من جديد.'
            : 'تعذر القرار: ' + error.message;
        }
        previewButton.onclick = () => show().catch((error) => { status.textContent = error.message; });
        approve.onclick = async () => {
          if (!previewReady || shownRevision == null) {
            status.textContent = 'عايني النسخة أولًا. التحديث لا يعتمدها تلقائيًا.';
            return;
          }
          const revision = shownRevision;
          status.textContent = 'جارٍ الاعتماد';
          approve.disabled = true;
          reject.disabled = true;
          try {
            await MiraAdminApi.catalogDecision(item.kind, item.id, 'approve', '', revision);
            status.textContent = 'تم الاعتماد';
            releaseBlobs();
            renderReviews();
          } catch (error) {
            staleDecision(error);
          }
        };
        reject.onclick = async () => {
          if (!previewReady || shownRevision == null) {
            status.textContent = 'عايني النسخة أولًا. التحديث لا يرفضها تلقائيًا.';
            return;
          }
          const revision = shownRevision;
          const note = prompt('سبب الرفض أو طلب التعديل') || 'يحتاج تعديلًا';
          status.textContent = 'جارٍ الرفض';
          approve.disabled = true;
          reject.disabled = true;
          try {
            await MiraAdminApi.catalogDecision(item.kind, item.id, 'reject', note, revision);
            status.textContent = 'تم الرفض';
            releaseBlobs();
            renderReviews();
          } catch (error) {
            staleDecision(error);
          }
        };
        show().catch((error) => { status.textContent = error.message; });
      }
    } catch (error) {
      root.replaceChildren();
      const alert = document.createElement('div');
      alert.className = 'alert err';
      alert.textContent = error.message;
      root.appendChild(alert);
    }
  }

  const ORDER_STATUS_LABELS = {
    new: 'جديد',
    accepted: 'مقبول',
    preparing: 'قيد التجهيز',
    out_for_delivery: 'في الطريق',
    delivered: 'تم التسليم',
    rejected: 'مرفوض',
    cancelled: 'ملغي',
    failed_delivery: 'تعذر التسليم',
  };
  const PAYMENT_STATUS_LABELS = { uncollected: 'لم يُحصَّل', collected: 'حُصِّل', waived: 'أُعفي' };

  const BOOKING_STATUS_LABELS = {
    requested: 'طلب موعد',
    confirmed: 'مؤكد',
    completed: 'مكتمل',
    cancelled: 'ملغي',
    rejected: 'مرفوض',
  };
  const ORDER_NEXT_ADMIN = {
    new: [['accepted', 'قبول'], ['rejected', 'رفض'], ['cancelled', 'إلغاء']],
    accepted: [['preparing', 'تجهيز'], ['rejected', 'رفض'], ['cancelled', 'إلغاء']],
    preparing: [['out_for_delivery', 'خرج للتوصيل'], ['cancelled', 'إلغاء']],
    out_for_delivery: [['delivered', 'تسليم'], ['failed_delivery', 'تعذر التسليم']],
    failed_delivery: [['out_for_delivery', 'إعادة توصيل'], ['cancelled', 'إلغاء']],
  };
  const BOOKING_NEXT_ADMIN = {
    requested: [['confirmed', 'تأكيد'], ['rejected', 'رفض']],
    confirmed: [['completed', 'إتمام'], ['cancelled', 'إلغاء']],
  };

  async function renderOrders() {
    root.replaceChildren();
    if (!state.ordersTab) state.ordersTab = 'orders';
    const tabs = document.createElement('div');
    tabs.className = 'toolbar';
    [['orders', 'الطلبات'], ['bookings', 'الحجوزات']].forEach(([id, label]) => {
      const btn = document.createElement('button');
      btn.className = 'btn btn-sm' + (state.ordersTab === id ? ' btn-primary' : '');
      btn.textContent = label;
      btn.onclick = () => { state.ordersTab = id; state.ordersDetail = null; renderOrders(); };
      tabs.appendChild(btn);
    });
    root.appendChild(tabs);

    if (state.ordersDetail && state.ordersTab === 'orders') {
      await renderOrderDetail(state.ordersDetail);
      return;
    }

    const toolbar = document.createElement('div');
    toolbar.className = 'toolbar';
    const select = document.createElement('select');
    const all = document.createElement('option');
    all.value = '';
    all.textContent = 'كل الحالات';
    select.appendChild(all);
    const labels = state.ordersTab === 'orders' ? ORDER_STATUS_LABELS : BOOKING_STATUS_LABELS;
    Object.keys(labels).forEach((key) => {
      const option = document.createElement('option');
      option.value = key;
      option.textContent = labels[key];
      select.appendChild(option);
    });
    select.value = state.ordersStatus;
    const search = document.createElement('input');
    search.placeholder = state.ordersTab === 'orders' ? 'رقم الطلب أو الجهة أو الجوال' : 'رقم الحجز أو الجهة';
    search.value = state.ordersQuery;
    const apply = document.createElement('button');
    apply.className = 'btn btn-primary btn-sm';
    apply.textContent = 'تطبيق';
    apply.onclick = () => {
      state.ordersStatus = select.value;
      state.ordersQuery = search.value.trim();
      renderOrders();
    };
    toolbar.append(select, search, apply);
    root.appendChild(toolbar);

    const panel = document.createElement('div');
    panel.className = 'panel';
    root.appendChild(panel);
    reviewText(panel, 'جارٍ التحميل');
    try {
      const data = state.ordersTab === 'orders'
        ? await MiraAdminApi.commerceOrders(state.ordersStatus, state.ordersQuery)
        : await MiraAdminApi.commerceBookings(state.ordersStatus, state.ordersQuery);
      const items = data.items || [];
      panel.replaceChildren();
      if (!items.length) {
        reviewText(panel, state.ordersTab === 'orders' ? 'لا طلبات.' : 'لا حجوزات.');
        return;
      }
      const wrap = document.createElement('div');
      wrap.className = 'table-wrap';
      const table = document.createElement('table');
      const head = document.createElement('tr');
      const headers = state.ordersTab === 'orders'
        ? ['الرقم', 'الشريك', 'العميلة', 'التنفيذ', 'التحصيل', 'المجموع (ر.س)', 'التاريخ', '']
        : ['الرقم', 'الشريك', 'الخدمة', 'الحالة', 'الموعد', 'التاريخ', ''];
      headers.forEach((label) => {
        const th = document.createElement('th');
        th.textContent = label;
        head.appendChild(th);
      });
      const thead = document.createElement('thead');
      thead.appendChild(head);
      const tbody = document.createElement('tbody');
      items.forEach((row) => {
        const tr = document.createElement('tr');
        const cells = state.ordersTab === 'orders'
          ? [
              row.publicNumber,
              row.partner && row.partner.nameAr,
              row.contactName + ' · ' + row.contactPhone,
              ORDER_STATUS_LABELS[row.fulfillmentStatus] || row.fulfillmentStatus,
              PAYMENT_STATUS_LABELS[row.paymentCollectionStatus] || row.paymentCollectionStatus,
              (row.totalHalalas / 100).toFixed(2) + (row.deliveryFeeKnown === false ? ' (رسوم غير مؤكدة)' : ''),
              fmtDate(row.createdAt),
            ]
          : [
              row.publicNumber,
              row.partner && row.partner.nameAr,
              row.serviceNameAr,
              BOOKING_STATUS_LABELS[row.status] || row.status,
              fmtDate(row.startsAt),
              fmtDate(row.createdAt),
            ];
        cells.forEach((value) => {
          const td = document.createElement('td');
          td.textContent = value == null ? '' : String(value);
          tr.appendChild(td);
        });
        const actionTd = document.createElement('td');
        if (state.ordersTab === 'orders') {
          const open = document.createElement('button');
          open.className = 'btn btn-sm';
          open.textContent = 'تفاصيل';
          open.onclick = () => { state.ordersDetail = row.id; renderOrders(); };
          actionTd.appendChild(open);
        } else {
          (BOOKING_NEXT_ADMIN[row.status] || []).forEach((step) => {
            const b = document.createElement('button');
            b.className = 'btn btn-sm';
            b.textContent = step[1];
            b.onclick = async () => {
              const note = prompt('سبب التدخل الإداري (مطلوب)');
              if (!note) return;
              try {
                await MiraAdminApi.commerceBookingTransition(row.id, { status: step[0], note });
                renderOrders();
              } catch (error) {
                alert(error.message);
              }
            };
            actionTd.appendChild(b);
          });
        }
        tr.appendChild(actionTd);
        tbody.appendChild(tr);
      });
      table.append(thead, tbody);
      wrap.appendChild(table);
      panel.appendChild(wrap);
      if (data.nextCursor) reviewText(panel, 'يوجد المزيد. تظهر آخر ٥٠ فقط.');
    } catch (error) {
      panel.replaceChildren();
      const alert = document.createElement('div');
      alert.className = 'alert err';
      alert.textContent = error.message;
      panel.appendChild(alert);
    }
  }

  async function renderOrderDetail(orderId) {
    const panel = document.createElement('div');
    panel.className = 'panel';
    root.appendChild(panel);
    reviewText(panel, 'جارٍ تحميل التفاصيل');
    try {
      const order = await MiraAdminApi.commerceOrder(orderId);
      panel.replaceChildren();
      const back = document.createElement('button');
      back.className = 'btn btn-sm';
      back.textContent = 'رجوع للقائمة';
      back.onclick = () => { state.ordersDetail = null; renderOrders(); };
      panel.appendChild(back);
      reviewText(panel, 'طلب ' + order.publicNumber);
      reviewText(panel, 'التنفيذ: ' + (ORDER_STATUS_LABELS[order.fulfillmentStatus] || order.fulfillmentStatus));
      reviewText(panel, 'التوصيل: ' + (order.deliveryStatus || '—'));
      reviewText(panel, 'التحصيل: ' + (PAYMENT_STATUS_LABELS[order.paymentCollectionStatus] || order.paymentCollectionStatus));
      reviewText(panel, 'الشريك: ' + ((order.partner && order.partner.nameAr) || order.partnerId));
      reviewText(panel, 'العميلة: ' + order.contactName + ' · ' + order.contactPhone);
      reviewText(panel, 'العنوان: ' + order.city + ' · ' + order.addressLine);
      (order.items || []).forEach((item) => {
        reviewText(panel, item.productNameAr + ' × ' + item.quantity + ' = ' + (item.lineTotalHalalas / 100).toFixed(2) + ' ر.س');
      });
      reviewText(panel, 'المجموع: ' + (order.totalHalalas / 100).toFixed(2) + ' ر.س (منتجات ' + (order.subtotalHalalas / 100).toFixed(2) + ' + توصيل ' + (order.deliveryFeeHalalas == null ? 'غير محدد' : (order.deliveryFeeHalalas / 100).toFixed(2)) + ')');

      const actions = document.createElement('div');
      actions.className = 'toolbar';
      (ORDER_NEXT_ADMIN[order.fulfillmentStatus] || []).forEach((step) => {
        const b = document.createElement('button');
        b.className = 'btn btn-sm btn-primary';
        b.textContent = step[1];
        b.onclick = async () => {
          const note = prompt('سبب التدخل الإداري (مطلوب)');
          if (!note) return;
          try {
            await MiraAdminApi.commerceOrderTransition(order.id, { fulfillmentStatus: step[0], note });
            renderOrders();
          } catch (error) {
            alert(error.message);
          }
        };
        actions.appendChild(b);
      });
      if (order.paymentCollectionStatus === 'uncollected' && order.fulfillmentStatus === 'delivered') {
        const collect = document.createElement('button');
        collect.className = 'btn btn-sm';
        collect.textContent = 'تسجيل التحصيل';
        collect.onclick = async () => {
          const note = prompt('ملاحظة التحصيل (مطلوبة للإدارة)');
          if (!note) return;
          try {
            await MiraAdminApi.commerceCollectPayment(order.id, note);
            renderOrders();
          } catch (error) {
            alert(error.message);
          }
        };
        actions.appendChild(collect);
      }
      panel.appendChild(actions);

      reviewText(panel, 'الخط الزمني');
      (order.events || []).forEach((ev) => {
        reviewText(
          panel,
          fmtDate(ev.createdAt) + ' · ' + (ev.field || '') + ' · ' + (ev.fromStatus || '') + ' → ' + (ev.toStatus || '') +
            (ev.actorType ? ' · ' + ev.actorType : '') + (ev.note ? ' · ' + ev.note : ''),
        );
      });
    } catch (error) {
      panel.replaceChildren();
      const alert = document.createElement('div');
      alert.className = 'alert err';
      alert.textContent = error.message;
      panel.appendChild(alert);
    }
  }

  function render() {
    const map = {
      dashboard: renderDashboard,
      users: renderUsers,
      audit: renderAudit,
      feedback: renderFeedback,
      applications: renderApplications,
      reviews: renderReviews,
      ads: renderAdReviews,
      orders: renderOrders,
      partners: renderPartners,
      leads: renderLeads,
      system: renderSystem,
    };
    (map[state.view] || renderDashboard)();
  }

  document.querySelectorAll('.nav-item[data-view]').forEach((btn) => {
    btn.onclick = () => navigate(btn.dataset.view);
  });

  $('#loginBtn').onclick = login;
  adminKeyInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') login();
  });

  $('#logoutBtn').onclick = () => {
    MiraAdminApi.clearKey();
    showLogin();
  };

  $('#refreshBtn').onclick = () => render();
  $('#menuToggle').onclick = () => {
    const sidebar = $('#sidebar');
    sidebar.classList.toggle('open');
    $('#menuToggle').setAttribute('aria-expanded', sidebar.classList.contains('open') ? 'true' : 'false');
  };

  function labeledAdFixture() {
    return {
      items: [{
        id: 'labeled-ad',
        captionAr: '<script>alert(1)</script> "اقتباس"',
        status: 'in_review',
        reviewRevision: 3,
        submittedRevision: 3,
        reviewNote: null,
        advertiser: { nameAr: 'المعلن' },
        publisher: { nameAr: 'الناشر' },
        seller: { nameAr: 'جهة الأصل' },
        targetKind: 'product',
        targetId: 'labeled-product',
        liveTarget: { nameAr: 'فستان', priceHalalas: 1800, contentStatus: 'published', externalUrl: 'https://example.com/dress' },
        decisions: [{ revision: 1, decision: 'reject', actor: 'admin-api-key', note: 'نسخة سابقة' }],
      }],
    };
  }

  async function renderAdReviews() {
    const labeled = new URLSearchParams(location.search).get('ui-fixture') === 'labeled';
    root.replaceChildren();
    const banner = document.createElement('p');
    banner.textContent = labeled
      ? 'بيانات اختبار موسومة لعرض الواجهة. ليست كتالوجًا عامًا ولا اعتمادًا.'
      : 'الاعتماد يخص النسخة التي اكتملت معاينتها. الاستجابة 409 لا تعتمد نسخة أحدث.';
    root.appendChild(banner);
    try {
      const data = labeled ? labeledAdFixture() : await MiraAdminApi.adReviews();
      const items = data.items || [];
      if (!items.length) {
        const empty = document.createElement('p');
        empty.textContent = 'لا إعلانات بانتظار المراجعة.';
        root.appendChild(empty);
        return;
      }
      for (const item of items) {
        const panel = document.createElement('article');
        panel.className = 'panel';
        function line(value) {
          const node = document.createElement('p');
          node.textContent = value == null ? '' : String(value);
          panel.appendChild(node);
          return node;
        }
        line(item.captionAr);
        line('المعلن: ' + (item.advertiser && item.advertiser.nameAr || '') + ' · الناشر: ' + (item.publisher && item.publisher.nameAr || '') + ' · الجهة: ' + (item.seller && item.seller.nameAr || ''));
        line('الهدف: ' + (item.targetKind || '') + ' ' + (item.targetId || ''));
        if (item.liveTarget) line('الأصل الآن: ' + item.liveTarget.nameAr + ' · السعر بالهللة: ' + item.liveTarget.priceHalalas + ' · حالة الأصل: ' + item.liveTarget.contentStatus);
        const status = line('');
        const detail = document.createElement('div');
        const previewButton = document.createElement('button');
        previewButton.className = 'btn btn-ghost btn-sm';
        previewButton.textContent = 'معاينة';
        const approve = document.createElement('button');
        approve.className = 'btn btn-primary btn-sm';
        approve.textContent = 'اعتماد النسخة المعروضة';
        const reject = document.createElement('button');
        reject.className = 'btn btn-ghost btn-sm';
        reject.textContent = 'رفض';
        const withdraw = document.createElement('button');
        withdraw.className = 'btn btn-ghost btn-sm';
        withdraw.textContent = 'سحب';
        const noteInput = document.createElement('textarea');
        noteInput.className = 'ad-note';
        noteInput.rows = 3;
        noteInput.placeholder = 'سبب الرفض يظهر هنا قبل الإرسال';
        approve.disabled = true;
        reject.disabled = true;
        withdraw.disabled = true;
        const actions = document.createElement('div');
        actions.className = 'ad-actions';
        actions.append(previewButton, approve, reject, withdraw, noteInput);
        panel.append(actions, detail);
        root.appendChild(panel);
        let shownRevision = null;
        let previewReady = false;
        function showPreview(preview) {
          detail.replaceChildren();
          shownRevision = preview.submittedRevision;
          function row(value) {
            const node = document.createElement('p');
            node.textContent = value == null ? '' : String(value);
            detail.appendChild(node);
          }
          row('رقم النسخة المعروضة: ' + shownRevision);
          row('النص: ' + (preview.captionAr || ''));
          row('المعلن: ' + (preview.advertiser && preview.advertiser.nameAr || ''));
          row('الناشر: ' + (preview.publisher && preview.publisher.nameAr || ''));
          row('الجهة: ' + (preview.seller && preview.seller.nameAr || ''));
          if (preview.liveTarget) row('بيانات الأصل الحالية: ' + preview.liveTarget.nameAr + ' · ' + preview.liveTarget.priceHalalas);
          for (const decision of preview.decisions || []) {
            row('سجل: ' + decision.decision + ' · النسخة ' + decision.revision + ' · ' + decision.actor + (decision.note ? ' · ' + decision.note : ''));
          }
          previewReady = shownRevision != null;
          approve.disabled = !previewReady;
          reject.disabled = !previewReady;
          withdraw.disabled = !previewReady;
          status.textContent = previewReady ? 'المعاينة جاهزة. القرار يخص هذه النسخة فقط.' : 'لا توجد نسخة معروضة للاعتماد.';
        }
        previewButton.onclick = async () => {
          previewReady = false;
          approve.disabled = true;
          reject.disabled = true;
          withdraw.disabled = true;
          if (labeled) {
            showPreview(item);
            return;
          }
          try {
            showPreview(await MiraAdminApi.adPreview(item.id));
          } catch (error) {
            status.textContent = error.message;
          }
        };
        async function send(decision) {
          if (!previewReady || shownRevision == null) {
            status.textContent = 'عايني النسخة أولًا. التحديث لا يعتمدها تلقائيًا.';
            return;
          }
          if (labeled) {
            status.textContent = 'محاكاة: لم يُرسل قرار الإدارة';
            return;
          }
          const revision = shownRevision;
          const note = decision === 'reject' ? (noteInput.value.trim() || 'يحتاج تعديلًا') : undefined;
          approve.disabled = true;
          reject.disabled = true;
          withdraw.disabled = true;
          try {
            await MiraAdminApi.adDecision(item.id, decision, note, revision);
            status.textContent = 'تم تسجيل القرار';
            renderAdReviews();
          } catch (error) {
            previewReady = false;
            shownRevision = null;
            status.textContent = error.status === 409
              ? 'النسخة تغيرت. أعيدي المعاينة. لم يُعتمد شيء تلقائيًا.'
              : error.message;
          }
        }
        approve.onclick = () => send('approve');
        reject.onclick = () => send('reject');
        withdraw.onclick = () => send('withdraw');
        if (labeled) showPreview(item);
      }
    } catch (error) {
      const alert = document.createElement('div');
      alert.className = 'alert err';
      alert.textContent = error.message;
      root.appendChild(alert);
    }
  }

  const labeledUi = new URLSearchParams(location.search).get('ui-fixture') === 'labeled';
  if (labeledUi) {
    showApp();
    navigate('ads');
  } else if (MiraAdminApi.hasKey()) {
    adminKeyInput.value = localStorage.getItem('mira_admin_key') || '';
  }

  if (!labeledUi) {
    tryAutoLogin().then((ok) => {
      if (ok) {
        showApp();
        navigate('dashboard');
      }
    });
  }
})();
