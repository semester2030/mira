/**
 * Independent taxonomy lane entries (jewelry · children · gifts · occasions).
 * Locks window.__MIRA_TAXONOMY_LANE__, reloads taxonomy, reuses product/service shells.
 */
(function () {
  var LANE_META = {
    jewelry: { labelAr: 'المجوهرات', kind: 'product', profileId: 'product.jewelry', category: 'jewelry' },
    children: { labelAr: 'الأطفال', kind: 'product', profileId: 'product.kids', category: 'children' },
    gifts: { labelAr: 'الهدايا', kind: 'product', profileId: 'product.gifts', category: 'gifts' },
    occasions: { labelAr: 'مناسباتك', kind: 'service', profileId: 'service.occasions', category: 'occasions' },
  };

  function partnerType() {
    return (window.sessionPartner && window.sessionPartner.type) || document.body.dataset.partnerType || '';
  }

  function canSellProducts() {
    var p = window.sessionPartner || {};
    return p.canSellProducts === true;
  }

  /** Visibility by activity grants when present; else partner.type (legacy). */
  function laneAllowed(laneId) {
    var meta = LANE_META[laneId];
    if (!meta) return false;
    var t = partnerType();
    if (t === 'developer') return true;
    var grants = window.sessionActivities && window.sessionActivities.grants;
    if (Array.isArray(grants) && grants.length) {
      var prefixes = {
        elegance: ['clothes.', 'bags.', 'shoes.', 'face.', 'body.', 'hair.', 'accessories.'],
        beauty: ['face.', 'body.', 'hair.', 'service.salon', 'service.clinic'],
        jewelry: ['jewelry.'],
        children: ['children.'],
        gifts: ['gifts.'],
        occasions: ['occasions.'],
      };
      var prefs = prefixes[laneId] || [];
      return grants.some(function (g) {
        var a = String(g.activity || '');
        return prefs.some(function (p) {
          return a.indexOf(p) === 0;
        });
      });
    }
    if (meta.kind === 'product') {
      if (t === 'brand') return true;
      if (t === 'event_planner' && laneId === 'occasions') return canSellProducts();
      return false;
    }
    // occasions service
    return t === 'salon' || t === 'clinic' || t === 'event_planner';
  }

  function setLaneLock(laneId) {
    window.__MIRA_TAXONOMY_LANE__ = laneId || 'elegance';
    window.__MIRA_LANE_PROFILE_ID__ = (LANE_META[laneId] && LANE_META[laneId].profileId) || null;
    window.__MIRA_LANE_LABEL_AR__ = (LANE_META[laneId] && LANE_META[laneId].labelAr) || null;
    try {
      document.body.dataset.taxonomyLane = laneId || 'elegance';
      if (window.__MIRA_LANE_LABEL_AR__) document.body.dataset.laneLabelAr = window.__MIRA_LANE_LABEL_AR__;
      else delete document.body.dataset.laneLabelAr;
    } catch (_) {
      /* optional */
    }
  }

  function clearLaneLock() {
    setLaneLock('elegance');
    window.__MIRA_LANE_PROFILE_ID__ = null;
    window.__MIRA_LANE_LABEL_AR__ = null;
  }

  /** Drop stale taxonomy banners on inactive forms (labeled boot paints serviceForm errors). */
  function clearInactiveTaxonomyBanners(activeFormId) {
    document.querySelectorAll('[data-testid="taxonomy-load-error"], [data-testid="taxonomy-load-retry"], [data-testid="e2b-taxonomy-load-error"], [data-testid="e2b-taxonomy-retry"]').forEach(function (n) {
      var form = n.closest('form');
      if (!form || form.id === activeFormId) return;
      n.remove();
    });
  }

  async function reloadProductTaxonomy() {
    if (window.MiraE2BProductShell && typeof MiraE2BProductShell.clearTaxonomyCache === 'function') {
      MiraE2BProductShell.clearTaxonomyCache();
    }
    if (window.MiraE2BProductShell && typeof MiraE2BProductShell.reloadTaxonomy === 'function') {
      await MiraE2BProductShell.reloadTaxonomy({ force: true });
    }
  }

  async function openProductLane(laneId) {
    var meta = LANE_META[laneId];
    if (!meta || meta.kind !== 'product') throw new Error('LANE_NOT_PRODUCT');
    if (!laneAllowed(laneId)) throw new Error('LANE_FORBIDDEN');
    setLaneLock(laneId);
    if (window.MiraE2BServiceShell && typeof MiraE2BServiceShell.disableServiceMode === 'function') {
      try {
        MiraE2BServiceShell.disableServiceMode();
      } catch (_) {
        /* optional */
      }
    }
    var bulk = document.getElementById('bulkSection');
    if (bulk) bulk.classList.add('hidden');
    var draftCtx = {
      profileId: meta.profileId,
      kind: 'product',
      values: { category: meta.category, taxonomyLane: laneId },
      status: 'draft',
    };
    if (typeof window.renderForm === 'function') {
      window.renderForm('brand', null, 'catalogForm', 'catalogTitle', null, draftCtx);
    }
    clearInactiveTaxonomyBanners('catalogForm');
    var title = document.getElementById('catalogTitle');
    if (title) title.textContent = meta.labelAr;
    await reloadProductTaxonomy();
    if (window.MiraPortalShell && typeof MiraPortalShell.openProductEditor === 'function') {
      MiraPortalShell.openProductEditor();
    }
    if (window.MiraE2BProductShell) {
      if (typeof MiraE2BProductShell.enableProductMode === 'function') MiraE2BProductShell.enableProductMode();
      if (typeof MiraE2BProductShell.focusEditor === 'function') MiraE2BProductShell.focusEditor();
      // Auto-select the lane root so elegance branches stay hidden.
      if (typeof MiraE2BProductShell.selectMain === 'function') {
        try {
          MiraE2BProductShell.selectMain({ id: meta.category, labelAr: meta.labelAr });
        } catch (_) {
          /* optional */
        }
      }
    }
    paintLaneSwitcher();
  }

  async function openOccasionsService(opts) {
    opts = opts || {};
    var meta = LANE_META.occasions;
    if (!laneAllowed('occasions') && !opts.force) throw new Error('LANE_FORBIDDEN');
    setLaneLock('occasions');
    if (window.MiraE2BProductShell && typeof MiraE2BProductShell.disableProductMode === 'function') {
      try {
        MiraE2BProductShell.disableProductMode();
      } catch (_) {
        /* optional */
      }
    }
    var bulk = document.getElementById('bulkSection');
    if (bulk) bulk.classList.add('hidden');
    var p = window.sessionPartner || {};
    var formType = p.type === 'clinic' ? 'clinic' : p.type === 'salon' ? 'salon' : 'salon';
    if (p.type === 'developer') formType = 'salon';
    if (p.type === 'event_planner') formType = 'salon';
    var developer = p.type === 'developer';
    var formId = developer ? 'serviceForm' : 'catalogForm';
    var titleId = developer ? 'serviceTitle' : 'catalogTitle';
    // Do not force a single leaf — partner picks packages/hospitality/buffet/… then multi-selects occasions.
    var draftCtx = {
      profileId: meta.profileId,
      kind: 'service',
      values: {
        category: 'occasions',
        subcategory: opts.subcategory || null,
        taxonomyLane: 'occasions',
        occasionTypeIds: opts.occasionTypeIds || [],
        occasionServiceOffer: opts.occasionServiceOffer || null,
      },
      status: 'draft',
    };
    if (typeof window.renderForm === 'function') {
      window.renderForm(formType, null, formId, titleId, 'عرض مناسبة — حجز', draftCtx);
    }
    clearInactiveTaxonomyBanners(formId);
    var title = document.getElementById(titleId);
    if (title) title.textContent = 'مناسباتك — إضافة عرض';
    // event_planner uses catalog-as-services; openServiceEditor must show catalogSection.
    if (window.MiraPortalShell && typeof MiraPortalShell.openServiceEditor === 'function') {
      MiraPortalShell.openServiceEditor();
    }
    if (window.MiraE2BServiceShell) {
      if (typeof MiraE2BServiceShell.enableServiceMode === 'function') {
        try {
          MiraE2BServiceShell.enableServiceMode();
        } catch (_) {
          /* optional */
        }
      }
      if (typeof MiraE2BServiceShell.focusEditor === 'function') {
        MiraE2BServiceShell.focusEditor(formId);
      }
      if (typeof MiraE2BServiceShell.syncFromForm === 'function') {
        try {
          MiraE2BServiceShell.syncFromForm(document.getElementById(formId));
        } catch (_) {
          /* optional */
        }
      }
    }
  }

  /** Explicit product sell exception: favors/decor under occasions lane. */
  async function openOccasionsProductSell(subcategory) {
    if (!laneAllowed('occasions') && partnerType() !== 'brand' && partnerType() !== 'developer') {
      if (!(partnerType() === 'event_planner' && canSellProducts())) throw new Error('LANE_FORBIDDEN');
    }
    setLaneLock('occasions');
    var draftCtx = {
      profileId: 'product.occasions_favors',
      kind: 'product',
      values: {
        category: 'occasions',
        subcategory: subcategory || 'occasions.favors',
        taxonomyLane: 'occasions',
      },
      status: 'draft',
    };
    if (typeof window.renderForm === 'function') {
      window.renderForm('brand', null, 'catalogForm', 'catalogTitle', 'بيع توزيعات/ضيافة', draftCtx);
    }
    clearInactiveTaxonomyBanners('catalogForm');
    var title = document.getElementById('catalogTitle');
    if (title) title.textContent = 'مناسباتك — بيع';
    await reloadProductTaxonomy();
    if (window.MiraPortalShell && typeof MiraPortalShell.openProductEditor === 'function') {
      MiraPortalShell.openProductEditor();
    }
    if (window.MiraE2BProductShell) {
      if (typeof MiraE2BProductShell.enableProductMode === 'function') MiraE2BProductShell.enableProductMode();
      if (typeof MiraE2BProductShell.focusEditor === 'function') MiraE2BProductShell.focusEditor();
    }
  }

  async function openEleganceProduct() {
    clearLaneLock();
    if (window.MiraE2BServiceShell && typeof MiraE2BServiceShell.disableServiceMode === 'function') {
      try {
        MiraE2BServiceShell.disableServiceMode();
      } catch (_) {
        /* optional */
      }
    }
    var bulk = document.getElementById('bulkSection');
    if (bulk) bulk.classList.add('hidden');
    // «إضافة منتج» always opens a blank form — never reuse a previously opened item.
    if (typeof window.renderForm === 'function') {
      window.renderForm('brand', null, 'catalogForm', 'catalogTitle');
    }
    clearInactiveTaxonomyBanners('catalogForm');
    var title = document.getElementById('catalogTitle');
    if (title) title.textContent = 'أناقتك — إضافة منتج';
    await reloadProductTaxonomy();
    if (window.MiraPortalShell && typeof MiraPortalShell.openProductEditor === 'function') {
      MiraPortalShell.openProductEditor();
    }
    if (window.MiraE2BProductShell) {
      if (typeof MiraE2BProductShell.enableProductMode === 'function') MiraE2BProductShell.enableProductMode();
      if (typeof MiraE2BProductShell.focusEditor === 'function') MiraE2BProductShell.focusEditor();
    }
    paintLaneSwitcher();
  }

  /** Product lanes the current account may open (developer = all). */
  function productLaneChoices() {
    var out = [{ id: 'elegance', label: 'أناقتك', run: openEleganceProduct }];
    if (laneAllowed('jewelry')) out.push({ id: 'jewelry', label: 'المجوهرات', run: function () { return openProductLane('jewelry'); } });
    if (laneAllowed('children')) out.push({ id: 'children', label: 'الأطفال', run: function () { return openProductLane('children'); } });
    if (laneAllowed('gifts')) out.push({ id: 'gifts', label: 'الهدايا', run: function () { return openProductLane('gifts'); } });
    var t = partnerType();
    if (t === 'brand' || t === 'developer' || (t === 'event_planner' && canSellProducts())) {
      out.push({
        id: 'occasions_favors',
        label: 'توزيعات المناسبات',
        run: function () { return openOccasionsProductSell('occasions.favors'); },
      });
    }
    return out;
  }

  function serviceLaneChoices() {
    var out = [];
    if (laneAllowed('occasions') || partnerType() === 'developer') {
      out.push({
        id: 'occasions',
        label: 'مناسباتك — حجز',
        run: function () { return openOccasionsService({ force: partnerType() === 'developer' }); },
      });
    }
    return out;
  }

  function paintLaneSwitcher() {
    var hosts = [];
    var editorHost = document.getElementById('e2bLaneSwitcher');
    if (editorHost) hosts.push(editorHost);
    var listHost = document.getElementById('e2bLaneSwitcherList');
    if (listHost) hosts.push(listHost);
    var pageHost = document.getElementById('laneEntries');
    if (pageHost) hosts.push(pageHost);
    if (!hosts.length) return;

    var active = window.__MIRA_TAXONOMY_LANE__ || 'elegance';
    if (active === 'occasions' && window.__MIRA_LANE_PROFILE_ID__ === 'product.occasions_favors') {
      active = 'occasions_favors';
    }
    var choices = productLaneChoices();

    hosts.forEach(function (host) {
      host.replaceChildren();
      var lead = document.createElement('p');
      lead.className = 'e2b-cat-heading';
      lead.textContent = 'اختر القسم (مداخل مستقلة)';
      host.appendChild(lead);
      var row = document.createElement('div');
      row.className = 'e2b-circle-list e2b-circle-list-horizontal journey-actions';
      row.setAttribute('data-testid', 'lane-entries');
      host.appendChild(row);
      choices.forEach(function (choice) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn ' + (choice.id === active || (choice.id === 'elegance' && active === 'elegance') ? 'btn-primary' : 'btn-ghost');
        btn.id = 'laneEntry_' + choice.id;
        btn.setAttribute('data-testid', 'lane-entry-' + choice.id);
        btn.setAttribute('data-lane-id', choice.id);
        btn.textContent = choice.label;
        if (choice.id === active) btn.classList.add('is-selected');
        btn.addEventListener('click', function () {
          Promise.resolve(choice.run()).then(function () {
            paintLaneSwitcher();
          }).catch(function (e) {
            console.warn('[lane-entries]', e);
            alert((e && e.message) || 'تعذر فتح القسم');
          });
        });
        row.appendChild(btn);
      });
      // Occasions booking belongs to services — still surface for developer on product list.
      if (host.id === 'laneEntries' || host.id === 'e2bLaneSwitcherList') {
        serviceLaneChoices().forEach(function (choice) {
          var btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'btn btn-ghost';
          btn.id = 'laneEntry_' + choice.id;
          btn.setAttribute('data-testid', 'lane-entry-' + choice.id);
          btn.textContent = choice.label;
          btn.addEventListener('click', function () {
            Promise.resolve(choice.run()).catch(function (e) {
              console.warn('[lane-entries]', e);
              alert((e && e.message) || 'تعذر فتح القسم');
            });
          });
          row.appendChild(btn);
        });
      }
    });
  }

  function paintLaneEntries() {
    paintLaneSwitcher();
  }

  /** Called by «إضافة منتج» — open chooser when multiple product lanes exist. */
  async function startProductAdd() {
    var choices = productLaneChoices();
    if (choices.length <= 1) {
      return openEleganceProduct();
    }
    // Prefer switcher in editor; open elegance first so the shell exists, then keep switcher visible.
    await openEleganceProduct();
    paintLaneSwitcher();
    var switcher = document.getElementById('e2bLaneSwitcher');
    if (switcher) {
      switcher.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      switcher.classList.add('is-pulse');
      window.setTimeout(function () { switcher.classList.remove('is-pulse'); }, 1200);
    }
  }

  async function startServiceAdd(fallback) {
    var choices = serviceLaneChoices();
    if (choices.length && (partnerType() === 'developer' || laneAllowed('occasions'))) {
      // Keep classic salon/clinic path via fallback; also ensure occasions is one click away.
      if (typeof fallback === 'function') fallback();
      paintLaneSwitcher();
      return;
    }
    if (typeof fallback === 'function') return fallback();
  }

  window.MiraLaneEntries = {
    LANE_META: LANE_META,
    laneAllowed: laneAllowed,
    setLaneLock: setLaneLock,
    clearLaneLock: clearLaneLock,
    openEleganceProduct: openEleganceProduct,
    openProductLane: openProductLane,
    openOccasionsService: openOccasionsService,
    openOccasionsProductSell: openOccasionsProductSell,
    paintLaneEntries: paintLaneEntries,
    paintLaneSwitcher: paintLaneSwitcher,
    productLaneChoices: productLaneChoices,
    startProductAdd: startProductAdd,
    startServiceAdd: startServiceAdd,
  };
})();
