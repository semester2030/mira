(function () {
  const VIEWS = {
    dashboard: { title: 'لوحة التحكم', subtitle: 'نظرة شاملة على التطبيق' },
    users: { title: 'المستخدمات', subtitle: 'إدارة ومتابعة حسابات المستخدمات' },
    audit: { title: 'سجل التدقيق', subtitle: 'جميع الأحداث المسجّلة' },
    feedback: { title: 'التقييمات', subtitle: 'آراء وتقييمات المستخدمات' },
    applications: { title: 'طلبات الشركاء', subtitle: 'اعتماد ورفض طلبات الانضمام' },
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

  function render() {
    const map = {
      dashboard: renderDashboard,
      users: renderUsers,
      audit: renderAudit,
      feedback: renderFeedback,
      applications: renderApplications,
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
  $('#menuToggle').onclick = () => $('#sidebar').classList.toggle('open');

  if (MiraAdminApi.hasKey()) {
    adminKeyInput.value = localStorage.getItem('mira_admin_key') || '';
  }

  tryAutoLogin().then((ok) => {
    if (ok) {
      showApp();
      navigate('dashboard');
    }
  });
})();
