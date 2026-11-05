/**
 * P6 — إضافة مجموعة
 * Batch-scoped media/card state, frozen async upload context, dirty field gens, registry fields.
 */
(function () {
  const DEFAULT_LIMIT = 10;
  const BATCH_KEY = 'mira_bulk_pending_batch_id';
  const MEDIA_STORE_KEY = 'mira_bulk_media_jobs_v2';
  const HALALAS_PER_SAR = 100;
  const MAX_UPLOAD_INFLIGHT = 2;
  const VIDEO_MAX_SECONDS = 300;

  /** Global media jobs: clientMediaId -> job (always includes batchId). Never wipe on batch switch. */
  const mediaJobs = Object.create(null);
  /** batchId -> { cardId -> cardState } */
  const cardsByBatch = Object.create(null);
  let uploadInflight = 0;
  let uploadPumpRunning = false;

  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach((k) => {
        if (k === 'className') node.className = attrs[k];
        else if (k === 'text') node.textContent = attrs[k];
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

  function setBulkUrl(batchId) {
    const u = new URL(location.href);
    if (batchId) u.searchParams.set('bulk', batchId);
    else u.searchParams.delete('bulk');
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

  function fieldDefsForProfile(registry, profileId) {
    const root = (registry && registry.registry) || registry || {};
    const profile = (root.profiles || []).find((p) => p.id === profileId);
    const fieldsMap = root.fields || {};
    if (!profile) return [];
    const skip = {
      media: 1,
      coverMediaId: 1,
      optionsJson: 1,
      variantsJson: 1,
      serviceProfile: 1,
    };
    return (profile.fields || [])
      .filter((id) => !skip[id])
      .map((id) => fieldsMap[id] || { id: id, type: 'string', labelAr: id })
      .filter((f) => {
        const t = f.type || 'string';
        return (
          t === 'string' ||
          t === 'text' ||
          t === 'int' ||
          t === 'integer' ||
          t === 'enum' ||
          t === 'boolean' ||
          t === 'money' ||
          t === 'halalas'
        );
      });
  }

  function persistMediaMeta() {
    try {
      const out = {};
      Object.keys(mediaJobs).forEach((id) => {
        const j = mediaJobs[id];
        out[id] = {
          clientMediaId: id,
          batchId: j.batchId,
          cardId: j.cardId,
          fileName: j.fileName,
          mimeType: j.mimeType,
          size: j.size,
          sessionId: j.sessionId || null,
          mediaId: j.mediaId || null,
          status: j.status,
          ownerId: j.ownerId || null,
          error: j.error || null,
          needsLocalFile: !j.file && j.status !== 'ready',
        };
      });
      sessionStorage.setItem(MEDIA_STORE_KEY, JSON.stringify(out));
    } catch (_) {}
  }

  function restoreMediaMeta() {
    try {
      const raw = sessionStorage.getItem(MEDIA_STORE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      Object.keys(parsed || {}).forEach((id) => {
        if (mediaJobs[id]) return;
        const j = parsed[id];
        mediaJobs[id] = Object.assign({}, j, { file: null, clientMediaId: id });
      });
    } catch (_) {}
  }

  function cardKey(batchId, cardId) {
    return String(batchId) + '::' + String(cardId);
  }

  function ensureBatchCards(batchId) {
    if (!cardsByBatch[batchId]) cardsByBatch[batchId] = Object.create(null);
    return cardsByBatch[batchId];
  }

  function jobsForCard(batchId, cardId) {
    return Object.keys(mediaJobs)
      .map((id) => mediaJobs[id])
      .filter((j) => j && j.batchId === batchId && j.cardId === cardId);
  }

  function jobsForBatch(batchId) {
    return Object.keys(mediaJobs)
      .map((id) => mediaJobs[id])
      .filter((j) => j && j.batchId === batchId);
  }

  async function openBulkUi(root, partner) {
    root.innerHTML = '';
    restoreMediaMeta();

    let registry = null;
    let registryError = null;
    try {
      registry = await PartnersApi.registry();
    } catch (e) {
      registry = null;
      registryError = (e && (e.messageAr || e.message)) || String(e);
    }

    const status = el('p', { className: 'lead', id: 'bulkStatus', role: 'status' }, [
      'دفعة بهوية ثابتة · الوسائط مربوطة بالدفعة والبطاقة · التحويل ≠ نشر.',
    ]);
    const listHost = el('div', { id: 'bulkMyList' });
    const cardsHost = el('div', { id: 'bulkCards' });

    const kindSelect = el('select', { id: 'bulkKind' }, [
      el('option', { value: 'product', text: 'منتجات' }),
      el('option', { value: 'service', text: 'خدمات' }),
    ]);
    const profileSelect = el('select', { id: 'bulkProfile' });
    const countInput = el('input', {
      id: 'bulkCount',
      type: 'number',
      min: '1',
      max: '50',
      step: '1',
      value: String(DEFAULT_LIMIT),
    });

    const refillProfiles = () => {
      profileSelect.innerHTML = '';
      if (!registry) {
        profileSelect.appendChild(
          el('option', { value: '', text: 'تعذر جلب القوالب — لا يُختار افتراضي مضلل' }),
        );
        profileSelect.disabled = true;
        return;
      }
      profileSelect.disabled = false;
      const opts = profilesFromRegistry(registry, partner, kindSelect.value);
      if (!opts.length) {
        profileSelect.appendChild(el('option', { value: '', text: 'لا قوالب مسموحة لهذا الحساب' }));
        return;
      }
      opts.forEach((p) => profileSelect.appendChild(el('option', { value: p.id, text: p.label })));
    };
    refillProfiles();
    kindSelect.addEventListener('change', refillProfiles);

    /** @type {null | {batchId:string, kind:string, profileId:string, cards:any[], ready?:boolean}} */
    let batch = null;

    function currentCards() {
      return batch ? ensureBatchCards(batch.batchId) : Object.create(null);
    }

    function syncStateFromBatch(b) {
      batch = b;
      const map = ensureBatchCards(b.batchId);
      (b.cards || []).forEach((c) => {
        const prev = map[c.cardId];
        const saved = Object.assign({}, c.values || {});
        if (prev && prev.dirty) {
          map[c.cardId] = Object.assign({}, prev, {
            revision: c.revision,
            status: c.status,
            targetOwnerId: c.targetOwnerId,
            savedValues: saved,
            contentStatus: c.contentStatus,
            submitReviewStatus: c.submitReviewStatus,
            openUrl: c.openUrl,
          });
        } else {
          map[c.cardId] = {
            localValues: Object.assign({}, saved),
            savedValues: saved,
            priceSarText:
              prev && prev.priceSarText != null
                ? prev.priceSarText
                : saved.priceHalalas != null
                  ? halalasToSar(saved.priceHalalas)
                  : '',
            priceError: null,
            revision: c.revision,
            status: c.status,
            targetOwnerId: c.targetOwnerId,
            contentStatus: c.contentStatus,
            submitReviewStatus: c.submitReviewStatus,
            dirty: false,
            editGen: (prev && prev.editGen) || 0,
            saveGen: (prev && prev.saveGen) || 0,
            error: null,
            openUrl: c.openUrl,
          };
        }
      });
    }

    function bumpEdit(cardId) {
      const st = currentCards()[cardId];
      if (!st) return;
      st.editGen = (st.editGen || 0) + 1;
      st.dirty = true;
      st.error = null;
    }

    function markDirty(cardId, field, value) {
      const st = currentCards()[cardId];
      if (!st || st.status === 'materialized') return;
      st.localValues[field] = value;
      bumpEdit(cardId);
    }

    function markClear(cardId, field) {
      const st = currentCards()[cardId];
      if (!st || st.status === 'materialized') return;
      delete st.localValues[field];
      if (field === 'priceHalalas') {
        st.priceSarText = '';
        st.priceError = null;
      }
      bumpEdit(cardId);
    }

    async function saveCard(cardId, opts) {
      const st = currentCards()[cardId];
      if (!st || !batch) return null;
      if (st.status === 'materialized') {
        st.error = 'البطاقة محوّلة — استخدمي رابط فتح العنصر للتعديل. لم يُرسل حفظ.';
        if (!(opts && opts.silent)) status.textContent = st.error;
        throw Object.assign(new Error(st.error), { code: 'BULK_CARD_MATERIALIZED_UI' });
      }
      if (st.priceError) {
        st.error = st.priceError;
        if (!(opts && opts.silent)) status.textContent = st.error;
        throw Object.assign(new Error(st.error), { code: 'BULK_PRICE_INVALID' });
      }
      const clearFields = [];
      const values = {};
      const keys = new Set([...Object.keys(st.localValues), ...Object.keys(st.savedValues)]);
      keys.forEach((k) => {
        if (k.startsWith('_')) return;
        if (!(k in st.localValues) && k in st.savedValues) clearFields.push(k);
        else if (k in st.localValues) values[k] = st.localValues[k];
      });
      const sentGen = st.editGen;
      const sentRevision = st.revision;
      st.saveGen = sentGen;
      try {
        const put = await PartnersApi.putBulkCard(batch.batchId, cardId, {
          expectedRevision: sentRevision,
          values,
          clearFields,
          overwriteWritten: true,
        });
        // Only apply server snapshot if no newer local edit landed during the wait.
        if (st.editGen === sentGen) {
          st.revision = put.revision;
          st.savedValues = Object.assign({}, put.values || {});
          st.localValues = Object.assign({}, put.values || {});
          st.priceSarText =
            put.values && put.values.priceHalalas != null ? halalasToSar(put.values.priceHalalas) : st.priceSarText;
          st.priceError = null;
          st.dirty = false;
          st.error = null;
          if (!(opts && opts.silent)) {
            status.textContent = 'حُفظت البطاقة ' + cardId + ' · rev ' + put.revision + ' (مؤكد من الخادم)';
          }
        } else {
          // Server advanced; keep local newer edits dirty; adopt revision only if put matched our base.
          st.revision = put.revision;
          st.savedValues = Object.assign({}, put.values || {});
          st.dirty = true;
          st.error = null;
          if (!(opts && opts.silent)) {
            status.textContent =
              'حُفظت نسخة سابقة من ' + cardId + '؛ بقي تعديل أحدث غير محفوظ — احفظي مجددًا.';
          }
        }
        return put;
      } catch (e) {
        st.error = (e && (e.messageAr || e.message)) || String(e);
        if (e && e.code === 'DRAFT_REVISION_CONFLICT') {
          st.error += ' — تعارض إصدار؛ لا يُستبدل تعديلك صامتًا.';
        }
        if (!(opts && opts.silent)) status.textContent = st.error;
        throw e;
      }
    }

    async function saveDirtyCards() {
      if (!batch) return { ok: true, failed: [] };
      const map = currentCards();
      const failed = [];
      for (const cardId of Object.keys(map)) {
        const st = map[cardId];
        if (!st.dirty || st.status === 'materialized') continue;
        try {
          await saveCard(cardId, { silent: true });
        } catch (e) {
          failed.push({ cardId, error: st.error || String(e) });
        }
      }
      return { ok: failed.length === 0, failed };
    }

    function confirmLeaveIfNeeded() {
      if (!batch) return true;
      const dirty = Object.keys(currentCards()).some((id) => currentCards()[id].dirty);
      const uploading = jobsForBatch(batch.batchId).some((j) => j.status === 'uploading' || j.status === 'verifying');
      if (!dirty && !uploading) return true;
      return window.confirm(
        'هناك تعديلات غير محفوظة أو رفع جارٍ. المتابعة قد تُبقي الرفع على دفعة/بطاقة التعيين الأصلية، لكن التعديلات غير المحفوظة تبقى في دفعتها. متابَعة؟',
      );
    }

    function renderCards() {
      cardsHost.innerHTML = '';
      if (!batch) return;
      if (batch.ready === false) {
        cardsHost.appendChild(el('p', { className: 'lead', text: 'الدفعة قيد الاستكمال…' }));
        return;
      }
      const map = currentCards();
      const fieldDefs = fieldDefsForProfile(registry, batch.profileId);
      const simpleIds = fieldDefs.map((f) => f.id);
      // Always ensure core fields present
      ['nameAr', 'priceHalalas', 'durationMin', 'descriptionAr', 'purchaseMode', 'externalUrl'].forEach((id) => {
        if (simpleIds.indexOf(id) < 0) {
          const need =
            id === 'durationMin'
              ? batch.kind === 'service'
              : id === 'purchaseMode' || id === 'externalUrl'
                ? batch.kind === 'product'
                : true;
          if (need) fieldDefs.push({ id: id, type: id === 'priceHalalas' ? 'halalas' : 'string', labelAr: id });
        }
      });

      (batch.cards || []).forEach((card) => {
        const state = map[card.cardId];
        if (!state) return;
        const locked = state.status === 'materialized';
        const ck = el('input', { type: 'checkbox', className: 'bulk-card-ck', 'data-card': card.cardId });
        ck.checked = true;
        const dirtyBadge = el('span', {
          className: 'lead',
          text: locked ? 'محوّلة' : state.dirty ? 'غير محفوظ' : 'محفوظ',
        });
        const err = el('p', {
          className: 'lead',
          text: state.error || state.priceError || '',
          style: state.error || state.priceError ? 'color:#b00020' : '',
        });
        const fieldsHost = el('div', { className: 'bulk-card-fields' });

        fieldDefs.forEach((def) => {
          const id = def.id;
          if (id === 'priceHalalas') {
            const priceSar = el('input', {
              type: 'text',
              inputmode: 'decimal',
              placeholder: 'ريال',
              value: state.priceSarText != null ? state.priceSarText : '',
              disabled: locked,
            });
            priceSar.addEventListener('input', () => {
              if (locked) return;
              const t = priceSar.value;
              state.priceSarText = t;
              const trimmed = t.trim();
              if (!trimmed) {
                state.priceError = null;
                markClear(card.cardId, 'priceHalalas');
              } else {
                try {
                  const h = sarToHalalas(trimmed);
                  state.priceError = null;
                  markDirty(card.cardId, 'priceHalalas', h);
                } catch (e) {
                  state.priceError = e.message || 'السعر غير صالح';
                  bumpEdit(card.cardId);
                  // Do NOT write previous valid priceHalalas
                }
              }
              dirtyBadge.textContent = state.dirty ? 'غير محفوظ' : 'محفوظ';
              err.textContent = state.priceError || state.error || '';
            });
            fieldsHost.appendChild(el('label', null, [(def.labelAr || 'السعر') + ' (ريال) ', priceSar]));
            return;
          }
          if (id === 'durationMin' && batch.kind !== 'service') return;
          const input = el('input', {
            type: def.type === 'int' || def.type === 'integer' ? 'number' : 'text',
            value: state.localValues[id] != null ? String(state.localValues[id]) : '',
            disabled: locked,
          });
          input.addEventListener('input', () => {
            if (locked) return;
            const v = input.value;
            if (v === '') markClear(card.cardId, id);
            else if (def.type === 'int' || def.type === 'integer') markDirty(card.cardId, id, Number(v));
            else markDirty(card.cardId, id, v);
            dirtyBadge.textContent = state.dirty ? 'غير محفوظ' : 'محفوظ';
          });
          fieldsHost.appendChild(el('label', null, [(def.labelAr || id) + ' ', input]));
        });

        const saveBtn = el('button', {
          type: 'button',
          className: 'btn btn-ghost',
          text: locked ? 'محوّلة — لا حفظ مسودة' : 'حفظ البطاقة',
          disabled: locked,
          onClick: async () => {
            if (locked) {
              err.textContent = 'البطاقة محوّلة. افتحي العنصر للتعديل.';
              return;
            }
            try {
              await saveCard(card.cardId);
              dirtyBadge.textContent = state.dirty ? 'غير محفوظ' : 'محفوظ';
              err.textContent = state.error || '';
            } catch (_) {
              err.textContent = state.error || 'فشل الحفظ';
              dirtyBadge.textContent = state.dirty ? 'غير محفوظ' : 'محفوظ';
            }
          },
        });

        const mediaList = el('div', { className: 'bulk-media-list' });
        const refreshMedia = () => {
          mediaList.innerHTML = '';
          jobsForCard(batch.batchId, card.cardId).forEach((j) => {
            mediaList.appendChild(
              el('div', null, [
                el('span', {
                  text:
                    j.fileName +
                    ' · ' +
                    j.status +
                    (j.sessionId ? ' · session…' + String(j.sessionId).slice(-6) : '') +
                    (j.mediaId ? ' · media ' + j.mediaId : '') +
                    (j.needsLocalFile ? ' · يلزم إعادة اختيار الملف' : ''),
                }),
                el('button', {
                  type: 'button',
                  className: 'btn btn-ghost',
                  text: 'إلغاء التعيين',
                  onClick: () => {
                    if (j.status === 'uploading' || j.status === 'verifying') {
                      status.textContent = 'لا يمكن إلغاء تعيين رفع جارٍ من هنا دون إيقاف العملية.';
                      return;
                    }
                    delete mediaJobs[j.clientMediaId];
                    persistMediaMeta();
                    refreshMedia();
                  },
                }),
              ]),
            );
          });
        };
        refreshMedia();

        const assignBtn = el('button', {
          type: 'button',
          className: 'btn btn-ghost',
          text: 'تعيين الملفات المحددة لهذه البطاقة',
          onClick: () => {
            const files = fileInput.files;
            if (!files || !files.length) {
              status.textContent = 'اختاري ملفات أولًا ثم عيّنيها يدويًا لكل بطاقة (لا توزيع تلقائي).';
              return;
            }
            const batchIdFrozen = batch.batchId;
            const cardIdFrozen = card.cardId;
            Array.from(files).forEach((file) => {
              const clientMediaId = newClientMediaId();
              mediaJobs[clientMediaId] = {
                clientMediaId,
                batchId: batchIdFrozen,
                cardId: cardIdFrozen,
                file,
                fileName: file.name,
                mimeType: file.type || 'application/octet-stream',
                size: file.size,
                status: 'assigned',
                sessionId: null,
                mediaId: null,
                ownerId: state.targetOwnerId || null,
                ownerKindPath: batch.kind === 'product' ? 'products' : 'services',
                error: null,
                needsLocalFile: false,
              };
            });
            persistMediaMeta();
            refreshMedia();
            status.textContent =
              'عُيّنت ' + files.length + ' ملفًا للدفعة ' + batchIdFrozen.slice(0, 8) + ' / ' + cardIdFrozen;
          },
        });

        const refileInput = el('input', { type: 'file', accept: 'image/*,video/*', style: 'display:none' });
        refileInput.addEventListener('change', () => {
          const file = refileInput.files && refileInput.files[0];
          if (!file) return;
          const need = jobsForCard(batch.batchId, card.cardId).find((j) => j.needsLocalFile && j.status !== 'ready');
          if (!need) {
            status.textContent = 'لا مهمة تحتاج إعادة اختيار ملف لهذه البطاقة.';
            return;
          }
          if (need.size && file.size !== need.size) {
            status.textContent = 'الحجم لا يطابق جلسة الرفع المحفوظة.';
            return;
          }
          need.file = file;
          need.needsLocalFile = false;
          need.fileName = file.name;
          need.mimeType = file.type || need.mimeType;
          persistMediaMeta();
          refreshMedia();
          status.textContent = 'أُعيد ربط الملف المحلي للمهمة ' + need.clientMediaId.slice(0, 8);
        });
        const refileBtn = el('button', {
          type: 'button',
          className: 'btn btn-ghost',
          text: 'إعادة اختيار ملف لجلسة محفوظة',
          onClick: () => refileInput.click(),
        });

        const phase =
          state.status === 'materialized'
            ? 'محوّل' +
              (state.contentStatus ? ' · محتوى:' + state.contentStatus : '') +
              (state.submitReviewStatus ? ' · مراجعة:' + state.submitReviewStatus : '')
            : 'مسودة محفوظة';

        cardsHost.appendChild(
          el('div', { className: 'bulk-card', 'data-batch': batch.batchId, 'data-card': card.cardId }, [
            el('div', { className: 'bulk-card-head' }, [
              ck,
              el('strong', { text: card.cardId }),
              el('span', { text: ' · ' + phase + ' · ' }),
              dirtyBadge,
              state.targetOwnerId
                ? el('a', { href: state.openUrl || card.openUrl, text: ' فتح العنصر للتعديل' })
                : null,
            ]),
            fieldsHost,
            locked ? null : saveBtn,
            locked ? null : assignBtn,
            locked ? null : refileBtn,
            refileInput,
            mediaList,
            err,
          ]),
        );
      });
    }

    async function loadMyBatches() {
      listHost.innerHTML = '';
      try {
        const list = await PartnersApi.listBulkBatches();
        listHost.appendChild(el('h3', { text: 'دفعاتي' }));
        if (!list.items || !list.items.length) {
          listHost.appendChild(el('p', { className: 'lead', text: 'لا دفعات بعد.' }));
          return;
        }
        list.items.forEach((it) => {
          listHost.appendChild(
            el('div', { className: 'journey-actions' }, [
              el('button', {
                type: 'button',
                className: 'btn btn-ghost',
                text:
                  it.batchId.slice(0, 8) +
                  '… · ' +
                  it.kind +
                  ' · ' +
                  it.cardCount +
                  ' · ' +
                  (it.createStatus || '') +
                  ' · محوّل ' +
                  (it.materializedCount || 0),
                onClick: async () => {
                  if (!confirmLeaveIfNeeded()) return;
                  try {
                    const b = await PartnersApi.getBulkBatch(it.batchId);
                    syncStateFromBatch(b);
                    setBulkUrl(b.batchId);
                    status.textContent =
                      'فُتحت الدفعة ' +
                      b.batchId +
                      ' · وسائط هذه الدفعة: ' +
                      jobsForBatch(b.batchId).length +
                      ' (دفعات أخرى معزولة)';
                    renderCards();
                  } catch (e) {
                    status.textContent = (e && (e.messageAr || e.message)) || String(e);
                  }
                },
              }),
            ]),
          );
        });
      } catch (e) {
        listHost.appendChild(el('p', { text: (e && e.message) || String(e) }));
      }
    }

    const createBtn = el('button', {
      type: 'button',
      className: 'btn btn-primary',
      text: 'إنشاء البطاقات',
      onClick: async () => {
        if (!confirmLeaveIfNeeded()) return;
        try {
          if (!registry || profileSelect.disabled || !profileSelect.value) {
            status.textContent = registryError
              ? 'تعذر إنشاء الدفعة: ' + registryError
              : 'اختاري قالبًا مسموحًا من الخادم أولًا.';
            return;
          }
          const count = Number(countInput.value);
          if (!Number.isInteger(count) || count < 1) {
            status.textContent = 'أدخلي عددًا صحيحًا دون كسور.';
            return;
          }
          let batchId = sessionStorage.getItem(BATCH_KEY);
          if (!batchId) {
            batchId = newBatchId();
            sessionStorage.setItem(BATCH_KEY, batchId);
          }
          status.textContent = 'إنشاء الدفعة ' + batchId + '…';
          const b = await PartnersApi.createBulkBatch({
            kind: kindSelect.value,
            profileId: profileSelect.value,
            count,
            batchId,
          });
          sessionStorage.removeItem(BATCH_KEY);
          // Do NOT clear mediaJobs — other batches' assignments must survive.
          syncStateFromBatch(b);
          setBulkUrl(b.batchId);
          status.textContent = 'دفعة جاهزة ' + b.batchId + ' · ' + b.cards.length + ' بطاقة';
          renderCards();
          await loadMyBatches();
        } catch (e) {
          status.textContent = (e && (e.messageAr || e.message)) || String(e);
        }
      },
    });

    const sharedName = el('input', { id: 'bulkSharedName', type: 'text', placeholder: 'اسم مشترك' });
    const sharedPrice = el('input', { id: 'bulkSharedPrice', type: 'text', placeholder: 'سعر مشترك (ريال)' });
    const overwriteCk = el('input', { id: 'bulkOverwrite', type: 'checkbox' });
    const fileInput = el('input', { id: 'bulkFiles', type: 'file', multiple: 'multiple', accept: 'image/*,video/*' });

    const selectedIds = () =>
      Array.from(cardsHost.querySelectorAll('.bulk-card-ck:checked')).map((n) => n.getAttribute('data-card'));

    let lastPreview = null;

    const previewBtn = el('button', {
      type: 'button',
      className: 'btn btn-ghost',
      text: 'معاينة التعبئة',
      onClick: async () => {
        if (!batch) return;
        const values = {};
        if (sharedName.value.trim()) values.nameAr = sharedName.value.trim();
        if (sharedPrice.value.trim()) {
          try {
            values.priceHalalas = sarToHalalas(sharedPrice.value);
          } catch (e) {
            status.textContent = e.message;
            return;
          }
        }
        const cardIds = selectedIds();
        const expectedRevisions = {};
        cardIds.forEach((id) => {
          const st = currentCards()[id];
          if (st) expectedRevisions[id] = st.revision;
        });
        try {
          const preview = await PartnersApi.applyBulkShared(batch.batchId, {
            previewOnly: true,
            cardIds,
            values,
            overwriteWritten: overwriteCk.checked,
            expectedRevisions,
          });
          lastPreview = { batchId: batch.batchId, expectedRevisions, values, cardIds, at: Date.now() };
          const lines = (preview.perCard || [])
            .map(
              (p) =>
                p.cardId +
                '@' +
                p.revision +
                ': تعيين[' +
                (p.willSet || []).join(',') +
                '] مسح[' +
                (p.willClear || []).join(',') +
                '] حظر[' +
                (p.wouldBlock || []).join(',') +
                ']',
            )
            .join(' · ');
          status.textContent = 'معاينة مربوطة بالإصدارات: ' + (lines || 'لا تغيير');
        } catch (e) {
          status.textContent = (e && (e.messageAr || e.message)) || String(e);
        }
      },
    });

    const applySharedBtn = el('button', {
      type: 'button',
      className: 'btn btn-ghost',
      text: 'تعبئة مشتركة',
      onClick: async () => {
        if (!batch) return;
        const values = {};
        if (sharedName.value.trim()) values.nameAr = sharedName.value.trim();
        if (sharedPrice.value.trim()) {
          try {
            values.priceHalalas = sarToHalalas(sharedPrice.value);
          } catch (e) {
            status.textContent = e.message;
            return;
          }
        }
        const cardIds = selectedIds();
        const expectedRevisions = {};
        const blockedLocal = [];
        cardIds.forEach((id) => {
          const st = currentCards()[id];
          if (!st) return;
          expectedRevisions[id] = st.revision;
          if (st.dirty && !overwriteCk.checked) blockedLocal.push(id);
        });
        if (blockedLocal.length && !overwriteCk.checked) {
          status.textContent =
            'بطاقات بتعديلات محلية غير محفوظة: ' + blockedLocal.join(', ') + ' — احفظيها أو فعّلي الاستبدال.';
          return;
        }
        if (lastPreview && lastPreview.batchId === batch.batchId) {
          const drift = cardIds.filter((id) => lastPreview.expectedRevisions[id] !== expectedRevisions[id]);
          if (drift.length) {
            status.textContent =
              'تغيرت إصدارات بعد المعاينة (' + drift.join(',') + '). أعيدي المعاينة قبل التطبيق.';
            return;
          }
        }
        try {
          const out = await PartnersApi.applyBulkShared(batch.batchId, {
            cardIds,
            values,
            overwriteWritten: overwriteCk.checked,
            expectedRevisions,
          });
          (out.results || []).forEach((r) => {
            const st = currentCards()[r.cardId];
            if (!st) return;
            if (r.ok) {
              if (!st.dirty || st.editGen === st.saveGen) {
                st.revision = r.revision;
                st.savedValues = Object.assign({}, r.values || {});
                st.localValues = Object.assign({}, r.values || {});
                st.dirty = false;
              } else {
                st.revision = r.revision;
                st.savedValues = Object.assign({}, r.values || {});
                // keep newer local edits
              }
            } else {
              const errBody = r.error || {};
              st.error = errBody.messageAr || errBody.message || errBody.code || 'فشل';
            }
          });
          renderCards();
          if (out.allOk) status.textContent = 'تعبئة مشتركة: نجحت كل البطاقات (' + out.succeeded + ').';
          else if (out.partial)
            status.textContent = 'نجاح جزئي: نجح ' + out.succeeded + ' · تعثر ' + out.failed;
          else status.textContent = 'تعبئة مشتركة: فشلت (' + out.failed + ').';
        } catch (e) {
          status.textContent = (e && (e.messageAr || e.message)) || String(e);
        }
      },
    });

    async function runOneUpload(job) {
      // Frozen destination — never read current `batch` for ownership.
      const destBatchId = job.batchId;
      const destCardId = job.cardId;
      const map = ensureBatchCards(destBatchId);
      const st = map[destCardId];
      if (!st) {
        job.status = 'failed';
        job.error = 'بطاقة الوجهة غير محمّلة';
        persistMediaMeta();
        return;
      }
      if (job.status === 'ready' && job.mediaId) return;
      if (!job.file) {
        job.status = 'needs_file';
        job.needsLocalFile = true;
        job.error = 'يلزم إعادة اختيار الملف المحلي لاستكمال الجلسة';
        persistMediaMeta();
        return;
      }
      if (String(job.mimeType || '').indexOf('video/') === 0) {
        // Best-effort duration gate when browser can probe; server enforces too.
        try {
          const dur = await new Promise((resolve) => {
            const v = document.createElement('video');
            v.preload = 'metadata';
            v.onloadedmetadata = () => {
              resolve(v.duration || 0);
              URL.revokeObjectURL(v.src);
            };
            v.onerror = () => resolve(0);
            v.src = URL.createObjectURL(job.file);
          });
          if (dur > VIDEO_MAX_SECONDS) {
            job.status = 'failed';
            job.error = 'الفيديو يتجاوز الحد المعتمد (5 دقائق)';
            persistMediaMeta();
            return;
          }
        } catch (_) {}
      }

      job.status = 'uploading';
      persistMediaMeta();
      try {
        if (st.dirty && st.status !== 'materialized') {
          // Save within destination batch context
          const prevBatch = batch;
          batch = { batchId: destBatchId, kind: (batch && batch.kind) || 'product', profileId: '', cards: [] };
          try {
            await saveCard(destCardId, { silent: true });
          } finally {
            batch = prevBatch;
          }
        }
        let ownerId = job.ownerId || st.targetOwnerId;
        if (!ownerId) {
          const mat = await PartnersApi.materializeBulkBatch(
            destBatchId,
            { cardIds: [destCardId], submitReview: false },
            'bulk-media-' + destBatchId + '-' + destCardId,
          );
          const row = (mat.results || []).find((r) => r.cardId === destCardId);
          if (!row || !row.ok) throw new Error('تعذر إنشاء العنصر قبل الرفع');
          ownerId = row.targetOwnerId;
          st.targetOwnerId = ownerId;
          st.status = 'materialized';
          job.ownerId = ownerId;
        } else {
          job.ownerId = ownerId;
        }

        if (job.sessionId && typeof PartnersApi.getUploadSession === 'function') {
          try {
            const sess = await PartnersApi.getUploadSession(job.sessionId);
            if (sess && (sess.status === 'ready' || sess.mediaId)) {
              job.status = 'ready';
              job.mediaId = sess.mediaId || sess.id || job.mediaId;
              job.file = null;
              persistMediaMeta();
              return;
            }
            if (sess && sess.status === 'finalizing') {
              job.status = 'verifying';
              persistMediaMeta();
            }
          } catch (_) {}
        }

        const kindForUpload = job.ownerKindPath || 'products';

        job.status = job.status === 'verifying' ? 'verifying' : 'uploading';
        const session = await PartnersApi.uploadViaSession(kindForUpload, ownerId, job.file, {
          clientMediaId: job.clientMediaId,
          sessionId: job.sessionId || undefined,
          onSession: (s) => {
            job.sessionId = s && s.sessionId;
            persistMediaMeta();
          },
          onProgress: () => {},
        });
        job.status = 'ready';
        job.mediaId = session && (session.mediaId || session.id);
        job.file = null;
        job.needsLocalFile = false;
        job.error = null;
        persistMediaMeta();
      } catch (e) {
        const msg = (e && (e.messageAr || e.message)) || String(e);
        if (/تحقق|finaliz|pending|جار/i.test(msg)) {
          job.status = 'verifying';
          job.error = 'جارٍ التحقق من اكتمال التخزين — يمكن المتابعة لاحقًا بنفس الجلسة';
        } else {
          job.status = 'failed';
          job.error = msg;
        }
        persistMediaMeta();
      }
    }

    async function uploadAssignedMedia() {
      if (!batch) return;
      if (typeof PartnersApi.uploadViaSession !== 'function') {
        status.textContent = 'مسار الرفع غير متاح.';
        return;
      }
      // Only jobs for the *current* batch that still need work — never pull other batches.
      const pending = jobsForBatch(batch.batchId).filter(
        (j) => j.status === 'assigned' || j.status === 'failed' || j.status === 'needs_file' || j.status === 'verifying',
      );
      if (!pending.length) {
        status.textContent = 'لا مهام رفع معلّقة لهذه الدفعة.';
        return;
      }
      if (uploadPumpRunning) {
        status.textContent = 'رفع جارٍ بالفعل (حد التزامن ' + MAX_UPLOAD_INFLIGHT + ') — لم تُنشأ مجموعة إضافية.';
        return;
      }
      uploadPumpRunning = true;
      let i = 0;
      await new Promise((resolve) => {
        const pump = () => {
          while (uploadInflight < MAX_UPLOAD_INFLIGHT && i < pending.length) {
            const job = pending[i++];
            // Skip ready (idempotent)
            if (job.status === 'ready' && job.mediaId) continue;
            uploadInflight++;
            runOneUpload(job).finally(() => {
              uploadInflight--;
              if (i >= pending.length && uploadInflight === 0) {
                uploadPumpRunning = false;
                resolve();
              } else pump();
            });
          }
          if (pending.length === 0) {
            uploadPumpRunning = false;
            resolve();
          } else if (i >= pending.length && uploadInflight === 0) {
            uploadPumpRunning = false;
            resolve();
          }
        };
        pump();
      });
      renderCards();
      const all = jobsForBatch(batch.batchId);
      const ready = all.filter((j) => j.status === 'ready').length;
      const failed = all.filter((j) => j.status === 'failed').length;
      const verifying = all.filter((j) => j.status === 'verifying').length;
      const assigned = all.filter((j) => j.status === 'assigned' || j.status === 'needs_file').length;
      status.textContent =
        'رفع دفعة ' +
        batch.batchId.slice(0, 8) +
        ': جاهز ' +
        ready +
        ' · جارٍ التحقق ' +
        verifying +
        ' · فشل ' +
        failed +
        ' · متبقٍ ' +
        assigned;
    }

    const uploadBtn = el('button', {
      type: 'button',
      className: 'btn btn-ghost',
      text: 'رفع وسائط هذه الدفعة فقط',
      onClick: () => uploadAssignedMedia(),
    });

    const matBtn = el('button', {
      type: 'button',
      className: 'btn btn-primary',
      text: 'حفظ ثم تحويل الدفعة',
      onClick: async () => {
        if (!batch) return;
        try {
          status.textContent = 'حفظ المدخلات قبل التحويل…';
          const saved = await saveDirtyCards();
          if (!saved.ok) {
            status.textContent =
              'تعذر التحويل: فشل حفظ ' + saved.failed.length + ' بطاقة. المدخلات محفوظة محليًا.';
            renderCards();
            return;
          }
          const key = 'bulk-ui-' + batch.batchId;
          const out = await PartnersApi.materializeBulkBatch(
            batch.batchId,
            { submitReview: true, failedOnly: true },
            key,
          );
          const fresh = await PartnersApi.getBulkBatch(batch.batchId);
          syncStateFromBatch(fresh);
          renderCards();
          const detail = (out.results || [])
            .filter((r) => !r.ok)
            .map((r) => r.cardId + ':' + ((r.error && (r.error.messageAr || r.error.code)) || 'fail'))
            .join(' · ');
          status.textContent =
            'مسودة→محوّل: نجح ' +
            out.succeeded +
            ' · تعثر ' +
            out.failed +
            ' · تخطي ' +
            out.skipped +
            (detail ? ' | ' + detail : '') +
            ' — التحويل ليس نشرًا علنيًا.';
        } catch (e) {
          status.textContent = (e && (e.messageAr || e.message)) || String(e);
        }
      },
    });

    root.appendChild(status);
    if (registryError) {
      root.appendChild(el('p', { className: 'lead', style: 'color:#b00020', text: 'فشل registry: ' + registryError }));
    }
    root.appendChild(listHost);
    root.appendChild(
      el('div', { className: 'journey-actions' }, [
        el('label', null, ['النوع ', kindSelect]),
        el('label', null, ['القالب ', profileSelect]),
        el('label', null, ['العدد ', countInput]),
        createBtn,
      ]),
    );
    root.appendChild(
      el('p', { className: 'lead' }, [
        'الملفات تُعيَّن يدويًا لكل بطاقة بهوية clientMediaId مستقلة وbatchId ثابت. التبديل بين الدفعات لا ينقل الرفع. حد الفيديو 5 دقائق.',
      ]),
    );
    root.appendChild(fileInput);
    root.appendChild(
      el('div', { className: 'journey-actions' }, [
        sharedName,
        sharedPrice,
        el('label', null, [overwriteCk, ' استبدال المكتوب']),
        previewBtn,
        applySharedBtn,
        uploadBtn,
        matBtn,
      ]),
    );
    root.appendChild(cardsHost);

    await loadMyBatches();

    const q = new URLSearchParams(location.search);
    const existing = q.get('bulk');
    if (existing) {
      try {
        const b = await PartnersApi.getBulkBatch(existing);
        syncStateFromBatch(b);
        setBulkUrl(b.batchId);
        status.textContent =
          'استُعيدت الدفعة ' + b.batchId + ' · مهام وسائط مستعادة: ' + jobsForBatch(b.batchId).length;
        renderCards();
      } catch (e) {
        status.textContent =
          'تعذر فتح الدفعة: ' + ((e && (e.messageAr || e.message)) || String(e)) + ' — لم تُنشأ دفعة جديدة.';
      }
    }
  }

  window.MiraBulkAdd = {
    open: openBulkUi,
    defaultLimit: DEFAULT_LIMIT,
    sarToHalalas,
    halalasToSar,
    /** test hooks */
    _mediaJobs: mediaJobs,
    _cardsByBatch: cardsByBatch,
    _jobsForBatch: jobsForBatch,
    _jobsForCard: jobsForCard,
    _cardKey: cardKey,
  };
})();
