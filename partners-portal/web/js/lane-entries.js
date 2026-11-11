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

  /** Visibility by partner.type + profile.partnerTypes (no new ACL table). */
  function laneAllowed(laneId) {
    var meta = LANE_META[laneId];
    if (!meta) return false;
    var t = partnerType();
    if (t === 'developer') return true;
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
    var draftCtx = {
      profileId: meta.profileId,
      kind: 'service',
      values: {
        category: 'occasions',
        subcategory: 'occasions.styling',
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

  function paintLaneEntries() {
    var host = document.getElementById('laneEntries');
    if (!host) return;
    host.replaceChildren();
    var lead = document.createElement('p');
    lead.className = 'lead';
    lead.textContent = 'مداخل الأقسام المستقلة — دون المرور عبر أناقتك/خدماتي.';
    host.appendChild(lead);
    var row = document.createElement('div');
    row.className = 'journey-actions';
    row.setAttribute('data-testid', 'lane-entries');
    host.appendChild(row);

    function addBtn(id, label, onClick) {
      if (!laneAllowed(id) && id !== 'occasions_favors') return;
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn btn-primary';
      btn.id = 'laneEntry_' + id;
      btn.setAttribute('data-testid', 'lane-entry-' + id);
      btn.textContent = label;
      btn.addEventListener('click', function () {
        Promise.resolve(onClick()).catch(function (e) {
          console.warn('[lane-entries]', e);
          alert((e && e.message) || 'تعذر فتح القسم');
        });
      });
      row.appendChild(btn);
    }

    addBtn('jewelry', 'المجوهرات', function () {
      return openProductLane('jewelry');
    });
    addBtn('children', 'الأطفال', function () {
      return openProductLane('children');
    });
    addBtn('gifts', 'الهدايا', function () {
      return openProductLane('gifts');
    });
    if (laneAllowed('occasions')) {
      addBtn('occasions', 'مناسباتك — عرض حجز', function () {
        return openOccasionsService();
      });
    }
    // Favors sell: brand, developer, or event_planner with canSellProducts.
    var t = partnerType();
    if (t === 'brand' || t === 'developer' || (t === 'event_planner' && canSellProducts())) {
      var fav = document.createElement('button');
      fav.type = 'button';
      fav.className = 'btn btn-ghost';
      fav.id = 'laneEntry_occasions_favors';
      fav.setAttribute('data-testid', 'lane-entry-occasions-favors');
      fav.textContent = 'مناسباتك — توزيعات للبيع';
      fav.addEventListener('click', function () {
        Promise.resolve(openOccasionsProductSell('occasions.favors')).catch(function (e) {
          console.warn('[lane-entries]', e);
        });
      });
      row.appendChild(fav);
    }
  }

  window.MiraLaneEntries = {
    LANE_META: LANE_META,
    laneAllowed: laneAllowed,
    setLaneLock: setLaneLock,
    clearLaneLock: clearLaneLock,
    openProductLane: openProductLane,
    openOccasionsService: openOccasionsService,
    openOccasionsProductSell: openOccasionsProductSell,
    paintLaneEntries: paintLaneEntries,
  };
})();
