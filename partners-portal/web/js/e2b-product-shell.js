/**
 * E2 ب — صدفة محرر المنتجات.
 * التصنيفات ومعرفاتها من taxonomy المركزي؛ أصول العرض مربوطة بالمعرفات.
 * لا تُستخدم صورة المرجع الكاملة كشعار أو كصورة دائرة.
 */
(function () {
  const DEFERRED_E4 = { bags: false, shoes: false }; // E4 write started
  const ORB_BY_ID = {
    clothes: 'assets/e2b-ref/orbs/clothes.png',
    bags: 'assets/e2b-ref/orbs/bags.png',
    shoes: 'assets/e2b-ref/orbs/shoes.png',
    face: 'assets/e2b-ref/orbs/face.png',
    body: 'assets/e2b-ref/orbs/body.png',
    hair: 'assets/e2b-ref/orbs/hair.png',
    accessories: 'assets/e2b-ref/orbs/accessories.png',
  };
  /** Stable subcategory orb map by taxonomy id — never index-modulo reuse. */
  const SUB_ORB_BY_ID = {
    'clothes.wedding_dress': 'assets/e2b-ref/orbs/clothes_wedding_dress.png',
    'clothes.abaya': 'assets/e2b-ref/orbs/clothes_abaya.png',
    'clothes.evening': 'assets/e2b-ref/orbs/clothes_evening.png',
    'clothes.skirt': 'assets/e2b-ref/orbs/clothes_skirt.png',
    'clothes.blouse': 'assets/e2b-ref/orbs/clothes_blouse.png',
    'clothes.all': 'assets/e2b-ref/orbs/clothes.png',
  };
  const SUB_ORB_FALLBACK = 'assets/e2b-ref/orbs/sub-0.png';

  let selectSeq = 0;
  let selectedMainId = null;
  let selectedSubId = null;
  let taxonomyCache = null;
  let taxonomyError = null;
  let syncingFromForm = false;
  let formWired = false;

  function el(tag, attrs, kids) {
    const n = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach((k) => {
        if (k === 'text') n.textContent = attrs[k];
        else if (k === 'className') n.className = attrs[k];
        else if (k.slice(0, 2) === 'on' && typeof attrs[k] === 'function')
          n.addEventListener(k.slice(2).toLowerCase(), attrs[k]);
        else n.setAttribute(k, attrs[k]);
      });
    }
    (kids || []).forEach((c) => c && n.appendChild(c));
    return n;
  }

  function subOrbFor(id) {
    if (SUB_ORB_BY_ID[id]) return SUB_ORB_BY_ID[id];
    const safe = String(id || '').replace(/\./g, '_');
    if (safe && SUB_ORB_BY_ID[safe.replace(/_/g, '.')]) return SUB_ORB_BY_ID[safe.replace(/_/g, '.')];
    return 'assets/e2b-ref/orbs/' + safe + '.png';
  }

  function ensureWorkspace() {
    const section = document.getElementById('catalogSection');
    if (!section) return null;
    section.classList.add('e2b-panel', 'e2b-split');
    if (document.getElementById('e2bWorkspace')) return section;

    const list = document.getElementById('catalogList');
    const form = document.getElementById('catalogForm');
    if (!list || !form) return section;

    const workspace = el('div', { className: 'e2b-workspace', id: 'e2bWorkspace' });
    const rail = el('aside', { className: 'e2b-rail', 'aria-label': 'تنقل البوابة' }, [
      el('img', {
        className: 'e2b-brand-mark',
        src: 'assets/e2b-ref/mira-logo-icon.png',
        alt: 'ميرا',
        width: '56',
        height: '56',
      }),
      el('p', { className: 'e2b-rail-title', text: 'ميرا · شركاء' }),
      el('nav', { className: 'e2b-nav', id: 'e2bSideNav' }, [
        el('a', {
          href: '#catalogSection',
          className: 'e2b-nav-link is-active',
          'data-nav': 'products',
          text: 'منتجاتي',
        }),
        el('a', { href: '#editorDraftsSection', className: 'e2b-nav-link', 'data-nav': 'drafts', text: 'المسودات' }),
        el('a', {
          href: '#commerceSection',
          className: 'e2b-nav-link',
          'data-nav': 'orders',
          'data-tab': 'orders',
          text: 'الطلبات',
        }),
        el('a', {
          href: '#commerceSection',
          className: 'e2b-nav-link',
          'data-nav': 'bookings',
          'data-tab': 'bookings',
          text: 'الحجوزات',
        }),
        el('a', {
          href: '#partnerSettingsSection',
          className: 'e2b-nav-link',
          'data-nav': 'settings',
          text: 'الإعدادات',
        }),
        el('a', { href: '#adsSection', className: 'e2b-nav-link', 'data-nav': 'ads', text: 'إعلانات المشاهير' }),
      ]),
    ]);
    const main = el('div', { className: 'e2b-main', id: 'e2bMain' });
    const listPanel = el('div', { className: 'e2b-panel', id: 'e2bListPanel', 'data-testid': 'e2b-list-panel' });
    const editorPanel = el('div', { className: 'e2b-panel', id: 'e2bEditorPanel', 'data-testid': 'e2b-editor-panel' });

    listPanel.appendChild(
      el('div', { className: 'e2b-list-toolbar' }, [
        el('input', {
          type: 'search',
          id: 'e2bCatalogSearch',
          placeholder: 'بحث في العناصر المحمّلة…',
          'aria-label': 'بحث في العناصر المحمّلة بالقائمة الحالية',
          title: 'البحث يصفّي عناصر القائمة المحمّلة من لوحة التحكم الحالية؛ لا يدّعي البحث في صفحات غير محمّلة.',
          'data-search-scope': 'loaded-dom',
        }),
        el('button', { type: 'button', className: 'btn btn-ghost', id: 'e2bShowList', text: 'عرض القائمة' }),
      ]),
    );

    const children = Array.from(section.children);
    children.forEach((child) => {
      if (child.id === 'catalogList' || child.contains(list)) listPanel.appendChild(child);
      else if (child.id === 'catalogForm' || child.contains(form)) editorPanel.appendChild(child);
      else if (/H2/i.test(child.tagName) && /إضافة جديد/.test(child.textContent || '')) editorPanel.appendChild(child);
      else if (/H2/i.test(child.tagName) || (/P/i.test(child.tagName) && child.classList.contains('lead')))
        listPanel.insertBefore(child, listPanel.firstChild?.nextSibling || null);
      else listPanel.appendChild(child);
    });
    if (!listPanel.contains(list)) listPanel.appendChild(list);

    const catRow = el('div', { className: 'e2b-cat-row', id: 'e2bCatRow' }, [
      el('p', { className: 'e2b-cat-heading', text: 'التصنيف الرئيسي' }),
      el('div', { className: 'e2b-circle-list e2b-circle-list-horizontal', id: 'e2bMainCircles', 'data-testid': 'e2b-main-circles' }),
    ]);
    const subRow = el('div', { className: 'e2b-subcircles', id: 'e2bSubCircles', 'data-testid': 'e2b-subcircles' });

    if (!editorPanel.contains(form)) {
      editorPanel.appendChild(catRow);
      editorPanel.appendChild(subRow);
      editorPanel.appendChild(form);
    } else {
      editorPanel.insertBefore(subRow, form);
      editorPanel.insertBefore(catRow, subRow);
    }

    main.append(listPanel, editorPanel);
    workspace.append(rail, main);
    section.appendChild(workspace);

    const showBtn = document.getElementById('e2bShowList');
    if (showBtn) showBtn.addEventListener('click', () => showList());
    const search = document.getElementById('e2bCatalogSearch');
    if (search) {
      search.addEventListener('input', (e) => {
        const q = String(e.target.value || '').trim().toLowerCase();
        // Scope: loaded dashboard catalog rows only (explicit). Not a claim of full-server search.
        const rows = document.querySelectorAll('#catalogList .list-item');
        let shown = 0;
        rows.forEach((row) => {
          const t = (row.textContent || '').toLowerCase();
          const id = (row.getAttribute('data-id') || '').toLowerCase();
          const name = (row.getAttribute('data-name-ar') || '').toLowerCase();
          const cat = (row.getAttribute('data-category-id') || '').toLowerCase();
          const match = !q || t.includes(q) || id.includes(q) || name.includes(q) || cat.includes(q);
          row.style.display = match ? '' : 'none';
          if (match) shown += 1;
        });
        search.setAttribute('data-match-count', String(shown));
        search.setAttribute('data-loaded-count', String(rows.length));
      });
    }
    wireSideNav();
    loadAndPaintMains();
    wireFormSync();
    observeCatalogForm();
    return section;
  }

  function wireSideNav() {
    const nav = document.getElementById('e2bSideNav');
    if (!nav || nav.dataset.wired === '1') return;
    nav.dataset.wired = '1';
    nav.addEventListener('click', (e) => {
      const a = e.target && e.target.closest ? e.target.closest('a.e2b-nav-link') : null;
      if (!a) return;
      nav.querySelectorAll('.e2b-nav-link').forEach((n) => n.classList.toggle('is-active', n === a));
      const kind = a.getAttribute('data-nav');
      if (kind === 'products') {
        e.preventDefault();
        showList();
        const section = document.getElementById('catalogSection');
        if (section) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      if (kind === 'settings') {
        e.preventDefault();
        document.body.classList.remove('e2b-editor-focus');
        const settings = document.getElementById('partnerSettingsSection');
        if (settings) {
          settings.classList.remove('hidden');
          settings.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        return;
      }
      if (kind === 'orders' || kind === 'bookings') {
        document.body.classList.remove('e2b-editor-focus');
        const tabBtn =
          kind === 'bookings'
            ? document.getElementById('commerceTabBookings')
            : document.getElementById('commerceTabOrders');
        if (tabBtn) tabBtn.click();
      } else {
        document.body.classList.remove('e2b-editor-focus');
      }
    });
  }

  let composeBusy = false;
  let catalogFormObserver = null;

  function observeCatalogForm() {
    const form = document.getElementById('catalogForm');
    if (!form || form.dataset.e2bObserved === '1') return;
    form.dataset.e2bObserved = '1';
    let timer = null;
    const schedule = () => {
      if (composeBusy) return;
      if (timer) clearTimeout(timer);
      timer = window.setTimeout(() => {
        composeCatalogLayout();
        syncFromForm();
      }, 0);
    };
    catalogFormObserver = new MutationObserver(schedule);
    // childList + subtree catches subcategory <option> restores after taxonomy load.
    catalogFormObserver.observe(form, { childList: true, subtree: true });
  }

  /**
   * Stable approved order by data-section-role (not Arabic labels):
   * status → compose(fields: basics/options/attributes/commerce + media: main-media)
   * → details → detail-media → variant-media → preview-publish → CTAs
   */
  function composeCatalogLayout() {
    const form = document.getElementById('catalogForm');
    if (!form || !document.body.classList.contains('e2b-product-mode')) return;
    if (composeBusy) return;
    composeBusy = true;
    if (catalogFormObserver) catalogFormObserver.disconnect();
    try {
      function byRole(role) {
        return form.querySelector('[data-section-role="' + role + '"]');
      }
      const mediaSection =
        byRole('main-media') ||
        form.querySelector('[data-testid="catalog-main-media-section"]');
      const basics = byRole('basics');
      if (!mediaSection || !basics) return;

      const mediaBox =
        mediaSection.querySelector('.media-box') || mediaSection.querySelector('[data-testid="catalog-media-stage"]');
      if (mediaBox) {
        mediaBox.classList.add('media-box');
        mediaBox.setAttribute('data-testid', 'catalog-media-stage');
      }
      mediaSection.classList.add('e2b-media-stage');

      // Idempotent: reuse compose hosts so late-created sections still land correctly.
      let compose = form.querySelector('[data-testid="e2b-editor-compose"]');
      let fields = form.querySelector('[data-testid="e2b-editor-fields"]');
      let mediaCol = form.querySelector('[data-testid="e2b-editor-media"]');
      if (!compose || !fields || !mediaCol) {
        compose = el('div', { className: 'e2b-editor-compose', 'data-testid': 'e2b-editor-compose' });
        fields = el('div', { className: 'e2b-editor-fields', 'data-testid': 'e2b-editor-fields' });
        mediaCol = el('div', { className: 'e2b-editor-media', 'data-testid': 'e2b-editor-media' });
        compose.append(fields, mediaCol);
      }

      // options-preview after attributes so long preview never separates sizes from materials (I-02).
      const fieldOrder = ['basics', 'options', 'attributes', 'options-preview', 'commerce', 'template'];
      const afterCompose = ['details', 'detail-media', 'variant-media', 'preview-publish', 'editor-actions'];
      const actionsBar = form.querySelector('[data-testid="e2b-editor-actions"]');
      const save = document.getElementById('catalogForm-save');
      const submit = form.querySelector('[data-testid="catalog-submit-review"]');
      const matBtn = form.querySelector(
        '[data-testid="materialize-draft"], [data-editor-v2-materialize="1"], button.mat-btn',
      );
      const ctaNodes = actionsBar
        ? [actionsBar]
        : [matBtn, save, submit].filter(Boolean);

      const alreadyOrdered =
        compose.parentElement === form &&
        fieldOrder.every((role) => {
          const node = byRole(role);
          return !node || node.parentElement === fields;
        }) &&
        mediaSection.parentElement === mediaCol &&
        afterCompose.every((role) => {
          const node = byRole(role);
          if (!node) return true;
          return node.parentElement === form && !!(compose.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING);
        });
      if (alreadyOrdered) return;

      fieldOrder.forEach((role) => {
        const node = byRole(role);
        if (node) fields.appendChild(node);
      });
      mediaCol.appendChild(mediaSection);

      const tail = [];
      afterCompose.forEach((role) => {
        const node = byRole(role);
        if (node) tail.push(node);
      });

      const statusNodes = Array.from(form.children).filter((child) => {
        if (child === compose) return false;
        if (child.getAttribute && child.getAttribute('data-section-role')) return false;
        if (child === mediaSection) return false;
        if (ctaNodes.indexOf(child) >= 0) return false;
        if (child.tagName === 'BUTTON') return false;
        return true;
      });

      statusNodes.forEach((n) => form.appendChild(n));
      form.appendChild(compose);
      tail.forEach((n) => form.appendChild(n));
      ctaNodes.forEach((n) => form.appendChild(n));
    } finally {
      composeBusy = false;
      if (catalogFormObserver && form.isConnected) {
        catalogFormObserver.observe(form, { childList: true, subtree: true });
      }
    }
  }

  async function loadTaxonomy(force) {
    if (taxonomyCache && !force) return taxonomyCache;
    if (!(window.PartnersApi && typeof PartnersApi.taxonomy === 'function')) {
      taxonomyError = 'عميل التصنيفات غير متاح';
      throw new Error(taxonomyError);
    }
    const doc = await PartnersApi.taxonomy({ lane: 'elegance' });
    taxonomyCache = doc || {};
    taxonomyError = null;
    return taxonomyCache;
  }

  function mainCategoriesFromTaxonomy(doc) {
    const nodes = (doc && doc.nodes) || [];
    return nodes
      .filter((n) => n && n.parentId == null && n.id !== 'elegance.all' && !n.browseOnly)
      .map((n) => ({
        id: n.id,
        labelAr: n.labelAr || n.label || n.id,
        deferredE4: !!DEFERRED_E4[n.id],
        orb: ORB_BY_ID[n.id] || ORB_BY_ID.accessories,
      }));
  }

  async function loadAndPaintMains(opts) {
    opts = opts || {};
    const host = document.getElementById('e2bMainCircles');
    if (!host) return;
    host.replaceChildren(el('p', { className: 'lead', 'data-testid': 'e2b-mains-loading', text: 'تحميل التصنيفات…' }));
    try {
      const doc = await loadTaxonomy(!!opts.force);
      const mains = mainCategoriesFromTaxonomy(doc);
      host.replaceChildren();
      if (!mains.length) {
        host.appendChild(
          el('p', {
            className: 'lead',
            'data-testid': 'e2b-mains-empty',
            text: 'لا توجد تصنيفات رئيسية من المصدر المركزي.',
          }),
        );
        return;
      }
      mains.forEach((cat) => {
        const orb = el('span', { className: 'e2b-circle-orb' });
        orb.style.backgroundImage = "url('" + cat.orb + "')";
        const btn = el(
          'button',
          {
            type: 'button',
            className: 'e2b-circle',
            'data-testid': 'e2b-main-circle',
            'data-category-id': cat.id,
            'aria-pressed': selectedMainId === cat.id ? 'true' : 'false',
            title: cat.deferredE4 ? cat.labelAr + ' (مؤجل E4)' : cat.labelAr,
            onClick: () => selectMain(cat),
          },
          [orb, el('span', { className: 'e2b-circle-label', text: cat.labelAr })],
        );
        if (cat.deferredE4) btn.dataset.deferred = 'e4';
        if (selectedMainId === cat.id) btn.classList.add('is-selected');
        host.appendChild(btn);
      });
      // Prefer live form values after late taxonomy arrival (draft restore / retry).
      syncFromForm();
      if (selectedMainId) {
        const keep = mains.find((m) => m.id === selectedMainId);
        if (keep) selectMain(keep, { preserveSub: true, fromSync: true });
      }
    } catch (e) {
      host.replaceChildren();
      host.appendChild(
        el('p', {
          className: 'lead',
          style: 'color:#b00020',
          'data-testid': 'e2b-taxonomy-load-error',
          text: 'تعذر تحميل التصنيفات: ' + ((e && (e.messageAr || e.message)) || String(e)),
        }),
      );
      host.appendChild(
        el('button', {
          type: 'button',
          className: 'btn btn-ghost',
          'data-testid': 'e2b-taxonomy-retry',
          text: 'إعادة المحاولة',
          onClick: () => loadAndPaintMains(),
        }),
      );
    }
  }

  async function selectMain(cat, opts) {
    opts = opts || {};
    const seq = ++selectSeq;
    const sameMain = selectedMainId === cat.id;
    selectedMainId = cat.id;
    // Re-clicking the same main (e.g. ملابس after فستان زفاف) must keep the subcategory selection.
    if (!opts.preserveSub && !sameMain) selectedSubId = null;
    else if (sameMain && !opts.preserveSub) {
      const form = document.getElementById('catalogForm');
      const subSel = form && form.querySelector('select[name="subcategory"]');
      if (subSel && subSel.value) selectedSubId = subSel.value;
    }
    document.querySelectorAll('#e2bMainCircles .e2b-circle').forEach((b) => {
      const on = b.getAttribute('data-category-id') === cat.id;
      b.classList.toggle('is-selected', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    const subHost = document.getElementById('e2bSubCircles');
    if (!subHost) return;
    subHost.replaceChildren();
    subHost.setAttribute('data-parent-id', cat.id);

    if (cat.deferredE4) {
      subHost.appendChild(
        el('p', {
          className: 'lead',
          'data-testid': 'e2b-deferred-e4',
          text: 'تصنيف «' + cat.labelAr + '» مؤجل إلى E4 — غير متاح كمسار إنشاء مكتمل هنا.',
        }),
      );
      return;
    }

    const form = document.getElementById('catalogForm');
    const catSel = form && form.querySelector('select[name="category"]');
    // Only dispatch change when the value actually changes — never wipe subcategory on same-main re-click.
    if (catSel && catSel.value !== cat.id && !opts.fromSync) {
      syncingFromForm = true;
      catSel.value = cat.id;
      catSel.dispatchEvent(new Event('change', { bubbles: true }));
      syncingFromForm = false;
    }

    subHost.appendChild(el('p', { className: 'lead', 'data-testid': 'e2b-subs-loading', text: 'تحميل الأنواع…' }));
    try {
      const doc = await loadTaxonomy(false);
      if (seq !== selectSeq || selectedMainId !== cat.id) return;
      const nodes = ((doc && doc.nodes) || []).filter(
        (n) =>
          n &&
          !n.browseOnly &&
          n.id !== cat.id + '.all' &&
          (n.parentId === cat.id || String(n.id || '').startsWith(cat.id + '.')),
      );
      if (seq !== selectSeq || selectedMainId !== cat.id) return;
      subHost.replaceChildren();
      subHost.setAttribute('data-parent-id', cat.id);
      if (!nodes.length) {
        subHost.appendChild(el('p', { className: 'lead', text: 'لا توجد تصنيفات فرعية ظاهرة لهذا القسم.' }));
        return;
      }
      nodes.forEach((n) => {
        const orbUrl = SUB_ORB_BY_ID[n.id] || subOrbFor(n.id);
        const orb = el('span', { className: 'e2b-circle-orb' });
        orb.style.backgroundImage = "url('" + orbUrl + "')";
        orb.setAttribute('data-orb-id', n.id);
        const btn = el(
          'button',
          {
            type: 'button',
            className: 'e2b-circle' + (selectedSubId === n.id ? ' is-selected' : ''),
            'data-testid': 'e2b-sub-circle',
            'data-subcategory-id': n.id,
            'data-parent-id': cat.id,
            'data-orb-src': orbUrl,
            onClick: () => selectSub(n.id, { fromCircle: true }),
          },
          [orb, el('span', { className: 'e2b-circle-label', text: n.labelAr || n.id })],
        );
        subHost.appendChild(btn);
      });
      if (selectedSubId) selectSub(selectedSubId, { fromSync: true, silentMissing: true });
    } catch (e) {
      if (seq !== selectSeq || selectedMainId !== cat.id) return;
      subHost.replaceChildren();
      subHost.appendChild(
        el('p', {
          className: 'lead',
          style: 'color:#b00020',
          'data-testid': 'e2b-subs-load-error',
          text: 'تعذر تحميل الأنواع: ' + ((e && (e.messageAr || e.message)) || String(e)),
        }),
      );
      subHost.appendChild(
        el('button', {
          type: 'button',
          className: 'btn btn-ghost',
          'data-testid': 'e2b-subs-retry',
          text: 'إعادة المحاولة',
          onClick: () => selectMain(cat, opts),
        }),
      );
    }
  }

  function selectSub(subId, opts) {
    opts = opts || {};
    selectedSubId = subId || null;
    document.querySelectorAll('#e2bSubCircles .e2b-circle').forEach((b) => {
      const on = b.getAttribute('data-subcategory-id') === subId;
      b.classList.toggle('is-selected', on);
    });
    const form = document.getElementById('catalogForm');
    const subSel = form && form.querySelector('select[name="subcategory"]');
    if (!subSel) return;
    const has = Array.from(subSel.options).some((o) => o.value === subId);
    if (!has) {
      if (!opts.silentMissing) return;
      return;
    }
    if (subSel.value !== subId) {
      syncingFromForm = true;
      subSel.value = subId;
      if (!opts.fromSync) {
        subSel.dispatchEvent(new Event('change', { bubbles: true }));
      }
      syncingFromForm = false;
    }
  }

  function enableProductMode() {
    if (window.MiraE2BServiceShell && typeof MiraE2BServiceShell.disableServiceMode === 'function') {
      try {
        MiraE2BServiceShell.disableServiceMode();
      } catch (_) {
        /* optional */
      }
    }
    document.body.classList.remove('e2b-service-mode');
    document.body.classList.add('e2b-product-mode');
    const prodMains = document.getElementById('e2bMainCircles');
    const prodSubs = document.getElementById('e2bSubCircles');
    if (prodMains) prodMains.hidden = false;
    if (prodSubs) prodSubs.hidden = false;
    ensureWorkspace();
  }

  function disableProductMode() {
    document.body.classList.remove('e2b-product-mode', 'e2b-editor-focus');
  }

  function focusEditor() {
    enableProductMode();
    document.body.classList.add('e2b-editor-focus');
    const form = document.getElementById('catalogForm');
    if (form) form.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function showList() {
    document.body.classList.remove('e2b-editor-focus');
    const listPanel = document.getElementById('e2bListPanel');
    if (listPanel) listPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function syncFromForm() {
    if (syncingFromForm) return;
    const form = document.getElementById('catalogForm');
    if (!form) return;
    const catSel = form.querySelector('select[name="category"]');
    const subSel = form.querySelector('select[name="subcategory"]');
    const catId = catSel && catSel.value;
    const subId = subSel && subSel.value;
    if (!catId) return;
    const btn = document.querySelector('#e2bMainCircles .e2b-circle[data-category-id="' + catId + '"]');
    const label = (btn && btn.querySelector('.e2b-circle-label') && btn.querySelector('.e2b-circle-label').textContent) || catId;
    if (selectedMainId !== catId) {
      selectedSubId = subId || null;
      selectMain(
        {
          id: catId,
          labelAr: label,
          deferredE4: !!DEFERRED_E4[catId],
          orb: ORB_BY_ID[catId],
        },
        { preserveSub: true, fromSync: true },
      );
    } else if (subId && selectedSubId !== subId) {
      selectSub(subId, { fromSync: true, silentMissing: true });
    } else if (!subId) {
      selectedSubId = null;
      document.querySelectorAll('#e2bSubCircles .e2b-circle').forEach((b) => b.classList.remove('is-selected'));
    }
  }

  function wireFormSync() {
    if (formWired) return;
    formWired = true;
    document.addEventListener(
      'change',
      (e) => {
        const t = e.target;
        if (!t || !t.name) return;
        if (t.name !== 'category' && t.name !== 'subcategory') return;
        if (!document.getElementById('catalogForm') || !document.getElementById('catalogForm').contains(t)) return;
        if (syncingFromForm) return;
        syncFromForm();
      },
      true,
    );
  }

  function init() {
    const go = document.getElementById('goProduct');
    if (go && go.dataset.e2bWired !== '1') {
      go.dataset.e2bWired = '1';
      go.addEventListener('click', () => focusEditor(), true);
    }
    wireFormSync();
  }

  window.MiraE2BProductShell = {
    init: init,
    enableProductMode: enableProductMode,
    disableProductMode: disableProductMode,
    focusEditor: focusEditor,
    showList: showList,
    selectMain: selectMain,
    selectSub: selectSub,
    syncFromForm: syncFromForm,
    composeCatalogLayout: composeCatalogLayout,
    reloadTaxonomy: (opts) => {
      if (opts && opts.force) taxonomyCache = null;
      return loadAndPaintMains({ force: !!(opts && opts.force) });
    },
    clearTaxonomyCache: () => {
      taxonomyCache = null;
    },
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
