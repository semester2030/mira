/**
 * P6 — إضافة مجموعة
 * Stable batchId, dirty cards, honest shared fill, real P2 upload sessions, registry profiles.
 */
(function () {
  const DEFAULT_LIMIT = 10;
  const BATCH_KEY = 'mira_bulk_pending_batch_id';
  const HALALAS_PER_SAR = 100;

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

  function sarToHalalas(sarStr) {
    const t = String(sarStr == null ? '' : sarStr).trim();
    if (!t) return null;
    if (!/^\d+(\.\d{1,2})?$/.test(t)) throw new Error('السعر بالريال غير صالح');
    const [r, f] = t.split('.');
    const frac = (f || '').padEnd(2, '0').slice(0, 2);
    return Number(r) * HALALAS_PER_SAR + Number(frac || 0);
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
        const allowed = p.partnerTypes || p.allowedPartnerTypes || [];
        if (!allowed.length) return true;
        if (type === 'developer') return true;
        return allowed.indexOf(type) >= 0;
      })
      .map((p) => ({ id: p.id, label: p.labelAr || p.label || p.id }));
  }

  async function openBulkUi(root, partner) {
    root.innerHTML = '';
    let registry = null;
    try {
      registry = await PartnersApi.registry();
    } catch (e) {
      registry = { profiles: [] };
    }

    const status = el('p', { className: 'lead', id: 'bulkStatus', role: 'status' }, [
      'أنشئي دفعة بهوية ثابتة. المادة = materialized ليست منشورة تلقائيًا.',
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
      const opts = profilesFromRegistry(registry, partner, kindSelect.value);
      (opts.length
        ? opts
        : kindSelect.value === 'product'
          ? [{ id: 'product.clothes', label: 'ملابس' }]
          : [{ id: 'service.salon_hair_cut', label: 'قص شعر' }]
      ).forEach((p) => profileSelect.appendChild(el('option', { value: p.id, text: p.label })));
    };
    refillProfiles();
    kindSelect.addEventListener('change', refillProfiles);

    /** @type {null | {batchId:string, kind:string, profileId:string, cards:any[], ready?:boolean}} */
    let batch = null;
    /** cardId -> { localValues, savedValues, revision, dirty, status, targetOwnerId, error, media[] } */
    const cardState = Object.create(null);
    /** clientMediaId -> { file?:File, fileName, mimeType, size, cardId, sessionId?, status, mediaId? } */
    const mediaJobs = Object.create(null);

    function syncStateFromBatch(b) {
      batch = b;
      (b.cards || []).forEach((c) => {
        const prev = cardState[c.cardId];
        const saved = Object.assign({}, c.values || {});
        if (prev && prev.dirty) {
          cardState[c.cardId] = Object.assign({}, prev, {
            revision: c.revision,
            status: c.status,
            targetOwnerId: c.targetOwnerId,
            savedValues: saved,
            contentStatus: c.contentStatus,
            submitReviewStatus: c.submitReviewStatus,
            // keep localValues / dirty
          });
        } else {
          cardState[c.cardId] = {
            localValues: Object.assign({}, saved),
            savedValues: saved,
            revision: c.revision,
            status: c.status,
            targetOwnerId: c.targetOwnerId,
            contentStatus: c.contentStatus,
            submitReviewStatus: c.submitReviewStatus,
            dirty: false,
            error: null,
            openUrl: c.openUrl,
          };
        }
      });
    }

    function markDirty(cardId, field, value) {
      const st = cardState[cardId];
      if (!st) return;
      st.localValues[field] = value;
      st.dirty = JSON.stringify(st.localValues) !== JSON.stringify(st.savedValues);
      st.error = null;
    }

    function markClear(cardId, field) {
      const st = cardState[cardId];
      if (!st) return;
      delete st.localValues[field];
      st.dirty = true;
      st.error = null;
    }

    async function saveCard(cardId, opts) {
      const st = cardState[cardId];
      if (!st || !batch) return null;
      if (st.status === 'materialized') return st;
      const clearFields = [];
      const values = {};
      const keys = new Set([...Object.keys(st.localValues), ...Object.keys(st.savedValues)]);
      keys.forEach((k) => {
        if (!(k in st.localValues) && k in st.savedValues) clearFields.push(k);
        else if (k in st.localValues) values[k] = st.localValues[k];
      });
      try {
        const put = await PartnersApi.putBulkCard(batch.batchId, cardId, {
          expectedRevision: st.revision,
          values,
          clearFields,
          overwriteWritten: true,
        });
        st.revision = put.revision;
        st.savedValues = Object.assign({}, put.values || {});
        st.localValues = Object.assign({}, put.values || {});
        st.dirty = false;
        st.error = null;
        status.textContent = 'حُفظت البطاقة ' + cardId + ' · rev ' + put.revision + ' (مؤكد من الخادم)';
        return put;
      } catch (e) {
        st.error = (e && (e.messageAr || e.message)) || String(e);
        if (e && e.code === 'DRAFT_REVISION_CONFLICT') {
          st.error += ' — تعارض إصدار؛ احفظي مراجعتك أو أعيدي التحميل بحذر.';
        }
        if (!(opts && opts.silent)) status.textContent = st.error;
        throw e;
      }
    }

    async function saveDirtyCards() {
      if (!batch) return { ok: true, failed: [] };
      const failed = [];
      for (const cardId of Object.keys(cardState)) {
        const st = cardState[cardId];
        if (!st.dirty || st.status === 'materialized') continue;
        try {
          await saveCard(cardId, { silent: true });
        } catch (e) {
          failed.push({ cardId, error: st.error || String(e) });
        }
      }
      return { ok: failed.length === 0, failed };
    }

    function renderCards() {
      cardsHost.innerHTML = '';
      if (!batch) return;
      if (batch.ready === false) {
        cardsHost.appendChild(el('p', { className: 'lead', text: 'الدفعة قيد الاستكمال…' }));
        return;
      }
      (batch.cards || []).forEach((card) => {
        const st = cardState[card.cardId] || syncStateFromBatch(batch) || cardState[card.cardId];
        const state = cardState[card.cardId];
        const ck = el('input', { type: 'checkbox', className: 'bulk-card-ck', 'data-card': card.cardId });
        ck.checked = true;
        const name = el('input', {
          type: 'text',
          value: state.localValues.nameAr != null ? String(state.localValues.nameAr) : '',
          'data-card': card.cardId,
        });
        name.addEventListener('input', () => {
          const v = name.value;
          if (v === '') markClear(card.cardId, 'nameAr');
          else markDirty(card.cardId, 'nameAr', v);
          dirtyBadge.textContent = cardState[card.cardId].dirty ? 'غير محفوظ' : 'محفوظ';
        });
        const priceSar = el('input', {
          type: 'text',
          inputmode: 'decimal',
          placeholder: 'ريال',
          value: halalasToSar(state.localValues.priceHalalas),
          'data-card': card.cardId,
        });
        priceSar.addEventListener('input', () => {
          const t = priceSar.value.trim();
          if (!t) {
            markClear(card.cardId, 'priceHalalas');
          } else {
            try {
              markDirty(card.cardId, 'priceHalalas', sarToHalalas(t));
            } catch (_) {
              /* keep typing */
            }
          }
          dirtyBadge.textContent = cardState[card.cardId].dirty ? 'غير محفوظ' : 'محفوظ';
        });
        let duration = null;
        if (batch.kind === 'service') {
          duration = el('input', {
            type: 'number',
            value: state.localValues.durationMin != null ? String(state.localValues.durationMin) : '',
          });
          duration.addEventListener('input', () => {
            if (duration.value === '') markClear(card.cardId, 'durationMin');
            else markDirty(card.cardId, 'durationMin', Number(duration.value));
            dirtyBadge.textContent = cardState[card.cardId].dirty ? 'غير محفوظ' : 'محفوظ';
          });
        }
        const dirtyBadge = el('span', {
          className: 'lead',
          text: state.dirty ? 'غير محفوظ' : 'محفوظ',
        });
        const err = el('p', {
          className: 'lead',
          text: state.error || '',
          style: state.error ? 'color:#b00020' : '',
        });
        const saveBtn = el('button', {
          type: 'button',
          className: 'btn btn-ghost',
          text: 'حفظ البطاقة',
          onClick: async () => {
            try {
              await saveCard(card.cardId);
              dirtyBadge.textContent = 'محفوظ';
              err.textContent = '';
            } catch (_) {
              err.textContent = cardState[card.cardId].error || 'فشل الحفظ';
            }
          },
        });
        const mediaList = el('div', { className: 'bulk-media-list' });
        const refreshMedia = () => {
          mediaList.innerHTML = '';
          Object.keys(mediaJobs)
            .filter((id) => mediaJobs[id].cardId === card.cardId)
            .forEach((id) => {
              const j = mediaJobs[id];
              mediaList.appendChild(
                el('div', null, [
                  el('span', {
                    text: j.fileName + ' · ' + j.status + (j.mediaId ? ' · media ' + j.mediaId : ''),
                  }),
                  el('button', {
                    type: 'button',
                    className: 'btn btn-ghost',
                    text: 'إلغاء التعيين',
                    onClick: () => {
                      delete mediaJobs[id];
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
              status.textContent = 'اختاري ملفات أولًا ثم عيّنيها يدويًا لكل بطاقة.';
              return;
            }
            Array.from(files).forEach((file) => {
              const clientMediaId =
                (window.crypto && crypto.randomUUID && crypto.randomUUID()) ||
                'm' + Date.now() + Math.random().toString(36).slice(2);
              mediaJobs[clientMediaId] = {
                file,
                fileName: file.name,
                mimeType: file.type || 'application/octet-stream',
                size: file.size,
                cardId: card.cardId,
                status: 'assigned',
                sessionId: null,
                mediaId: null,
              };
            });
            refreshMedia();
            status.textContent = 'عُيّنت ' + files.length + ' ملفًا للبطاقة ' + card.cardId + ' (هويات مستقلة).';
          },
        });
        const phase =
          state.status === 'materialized'
            ? 'محوّل' +
              (state.contentStatus ? ' · محتوى:' + state.contentStatus : '') +
              (state.submitReviewStatus ? ' · مراجعة:' + state.submitReviewStatus : '')
            : 'مسودة';
        cardsHost.appendChild(
          el('div', { className: 'bulk-card', 'data-card': card.cardId }, [
            el('div', { className: 'bulk-card-head' }, [
              ck,
              el('strong', { text: card.cardId }),
              el('span', { text: ' · ' + phase + ' · ' }),
              dirtyBadge,
              state.targetOwnerId ? el('a', { href: state.openUrl || card.openUrl, text: ' فتح العنصر' }) : null,
            ]),
            el('label', null, ['الاسم ', name]),
            el('label', null, ['السعر (ريال) ', priceSar]),
            duration ? el('label', null, ['المدة (د) ', duration]) : null,
            saveBtn,
            assignBtn,
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
                  try {
                    const b = await PartnersApi.getBulkBatch(it.batchId);
                    Object.keys(cardState).forEach((k) => delete cardState[k]);
                    syncStateFromBatch(b);
                    setBulkUrl(b.batchId);
                    status.textContent = 'فُتحت الدفعة ' + b.batchId + (b.ready ? '' : ' (استكمال)');
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
        try {
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
          Object.keys(cardState).forEach((k) => delete cardState[k]);
          syncStateFromBatch(b);
          setBulkUrl(b.batchId);
          status.textContent =
            'دفعة جاهزة ' + b.batchId + ' · ' + b.cards.length + ' بطاقة' + (b.ready ? '' : ' — قيد الاستكمال');
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
        try {
          const preview = await PartnersApi.applyBulkShared(batch.batchId, {
            previewOnly: true,
            cardIds: selectedIds(),
            values,
            overwriteWritten: overwriteCk.checked,
          });
          const lines = (preview.perCard || [])
            .map(
              (p) =>
                p.cardId +
                ': تعيين[' +
                (p.willSet || []).join(',') +
                '] مسح[' +
                (p.willClear || []).join(',') +
                '] حظر[' +
                (p.wouldBlock || []).join(',') +
                ']',
            )
            .join(' · ');
          status.textContent = 'معاينة: ' + (lines || 'لا تغيير');
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
        try {
          const out = await PartnersApi.applyBulkShared(batch.batchId, {
            cardIds: selectedIds(),
            values,
            overwriteWritten: overwriteCk.checked,
          });
          (out.results || []).forEach((r) => {
            if (r.ok && cardState[r.cardId] && !cardState[r.cardId].dirty) {
              cardState[r.cardId].revision = r.revision;
              cardState[r.cardId].savedValues = Object.assign({}, r.values || {});
              cardState[r.cardId].localValues = Object.assign({}, r.values || {});
            } else if (r.ok && cardState[r.cardId] && cardState[r.cardId].dirty) {
              cardState[r.cardId].revision = r.revision;
              cardState[r.cardId].savedValues = Object.assign({}, r.values || {});
              // keep local dirty edits
            } else if (!r.ok && cardState[r.cardId]) {
              const err = r.error || {};
              cardState[r.cardId].error = err.messageAr || err.message || err.code || 'فشل';
            }
          });
          renderCards();
          if (out.allOk) status.textContent = 'تعبئة مشتركة: نجحت كل البطاقات (' + out.succeeded + ').';
          else if (out.partial)
            status.textContent =
              'نجاح جزئي: نجح ' + out.succeeded + ' · تعثر ' + out.failed + ' — راجعي أسباب كل بطاقة.';
          else status.textContent = 'تعبئة مشتركة: فشلت كل البطاقات المختارة (' + out.failed + ').';
        } catch (e) {
          status.textContent = (e && (e.messageAr || e.message)) || String(e);
        }
      },
    });

    async function uploadAssignedMedia() {
      if (!batch) return;
      if (typeof PartnersApi.uploadViaSession !== 'function') {
        status.textContent = 'مسار الرفع غير متاح في هذه الصفحة.';
        return;
      }
      const jobs = Object.keys(mediaJobs).map((id) => Object.assign({ clientMediaId: id }, mediaJobs[id]));
      const pending = jobs.filter((j) => j.status !== 'ready' && j.file);
      let inflight = 0;
      const max = 2;
      let i = 0;
      await new Promise((resolve) => {
        const pump = () => {
          while (inflight < max && i < pending.length) {
            const job = pending[i++];
            inflight++;
            (async () => {
              try {
                job.status = 'uploading';
                const st = cardState[job.cardId];
                if (!st) throw new Error('بطاقة مفقودة');
                if (st.dirty) await saveCard(job.cardId, { silent: true });
                // Materialize draft first if no owner — upload needs ownerId.
                let ownerId = st.targetOwnerId;
                if (!ownerId) {
                  const mat = await PartnersApi.materializeBulkBatch(
                    batch.batchId,
                    { cardIds: [job.cardId], submitReview: false },
                    'bulk-media-' + batch.batchId + '-' + job.cardId,
                  );
                  const row = (mat.results || []).find((r) => r.cardId === job.cardId);
                  if (!row || !row.ok) throw new Error('تعذر إنشاء العنصر قبل الرفع');
                  ownerId = row.targetOwnerId;
                  st.targetOwnerId = ownerId;
                  st.status = 'materialized';
                }
                const ownerKindPath = batch.kind === 'product' ? 'products' : 'services';
                const session = await PartnersApi.uploadViaSession(ownerKindPath, ownerId, job.file, {
                  clientMediaId: job.clientMediaId,
                  sessionId: job.sessionId || undefined,
                  onSession: (s) => {
                    job.sessionId = s && s.sessionId;
                  },
                  onProgress: () => {},
                });
                job.status = 'ready';
                job.mediaId = session && (session.mediaId || session.id);
                job.file = null; // drop bytes after success
              } catch (e) {
                job.status = 'failed';
                job.error = (e && (e.messageAr || e.message)) || String(e);
              } finally {
                inflight--;
                if (i >= pending.length && inflight === 0) resolve();
                else pump();
              }
            })();
          }
          if (pending.length === 0) resolve();
        };
        pump();
      });
      renderCards();
      const failed = jobs.filter((j) => j.status === 'failed').length;
      const ready = jobs.filter((j) => j.status === 'ready').length;
      status.textContent = 'رفع الوسائط: جاهز ' + ready + ' · فشل ' + failed;
    }

    const uploadBtn = el('button', {
      type: 'button',
      className: 'btn btn-ghost',
      text: 'رفع الوسائط المعيّنة',
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
              'تعذر التحويل: فشل حفظ ' +
              saved.failed.length +
              ' بطاقة. المدخلات محفوظة محليًا — أصلحيها ثم أعيدي.';
            renderCards();
            return;
          }
          status.textContent = 'تحويل الدفعة…';
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
            'تحويل: نجح ' +
            out.succeeded +
            ' · تعثر ' +
            out.failed +
            ' · تخطي ' +
            out.skipped +
            (detail ? ' | ' + detail : '') +
            ' — تنبيه: التحويل ≠ نشر علني.';
        } catch (e) {
          status.textContent = (e && (e.messageAr || e.message)) || String(e);
        }
      },
    });

    root.appendChild(status);
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
        'الملفات تُعيَّن يدويًا لكل بطاقة بهوية مستقلة — عدد الملفات لا يغيّر عدد العناصر. حد الفيديو 5 دقائق حسب العقد.',
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
        status.textContent = 'استُعيدت الدفعة ' + b.batchId;
        renderCards();
      } catch (e) {
        status.textContent =
          'تعذر فتح الدفعة المطلوبة: ' + ((e && (e.messageAr || e.message)) || String(e)) + ' — لم تُنشأ دفعة جديدة.';
      }
    }
  }

  window.MiraBulkAdd = {
    open: openBulkUi,
    defaultLimit: DEFAULT_LIMIT,
    sarToHalalas,
    halalasToSar,
  };
})();
