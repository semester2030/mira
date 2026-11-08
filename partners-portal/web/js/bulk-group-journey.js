/**
 * Sequential mobile «إضافة مجموعة» journey.
 * One video + fields per offer → summary → one-shot publish.
 * Replaces the count/cards/shared-fill surface for partners.
 */
(function () {
  const HALALAS_PER_SAR = 100;
  const VIDEO_MAX_SECONDS = 300;

  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach((k) => {
        if (k === 'className') node.className = attrs[k];
        else if (k === 'text') node.textContent = attrs[k];
        else if (k === 'html') node.innerHTML = attrs[k];
        else if (k.startsWith('on') && typeof attrs[k] === 'function') {
          node.addEventListener(k.slice(2).toLowerCase(), attrs[k]);
        } else if (attrs[k] === false || attrs[k] == null) {
          /* skip */
        } else if (attrs[k] === true) node.setAttribute(k, k);
        else node.setAttribute(k, attrs[k]);
      });
    }
    (children || []).forEach((c) => {
      if (c == null) return;
      node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return node;
  }

  function newBatchId() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID().replace(/-/g, '').slice(0, 32);
    return 'b' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  }

  function newClientMediaId() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'm' + Date.now() + '-' + Math.random().toString(36).slice(2);
  }

  function sarToHalalas(sarStr) {
    const t = String(sarStr == null ? '' : sarStr).trim();
    if (!t) return null;
    if (!/^\d+(\.\d{1,2})?$/.test(t)) throw new Error('السعر بالريال غير صالح');
    const [r, f] = t.split('.');
    const frac = (f || '').padEnd(2, '0').slice(0, 2);
    const h = Number(r) * HALALAS_PER_SAR + Number(frac || 0);
    if (!Number.isInteger(h) || h < 0) throw new Error('السعر بالريال غير صالح');
    return h;
  }

  function halalasToSar(h) {
    if (h == null || h === '') return '';
    const n = Number(h);
    if (!Number.isFinite(n)) return '';
    return (n / HALALAS_PER_SAR).toFixed(2).replace(/\.00$/, '');
  }

  function setBulkUrl(batchId, cardId) {
    const u = new URL(location.href);
    if (batchId) u.searchParams.set('bulk', batchId);
    else u.searchParams.delete('bulk');
    if (cardId) u.searchParams.set('card', cardId);
    else u.searchParams.delete('card');
    history.replaceState(null, '', u.pathname + u.search + u.hash);
  }

  function profilesFromRegistry(registry, partner, kind) {
    const root = (registry && registry.registry) || registry || {};
    const profiles = root.profiles || [];
    const type = partner && partner.type;
    return profiles
      .filter((p) => p.kind === kind)
      .filter((p) => {
        if (p.enabledByDefault === false || p.phase === 'FUTURE_EXTENSION') return false;
        const allowed = p.partnerTypes || [];
        if (!allowed.length) return true;
        if (type === 'developer') return true;
        return allowed.indexOf(type) >= 0;
      })
      .map((p) => ({ id: p.id, label: p.labelAr || p.label || p.id, fields: p.fields || [] }));
  }

  function readVideoDuration(file) {
    return new Promise((resolve) => {
      const v = document.createElement('video');
      v.preload = 'metadata';
      v.onloadedmetadata = () => {
        resolve(v.duration || 0);
        URL.revokeObjectURL(v.src);
      };
      v.onerror = () => resolve(0);
      v.src = URL.createObjectURL(file);
    });
  }

  async function openGroupJourney(root, partner) {
    root.innerHTML = '';
    root.classList.add('bulk-journey-root');

    const PartnersApi = window.PartnersApi;
    if (!PartnersApi) {
      root.appendChild(el('p', { className: 'lead', style: 'color:#b00020', text: 'واجهة الشبكة غير محمّلة' }));
      return;
    }

    let registry = null;
    let registryError = null;
    let taxonomyDoc = null;
    let taxonomyError = null;
    try {
      registry = await PartnersApi.registry();
    } catch (e) {
      registryError = (e && (e.messageAr || e.message)) || String(e);
    }
    async function loadBulkTaxonomy(force) {
      if (taxonomyDoc && !force) return taxonomyDoc;
      if (typeof PartnersApi.taxonomy !== 'function') {
        taxonomyDoc = null;
        taxonomyError = 'عميل التصنيفات (PartnersApi.taxonomy) غير متاح';
        throw new Error(taxonomyError);
      }
      const doc = await PartnersApi.taxonomy({ lane: 'elegance' });
      if (!doc || !Array.isArray(doc.nodes)) {
        taxonomyDoc = null;
        taxonomyError = 'استجابة تصنيفات غير صالحة';
        throw new Error(taxonomyError);
      }
      taxonomyDoc = doc;
      taxonomyError = null;
      return taxonomyDoc;
    }
    try {
      await loadBulkTaxonomy(false);
    } catch (e) {
      taxonomyError = (e && (e.messageAr || e.message)) || String(e);
      taxonomyDoc = null;
    }

    const pType = (partner && partner.type) || '';
    const isDeveloper = pType === 'developer';
    const canProduct = isDeveloper || pType === 'brand';
    const canService = isDeveloper || pType === 'salon' || pType === 'clinic';

    /** @type {{ step: string, batch: any, cardId: string|null, file: File|null, previewUrl: string|null, uploadPct: number, uploadStatus: string, mediaId: string|null, busy: boolean, publishResult: any }} */
    const state = {
      step: 'kind',
      batch: null,
      cardId: null,
      file: null,
      previewUrl: null,
      uploadPct: 0,
      uploadStatus: '',
      mediaId: null,
      busy: false,
      publishResult: null,
      fieldDraft: {},
    };

    const status = el('p', { className: 'lead bulk-journey-status', role: 'status' });
    const shell = el('div', { className: 'bulk-journey-shell' });
    root.appendChild(status);
    root.appendChild(shell);

    function setStatus(msg, isErr) {
      status.textContent = msg || '';
      status.style.color = isErr ? '#b00020' : '';
    }

    function cardIndex() {
      if (!state.batch || !state.cardId) return 0;
      const ids = (state.batch.cards || []).map((c) => c.cardId);
      const i = ids.indexOf(state.cardId);
      return i >= 0 ? i : 0;
    }

    function currentCard() {
      if (!state.batch || !state.cardId) return null;
      return (state.batch.cards || []).find((c) => c.cardId === state.cardId) || null;
    }

    function syncFieldDraftFromCard() {
      const card = currentCard();
      const vals = (card && card.values) || {};
      const attrs =
        window.MiraRegistryAttributeFields &&
        typeof MiraRegistryAttributeFields.extractAttributesFromValues === 'function'
          ? MiraRegistryAttributeFields.extractAttributesFromValues(
              vals,
              registry || undefined,
              { includeComponentContract: false },
            )
          : Object.assign(
              {},
              vals.attributesJson && typeof vals.attributesJson === 'object' ? vals.attributesJson : {},
              vals.attributes && typeof vals.attributes === 'object' ? vals.attributes : {},
            );
      // Contract field is stockQty. Legacy drafts may still carry `stock`.
      const stockSrc = Object.prototype.hasOwnProperty.call(vals, 'stockQty')
        ? vals.stockQty
        : Object.prototype.hasOwnProperty.call(vals, 'stock')
          ? vals.stock
          : undefined;
      let inventoryMode = vals.inventoryMode || attrs.inventoryMode || null;
      let stockStr = '';
      if (stockSrc === 0 || stockSrc === '0') {
        stockStr = '0';
        if (inventoryMode !== 'variant') inventoryMode = 'product';
      } else if (stockSrc != null && stockSrc !== '') {
        stockStr = String(stockSrc);
        if (inventoryMode !== 'variant') inventoryMode = 'product';
      } else if (inventoryMode === 'variant') {
        stockStr = '';
      } else if (inventoryMode === 'product') {
        stockStr = '';
      } else {
        inventoryMode = 'untracked';
        stockStr = '';
      }
      state.fieldDraft = {
        nameAr: vals.nameAr || '',
        priceSar: vals.priceHalalas != null ? halalasToSar(vals.priceHalalas) : '',
        descriptionAr: vals.descriptionAr || '',
        durationMin: vals.durationMin != null ? String(vals.durationMin) : '',
        deliveryMode: vals.deliveryMode || vals.fulfillmentMode || '',
        category: vals.category || '',
        // Never invent subcategory — keep stored value or empty for explicit choice.
        subcategory: Object.prototype.hasOwnProperty.call(vals, 'subcategory')
          ? vals.subcategory == null
            ? ''
            : String(vals.subcategory)
          : '',
        stock: stockStr,
        optionsJson: vals.optionsJson != null ? vals.optionsJson : null,
        variantsJson: Array.isArray(vals.variantsJson) ? vals.variantsJson : [],
        inventoryMode: inventoryMode || 'untracked',
        attributes: attrs,
        coverageCityIds: Array.isArray(vals.coverageZones)
          ? vals.coverageZones
          : Array.isArray(vals.cityIds)
            ? vals.cityIds
            : [],
      };
      state.commerceMount = null;
      state.attrMount = null;
      state.file = null;
      if (state.previewUrl && String(state.previewUrl).indexOf('blob:') === 0) {
        try {
          URL.revokeObjectURL(state.previewUrl);
        } catch (_) {}
      }
      // Restore media from server card summary — never invent ready/mediaId.
      const media = card && card.media;
      if (media && media.videoReady && media.videoMediaId) {
        state.mediaId = media.videoMediaId;
        state.uploadStatus = 'ready';
        state.uploadPct = 1;
        state.previewUrl = media.previewUrl || null;
      } else {
        state.previewUrl = null;
        state.uploadPct = 0;
        state.uploadStatus = '';
        state.mediaId = null;
      }
      state.uploadSessionId = null;
    }

    async function refreshBatch(batchId) {
      const b = await PartnersApi.getBulkBatch(batchId);
      state.batch = b;
      return b;
    }

    function buildValuesFromDraft(kind) {
      const d = state.fieldDraft;
      const values = {};
      const name = String(d.nameAr || '').trim();
      if (!name) throw new Error('الاسم مطلوب');
      values.nameAr = name;
      const price = sarToHalalas(d.priceSar);
      if (price == null) throw new Error('السعر مطلوب');
      values.priceHalalas = price;
      const desc = String(d.descriptionAr || '').trim();
      if (desc) values.descriptionAr = desc;
      if (kind === 'service') {
        const dur = Number(d.durationMin);
        if (!Number.isFinite(dur) || dur <= 0) throw new Error('مدة الخدمة مطلوبة');
        values.durationMin = Math.round(dur);
        if (d.deliveryMode) values.deliveryMode = d.deliveryMode;
      } else {
        const commerce =
          state.commerceMount && typeof state.commerceMount.getCommercePayload === 'function'
            ? state.commerceMount.getCommercePayload()
            : null;
        if (commerce) {
          if (commerce.category) values.category = commerce.category;
          if (commerce.optionsJson != null) values.optionsJson = commerce.optionsJson;
          // Only send variants when non-empty — empty [] is valid but unnecessary noise.
          if (Array.isArray(commerce.variantsJson) && commerce.variantsJson.length) {
            values.variantsJson = commerce.variantsJson;
          }
        } else {
          if (d.category) values.category = d.category;
          if (d.optionsJson != null) values.optionsJson = d.optionsJson;
          if (Array.isArray(d.variantsJson) && d.variantsJson.length) values.variantsJson = d.variantsJson;
        }
        if (!values.category && d.category) values.category = d.category;
        // Align with editor-v2 materialize default so publish validation sees a known mode.
        if (!values.purchaseMode) values.purchaseMode = 'external';
        if (d.subcategory) values.subcategory = d.subcategory;
        // Do not invent clothes.wedding_dress / profile defaults here.
        if (state.attrMount && typeof state.attrMount.hasBlockingErrors === 'function') {
          if (state.attrMount.hasBlockingErrors()) {
            throw Object.assign(new Error('أصلحي قيم الخصائص الرقمية قبل الحفظ'), {
              code: 'ATTR_VALIDATION',
            });
          }
        }
        // Flat registry field ids only (bulk rejects unknown keys like nested `attributes`).
        if (state.attrMount && typeof state.attrMount.getFlatValues === 'function') {
          const flat = state.attrMount.getFlatValues();
          Object.keys(flat).forEach((k) => {
            values[k] = flat[k];
          });
        } else if (d.attributes && typeof d.attributes === 'object') {
          Object.keys(d.attributes).forEach((k) => {
            if (Object.prototype.hasOwnProperty.call(d.attributes, k)) values[k] = d.attributes[k];
          });
        }
        // inventoryMode=product makes stockQty publish-required. Only opt into product
        // tracking when the partner entered stock; otherwise leave untracked.
        const stockRaw = d.stock;
        if (stockRaw !== '' && stockRaw != null && Number.isFinite(Number(stockRaw))) {
          values.inventoryMode = 'product';
          values.stockQty = Number(stockRaw);
        } else if (commerce && commerce.inventoryMode === 'variant') {
          values.inventoryMode = 'variant';
        } else {
          values.inventoryMode = 'untracked';
        }
      }
      // Drop keys not in the batch profile — commerce helpers may carry traits/legacy aliases
      // that fail putEditorDraft with REGISTRY_UNKNOWN_FIELD («راجعي الحقول المحددة»).
      const profileId = (state.batch && state.batch.profileId) || null;
      const profiles = ((registry && registry.registry) || registry || {}).profiles || [];
      const profile = profiles.find((p) => p && p.id === profileId);
      if (profile && Array.isArray(profile.fields)) {
        const allowed = {};
        profile.fields.forEach((fid) => {
          allowed[fid] = true;
        });
        Object.keys(values).forEach((k) => {
          if (!allowed[k]) delete values[k];
        });
      }
      return values;
    }

    function valuesToOwnerPatch(kind, values) {
      const top = {
        nameAr: true,
        nameEn: true,
        descriptionAr: true,
        priceHalalas: true,
        category: true,
        subcategory: true,
        profileId: true,
        purchaseMode: true,
        stockQty: true,
        deliveryFeeHalalas: true,
        optionsJson: true,
        variantsJson: true,
        durationMin: true,
        deliveryMode: true,
        concernTags: true,
      };
      const payload = {};
      if (values.nameAr) payload.nameAr = values.nameAr;
      if (values.priceHalalas != null) payload.priceHalalas = values.priceHalalas;
      if (Object.prototype.hasOwnProperty.call(values, 'descriptionAr')) {
        payload.descriptionAr = values.descriptionAr == null ? '' : values.descriptionAr;
      }
      if (values.category) payload.category = values.category;
      if (Object.prototype.hasOwnProperty.call(values, 'subcategory')) {
        payload.subcategory = values.subcategory;
      }
      if (values.purchaseMode === 'internal_cod' || values.purchaseMode === 'external') {
        payload.purchaseMode = values.purchaseMode;
      } else if (values.purchaseMode) {
        payload.purchaseMode = 'external';
      }
      if (values.inventoryMode === 'untracked') {
        payload.stockQty = null;
      } else if (Object.prototype.hasOwnProperty.call(values, 'stockQty')) {
        payload.stockQty = values.stockQty;
      }
      if (values.optionsJson != null) payload.optionsJson = values.optionsJson;
      if (Array.isArray(values.variantsJson)) payload.variantsJson = values.variantsJson;
      if (kind === 'service' && values.durationMin != null) payload.durationMin = values.durationMin;
      const attributes = {};
      let hasAttr = false;
      Object.keys(values).forEach((k) => {
        if (top[k]) return;
        attributes[k] = values[k];
        hasAttr = true;
      });
      // Keep registry inventoryMode on attributes (contract storage), not as a parallel stock source.
      if (values.inventoryMode === 'untracked' || values.inventoryMode === 'product' || values.inventoryMode === 'variant') {
        attributes.inventoryMode = values.inventoryMode;
        hasAttr = true;
      }
      if (hasAttr) payload.attributes = attributes;
      return payload;
    }

    async function saveCurrentOffer() {
      const batch = state.batch;
      const card = currentCard();
      if (!batch || !card) throw new Error('لا يوجد عرض مفتوح');
      const values = buildValuesFromDraft(batch.kind);
      // Materialized cards cannot PUT the open draft — edit the owner item instead.
      if (card.status === 'materialized' && card.targetOwnerId) {
        const payload = valuesToOwnerPatch(batch.kind, values);
        if (batch.kind === 'product') {
          await PartnersApi.updateProduct(card.targetOwnerId, payload);
        } else {
          await PartnersApi.updateService(card.targetOwnerId, payload);
        }
        await refreshBatch(batch.batchId);
        syncFieldDraftFromCard();
        return currentCard();
      }
      const put = await PartnersApi.putBulkCard(batch.batchId, card.cardId, {
        expectedRevision: card.revision,
        values: values,
        overwriteWritten: true,
      });
      await refreshBatch(batch.batchId);
      return put;
    }

    async function ensureVideoReady() {
      const batch = state.batch;
      let card = currentCard();
      if (!batch || !card) throw new Error('لا يوجد عرض');
      // Server-backed ready video — do not invent mediaId/ready locally.
      if (card.media && card.media.videoReady && card.media.videoMediaId) {
        state.mediaId = card.media.videoMediaId;
        state.uploadStatus = 'ready';
        state.uploadPct = 1;
        if (card.media.previewUrl) state.previewUrl = card.media.previewUrl;
        return state.mediaId;
      }
      if (state.mediaId && state.uploadStatus === 'ready' && !state.file) {
        return state.mediaId;
      }
      if (!state.file) throw new Error('اختاري مقطع فيديو لهذا العرض');

      const dur = await readVideoDuration(state.file);
      if (dur > VIDEO_MAX_SECONDS) throw new Error('الفيديو يتجاوز 5 دقائق');

      card = currentCard();
      let ownerId = card && card.targetOwnerId;
      if (!ownerId) {
        setStatus('إنشاء مسودة العنصر قبل الرفع…');
        const mat = await PartnersApi.materializeBulkBatch(
          batch.batchId,
          { cardIds: [card.cardId], submitReview: false },
          'journey-mat-' + batch.batchId + '-' + card.cardId,
        );
        const row = (mat.results || []).find((r) => r.cardId === card.cardId);
        if (!(row && row.ok && row.targetOwnerId)) {
          const err = row && row.error;
          const fe = err && err.fieldErrors;
          const feTxt = Array.isArray(fe) && fe.length
            ? ' [' + fe.map((x) => (x.fieldId || '') + ':' + (x.code || '')).join(', ') + ']'
            : '';
          throw new Error(
            ((err && (err.messageAr || err.message || err.code)) || 'تعذر إنشاء العنصر قبل الرفع') + feTxt,
          );
        }
        ownerId = row.targetOwnerId;
        await refreshBatch(batch.batchId);
        // Do not syncFieldDraftFromCard here — it would clear the pending local file
        // selected for this first upload.
      }

      const pendingFile = state.file;
      if (!pendingFile) throw new Error('اختاري مقطع فيديو لهذا العرض');
      const ownerKindPath = batch.kind === 'product' ? 'products' : 'services';
      const clientMediaId = newClientMediaId();
      state.uploadStatus = 'uploading';
      state.uploadPct = 0;
      render();
      let uploadSessionId = state.uploadSessionId || null;
      try {
        const session = await PartnersApi.uploadViaSession(ownerKindPath, ownerId, pendingFile, {
          clientMediaId: clientMediaId,
          sessionId: uploadSessionId || undefined,
          mimeType: pendingFile.type || (/\.mov$/i.test(pendingFile.name || '') ? 'video/quicktime' : 'video/mp4'),
          onSession: (s) => {
            if (s && s.sessionId) {
              state.uploadSessionId = s.sessionId;
              uploadSessionId = s.sessionId;
            }
          },
          onProgress: (p) => {
            if (typeof p === 'number' && Number.isFinite(p)) {
              state.uploadPct = Math.max(0, Math.min(1, p));
              state.uploadStatus = 'uploading';
              const bar = document.getElementById('journeyUploadBar');
              const txt = document.getElementById('journeyUploadTxt');
              if (bar) bar.style.width = Math.round(state.uploadPct * 100) + '%';
              if (txt) txt.textContent = 'رفع المقطع: ' + Math.round(state.uploadPct * 100) + '%';
            }
          },
          onProcessing: () => {
            state.uploadStatus = 'verifying';
            state.uploadPct = 1;
            const txt = document.getElementById('journeyUploadTxt');
            if (txt) txt.textContent = 'التحقق من المقطع…';
          },
        });
        state.mediaId = session && (session.catalogMediaId || session.mediaId || session.id);
        state.uploadStatus = 'ready';
        state.uploadPct = 1;
        state.file = null;
        state.uploadSessionId = null;
        await refreshBatch(batch.batchId);
        syncFieldDraftFromCard();
        return state.mediaId;
      } catch (e) {
        const stage = (e && e.stage) || (e && e.code) || '';
        const ar =
          (e && (e.messageAr || e.message)) ||
          String(e);
        state.uploadStatus = 'failed';
        throw Object.assign(new Error(ar + (stage ? ' · مرحلة: ' + stage : '')), e || {});
      }
    }

    async function startBatch(kind, profileId) {
      const batchId = newBatchId();
      setStatus('إنشاء المجموعة…');
      const b = await PartnersApi.createBulkBatch({
        kind: kind,
        profileId: profileId,
        count: 1,
        batchId: batchId,
      });
      state.batch = b;
      state.cardId = (b.cards && b.cards[0] && b.cards[0].cardId) || 'c001';
      syncFieldDraftFromCard();
      state.step = 'offer';
      setBulkUrl(b.batchId, state.cardId);
      setStatus('العرض ١ — أضيفي المقطع والبيانات');
    }

    function renderKind() {
      shell.innerHTML = '';
      const title = el('h3', { text: 'إضافة مجموعة' });
      const lead = el('p', {
        className: 'lead',
        text: isDeveloper
          ? 'كل مقطع يصبح عرضًا مستقلًا. بعد تجهيز المجموعة تنشرين مباشرة بلا موافقة إدارية.'
          : 'كل مقطع يصبح عرضًا مستقلًا. عند الجاهزية تُرسل المجموعة للمراجعة.',
      });
      const actions = el('div', { className: 'journey-actions bulk-journey-actions' });
      if (canProduct) {
        actions.appendChild(
          el('button', {
            type: 'button',
            className: 'btn btn-primary',
            text: 'مجموعة منتجات',
            onClick: async () => {
              if (state.busy) return;
              state.busy = true;
              try {
                const opts = profilesFromRegistry(registry, partner, 'product');
                if (!opts.length) throw new Error('لا قوالب منتجات مسموحة');
                if (opts.length === 1) await startBatch('product', opts[0].id);
                else {
                  state.step = 'profile';
                  state._kindPending = 'product';
                  state._profilesPending = opts;
                  render();
                }
              } catch (e) {
                setStatus((e && (e.messageAr || e.message)) || String(e), true);
              } finally {
                state.busy = false;
              }
            },
          }),
        );
      }
      if (canService) {
        actions.appendChild(
          el('button', {
            type: 'button',
            className: 'btn btn-primary',
            text: 'مجموعة خدمات',
            onClick: async () => {
              if (state.busy) return;
              state.busy = true;
              try {
                const opts = profilesFromRegistry(registry, partner, 'service');
                if (!opts.length) throw new Error('لا قوالب خدمات مسموحة');
                if (opts.length === 1) await startBatch('service', opts[0].id);
                else {
                  state.step = 'profile';
                  state._kindPending = 'service';
                  state._profilesPending = opts;
                  render();
                }
              } catch (e) {
                setStatus((e && (e.messageAr || e.message)) || String(e), true);
              } finally {
                state.busy = false;
              }
            },
          }),
        );
      }
      if (!canProduct && !canService) {
        actions.appendChild(el('p', { text: 'لا صلاحية لإضافة مجموعة على هذا الحساب.' }));
      }
      if (registryError) {
        shell.appendChild(
          el('p', {
            className: 'lead',
            style: 'color:#b00020',
            text: 'محرر الشريك غير متاح: ' + registryError,
          }),
        );
      }
      shell.appendChild(title);
      shell.appendChild(lead);
      shell.appendChild(actions);
    }

    function renderProfile() {
      shell.innerHTML = '';
      const opts = state._profilesPending || [];
      shell.appendChild(el('h3', { text: 'اختاري القالب' }));
      const list = el('div', { className: 'journey-actions bulk-journey-actions' });
      opts.forEach((p) => {
        list.appendChild(
          el('button', {
            type: 'button',
            className: 'btn btn-ghost',
            text: p.label,
            onClick: async () => {
              if (state.busy) return;
              state.busy = true;
              try {
                await startBatch(state._kindPending, p.id);
                render();
              } catch (e) {
                setStatus((e && (e.messageAr || e.message)) || String(e), true);
              } finally {
                state.busy = false;
              }
            },
          }),
        );
      });
      shell.appendChild(list);
    }

    function fieldInput(label, required, inputEl, hint) {
      return el('label', { className: 'bulk-journey-field' }, [
        el('span', {
          text: label + (required ? ' *' : ' (اختياري)'),
        }),
        inputEl,
        hint ? el('small', { className: 'lead', text: hint }) : null,
      ]);
    }

    function renderOffer() {
      shell.innerHTML = '';
      const batch = state.batch;
      const n = cardIndex() + 1;
      shell.appendChild(el('h3', { text: 'العرض ' + n }));
      shell.appendChild(
        el('p', {
          className: 'lead',
          text: batch.kind === 'product' ? 'منتج — فيديو واحد وبيانات هذا العرض فقط' : 'خدمة — فيديو واحد وبيانات هذا العرض فقط',
        }),
      );

      const fileInput = el('input', {
        type: 'file',
        accept: 'video/*,.mov,.mp4,.m4v',
        style: 'display:none',
        id: 'journeyVideoInput',
      });
      const pickBtn = el('button', {
        type: 'button',
        className: 'btn btn-primary',
        text: state.previewUrl || state.mediaId || state.uploadStatus === 'ready' ? 'استبدال المقطع' : 'اختيار مقطع',
        onClick: () => fileInput.click(),
      });
      fileInput.addEventListener('change', async () => {
        const file = fileInput.files && fileInput.files[0];
        if (!file) return;
        const mime = String(file.type || '').toLowerCase();
        const name = String(file.name || '').toLowerCase();
        const okVideo =
          mime.indexOf('video/') === 0 ||
          name.endsWith('.mov') ||
          name.endsWith('.mp4') ||
          name.endsWith('.m4v');
        if (!okVideo) {
          setStatus('يُقبل فيديو واحد فقط في هذا المسار (مثل MOV أو MP4)', true);
          return;
        }
        const dur = await readVideoDuration(file);
        if (dur > VIDEO_MAX_SECONDS) {
          setStatus('الفيديو يتجاوز 5 دقائق', true);
          return;
        }
        if (state.previewUrl && String(state.previewUrl).indexOf('blob:') === 0) {
          try {
            URL.revokeObjectURL(state.previewUrl);
          } catch (_) {}
        }
        // Explicit replace — clear prior server media binding until new upload succeeds.
        state.file = file;
        state.previewUrl = URL.createObjectURL(file);
        state.mediaId = null;
        state.uploadStatus = 'selected';
        state.uploadPct = 0;
        setStatus('مقطع جاهز للرفع مع الحفظ — استبدال صريح');
        render();
      });

      const mediaBox = el('div', { className: 'bulk-journey-media' });
      mediaBox.appendChild(pickBtn);
      mediaBox.appendChild(fileInput);
      if (state.previewUrl) {
        mediaBox.appendChild(
          el('video', {
            src: state.previewUrl,
            controls: true,
            playsinline: true,
            style: 'width:100%;max-height:240px;margin-top:8px;background:#111',
          }),
        );
      }
      const uploadTxt = el('div', {
        id: 'journeyUploadTxt',
        className: 'lead',
        'data-testid': 'bulk-media-status',
        text:
          state.uploadStatus === 'ready'
            ? 'المقطع مرفوع وجاهز'
            : state.uploadStatus === 'uploading'
              ? 'رفع المقطع: ' + Math.round(state.uploadPct * 100) + '%'
              : state.uploadStatus === 'verifying'
                ? 'التحقق من المقطع…'
                : state.file
                  ? 'مقطع محدد — يُرفع عند الحفظ'
                  : 'لم يُختر مقطع بعد',
      });
      const barWrap = el('div', {
        style: 'height:10px;background:#e5e0d8;border-radius:4px;overflow:hidden;margin-top:6px',
      });
      barWrap.appendChild(
        el('div', {
          id: 'journeyUploadBar',
          style:
            'height:100%;width:' +
            Math.round(state.uploadPct * 100) +
            '%;background:#2f6f4e;transition:width 0.2s ease',
        }),
      );
      mediaBox.appendChild(uploadTxt);
      mediaBox.appendChild(barWrap);
      shell.appendChild(mediaBox);

      const d = state.fieldDraft;
      const fields = el('div', { className: 'bulk-journey-fields' });
      const nameIn = el('input', {
        type: 'text',
        value: d.nameAr,
        autocomplete: 'off',
        onInput: (e) => {
          state.fieldDraft.nameAr = e.target.value;
        },
      });
      const priceIn = el('input', {
        type: 'text',
        inputmode: 'decimal',
        value: d.priceSar,
        placeholder: 'مثال: 1200',
        onInput: (e) => {
          state.fieldDraft.priceSar = e.target.value;
        },
      });
      const descIn = el('textarea', {
        rows: '3',
        onInput: (e) => {
          state.fieldDraft.descriptionAr = e.target.value;
        },
      });
      descIn.value = d.descriptionAr || '';
      fields.appendChild(fieldInput('الاسم', true, nameIn));
      fields.appendChild(fieldInput('السعر (ر.س)', true, priceIn));
      fields.appendChild(fieldInput('الوصف', false, descIn));

      if (batch.kind === 'service') {
        const durIn = el('input', {
          type: 'number',
          min: '1',
          value: d.durationMin,
          onInput: (e) => {
            state.fieldDraft.durationMin = e.target.value;
          },
        });
        fields.appendChild(fieldInput('المدة (دقائق)', true, durIn));
        const modeSel = el(
          'select',
          {
            onChange: (e) => {
              state.fieldDraft.deliveryMode = e.target.value;
            },
          },
          [
            el('option', { value: '', text: '— اختياري —' }),
            el('option', { value: 'home', text: 'منزلية / تغطية' }),
            el('option', { value: 'branch', text: 'في الفرع' }),
            el('option', { value: 'either', text: 'كلاهما' }),
          ],
        );
        if (d.deliveryMode) modeSel.value = d.deliveryMode;
        fields.appendChild(fieldInput('طريقة التقديم', false, modeSel));
      } else {
        const stockIn = el('input', {
          type: 'number',
          min: '0',
          step: '1',
          value: d.stock,
          'data-testid': 'bulk-stock-qty',
          placeholder: d.inventoryMode === 'untracked' ? 'غير محدد' : '',
          onInput: (e) => {
            state.fieldDraft.stock = e.target.value;
          },
        });
        fields.appendChild(fieldInput('المخزون على مستوى المنتج', false, stockIn));
        const commerceHost = el('div', { className: 'bulk-journey-commerce' });
        fields.appendChild(commerceHost);
        try {
          if (state.commerceMount && state.commerceMount.destroy) state.commerceMount.destroy();
          const MO = window.MiraCatalogOptions;
          const category =
            d.category ||
            (MO && MO.categoryFromProfileId
              ? MO.categoryFromProfileId(batch.profileId)
              : 'clothes');
          state.fieldDraft.category = category;
          state.commerceMount = window.MiraProductCommerceFields.mount(commerceHost, {
            category: category,
            initialRow: {
              optionsJson: d.optionsJson,
              variantsJson: d.variantsJson,
              inventoryMode: d.inventoryMode,
            },
            onChange: (payload) => {
              state.fieldDraft.category = payload.category;
              state.fieldDraft.optionsJson = payload.optionsJson;
              state.fieldDraft.variantsJson = payload.variantsJson;
              state.fieldDraft.inventoryMode = payload.inventoryMode;
            },
          });
          if (taxonomyError) {
            const taxErr = el('p', {
              className: 'lead',
              style: 'color:#b00020',
              'data-testid': 'bulk-taxonomy-load-error',
              text: 'تعذر تحميل التصنيفات: ' + taxonomyError,
            });
            const taxRetry = el('button', {
              type: 'button',
              className: 'btn btn-ghost',
              'data-testid': 'bulk-taxonomy-load-retry',
              text: 'إعادة المحاولة',
              onClick: async () => {
                try {
                  await loadBulkTaxonomy(true);
                  setStatus('أُعيد تحميل التصنيفات');
                  render();
                } catch (e) {
                  setStatus((e && (e.messageAr || e.message)) || String(e), true);
                  render();
                }
              },
            });
            fields.appendChild(taxErr);
            fields.appendChild(taxRetry);
          }
          const subOpts =
            window.MiraRegistryAttributeFields &&
            typeof MiraRegistryAttributeFields.subcategoriesFromTaxonomy === 'function'
              ? MiraRegistryAttributeFields.subcategoriesFromTaxonomy(taxonomyDoc, category)
              : [];
          const subSel = el('select', {
            'data-testid': 'bulk-subcategory',
            onChange: (e) => {
              const prevState =
                state.attrMount && state.attrMount.captureEditorState
                  ? state.attrMount.captureEditorState()
                  : null;
              state.fieldDraft.subcategory = e.target.value;
              remountBulkAttrs(prevState);
            },
          });
          subSel.appendChild(el('option', { value: '', text: '— اختاري التصنيف الفرعي —' }));
          subOpts.forEach((o) => {
            subSel.appendChild(el('option', { value: o.value, text: o.label }));
          });
          if (d.subcategory && subOpts.some((o) => o.value === d.subcategory)) {
            subSel.value = d.subcategory;
          } else if (d.subcategory) {
            // Keep unsupported/stored value visible rather than silent replace.
            subSel.appendChild(
              el('option', {
                value: d.subcategory,
                text: d.subcategory + ' (محفوظ)',
              }),
            );
            subSel.value = d.subcategory;
          } else {
            subSel.value = '';
            state.fieldDraft.subcategory = '';
          }
          fields.appendChild(fieldInput('التصنيف الفرعي', false, subSel));

          const attrHost = el('div', {
            className: 'mira-attr-fields',
            'data-testid': 'bulk-registry-attribute-host',
          });
          fields.appendChild(attrHost);

          function profileIdForBulkCard() {
            const sub = state.fieldDraft.subcategory || d.subcategory || '';
            if (sub === 'clothes.abaya') return 'product.abaya';
            const nodes = (taxonomyDoc && taxonomyDoc.nodes) || [];
            const n = nodes.find((x) => x && x.id === sub);
            if (n && n.profileId) return n.profileId;
            return batch.profileId || 'product.clothes';
          }

          function remountBulkAttrs(preserveState) {
            if (!(window.MiraRegistryAttributeFields && registry)) return;
            if (state.attrMount && state.attrMount.destroy) state.attrMount.destroy();
            const profileId = profileIdForBulkCard();
            const card = currentCard();
            // Mount id is per-card so parked/editor state never crosses cards.
            state.attrMount = window.MiraRegistryAttributeFields.mount(attrHost, {
              registry: registry,
              profileId: profileId,
              mountId: 'bulk-' + ((card && card.cardId) || 'x'),
              initialAttributes: d.attributes || {},
              preserveState: preserveState || null,
              includeComponentContract: profileId === 'product.bags',
              persistComponentContract: false,
              onChange: (payload) => {
                // Keep draft values for any source; only user edits mark the card dirty-for-save UX.
                state.fieldDraft.attributes = Object.assign({}, payload.values || {});
                if (payload && payload.source && payload.source !== 'user') return;
                state.fieldDraft.attrsUserEdited = true;
              },
            });
          }
          remountBulkAttrs(null);
        } catch (e) {
          commerceHost.appendChild(
            el('p', {
              className: 'lead',
              style: 'color:#b00020',
              text: 'تعذر تحميل حقول المنتج المشتركة: ' + ((e && e.message) || String(e)),
            }),
          );
        }
      }
      shell.appendChild(fields);

      if (isDeveloper) {
        shell.appendChild(
          el('p', {
            className: 'lead',
            text: 'فيديو صالح واحد يكفي — لا تُطلب صورة إضافية لحساب المطوّر.',
          }),
        );
      }

      const actions = el('div', { className: 'journey-actions bulk-journey-actions' });
      actions.appendChild(
        el('button', {
          type: 'button',
          className: 'btn btn-primary',
          text: 'حفظ وإضافة مقطع آخر',
          disabled: state.busy,
          onClick: async () => {
            if (state.busy) return;
            state.busy = true;
            try {
              // Save field values first (works for draft and materialized), then ensure media.
              setStatus('حفظ العرض…');
              await saveCurrentOffer();
              setStatus('رفع المقطع…');
              await ensureVideoReady();
              await refreshBatch(batch.batchId);
              syncFieldDraftFromCard();
              const next = await PartnersApi.appendBulkCard(batch.batchId);
              state.batch = next;
              const cards = next.cards || [];
              state.cardId = cards[cards.length - 1].cardId;
              syncFieldDraftFromCard();
              setBulkUrl(next.batchId, state.cardId);
              setStatus('العرض ' + cards.length + ' — بيانات فارغة لهذا المقطع');
              render();
            } catch (e) {
              const body = e && e.body;
              const fe =
                (e && e.fieldErrors) ||
                (body && body.fieldErrors) ||
                null;
              const feTxt = Array.isArray(fe) && fe.length
                ? ' [' + fe.map((x) => (x.fieldId || '') + ':' + (x.code || '')).join(', ') + ']'
                : '';
              setStatus(
                ((e && (e.messageAr || e.message)) || (body && body.messageAr) || String(e)) + feTxt,
                true,
              );
            } finally {
              state.busy = false;
              render();
            }
          },
        }),
      );
      actions.appendChild(
        el('button', {
          type: 'button',
          className: 'btn btn-ghost',
          text: 'حفظ ومراجعة المجموعة',
          disabled: state.busy,
          onClick: async () => {
            if (state.busy) return;
            state.busy = true;
            try {
              setStatus('حفظ العرض…');
              await saveCurrentOffer();
              await ensureVideoReady();
              await refreshBatch(batch.batchId);
              syncFieldDraftFromCard();
              state.step = 'summary';
              setStatus('مراجعة المجموعة قبل النشر');
              render();
            } catch (e) {
              const body = e && e.body;
              const fe = (e && e.fieldErrors) || (body && body.fieldErrors) || null;
              const feTxt = Array.isArray(fe) && fe.length
                ? ' [' + fe.map((x) => (x.fieldId || '') + ':' + (x.code || '')).join(', ') + ']'
                : '';
              setStatus(((e && (e.messageAr || e.message)) || String(e)) + feTxt, true);
            } finally {
              state.busy = false;
              render();
            }
          },
        }),
      );
      shell.appendChild(actions);
    }

    function offerReadyHint(card) {
      const vals = card.values || {};
      if (!vals.nameAr) return { ok: false, field: 'nameAr', label: 'الاسم' };
      if (vals.priceHalalas == null) return { ok: false, field: 'priceHalalas', label: 'السعر' };
      if (state.batch.kind === 'service' && (vals.durationMin == null || vals.durationMin === '')) {
        return { ok: false, field: 'durationMin', label: 'المدة' };
      }
      // targetOwnerId alone does not prove video readiness — require server media summary.
      const mediaOk = !!(card.media && card.media.videoReady && card.media.videoMediaId);
      if (!mediaOk) return { ok: false, field: 'video', label: 'المقطع' };
      return { ok: true };
    }

    function renderSummary() {
      shell.innerHTML = '';
      const batch = state.batch;
      const cards = batch.cards || [];
      shell.appendChild(el('h3', { text: 'ملخص المجموعة (' + cards.length + ')' }));
      const list = el('div', { className: 'bulk-journey-summary' });
      let allOk = true;
      cards.forEach((card, idx) => {
        const ready = offerReadyHint(card);
        if (!ready.ok) allOk = false;
        const vals = card.values || {};
        const row = el('div', { className: 'bulk-journey-summary-row' });
        row.appendChild(
          el('div', {
            className: 'bulk-journey-thumb',
            text: '🎬',
            title: 'مقطع العرض',
          }),
        );
        row.appendChild(
          el('div', { className: 'bulk-journey-summary-meta' }, [
            el('strong', { text: vals.nameAr || 'عرض ' + (idx + 1) + ' (بدون اسم)' }),
            el('div', {
              className: 'lead',
              text:
                (vals.priceHalalas != null ? halalasToSar(vals.priceHalalas) + ' ر.س' : 'بلا سعر') +
                ' · ' +
                (card.contentStatus === 'published'
                  ? 'منشور'
                  : ready.ok
                    ? 'مسودة جاهزة'
                    : 'ناقص: ' + ready.label),
            }),
          ]),
        );
        const btns = el('div', { className: 'journey-actions' });
        btns.appendChild(
          el('button', {
            type: 'button',
            className: 'btn btn-ghost',
            text: ready.ok ? 'تعديل' : 'إكمال العرض',
            onClick: () => {
              state.cardId = card.cardId;
              syncFieldDraftFromCard();
              state.step = 'offer';
              setBulkUrl(batch.batchId, card.cardId);
              render();
            },
          }),
        );
        if (cards.length > 1 && card.contentStatus !== 'published') {
          btns.appendChild(
            el('button', {
              type: 'button',
              className: 'btn btn-ghost',
              text: 'إزالة',
              onClick: async () => {
                if (state.busy) return;
                if (!window.confirm('إزالة هذا العرض من المجموعة؟')) return;
                state.busy = true;
                try {
                  const next = await PartnersApi.discardBulkCard(batch.batchId, card.cardId);
                  state.batch = next;
                  render();
                } catch (e) {
                  setStatus((e && (e.messageAr || e.message)) || String(e), true);
                } finally {
                  state.busy = false;
                }
              },
            }),
          );
        }
        row.appendChild(btns);
        list.appendChild(row);
      });
      shell.appendChild(list);

      const publishLabel = isDeveloper
        ? 'نشر المجموعة (' + cards.length + ' عروض)'
        : 'إرسال المجموعة للمراجعة';
      shell.appendChild(
        el('button', {
          type: 'button',
          className: 'btn btn-primary',
          text: publishLabel,
          disabled: state.busy || !allOk || !cards.length,
          style: 'width:100%;margin-top:16px',
          onClick: async () => {
            if (state.busy || !allOk) return;
            state.busy = true;
            setStatus(isDeveloper ? 'جاري النشر…' : 'جاري الإرسال للمراجعة…');
            render();
            try {
              const out = await PartnersApi.publishBulkGroup(
                batch.batchId,
                'publish-group-' + batch.batchId,
              );
              state.publishResult = out;
              state.step = 'done';
              setStatus(out.noteAr || (isDeveloper ? 'تم النشر' : 'أُرسلت للمراجعة'));
              render();
            } catch (e) {
              const blockers = e && e.body && e.body.blockers;
              if (blockers && blockers.length) {
                const first = blockers[0];
                setStatus(
                  'تعطل «' +
                    (first.cardId || '') +
                    '»: ' +
                    (first.messageAr || first.field) +
                    ' — بقية العروض بقيت مسودات',
                  true,
                );
              } else {
                setStatus((e && (e.messageAr || e.message)) || String(e), true);
              }
            } finally {
              state.busy = false;
              render();
            }
          },
        }),
      );
    }

    function renderDone() {
      shell.innerHTML = '';
      const out = state.publishResult || {};
      const n = out.publishedCount || out.queuedCount || (state.batch.cards || []).length;
      shell.appendChild(
        el('h3', {
          text: isDeveloper && out.publishedCount
            ? 'تم نشر ' + out.publishedCount + ' عروض'
            : out.noteAr || 'اكتملت العملية',
        }),
      );
      const items = out.published || out.queued || [];
      const list = el('div', { className: 'bulk-journey-summary' });
      items.forEach((it) => {
        list.appendChild(
          el('div', { className: 'bulk-journey-summary-row' }, [
            el('strong', { text: it.nameAr || it.id }),
            it.id
              ? el('a', {
                  href:
                    '/dashboard.html?edit=' +
                    encodeURIComponent(it.kind || state.batch.kind) +
                    ':' +
                    encodeURIComponent(it.id),
                  text: 'فتح العرض',
                })
              : null,
          ]),
        );
      });
      shell.appendChild(list);
      shell.appendChild(
        el('button', {
          type: 'button',
          className: 'btn btn-primary',
          text: 'مجموعة جديدة',
          onClick: () => {
            state.step = 'kind';
            state.batch = null;
            state.cardId = null;
            state.publishResult = null;
            setBulkUrl(null);
            render();
          },
        }),
      );
    }

    function render() {
      if (state.step === 'kind') renderKind();
      else if (state.step === 'profile') renderProfile();
      else if (state.step === 'offer') renderOffer();
      else if (state.step === 'summary') renderSummary();
      else if (state.step === 'done') renderDone();
    }

    // Resume existing batch from URL
    const existing = new URLSearchParams(location.search).get('bulk');
    const wantCard = new URLSearchParams(location.search).get('card');
    if (existing) {
      try {
        setStatus('استعادة المجموعة…');
        const b = await refreshBatch(existing);
        state.cardId =
          wantCard && (b.cards || []).some((c) => c.cardId === wantCard)
            ? wantCard
            : (b.cards && b.cards[0] && b.cards[0].cardId) || null;
        syncFieldDraftFromCard();
        const allSubmitted = (b.cards || []).every(
          (c) => c.contentStatus === 'published' || c.submitReviewStatus === 'submitted',
        );
        state.step = allSubmitted ? 'done' : 'offer';
        if (allSubmitted) {
          state.publishResult = {
            publishedCount: (b.cards || []).filter((c) => c.contentStatus === 'published').length,
            published: (b.cards || [])
              .filter((c) => c.contentStatus === 'published')
              .map((c) => ({
                id: c.targetOwnerId,
                kind: b.kind,
                nameAr: (c.values && c.values.nameAr) || c.targetOwnerId,
              })),
            noteAr: 'مجموعة مستعادة',
          };
        }
        setStatus(state.step === 'offer' ? 'العرض ' + (cardIndex() + 1) : '');
      } catch (e) {
        setStatus('تعذر فتح الدفعة: ' + ((e && (e.messageAr || e.message)) || String(e)), true);
        state.step = 'kind';
      }
    }

    render();
  }

  window.MiraGroupJourney = { open: openGroupJourney };

  // Take over bulk entry — keep legacy under openLegacy for tests.
  if (window.MiraBulkAdd && typeof window.MiraBulkAdd.open === 'function') {
    window.MiraBulkAdd.openLegacy = window.MiraBulkAdd.open;
    window.MiraBulkAdd.open = function (root, partner) {
      return openGroupJourney(root, partner);
    };
  } else {
    window.MiraBulkAdd = window.MiraBulkAdd || {};
    window.MiraBulkAdd.open = openGroupJourney;
  }
})();
