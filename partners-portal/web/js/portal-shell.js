/**
 * Unified partners portal shell — one active view, sidebar sync, history routes.
 * List and editor are exclusive modes; navigation does not scroll a long page.
 */
(function (global) {
  'use strict';

  var VIEWS = {
    products: { sectionIds: ['catalogSection'], nav: 'products', title: 'منتجاتي' },
    services: { sectionIds: ['serviceSection'], nav: 'services', title: 'خدماتي' },
    drafts: { sectionIds: ['editorDraftsSection'], nav: 'drafts', title: 'المسودات' },
    orders: { sectionIds: ['commerceSection'], nav: 'orders', title: 'الطلبات', commerceTab: 'orders' },
    bookings: { sectionIds: ['commerceSection'], nav: 'bookings', title: 'الحجوزات', commerceTab: 'bookings' },
    settings: { sectionIds: ['partnerSettingsSection'], nav: 'settings', title: 'الإعدادات' },
    ads: { sectionIds: ['adsSection'], nav: 'ads', title: 'إعلانات المشاهير' },
    bulk: { sectionIds: ['bulkSection'], nav: 'bulk', title: 'إضافة مجموعة' },
  };

  var state = {
    view: 'products',
    mode: 'list', // list | edit
    dirtyGuard: null,
    ready: false,
  };

  function partnerType() {
    return String(document.body.dataset.partnerType || '').toLowerCase();
  }

  /**
   * Partners that edit services inside catalogSection (not serviceSection).
   * event_planner must match — otherwise openOccasionsService paints catalogForm
   * then openServiceEditor reveals clinic orbs on serviceSection.
   */
  function usesCatalogAsServices() {
    var t = partnerType();
    return t === 'clinic' || t === 'salon' || t === 'event_planner';
  }

  function sectionIdsFor(view) {
    if (view === 'services' && usesCatalogAsServices()) return ['catalogSection'];
    if (view === 'products' && usesCatalogAsServices()) return ['catalogSection'];
    var meta = VIEWS[view] || VIEWS.products;
    return meta.sectionIds || [];
  }

  function parseRoute() {
    var hash = String(location.hash || '').replace(/^#\/?/, '');
    var parts = hash.split('/').filter(Boolean);
    var view = parts[0] || (usesCatalogAsServices() ? 'services' : 'products');
    if (!VIEWS[view]) view = usesCatalogAsServices() ? 'services' : 'products';
    var mode = parts[1] === 'edit' || parts[1] === 'new' ? 'edit' : 'list';
    if (view !== 'products' && view !== 'services' && view !== 'bulk') mode = 'list';
    return { view: view, mode: mode, raw: hash };
  }

  function routeFor(view, mode) {
    if ((view === 'products' || view === 'services') && mode === 'edit') return '#/' + view + '/edit';
    return '#/' + view;
  }

  function setActiveNav(view) {
    document.querySelectorAll('[data-portal-nav]').forEach(function (a) {
      var nav = a.getAttribute('data-portal-nav');
      a.classList.toggle('is-active', nav === view || (view === 'bookings' && nav === 'bookings') || (view === 'orders' && nav === 'orders'));
    });
  }

  function setExclusive(listEl, editorEl, mode) {
    if (listEl) {
      listEl.hidden = mode !== 'list';
      listEl.classList.toggle('hidden', mode !== 'list');
    }
    if (editorEl) {
      editorEl.hidden = mode !== 'edit';
      editorEl.classList.toggle('hidden', mode !== 'edit');
    }
  }

  function applyVisibility(view, mode) {
    var meta = VIEWS[view] || VIEWS.products;
    var activeIds = sectionIdsFor(view);
    document.body.setAttribute('data-portal-view', view);
    document.body.setAttribute('data-portal-mode', mode);
    document.body.classList.toggle('portal-mode-edit', mode === 'edit');
    document.body.classList.toggle('portal-mode-list', mode === 'list');

    var allSectionIds = {};
    Object.keys(VIEWS).forEach(function (key) {
      (VIEWS[key].sectionIds || []).forEach(function (id) {
        allSectionIds[id] = true;
      });
    });
    allSectionIds.catalogSection = true;
    allSectionIds.serviceSection = true;

    Object.keys(allSectionIds).forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      var show = activeIds.indexOf(id) >= 0;
      el.classList.toggle('hidden', !show);
      el.hidden = !show;
      el.setAttribute('data-portal-active', show ? '1' : '0');
    });

    // Shell owns chrome; legacy home/stats card stays out of product/service/draft flows.
    // Settings has its own section — keep home hidden to avoid stacked empty cards.
    var home = document.getElementById('portalHomeCard');
    var addCard = document.getElementById('portalAddCard');
    if (home) {
      home.classList.add('hidden');
      home.hidden = true;
      home.setAttribute('data-portal-active', '0');
    }
    if (addCard) {
      // Stage-head «إضافة» replaces the legacy quick-add card.
      addCard.classList.add('hidden');
      addCard.hidden = true;
      addCard.setAttribute('data-portal-active', '0');
    }

    // Hide legacy in-list «عرض القائمة» — shell owns list/edit exclusivity.
    var showListBtn = document.getElementById('e2bShowList');
    if (showListBtn) {
      showListBtn.hidden = true;
      showListBtn.classList.add('hidden');
    }

    var listPanel = document.getElementById('e2bListPanel');
    var editorPanel = document.getElementById('e2bEditorPanel');
    var catalogAsServices = usesCatalogAsServices();
    var useCatalogPanels =
      view === 'products' || (view === 'services' && catalogAsServices);

    if (useCatalogPanels) {
      setExclusive(listPanel, editorPanel, mode);
      document.body.classList.toggle('e2b-editor-focus', mode === 'edit');
      // Products view must never leave #catalogSection blanked by a prior service-mode paint.
      if (view === 'products') {
        var catalogSection = document.getElementById('catalogSection');
        if (catalogSection) {
          catalogSection.classList.remove('e2c-inactive-editor', 'hidden');
          catalogSection.hidden = false;
          catalogSection.removeAttribute('aria-hidden');
          catalogSection.setAttribute('data-portal-active', '1');
        }
        if (mode === 'list') {
          document.body.classList.remove('e2b-service-mode');
          if (window.MiraE2BProductShell && typeof MiraE2BProductShell.enableProductMode === 'function') {
            try {
              MiraE2BProductShell.enableProductMode();
            } catch (_) {
              /* optional */
            }
          }
        }
      }
    } else {
      if (listPanel && view !== 'products') {
        /* leave panels alone when another section is active */
      }
      if (view !== 'products') document.body.classList.remove('e2b-editor-focus');
    }

    // Developer service list vs editor (serviceSection)
    var serviceListWrap = document.getElementById('serviceListWrap');
    var serviceEditorWrap = document.getElementById('serviceEditorWrap');
    if (view === 'services' && !catalogAsServices) {
      setExclusive(serviceListWrap, serviceEditorWrap, mode);
      document.body.classList.toggle('e2c-editor-focus', mode === 'edit');
    } else {
      document.body.classList.remove('e2c-editor-focus');
    }

    if (meta.commerceTab && window.CommerceOrders) {
      var tabBtn =
        meta.commerceTab === 'bookings'
          ? document.getElementById('commerceTabBookings')
          : document.getElementById('commerceTabOrders');
      if (tabBtn) tabBtn.click();
    }

    setActiveNav(view);
    var titleEl = document.getElementById('portalViewTitle');
    if (titleEl) titleEl.textContent = meta.title + (mode === 'edit' ? ' · تحرير' : '');
  }

  function confirmLeaveIfDirty() {
    if (typeof state.dirtyGuard === 'function') {
      try {
        if (state.dirtyGuard()) {
          return window.confirm('لديك تعديلات غير محفوظة. هل تريدين المغادرة دون حفظ؟');
        }
      } catch (_) {
        /* ignore */
      }
    }
    return true;
  }

  function navigate(view, mode, opts) {
    opts = opts || {};
    mode = mode || 'list';
    if (!VIEWS[view]) view = 'products';
    if (!opts.force && (view !== state.view || mode !== state.mode)) {
      if (state.mode === 'edit' && mode !== 'edit' && !confirmLeaveIfDirty()) return false;
    }
    state.view = view;
    state.mode = mode;
    var nextHash = routeFor(view, mode);
    if (opts.replace) {
      history.replaceState({ portal: true, view: view, mode: mode }, '', nextHash);
    } else if (location.hash.replace(/^#\/?/, '') !== nextHash.replace(/^#\/?/, '')) {
      history.pushState({ portal: true, view: view, mode: mode }, '', nextHash);
    }
    applyVisibility(view, mode);
    return true;
  }

  function syncFromLocation() {
    var r = parseRoute();
    state.view = r.view;
    state.mode = r.mode;
    applyVisibility(r.view, r.mode);
  }

  function buildRail() {
    var app = document.getElementById('app');
    if (!app || document.getElementById('portalShell')) return;

    var shell = document.createElement('div');
    shell.id = 'portalShell';
    shell.className = 'portal-shell';
    shell.setAttribute('data-testid', 'portal-shell');

    var rail = document.createElement('aside');
    rail.className = 'portal-rail e2b-rail';
    rail.setAttribute('aria-label', 'تنقل البوابة');
    rail.innerHTML =
      '<img class="e2b-brand-mark" src="assets/e2b-ref/mira-logo-icon.png" alt="ميرا" width="56" height="56" />' +
      '<p class="e2b-rail-title">ميرا · شركاء</p>' +
      '<nav class="e2b-nav portal-nav" id="portalSideNav" data-testid="portal-side-nav"></nav>';

    var nav = rail.querySelector('#portalSideNav');
    var partnerType = (document.body.dataset.partnerType || '').toLowerCase();
    var partner = window.sessionPartner || {};
    var showProducts =
      !partnerType ||
      partnerType === 'brand' ||
      partnerType === 'developer' ||
      (partnerType === 'event_planner' && partner.canSellProducts === true);
    var showServices =
      !partnerType ||
      partnerType === 'clinic' ||
      partnerType === 'salon' ||
      partnerType === 'developer' ||
      partnerType === 'event_planner';

    function addLink(view, label) {
      var a = document.createElement('a');
      a.href = routeFor(view, 'list');
      a.className = 'e2b-nav-link';
      a.setAttribute('data-portal-nav', view);
      a.setAttribute('data-testid', 'portal-nav-' + view);
      a.textContent = label;
      a.addEventListener('click', function (e) {
        e.preventDefault();
        navigate(view, 'list');
      });
      nav.appendChild(a);
    }

    if (showProducts) addLink('products', 'منتجاتي');
    if (showServices) addLink('services', 'خدماتي');
    addLink('drafts', 'المسودات');
    addLink('orders', 'الطلبات');
    addLink('bookings', 'الحجوزات');
    addLink('settings', 'الإعدادات');
    addLink('ads', 'إعلانات المشاهير');

    var stage = document.createElement('div');
    stage.className = 'portal-stage';
    stage.id = 'portalStage';

    var head = document.createElement('div');
    head.className = 'portal-stage-head';
    head.innerHTML =
      '<h1 id="portalViewTitle" class="portal-view-title">منتجاتي</h1>' +
      '<div class="portal-stage-actions" id="portalStageActions"></div>';
    stage.appendChild(head);

    var content = document.createElement('div');
    content.className = 'portal-stage-content';
    content.id = 'portalStageContent';

    // Move existing #app children into stage content
    while (app.firstChild) content.appendChild(app.firstChild);
    stage.appendChild(content);

    shell.appendChild(rail);
    shell.appendChild(stage);
    app.appendChild(shell);
  }

  function wrapServicePanels() {
    var section = document.getElementById('serviceSection');
    if (!section || document.getElementById('serviceListWrap')) return;
    var list = document.getElementById('serviceList');
    var form = document.getElementById('serviceForm');
    if (!list || !form) return;
    var listWrap = document.createElement('div');
    listWrap.id = 'serviceListWrap';
    listWrap.className = 'portal-list-wrap';
    listWrap.setAttribute('data-testid', 'service-list-wrap');
    var editorWrap = document.createElement('div');
    editorWrap.id = 'serviceEditorWrap';
    editorWrap.className = 'portal-editor-wrap';
    editorWrap.setAttribute('data-testid', 'service-editor-wrap');
    // Move headings associated with list/form loosely
    var nodes = Array.from(section.children);
    nodes.forEach(function (n) {
      if (n === list || (n.contains && n.contains(list))) listWrap.appendChild(n);
      else if (n === form || (n.contains && n.contains(form))) editorWrap.appendChild(n);
      else if (/H2/i.test(n.tagName) && /إضافة خدمة/.test(n.textContent || '')) editorWrap.appendChild(n);
      else if (/H2/i.test(n.tagName)) listWrap.insertBefore(n, listWrap.firstChild);
      else listWrap.appendChild(n);
    });
    if (!listWrap.contains(list)) listWrap.appendChild(list);
    if (!editorWrap.contains(form)) editorWrap.appendChild(form);
    section.appendChild(listWrap);
    section.appendChild(editorWrap);
  }

  function installListActions() {
    var actions = document.getElementById('portalStageActions');
    if (!actions) return;
    actions.replaceChildren();
    var view = state.view;
    if (view === 'products' && state.mode === 'list') {
      var add = document.createElement('button');
      add.type = 'button';
      add.className = 'btn btn-primary';
      add.id = 'portalAddProduct';
      add.setAttribute('data-testid', 'portal-add-product');
      add.textContent = 'إضافة منتج';
      add.onclick = function () {
        // Prefer a blank product form immediately, then lane chooser if present.
        if (typeof window.renderForm === 'function') {
          try {
            window.renderForm('brand', null, 'catalogForm', 'catalogTitle');
          } catch (_) {
            /* optional */
          }
        }
        if (window.MiraLaneEntries && typeof MiraLaneEntries.startProductAdd === 'function') {
          Promise.resolve(MiraLaneEntries.startProductAdd()).catch(function (e) {
            console.warn('[portalAddProduct]', e);
          });
          return;
        }
        var go = document.getElementById('goProduct');
        if (go) go.click();
        else navigate('products', 'edit');
      };
      var back = null;
      actions.appendChild(add);
    }
    if (view === 'services' && state.mode === 'list') {
      var addS = document.createElement('button');
      addS.type = 'button';
      addS.className = 'btn btn-primary';
      addS.id = 'portalAddService';
      addS.setAttribute('data-testid', 'portal-add-service');
      addS.textContent = 'إضافة خدمة';
      addS.onclick = function () {
        var go = document.getElementById('goService');
        if (go) go.click();
        else navigate('services', 'edit');
      };
      actions.appendChild(addS);
    }
    if (state.mode === 'edit' && (view === 'products' || view === 'services')) {
      var backBtn = document.createElement('button');
      backBtn.type = 'button';
      backBtn.className = 'btn btn-ghost';
      backBtn.setAttribute('data-testid', 'portal-back-to-list');
      backBtn.textContent = 'العودة للقائمة';
      backBtn.onclick = function () {
        // Returning to the list is not discarding an in-progress create — force list mode.
        var ok = navigate(view, 'list', { force: true });
        if (!ok) return;
        if (view === 'products' && window.MiraE2BProductShell && MiraE2BProductShell.showList) {
          MiraE2BProductShell.showList();
        }
        if (view === 'services' && window.MiraE2BServiceShell && typeof MiraE2BServiceShell.disableServiceMode === 'function') {
          /* keep service mode for services list; product catalog stays gated by portal view */
        }
      };
      actions.appendChild(backBtn);
    }
  }

  function enhanceDraftsRenderer() {
    /* Human cards are rendered in dashboard.renderEditorDrafts; keep a safety rewrite. */
    var STATUS_AR = {
      draft: 'مسودة',
      ready: 'جاهزة',
      submitted: 'مُرسلة للمراجعة',
      materialized: 'محفوظة كعرض',
      discarded: 'مهملة',
      error: 'خطأ',
    };
    var KIND_AR = { product: 'منتج', service: 'خدمة' };
    var original = global.renderEditorDrafts;
    if (typeof original !== 'function' || original.__portalEnhanced) return;
    var wrapped = async function () {
      await original();
      var list = document.getElementById('editorDraftsList');
      if (!list) return;
      Array.from(list.querySelectorAll('.list-row')).forEach(function (row) {
        if (row.getAttribute('data-portal-draft-card') === '1') return;
        var raw = (row.childNodes[0] && row.childNodes[0].textContent) || row.textContent || '';
        if (!/rev\s*\d+|materialized|localStorage|clientDraftId/i.test(raw)) return;
        var openBtn = row.querySelector('button');
        var parts = raw.split('·').map(function (p) {
          return p.trim();
        });
        var kind = KIND_AR[parts[0]] || parts[0] || 'عنصر';
        var name = parts[1] || 'بدون اسم';
        var statusRaw = (parts[3] || parts[2] || '').replace(/^مراجعة:.*/, '').trim();
        var statusKey = statusRaw.split(/\s+/)[0];
        var status = STATUS_AR[statusKey] || statusRaw || 'مسودة';
        row.setAttribute('data-portal-draft-card', '1');
        row.className = 'portal-draft-card list-row';
        row.replaceChildren();
        var meta = document.createElement('div');
        meta.className = 'portal-draft-meta';
        meta.innerHTML =
          '<strong class="portal-draft-name"></strong>' +
          '<span class="portal-draft-kind"></span>' +
          '<span class="portal-draft-status"></span>';
        meta.querySelector('.portal-draft-name').textContent = name;
        meta.querySelector('.portal-draft-kind').textContent = kind;
        meta.querySelector('.portal-draft-status').textContent = status;
        row.appendChild(meta);
        if (openBtn) {
          openBtn.textContent = 'فتح';
          openBtn.className = 'btn btn-primary';
          openBtn.setAttribute('data-testid', 'portal-draft-open');
          var prev = openBtn.onclick;
          openBtn.onclick = async function (ev) {
            if (prev) await prev.call(openBtn, ev);
            var kindHint = /خدمة|service/i.test(kind) ? 'services' : 'products';
            navigate(kindHint, 'edit', { force: true });
          };
          row.appendChild(openBtn);
        }
      });
    };
    wrapped.__portalEnhanced = true;
    global.renderEditorDrafts = wrapped;
  }

  function wireHistory() {
    window.addEventListener('popstate', function () {
      syncFromLocation();
      installListActions();
    });
    window.addEventListener('hashchange', function () {
      syncFromLocation();
      installListActions();
    });
  }

  function boot() {
    if (state.ready) return;
    buildRail();
    wrapServicePanels();
    // Mark home/add cards if present
    var cards = document.querySelectorAll('#portalStageContent > .card');
    if (cards[0] && !cards[0].id) {
      cards[0].id = 'portalHomeCard';
    }
    if (cards[1] && !cards[1].id && /إضافة محتوى/.test(cards[1].textContent || '')) {
      cards[1].id = 'portalAddCard';
    }
    enhanceDraftsRenderer();
    wireHistory();
    if (!location.hash || location.hash === '#') {
      history.replaceState({ portal: true, view: 'products', mode: 'list' }, '', '#/products');
    }
    syncFromLocation();
    installListActions();
    state.ready = true;
    document.dispatchEvent(new CustomEvent('mira:portal-shell-ready'));
  }

  // Patch navigate after view changes to refresh action buttons
  var _navigate = navigate;
  navigate = function (view, mode, opts) {
    var ok = _navigate(view, mode, opts);
    if (ok) installListActions();
    return ok;
  };

  global.MiraPortalShell = {
    boot: boot,
    navigate: navigate,
    syncFromLocation: syncFromLocation,
    openProductEditor: function () {
      return navigate('products', 'edit');
    },
    openServiceEditor: function () {
      return navigate('services', 'edit');
    },
    showProductList: function () {
      return navigate('products', 'list');
    },
    showServiceList: function () {
      return navigate('services', 'list');
    },
    setDirtyGuard: function (fn) {
      state.dirtyGuard = fn;
    },
    getState: function () {
      return { view: state.view, mode: state.mode };
    },
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      // Delay until partner type may be known; also allow explicit boot from dashboard load.
    });
  }
})(typeof window !== 'undefined' ? window : globalThis);
