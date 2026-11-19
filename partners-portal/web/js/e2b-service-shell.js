/**
 * E2 ج — صدفة محرر الخدمات وفق المرجع البصري الثاني (ref-2).
 * دوائر رئيسية/فرعية، تبديل منتج↔خدمة، عمود إتاحة/وسائط، عزل عن وضع المنتجات.
 */
(function () {
  const ORB_BY_SERVICE_CAT = {
    'beauty.salons': 'assets/e2b-ref/orbs/hair.png',
    'beauty.skin_centers': 'assets/e2b-ref/orbs/skin.png',
    'beauty.spa': 'assets/e2b-ref/orbs/spa.png',
    'beauty.experts': 'assets/e2b-ref/orbs/makeup.png',
    hair: 'assets/e2b-ref/orbs/hair.png',
    skin: 'assets/e2b-ref/orbs/skin.png',
    makeup: 'assets/e2b-ref/orbs/makeup.png',
    nails: 'assets/e2b-ref/orbs/nails.png',
    lashes_brows: 'assets/e2b-ref/orbs/makeup.png',
    hair_removal: 'assets/e2b-ref/orbs/body.png',
    henna: 'assets/e2b-ref/orbs/spa.png',
    care: 'assets/e2b-ref/orbs/spa.png',
    spa: 'assets/e2b-ref/orbs/spa.png',
    face: 'assets/e2b-ref/orbs/face.png',
    body: 'assets/e2b-ref/orbs/body.png',
    occasions: 'assets/e2b-ref/orbs/occasions_types.png',
  };

  /** Per-template orbs — never reuse parent category art for cut vs color. */
  const ORB_BY_TEMPLATE_ID = {
    salon_hair_cut: 'assets/e2b-ref/orbs/hair_styling.png',
    salon_hair_color: 'assets/e2b-ref/orbs/hair_dye.png',
    salon_nails: 'assets/e2b-ref/orbs/nails.png',
    salon_makeup: 'assets/e2b-ref/orbs/makeup.png',
    salon_care: 'assets/e2b-ref/orbs/spa.png',
    clinic_skin: 'assets/e2b-ref/orbs/skin.png',
    clinic_consult: 'assets/e2b-ref/orbs/face.png',
  };

  const MEDICAL_CAT_BLOCKED = new Set([
    'laser',
    'teeth',
    'beauty.clinics',
    'beauty.clinic.laser',
    'beauty.clinic.teeth',
    'beauty.clinic.derm',
  ]);

  const BEAUTY_PROVIDER_ORDER = [
    'beauty.salons',
    'beauty.skin_centers',
    'beauty.spa',
    'beauty.experts',
  ];

  const BEAUTY_PROVIDER_LABELS = {
    'beauty.salons': 'الصالونات',
    'beauty.skin_centers': 'مراكز العناية بالبشرة',
    'beauty.spa': 'السبا والاسترخاء',
    'beauty.experts': 'خبيرات الجمال',
  };

  let beautyTaxonomyDoc = null;
  let beautyTaxonomyPromise = null;

  function loadBeautyTaxonomy(force) {
    if (beautyTaxonomyDoc && !force) return Promise.resolve(beautyTaxonomyDoc);
    if (beautyTaxonomyPromise && !force) return beautyTaxonomyPromise;
    const api = window.PartnersApi;
    beautyTaxonomyPromise = (api && typeof api.taxonomy === 'function'
      ? api.taxonomy({ lane: 'beauty', audience: 'partner' })
      : Promise.reject(new Error('no taxonomy api'))
    )
      .then((doc) => {
        beautyTaxonomyDoc = doc;
        return doc;
      })
      .catch(() =>
        fetch('assets/phase2-taxonomy/beauty-taxonomy.v1.json')
          .then((r) => (r.ok ? r.json() : Promise.reject(new Error('beauty taxonomy fallback'))))
          .then((doc) => {
            beautyTaxonomyDoc = doc;
            return doc;
          })
          .catch(() => null),
      );
    return beautyTaxonomyPromise;
  }

  function orbUrlForTemplate(t, catId) {
    if (t && t.icon && t.icon.smallUrl) return String(t.icon.smallUrl);
    if (t && t.id && ORB_BY_TEMPLATE_ID[t.id]) return ORB_BY_TEMPLATE_ID[t.id];
    if (t && t.imageKey && beautyTaxonomyDoc && Array.isArray(beautyTaxonomyDoc.nodes)) {
      const node = beautyTaxonomyDoc.nodes.find((n) => n && (n.id === t.id || n.imageKey === t.imageKey));
      if (node && node.icon && node.icon.smallUrl) return String(node.icon.smallUrl);
    }
    return ORB_BY_SERVICE_CAT[catId] || ORB_BY_SERVICE_CAT.care;
  }

  function taxonomyNodeById(id) {
    if (!beautyTaxonomyDoc || !Array.isArray(beautyTaxonomyDoc.nodes) || !id) return null;
    return beautyTaxonomyDoc.nodes.find((n) => n && n.id === id) || null;
  }

  function isMedicalNode(n) {
    if (!n) return true;
    const id = String(n.id || '');
    if (n.medicalOnly || n.blockedForNewRegistration) return true;
    if (MEDICAL_CAT_BLOCKED.has(id)) return true;
    if (id.includes('clinic.laser') || id.includes('clinic.teeth') || id === 'beauty.clinics') return true;
    return false;
  }

  function legacySpecialtyToBeautyParent(catId) {
    const map = {
      hair: 'beauty.hair',
      makeup: 'beauty.makeup',
      nails: 'beauty.nails',
      care: 'beauty.spa',
      spa: 'beauty.spa',
      skin: 'beauty.face_care',
      lashes_brows: 'beauty.lashes_brows',
      hair_removal: 'beauty.hair_removal',
      henna: 'beauty.henna',
    };
    return map[catId] || null;
  }

  /** Specialty groups linked to a provider without requiring mismatched parentId children. */
  const PROVIDER_LINKED_GROUPS = {
    'beauty.experts': ['beauty.makeup', 'beauty.lashes_brows', 'beauty.henna'],
    'beauty.salons': [
      'beauty.hair',
      'beauty.makeup',
      'beauty.nails',
      'beauty.lashes_brows',
      'beauty.hair_removal',
      'beauty.henna',
    ],
    'beauty.skin_centers': ['beauty.face_care'],
    'beauty.spa': ['beauty.spa.hammam', 'beauty.spa.body_care', 'beauty.spa.relax'],
  };

  /** Specialty groups under a provider (or legacy specialty id). */
  function beautyGroupsForProvider(providerId) {
    if (!beautyTaxonomyDoc || !Array.isArray(beautyTaxonomyDoc.nodes)) return [];
    if (MEDICAL_CAT_BLOCKED.has(providerId) || String(providerId).indexOf('beauty.clinic') === 0) return [];
    const parentId = legacySpecialtyToBeautyParent(providerId) || providerId;
    const parent = taxonomyNodeById(parentId);
    const linked =
      (parent && Array.isArray(parent.linkedSpecialtyIds) && parent.linkedSpecialtyIds.length
        ? parent.linkedSpecialtyIds
        : null) ||
      PROVIDER_LINKED_GROUPS[parentId] ||
      null;
    const childIds = linked
      ? linked.slice()
      : parent && Array.isArray(parent.children)
        ? parent.children.slice()
        : [];
    // Experts/salons may reference shared specialty ids that keep their own parentId.
    const nodes = childIds.length
      ? childIds.map(taxonomyNodeById).filter(Boolean)
      : beautyTaxonomyDoc.nodes.filter((n) => n && n.parentId === parentId);
    return nodes
      .filter((n) => n && !n.browseOnly && !isMedicalNode(n) && Array.isArray(n.children) && n.children.length)
      .sort((a, b) => (a.sort || 0) - (b.sort || 0) || String(a.id).localeCompare(String(b.id)))
      .map((n) => ({
        id: n.id,
        label: n.labelAr,
        suggestedName: n.labelAr,
        category: providerId,
        imageKey: n.imageKey,
        icon: n.icon,
        taxonomyGroup: true,
      }));
  }

  function beautyLeavesForCategory(catId) {
    if (!beautyTaxonomyDoc || !Array.isArray(beautyTaxonomyDoc.nodes)) return [];
    if (MEDICAL_CAT_BLOCKED.has(catId) || String(catId).indexOf('beauty.clinic') === 0) return [];
    const parentId = legacySpecialtyToBeautyParent(catId) || catId;
    return beautyTaxonomyDoc.nodes
      .filter((n) => {
        if (!n || n.parentId !== parentId || n.browseOnly || isMedicalNode(n)) return false;
        if (n.writeEnabled === false) return false;
        if (n.children && n.children.length) return false;
        return true;
      })
      .sort((a, b) => (a.sort || 0) - (b.sort || 0) || String(a.id).localeCompare(String(b.id)))
      .map((n) => ({
        id: n.id,
        label: n.labelAr,
        suggestedName: n.labelAr,
        category: catId,
        imageKey: n.imageKey,
        icon: n.icon,
        profileId: n.profileId,
        taxonomyLeaf: true,
      }));
  }

  /** Sub-orbs: groups under provider, else writable leaves under specialty. */
  function beautySubItemsForSelection(catId, groupId) {
    if (groupId) return beautyLeavesForCategory(groupId);
    const groups = beautyGroupsForProvider(catId);
    if (groups.length) return groups;
    return beautyLeavesForCategory(catId);
  }

  function profileIdToTemplateId(profileId) {
    if (!profileId) return null;
    const raw = String(profileId).trim();
    if (raw.indexOf('service.') === 0) return raw.slice('service.'.length);
    return raw;
  }

  const LABEL_BY_ID = Object.assign({}, BEAUTY_PROVIDER_LABELS, {
    hair: 'الشعر',
    skin: 'البشرة',
    makeup: 'المكياج',
    nails: 'الأظافر',
    lashes_brows: 'الرموش والحواجب',
    hair_removal: 'إزالة الشعر',
    henna: 'الحناء',
    care: 'السبا',
    spa: 'السبا',
    occasions: 'مناسباتك',
    'beauty.hair': 'الشعر',
    'beauty.makeup': 'المكياج',
    'beauty.nails': 'الأظافر',
    'beauty.lashes_brows': 'الرموش والحواجب',
    'beauty.hair_removal': 'إزالة الشعر',
    'beauty.henna': 'الحناء',
    'beauty.face_care': 'العناية بالوجه',
  });

  /** Preferred display order: four provider circles, then legacy specialties, occasions. */
  const MAIN_ORDER = BEAUTY_PROVIDER_ORDER.concat([
    'hair',
    'makeup',
    'nails',
    'lashes_brows',
    'hair_removal',
    'henna',
    'skin',
    'care',
    'spa',
    'occasions',
  ]);

  let selectedCatId = null;
  let selectedGroupId = null;
  let selectedSubId = null;
  let syncingFromForm = false;
  let formWired = false;
  let composeBusy = false;
  let activeFormId = null;

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

  function resolveForm() {
    if (activeFormId) {
      const f = document.getElementById(activeFormId);
      if (f) return f;
    }
    const svc = document.getElementById('serviceForm');
    if (svc && svc.querySelector('input[name="nameAr"]')) return svc;
    return document.getElementById('catalogForm');
  }

  function mainCirclesHost(form) {
    if (form) {
      const local = form.querySelector('[data-testid="e2c-main-circles"]');
      if (local) return local;
    }
    return document.getElementById('e2cMainCircles');
  }

  function subCirclesHost(form) {
    if (form) {
      const local = form.querySelector('[data-testid="e2c-sub-circles"]');
      if (local) return local;
    }
    return document.getElementById('e2cSubCircles');
  }

  function clearProductModeArtifacts() {
    document.body.classList.remove('e2b-product-mode');
    // Hide + empty product-only circle hosts while in service mode to prevent bleed.
    const prodMains = document.getElementById('e2bMainCircles');
    const prodSubs = document.getElementById('e2bSubCircles');
    if (prodMains) {
      prodMains.hidden = true;
      prodMains.replaceChildren();
    }
    if (prodSubs) {
      prodSubs.hidden = true;
      prodSubs.replaceChildren();
    }
    // Reveal service orb hosts when entering service mode.
    const svcMains = document.getElementById('e2cMainCircles');
    const svcSubs = document.getElementById('e2cSubCircles');
    const svcHost = document.querySelector('[data-testid="e2c-orb-host"]');
    if (svcMains) svcMains.hidden = false;
    if (svcSubs) svcSubs.hidden = false;
    if (svcHost) svcHost.hidden = false;
    const serviceSection = document.getElementById('serviceSection');
    if (serviceSection) serviceSection.hidden = false;
    const catalogSection = document.getElementById('catalogSection');
    // Developer keeps both sections in DOM; hide product catalog only while the
    // portal is actually on services. Never blank «منتجاتي» during boot paint of serviceForm.
    const portalView = String(document.body.getAttribute('data-portal-view') || '');
    if (
      catalogSection &&
      document.body.dataset.partnerType === 'developer' &&
      portalView === 'services'
    ) {
      catalogSection.classList.add('e2c-inactive-editor');
      catalogSection.hidden = true;
      catalogSection.setAttribute('aria-hidden', 'true');
    }
  }

  function hideServiceHosts() {
    const svcMains = document.getElementById('e2cMainCircles');
    const svcSubs = document.getElementById('e2cSubCircles');
    const svcHost = document.querySelector('[data-testid="e2c-orb-host"]');
    if (svcMains) svcMains.hidden = true;
    if (svcSubs) svcSubs.hidden = true;
    if (svcHost) svcHost.hidden = true;
    // Hide entire service forms' orb/compose when product mode is active.
    document.querySelectorAll('#serviceForm [data-testid="e2c-orb-host"], #catalogForm [data-testid="e2c-orb-host"]').forEach((n) => {
      n.hidden = true;
    });
    document.querySelectorAll('#serviceForm [data-testid="e2c-editor-compose"], #catalogForm [data-testid="e2c-editor-compose"]').forEach((n) => {
      // Keep DOM for data, but hide from view so inactive editor orbs/fields do not paint.
      n.setAttribute('data-e2c-inactive', '1');
      n.hidden = true;
    });
    const serviceSection = document.getElementById('serviceSection');
    if (serviceSection && document.body.dataset.partnerType === 'developer') {
      serviceSection.hidden = true;
    }
    const catalogSection = document.getElementById('catalogSection');
    if (catalogSection) {
      catalogSection.classList.remove('e2c-inactive-editor');
      if (document.body.dataset.partnerType === 'developer') {
        catalogSection.hidden = false;
        catalogSection.removeAttribute('aria-hidden');
      }
    }
  }

  function restoreProductHosts() {
    const prodMains = document.getElementById('e2bMainCircles');
    const prodSubs = document.getElementById('e2bSubCircles');
    if (prodMains) prodMains.hidden = false;
    if (prodSubs) prodSubs.hidden = false;
    hideServiceHosts();
  }

  function ensureKindToggle(host) {
    let toggle = host.querySelector('[data-testid="e2c-kind-toggle"]');
    if (toggle) return toggle;
    toggle = el('div', { className: 'e2c-kind-toggle', 'data-testid': 'e2c-kind-toggle' });
    const productBtn = el(
      'button',
      {
        type: 'button',
        className: 'e2c-kind-btn',
        'data-kind': 'product',
        'data-testid': 'e2c-kind-product',
        text: 'منتج',
        onClick: () => {
          const go = document.getElementById('goProduct');
          if (go) go.click();
        },
      },
    );
    const serviceBtn = el(
      'button',
      {
        type: 'button',
        className: 'e2c-kind-btn is-selected',
        'data-kind': 'service',
        'data-testid': 'e2c-kind-service',
        text: 'خدمة',
      },
    );
    toggle.append(productBtn, serviceBtn);
    host.insertBefore(toggle, host.firstChild);
    return toggle;
  }

  function ensureWorkspace(form) {
    if (!form) return null;
    const section =
      form.id === 'serviceForm'
        ? document.getElementById('serviceSection')
        : document.getElementById('catalogSection');
    if (!section) return null;
    section.classList.add('e2b-panel', 'e2b-split', 'e2c-service-panel');
    document.body.classList.add('e2b-service-mode');
    clearProductModeArtifacts();

    let host = form.querySelector('[data-testid="e2c-orb-host"]');
    if (!host) {
      host = el('div', {
        className: 'e2c-orb-host',
        'data-testid': 'e2c-orb-host',
        'data-section-role': 'service-orbs',
      });
      ensureKindToggle(host);
      host.append(
        el('p', { className: 'e2b-cat-heading', text: 'نوع مقدّم الخدمة' }),
        el('div', {
          className: 'e2b-circle-list e2b-circle-list-horizontal',
          id: 'e2cMainCircles',
          'data-testid': 'e2c-main-circles',
        }),
        el('p', {
          className: 'e2b-cat-heading e2c-sub-heading',
          'data-testid': 'e2c-sub-heading',
          text: 'مجموعة الخدمات',
        }),
        el('div', {
          className: 'e2b-circle-list e2b-circle-list-horizontal e2c-sub-circles',
          id: 'e2cSubCircles',
          'data-testid': 'e2c-sub-circles',
        }),
        el('p', {
          className: 'e2b-cat-heading e2c-detail-heading',
          'data-testid': 'e2c-detail-heading',
          hidden: 'hidden',
          text: 'تفاصيل الخدمة',
        }),
      );
      form.insertBefore(host, form.firstChild);
    } else {
      ensureKindToggle(host);
      if (!host.querySelector('#e2cSubCircles')) {
        host.append(
          el('p', { className: 'e2b-cat-heading e2c-sub-heading', text: 'النوع الفرعي' }),
          el('div', {
            className: 'e2b-circle-list e2b-circle-list-horizontal e2c-sub-circles',
            id: 'e2cSubCircles',
            'data-testid': 'e2c-sub-circles',
          }),
        );
      }
    }

    // Mark list so editor-focus can hide the long list above the form (UX01).
    const list =
      document.getElementById('serviceList') ||
      document.getElementById('catalogList');
    if (list) {
      list.setAttribute('data-testid', 'e2c-list-panel');
      list.classList.add('e2c-list-panel');
    }

    // Right rail for provider (salon/clinic) and developer service surfaces — not product-only.
    ensureServiceRail(section);
    const nav = document.getElementById('e2bSideNav') || document.getElementById('e2cSideNav');
    if (nav) {
      let svcLink = nav.querySelector('[data-nav="services"]');
      if (!svcLink) {
        svcLink = el('a', {
          href: '#' + section.id,
          className: 'e2b-nav-link is-active',
          'data-nav': 'services',
          'data-testid': 'e2c-nav-services',
          text: 'خدماتي',
          onClick: (e) => {
            e.preventDefault();
            const go = document.getElementById('goService');
            if (go) go.click();
          },
        });
        nav.insertBefore(svcLink, nav.firstChild);
      }
      nav.querySelectorAll('.e2b-nav-link').forEach((a) => {
        a.classList.toggle('is-active', a.getAttribute('data-nav') === 'services');
      });
    }
    return form;
  }

  function ensureServiceRail(section) {
    if (!section) return;
    if (document.getElementById('e2bSideNav') || document.getElementById('e2cSideNav')) return;
    // Build a dedicated service rail when product workspace is absent (salon/clinic).
    let workspace = document.getElementById('e2cWorkspace');
    if (workspace) return;
    workspace = el('div', {
      className: 'e2b-workspace e2c-workspace',
      id: 'e2cWorkspace',
      'data-testid': 'e2c-workspace',
    });
    const rail = el('aside', { className: 'e2b-rail e2c-rail', 'aria-label': 'تنقل البوابة', 'data-testid': 'e2c-side-rail' }, [
      el('img', {
        className: 'e2b-brand-mark',
        src: 'assets/e2b-ref/mira-logo-icon.png',
        alt: 'ميرا',
        width: '56',
        height: '56',
      }),
      el('p', { className: 'e2b-rail-title', text: 'ميرا · شركاء' }),
      el('nav', { className: 'e2b-nav', id: 'e2cSideNav', 'data-testid': 'e2c-side-nav' }, [
        el('a', {
          href: '#' + section.id,
          className: 'e2b-nav-link is-active',
          'data-nav': 'services',
          'data-testid': 'e2c-nav-services',
          text: 'خدماتي',
        }),
        el('a', { href: '#editorDraftsSection', className: 'e2b-nav-link', 'data-nav': 'drafts', text: 'المسودات' }),
        el('a', {
          href: '#commerceSection',
          className: 'e2b-nav-link',
          'data-nav': 'bookings',
          text: 'الحجوزات',
        }),
        el('a', {
          href: '#partnerSettingsSection',
          className: 'e2b-nav-link',
          'data-nav': 'settings',
          text: 'الإعدادات',
        }),
      ]),
    ]);
    const main = el('div', { className: 'e2b-main e2c-main', id: 'e2cMain' });
    const parent = section.parentNode;
    if (!parent) return;
    parent.insertBefore(workspace, section);
    workspace.append(rail, main);
    main.appendChild(section);
    section.classList.add('e2b-panel', 'e2b-split', 'e2c-service-panel');
  }

  function ensureBeautyProviderCategories(sel) {
    if (!sel) return;
    // Strip medical options from the live select (production #/services/edit path).
    Array.from(sel.options).forEach((o) => {
      const v = String(o.value || '');
      if (
        MEDICAL_CAT_BLOCKED.has(v) ||
        v.includes('clinic.laser') ||
        v.includes('clinic.teeth') ||
        v === 'laser' ||
        v === 'teeth'
      ) {
        o.remove();
      }
    });
    const lane = window.__MIRA_TAXONOMY_LANE__ || '';
    if (lane === 'occasions') return;
    const partnerType = document.body.dataset.partnerType || 'salon';
    // Developer + beauty partners: ensure the four provider circles exist.
    if (
      partnerType === 'developer' ||
      partnerType === 'salon' ||
      partnerType === 'independent' ||
      partnerType === 'studio' ||
      partnerType === 'spa' ||
      partnerType === 'clinic'
    ) {
      BEAUTY_PROVIDER_ORDER.forEach((id) => {
        if ([...sel.options].some((o) => o.value === id)) return;
        const opt = document.createElement('option');
        opt.value = id;
        opt.textContent = BEAUTY_PROVIDER_LABELS[id] || id;
        sel.appendChild(opt);
      });
    }
  }

  function categoriesFromForm(form) {
    const sel = form && form.querySelector('select[name="category"]');
    if (!sel) return [];
    ensureBeautyProviderCategories(sel);
    const lane = window.__MIRA_TAXONOMY_LANE__ || '';
    let cats = Array.from(sel.options)
      .filter((o) => o.value)
      .filter((o) => {
        const v = String(o.value);
        return !(
          MEDICAL_CAT_BLOCKED.has(v) ||
          v === 'laser' ||
          v === 'teeth' ||
          v.includes('clinic.laser') ||
          v.includes('clinic.teeth')
        );
      })
      .map((o) => ({
        id: o.value,
        labelAr: LABEL_BY_ID[o.value] || o.textContent || o.value,
        orb: ORB_BY_SERVICE_CAT[o.value] || ORB_BY_SERVICE_CAT.care,
      }));
    // Occasions lock: never paint clinic/beauty orbs when lane is مناسباتك.
    if (lane === 'occasions') {
      cats = cats.filter((c) => c.id === 'occasions' || String(c.id).indexOf('occasions.') === 0);
      if (!cats.length) {
        cats = [
          {
            id: 'occasions',
            labelAr: 'مناسباتك',
            orb: ORB_BY_SERVICE_CAT.occasions,
          },
        ];
      }
    } else {
      // Prefer the four provider circles when present; drop legacy specialty orbs.
      const providers = cats.filter((c) => BEAUTY_PROVIDER_ORDER.indexOf(c.id) >= 0);
      if (providers.length) {
        cats = providers;
      } else {
        cats = cats.filter((c) => c.id !== 'occasions' && String(c.id).indexOf('occasions.') !== 0);
      }
    }
    cats.sort((a, b) => {
      const ia = MAIN_ORDER.indexOf(a.id);
      const ib = MAIN_ORDER.indexOf(b.id);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });
    return cats;
  }

  function templatesForCategory(catId) {
    const api = window.ServiceTemplates;
    if (!api) return [];
    if (typeof api.forPartner === 'function') {
      const partnerType = (document.body.dataset.partnerType || 'salon').replace(/^developer$/, 'salon');
      try {
        return api.forPartner(partnerType === 'brand' ? 'salon' : partnerType, catId) || [];
      } catch (_) {
        /* fall through */
      }
    }
    if (Array.isArray(api.templates)) {
      return api.templates.filter((t) => t.category === catId);
    }
    return [];
  }

  function setSubHeading(form, text) {
    const host = form && form.querySelector('[data-testid="e2c-orb-host"]');
    const heading =
      (host && host.querySelector('[data-testid="e2c-sub-heading"]')) ||
      document.querySelector('[data-testid="e2c-sub-heading"]');
    if (heading) heading.textContent = text || 'مجموعة الخدمات';
  }

  function setDetailHeading(form, label) {
    const host = form && form.querySelector('[data-testid="e2c-orb-host"]');
    let heading =
      (host && host.querySelector('[data-testid="e2c-detail-heading"]')) ||
      document.querySelector('[data-testid="e2c-detail-heading"]');
    if (!heading && host) {
      heading = el('p', {
        className: 'e2b-cat-heading e2c-detail-heading',
        'data-testid': 'e2c-detail-heading',
        text: '',
      });
      host.appendChild(heading);
    }
    if (!heading) return;
    if (!label) {
      heading.hidden = true;
      heading.textContent = 'تفاصيل الخدمة';
      return;
    }
    heading.hidden = false;
    heading.textContent = 'تفاصيل ' + label;
  }

  function paintSubOrbs(form, catId) {
    const host = subCirclesHost(form);
    if (!host) return;
    host.replaceChildren();
    const items = beautySubItemsForSelection(catId, selectedGroupId);
    const templates = items.length ? items : templatesForCategory(catId).filter((t) => !t.blockedForNewRegistration);
    const showingGroups = !selectedGroupId && items.some((t) => t.taxonomyGroup);
    setSubHeading(form, showingGroups ? 'مجموعة الخدمات' : selectedGroupId ? 'الخدمة الفرعية' : 'الخدمة الفرعية');
    if (selectedGroupId) {
      const back = el(
        'button',
        {
          type: 'button',
          className: 'btn btn-ghost e2c-group-back',
          'data-testid': 'e2c-group-back',
          text: '← رجوع للمجموعات',
          onClick: () => {
            selectedGroupId = null;
            selectedSubId = null;
            setDetailHeading(form, null);
            paintSubOrbs(form, catId);
          },
        },
      );
      host.appendChild(back);
    }
    if (!templates.length) {
      host.appendChild(
        el('p', {
          className: 'muted',
          'data-testid': 'e2c-subs-empty',
          text: 'لا أنواع فرعية ظاهرة — اختاري قالبًا من قسم القالب إن وُجد.',
        }),
      );
      return;
    }
    templates.forEach((t) => {
      const orbUrl = orbUrlForTemplate(t, catId);
      const orb = el('span', { className: 'e2b-circle-orb' });
      orb.style.backgroundImage = "url('" + orbUrl + "')";
      if (t.imageKey) orb.setAttribute('data-image-key', t.imageKey);
      const selected =
        t.taxonomyGroup ? selectedGroupId === t.id : selectedSubId === t.id;
      const btn = el(
        'button',
        {
          type: 'button',
          className: 'e2b-circle' + (selected ? ' is-selected' : ''),
          'data-testid': t.taxonomyGroup ? 'e2c-group-circle' : 'e2c-sub-circle',
          'data-template-id': t.id,
          'data-subcategory-id': t.taxonomyLeaf ? t.id : '',
          'data-group-id': t.taxonomyGroup ? t.id : '',
          'data-category-id': catId,
          'data-orb-src': orbUrl,
          'data-image-key': t.imageKey || '',
          onClick: () => {
            if (t.taxonomyGroup) {
              selectedGroupId = t.id;
              selectedSubId = null;
              setDetailHeading(form, null);
              paintSubOrbs(form, catId);
              return;
            }
            selectSub(t.id, {
              fromCircle: true,
              taxonomyLeaf: !!t.taxonomyLeaf,
              profileId: t.profileId,
              label: t.label || t.suggestedName || t.id,
            });
          },
        },
        [orb, el('span', { className: 'e2b-circle-label', text: t.label || t.suggestedName || t.id })],
      );
      host.appendChild(btn);
    });
  }

  function selectSub(templateId, opts) {
    opts = opts || {};
    selectedSubId = templateId || null;
    document.querySelectorAll('#e2cSubCircles .e2b-circle').forEach((b) => {
      b.classList.toggle(
        'is-selected',
        b.getAttribute('data-template-id') === templateId || b.getAttribute('data-group-id') === templateId,
      );
    });
    const form = resolveForm();
    if (!form || !templateId || opts.fromSync) return;
    // Beauty taxonomy leaf: persist subcategory id + bridge profile → serviceTemplateId.
    if (opts.taxonomyLeaf || String(templateId).indexOf('beauty.') === 0) {
      let sub = form.querySelector('input[name="subcategory"], select[name="subcategory"]');
      if (!sub) {
        sub = document.createElement('input');
        sub.type = 'hidden';
        sub.name = 'subcategory';
        form.appendChild(sub);
      }
      syncingFromForm = true;
      sub.value = templateId;
      if (opts.profileId) window.__MIRA_LANE_PROFILE_ID__ = opts.profileId;
      const tmplId = profileIdToTemplateId(opts.profileId);
      const sel = form.querySelector('select[name="serviceTemplateId"]');
      if (sel && tmplId) {
        if (![...sel.options].some((o) => o.value === tmplId)) {
          const opt = document.createElement('option');
          opt.value = tmplId;
          opt.textContent = opts.label || tmplId;
          sel.appendChild(opt);
        }
        if (sel.value !== tmplId) {
          sel.value = tmplId;
          sel.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }
      setDetailHeading(form, opts.label || LABEL_BY_ID[templateId] || templateId);
      sub.dispatchEvent(new Event('change', { bubbles: true }));
      syncingFromForm = false;
      return;
    }
    const sel = form.querySelector('select[name="serviceTemplateId"]');
    if (sel && sel.value !== templateId) {
      syncingFromForm = true;
      sel.value = templateId;
      sel.dispatchEvent(new Event('change', { bubbles: true }));
      syncingFromForm = false;
    }
    setDetailHeading(form, opts.label || LABEL_BY_ID[templateId] || templateId);
  }

  function paintOrbs(form) {
    if (!form) return;
    const host = mainCirclesHost(form);
    if (!host) return;
    loadBeautyTaxonomy(false).then(() => {
      if (resolveForm() && resolveForm() !== form) return;
      paintOrbsAfterTaxonomy(form);
    });
  }

  function paintOrbsAfterTaxonomy(form) {
    if (!form) return;
    const host = mainCirclesHost(form);
    if (!host) return;
    // Drop stale orbs on inactive forms (duplicate ids from catalogForm + serviceForm).
    document.querySelectorAll('[data-testid="e2c-main-circles"]').forEach((h) => {
      if (h !== host) h.replaceChildren();
    });
    const cats = categoriesFromForm(form);
    host.replaceChildren();
    if (!cats.length) {
      host.appendChild(
        el('p', {
          className: 'lead',
          'data-testid': 'e2c-orbs-empty',
          text: 'لا توجد تصنيفات خدمة في النموذج.',
        }),
      );
      return;
    }
    cats.forEach((cat) => {
      const orb = el('span', { className: 'e2b-circle-orb' });
      orb.style.backgroundImage = "url('" + cat.orb + "')";
      // Guard: nails must never use accessories/jewelry asset.
      if (cat.id === 'nails' && /accessories/.test(cat.orb)) {
        orb.style.backgroundImage = "url('assets/e2b-ref/orbs/nails.png')";
      }
      const btn = el(
        'button',
        {
          type: 'button',
          className: 'e2b-circle' + (selectedCatId === cat.id ? ' is-selected' : ''),
          'data-testid': 'e2c-main-circle',
          'data-category-id': cat.id,
          'data-orb-src': cat.id === 'nails' ? 'assets/e2b-ref/orbs/nails.png' : cat.orb,
          'aria-pressed': selectedCatId === cat.id ? 'true' : 'false',
          onClick: () => selectCategory(cat.id, { fromCircle: true }),
        },
        [orb, el('span', { className: 'e2b-circle-label', text: cat.labelAr })],
      );
      if (selectedCatId === cat.id) {
        btn.appendChild(el('span', { className: 'e2c-check', text: '✓' }));
      }
      host.appendChild(btn);
    });
    if (selectedCatId) paintSubOrbs(form, selectedCatId);
  }

  function selectCategory(catId, opts) {
    opts = opts || {};
    const same = selectedCatId === catId;
    selectedCatId = catId || null;
    if (!same && !opts.preserveSub) {
      selectedSubId = null;
      selectedGroupId = null;
      setDetailHeading(resolveForm(), null);
    }
    const form = resolveForm();
    const host = mainCirclesHost(form);
    (host ? host.querySelectorAll('.e2b-circle') : []).forEach((b) => {
      const on = b.getAttribute('data-category-id') === catId;
      b.classList.toggle('is-selected', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      const mark = b.querySelector('.e2c-check');
      if (on && !mark) b.appendChild(el('span', { className: 'e2c-check', text: '✓' }));
      else if (!on && mark) mark.remove();
    });
    const catSel = form && form.querySelector('select[name="category"]');
    if (catSel && catId && catSel.value !== catId && !opts.fromSync) {
      syncingFromForm = true;
      if (![...catSel.options].some((o) => o.value === catId)) {
        const opt = document.createElement('option');
        opt.value = catId;
        opt.textContent = LABEL_BY_ID[catId] || catId;
        catSel.appendChild(opt);
      }
      catSel.value = catId;
      catSel.dispatchEvent(new Event('change', { bubbles: true }));
      syncingFromForm = false;
    }
    if (form && catId) paintSubOrbs(form, catId);
  }

  function syncFromForm(formOverride) {
    if (syncingFromForm) return;
    const form = formOverride || resolveForm();
    if (!form) return;
    activeFormId = form.id;
    ensureWorkspace(form);
    paintOrbs(form);
    const catSel = form.querySelector('select[name="category"]');
    const catId = catSel && catSel.value;
    if (catId) selectCategory(catId, { fromSync: true, preserveSub: true });
    else selectedCatId = null;
    const tmpl = form.querySelector('select[name="serviceTemplateId"]');
    if (tmpl && tmpl.value) selectSub(tmpl.value, { fromSync: true });
  }

  function composeServiceLayout(formOverride) {
    const form = formOverride || resolveForm();
    if (!form || !document.body.classList.contains('e2b-service-mode')) return;
    if (composeBusy) return;
    composeBusy = true;
    try {
      ensureWorkspace(form);
      function byRole(role) {
        return form.querySelector('[data-section-role="' + role + '"]');
      }
      const mediaSection =
        byRole('main-media') || form.querySelector('[data-testid="catalog-main-media-section"]');
      const basics = byRole('basics');
      if (!basics) return;

      let compose = form.querySelector('[data-testid="e2c-editor-compose"]');
      let fields = form.querySelector('[data-testid="e2c-editor-fields"]');
      let mediaCol = form.querySelector('[data-testid="e2c-editor-media"]');
      const fieldOrder = ['service-orbs', 'basics', 'place', 'template', 'secondary'];
      // Preview card beside basics first; compact availability below (not above pushing preview down).
      const sideOrder = ['main-media', 'availability'];
      const advancedRoles = ['detail-media', 'details', 'commerce'];
      let advanced = form.querySelector('[data-testid="e2c-advanced-sections"]');
      if (!advanced) {
        advanced = el('details', {
          className: 'e2c-secondary-details',
          'data-testid': 'e2c-advanced-sections',
          'data-section-role': 'advanced',
        }, [el('summary', { text: 'وسائط التفاصيل والوسوم والإعدادات الإضافية' })]);
      }
      const afterCompose = ['preview-publish', 'editor-actions'];
      // Skip reshuffle only when roles are in exact approved index order (contains ≠ position).
      if (compose && fields && mediaCol) {
        const roleKids = Array.from(fields.children).filter(
          (n) => n.getAttribute && n.getAttribute('data-section-role'),
        );
        const presentFieldRoles = fieldOrder.filter((role) => !!byRole(role));
        const fieldsOk =
          presentFieldRoles.length > 0 &&
          presentFieldRoles.every((role, i) => roleKids[i] === byRole(role));
        const sideStack = mediaCol.querySelector('[data-testid="e2c-side-stack"]');
        const avail = byRole('availability');
        const sideKids = sideStack
          ? Array.from(sideStack.children).filter(
              (n) =>
                (n.getAttribute && n.getAttribute('data-section-role')) ||
                n.getAttribute('data-testid') === 'catalog-main-media-section' ||
                n.classList.contains('e2b-media-stage'),
            )
          : [];
        const mediaIdx = mediaSection ? sideKids.indexOf(mediaSection) : -1;
        const availIdx = avail ? sideKids.indexOf(avail) : -1;
        const sideOk =
          !!sideStack &&
          (!mediaSection || sideKids.includes(mediaSection)) &&
          (mediaIdx === 0 || (!mediaSection && sideKids[0] === avail)) &&
          (availIdx < 0 || mediaIdx < 0 || mediaIdx < availIdx);
        const advancedOk = advanced.parentElement === form && compose.nextElementSibling === advanced &&
          advancedRoles.every((role) => !byRole(role) || byRole(role).parentElement === advanced);
        const noContentBeforeCompose = Array.from(form.children).every((node) =>
          node === compose || !node.hasAttribute('data-section-role') ||
          !!(compose.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING));
        const alreadyOrdered = fieldsOk && sideOk && advancedOk && noContentBeforeCompose &&
          form.contains(compose) && fields.parentElement === compose;
        if (alreadyOrdered && !compose.hidden) {
          compose.setAttribute('data-e2c-compose-stable', '1');
          compose.setAttribute(
            'data-e2c-field-order',
            roleKids.map((n) => n.getAttribute('data-section-role')).join(','),
          );
          const actionsBarEarly = form.querySelector('[data-testid="e2b-editor-actions"]');
          const saveEarly = document.getElementById(form.id + '-save');
          const ctaEarly = actionsBarEarly
            ? [actionsBarEarly]
            : [saveEarly, form.querySelector('[data-testid="catalog-submit-review"]')].filter(Boolean);
          mountServiceMobileSteps(
            form,
            compose,
            fields,
            mediaCol,
            advanced,
            afterCompose.map(byRole).filter(Boolean),
            ctaEarly,
          );
          return;
        }
      }
      if (!compose || !fields || !mediaCol) {
        compose = el('div', {
          className: 'e2b-editor-compose e2c-editor-compose',
          'data-testid': 'e2c-editor-compose',
        });
        fields = el('div', { className: 'e2b-editor-fields', 'data-testid': 'e2c-editor-fields' });
        mediaCol = el('div', { className: 'e2b-editor-media e2c-side-tools', 'data-testid': 'e2c-editor-media' });
        compose.append(fields, mediaCol);
      }

      const actionsBar = form.querySelector('[data-testid="e2b-editor-actions"]');
      const save = document.getElementById(form.id + '-save');
      const ctaNodes = actionsBar
        ? [actionsBar]
        : [save, form.querySelector('[data-testid="catalog-submit-review"]')].filter(Boolean);

      fieldOrder.forEach((role) => {
        const node = byRole(role);
        if (node) fields.appendChild(node);
      });
      // Side column: media preview first (beside fields), then compact availability.
      let sideStack = mediaCol.querySelector('[data-testid="e2c-side-stack"]');
      if (!sideStack) {
        sideStack = el('div', { className: 'e2c-side-stack', 'data-testid': 'e2c-side-stack' });
        mediaCol.appendChild(sideStack);
      }
      sideOrder.forEach((role) => {
        const node = role === 'main-media' ? mediaSection : byRole(role);
        if (node) {
          if (role === 'main-media') node.classList.add('e2b-media-stage');
          sideStack.appendChild(node);
        }
      });
      compose.hidden = false;
      compose.removeAttribute('data-e2c-inactive');
      compose.setAttribute('data-e2c-compose-stable', '1');

      const tail = [];
      afterCompose.forEach((role) => {
        const node = byRole(role);
        if (node) tail.push(node);
      });

      // Move existing nodes, preserving inputs, event handlers and selected files.
      advancedRoles.forEach((role) => {
        const node = byRole(role);
        if (node && node.parentElement !== advanced) advanced.appendChild(node);
      });
      // Place the editor before legacy role sections; status/help nodes may stay above it.
      const firstSection = Array.from(form.children).find((node) =>
        node === compose || node.hasAttribute('data-section-role'));
      if (firstSection !== compose) form.insertBefore(compose, firstSection || null);
      compose.after(advanced);
      tail.forEach((n) => form.appendChild(n));
      ctaNodes.forEach((n) => form.appendChild(n));
      mountServiceMobileSteps(form, compose, fields, mediaCol, advanced, tail, ctaNodes);
    } finally {
      composeBusy = false;
    }
  }

  function isNarrowServiceViewport() {
    return typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 900px)').matches;
  }

  function mountServiceMobileSteps(form, compose, fields, mediaCol, advanced, tail, ctaNodes) {
    if (!form || !compose) return;
    let nav = form.querySelector('[data-testid="e2c-mobile-steps"]');
    if (!nav) {
      nav = el('nav', {
        className: 'e2b-mobile-steps e2c-mobile-steps e2b-editor-tabs',
        'data-testid': 'e2c-mobile-steps',
        role: 'tablist',
        'aria-label': 'تبويبات محرر الخدمة',
      });
      form.insertBefore(nav, compose);
    } else {
      nav.classList.add('e2b-editor-tabs');
    }
    const steps = [
      { id: 'basics', label: 'الأساسيات', fieldRoles: ['service-orbs', 'basics', 'template', 'secondary'], showMedia: true, showAdvanced: false, showTail: false },
      { id: 'place', label: 'المكان', fieldRoles: ['place'], showMedia: true, showAdvanced: false, showTail: false },
      { id: 'schedule', label: 'الإتاحة والتقويم', fieldRoles: ['availability'], showMedia: false, showAdvanced: true, showTail: false },
      { id: 'media', label: 'الوسائط والتفاصيل', fieldRoles: [], showMedia: true, showAdvanced: false, showTail: true },
    ];
    const current = form.dataset.e2cMobileStep || 'basics';
    nav.replaceChildren();
    steps.forEach((step) => {
      const btn = el('button', {
        type: 'button',
        className: 'e2b-mobile-step' + (step.id === current ? ' is-active' : ''),
        'data-step': step.id,
        'data-testid': 'e2c-mobile-step-' + step.id,
        role: 'tab',
        'aria-selected': step.id === current ? 'true' : 'false',
      });
      btn.textContent = step.label;
      btn.addEventListener('click', () => {
        form.dataset.e2cMobileStep = step.id;
        applyServiceMobileStep(form, steps, step.id, compose, fields, mediaCol, advanced, tail, ctaNodes);
        mountServiceMobileSteps(form, compose, fields, mediaCol, advanced, tail, ctaNodes);
      });
      nav.appendChild(btn);
    });
    applyServiceMobileStep(form, steps, current, compose, fields, mediaCol, advanced, tail, ctaNodes);
  }

  function applyServiceMobileStep(form, steps, stepId, compose, fields, mediaCol, advanced, tail, ctaNodes) {
    const active = steps.find((s) => s.id === stepId) || steps[0];
    form.dataset.e2cMobileStep = active.id;
    form.setAttribute('data-e2c-mobile-step', active.id);
    const narrow = isNarrowServiceViewport();
    const byRole = (role) => form.querySelector('[data-section-role="' + role + '"]');
    // Always one tab of fields — never expand all on desktop via !narrow.
    ['service-orbs', 'basics', 'place', 'template', 'secondary'].forEach((role) => {
      const node = byRole(role);
      if (!node) return;
      const show = active.fieldRoles.indexOf(role) >= 0;
      node.hidden = !show;
      node.classList.toggle('e2b-step-hidden', !show);
    });
    if (fields) {
      const any = active.fieldRoles.some((role) => byRole(role));
      fields.hidden = !any;
      fields.classList.toggle('e2b-step-hidden', !any);
    }
    if (mediaCol) {
      const show = !narrow || active.showMedia || active.id === 'basics' || active.id === 'place';
      mediaCol.hidden = !show;
      mediaCol.classList.toggle('e2b-step-hidden', !show);
    }
    if (advanced) {
      const show = !!active.showAdvanced;
      advanced.hidden = !show;
      advanced.classList.toggle('e2b-step-hidden', !show);
    }
    (tail || []).forEach((node) => {
      if (!node) return;
      const role = node.getAttribute && node.getAttribute('data-section-role');
      const always =
        role === 'editor-actions' ||
        (node.getAttribute && node.getAttribute('data-testid') === 'e2b-editor-actions') ||
        (node.classList && node.classList.contains('e2b-editor-actions')) ||
        (node.classList && node.classList.contains('e2b-mobile-actions-always'));
      if (always) {
        node.hidden = false;
        node.classList.remove('e2b-step-hidden');
        return;
      }
      const show = !!active.showTail;
      node.hidden = !show;
      node.classList.toggle('e2b-step-hidden', !show);
    });
    (ctaNodes || []).forEach((n) => {
      if (!n) return;
      n.classList.add('e2b-mobile-actions-always');
      n.hidden = false;
      n.classList.remove('e2b-step-hidden');
      if (n.style && n.style.display === 'none') n.style.display = '';
    });
    const actionsRole = form.querySelector('[data-section-role="editor-actions"]');
    if (actionsRole) {
      actionsRole.hidden = false;
      actionsRole.classList.remove('e2b-step-hidden');
    }
    if (compose) compose.hidden = false;
  }

  function enableServiceMode(formId) {
    activeFormId = formId || activeFormId || 'catalogForm';
    document.body.classList.add('e2b-service-mode');
    clearProductModeArtifacts();
    const form = resolveForm();
    if (form) {
      ensureWorkspace(form);
      syncFromForm(form);
      composeServiceLayout(form);
    }
  }

  function disableServiceMode() {
    document.body.classList.remove('e2b-service-mode', 'e2b-editor-focus');
    restoreProductHosts();
    activeFormId = null;
    selectedCatId = null;
    selectedGroupId = null;
    selectedSubId = null;
  }

  function focusEditor(formId) {
    enableServiceMode(formId);
    document.body.classList.add('e2b-editor-focus');
    if (window.MiraPortalShell && typeof MiraPortalShell.openServiceEditor === 'function') {
      MiraPortalShell.openServiceEditor();
      return;
    }
    const form = resolveForm();
    if (form) form.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function wireFormSync() {
    if (formWired) return;
    formWired = true;
    document.addEventListener(
      'change',
      (e) => {
        const t = e.target;
        if (!t || !t.name) return;
        if (!document.body.classList.contains('e2b-service-mode')) return;
        const form = t.closest('form');
        if (!form || (form.id !== 'catalogForm' && form.id !== 'serviceForm')) return;
        if (form.id !== activeFormId && activeFormId) return;
        if (syncingFromForm) return;
        if (t.name === 'category' || t.name === 'serviceTemplateId') {
          activeFormId = form.id;
          syncFromForm(form);
          // Re-assert approved layout after category/template swaps (no parallel form).
          composeServiceLayout(form);
        }
      },
      true,
    );
  }

  function init() {
    wireFormSync();
    loadBeautyTaxonomy(false);
    const go = document.getElementById('goService');
    if (go && go.dataset.e2cWired !== '1') {
      go.dataset.e2cWired = '1';
      go.addEventListener(
        'click',
        () => {
          if (window.MiraE2BProductShell && typeof MiraE2BProductShell.disableProductMode === 'function') {
            try {
              MiraE2BProductShell.disableProductMode();
            } catch (_) {
              /* optional */
            }
          }
          document.body.classList.remove('e2b-product-mode');
          const developer = (document.body.dataset.partnerType || '') === 'developer';
          focusEditor(developer ? 'serviceForm' : 'catalogForm');
        },
        true,
      );
    }
    const goProd = document.getElementById('goProduct');
    if (goProd && goProd.dataset.e2cIsolate !== '1') {
      goProd.dataset.e2cIsolate = '1';
      goProd.addEventListener(
        'click',
        () => {
          disableServiceMode();
        },
        true,
      );
    }
  }

  window.MiraE2BServiceShell = {
    init: init,
    enableServiceMode: enableServiceMode,
    disableServiceMode: disableServiceMode,
    focusEditor: focusEditor,
    syncFromForm: syncFromForm,
    composeServiceLayout: composeServiceLayout,
    selectCategory: selectCategory,
    selectSub: selectSub,
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
