/**
 * Partner editor v2 — server drafts with auth-generation isolation (P1 RC3).
 * Server flag owns activation; query params cannot enable a disabled flag.
 */
(function () {
  const PARTNER_ID_KEY = 'mira_partner_id';
  const ACCOUNT_KEY = 'mira_partner_email';
  const EPOCH_KEY = 'mira_editor_v2_session_epoch';
  const REGISTRY_URL = 'js/field-registry.v2.json';

  const state = {
    enabled: false,
    registryHash: null,
    localRegistryHash: null,
    schemaVersion: 2,
    partnerType: null,
    partnerId: null,
    accountEmail: null,
    sessionEpoch: 0,
    authGeneration: 0,
    tokenFingerprint: null,
    registryMismatch: false,
    registryReady: false,
    draftRevisionByClientId: Object.create(null),
    editContexts: Object.create(null),
    timers: Object.create(null),
    inflight: Object.create(null),
    pending: Object.create(null),
    seq: Object.create(null),
    abortByForm: Object.create(null),
    lastFlushResult: Object.create(null),
  };

  function readEpoch() {
    const n = Number(sessionStorage.getItem(EPOCH_KEY) || '0');
    return Number.isFinite(n) ? n : 0;
  }

  function bumpEpoch(reason) {
    const next = readEpoch() + 1;
    sessionStorage.setItem(EPOCH_KEY, String(next));
    state.sessionEpoch = next;
    cancelAllPending(reason || 'epoch');
    return next;
  }

  function currentPartnerId() {
    return localStorage.getItem(PARTNER_ID_KEY) || (window.sessionPartner && window.sessionPartner.id) || null;
  }

  function currentAuthSnapshot() {
    const gen = window.PartnersApi && typeof PartnersApi.authGeneration === 'function'
      ? PartnersApi.authGeneration()
      : 0;
    const fp = window.PartnersApi && typeof PartnersApi.authTokenFingerprint === 'function'
      ? PartnersApi.authTokenFingerprint()
      : null;
    return { authGeneration: gen, tokenFingerprint: fp };
  }

  function statusEl(form) {
    return (form && form.querySelector('[data-editor-v2-status]')) || null;
  }

  function setStatus(form, text, kind) {
    const el = statusEl(form);
    if (!el) return;
    el.textContent = text || '';
    el.dataset.kind = kind || '';
  }

  function cancelAllPending(reason) {
    Object.keys(state.timers).forEach((k) => clearTimeout(state.timers[k]));
    state.timers = Object.create(null);
    state.pending = Object.create(null);
    Object.keys(state.abortByForm).forEach((k) => {
      try { state.abortByForm[k].abort(reason || 'cancelled'); } catch (e) {}
    });
    state.abortByForm = Object.create(null);
    state.inflight = Object.create(null);
  }

  /** Cancel timers/inflight for one form only (opening another form must not drop sibling saves). */
  function cancelFormPending(formId, reason) {
    const id = formId || 'default';
    if (state.timers[id]) {
      clearTimeout(state.timers[id]);
      delete state.timers[id];
    }
    delete state.pending[id];
    if (state.abortByForm[id]) {
      try { state.abortByForm[id].abort(reason || 'cancelled'); } catch (e) {}
      delete state.abortByForm[id];
    }
    state.inflight[id] = false;
  }

  function assertSameSession(snapshot) {
    if (!snapshot) return false;
    if (snapshot.sessionEpoch !== state.sessionEpoch) return false;
    if (snapshot.partnerId !== state.partnerId) return false;
    if (currentPartnerId() !== snapshot.partnerId) return false;
    const auth = currentAuthSnapshot();
    if (snapshot.authGeneration !== auth.authGeneration) return false;
    if (snapshot.tokenFingerprint !== auth.tokenFingerprint) return false;
    if (!auth.tokenFingerprint) return false;
    return true;
  }

  function captureSessionSnapshot() {
    const auth = currentAuthSnapshot();
    return {
      partnerId: state.partnerId,
      sessionEpoch: state.sessionEpoch,
      authGeneration: auth.authGeneration,
      tokenFingerprint: auth.tokenFingerprint,
    };
  }

  function hexSha256(buffer) {
    return Array.from(new Uint8Array(buffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  async function computeLocalRegistryHash() {
    if (window.MiraFieldRegistryLocalHash) return window.MiraFieldRegistryLocalHash;
    const res = await fetch(REGISTRY_URL, { cache: 'no-store' });
    if (!res.ok) throw new Error('تعذر تحميل سجل الحقول المحلي');
    const buf = await res.arrayBuffer();
    if (!window.crypto || !crypto.subtle) throw new Error('تعذر حساب بصمة السجل');
    const digest = await crypto.subtle.digest('SHA-256', buf);
    const hash = hexSha256(digest);
    window.MiraFieldRegistryLocalHash = hash;
    return hash;
  }

  function bindEditContext(formId, ctx) {
    if (!formId || !ctx || !ctx.clientDraftId) return null;
    state.editContexts[formId] = {
      clientDraftId: ctx.clientDraftId,
      kind: ctx.kind,
      profileId: ctx.profileId || null,
      schemaVersion: ctx.schemaVersion || state.schemaVersion,
      revision: ctx.revision == null ? null : ctx.revision,
      targetOwnerId: ctx.targetOwnerId || null,
      status: ctx.status || 'draft',
      submitReviewStatus: ctx.submitReviewStatus || null,
      values: ctx.values || {},
    };
    if (ctx.revision != null) state.draftRevisionByClientId[ctx.clientDraftId] = ctx.revision;
    return state.editContexts[formId];
  }

  function getEditContext(formId) {
    return state.editContexts[formId || 'default'] || null;
  }

  function clearEditContext(formId) {
    delete state.editContexts[formId || 'default'];
  }

  function clientDraftIdFor(kind, itemId, formId) {
    const ctx = formId ? getEditContext(formId) : null;
    if (ctx && ctx.clientDraftId && (!ctx.kind || ctx.kind === kind)) return ctx.clientDraftId;
    if (itemId) return 'owner:' + kind + ':' + itemId;
    const scope = state.partnerId || 'anon';
    const key = 'mira_editor_v2_new_' + scope + '_' + kind;
    let id = sessionStorage.getItem(key);
    if (!id) {
      id = 'new:' + scope + ':' + kind + ':' + (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random());
      sessionStorage.setItem(key, id);
    }
    return id;
  }

  function allocateNewDraftId(kind) {
    const scope = state.partnerId || 'anon';
    const key = 'mira_editor_v2_new_' + scope + '_' + kind;
    const id = 'new:' + scope + ':' + kind + ':' + (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random());
    sessionStorage.setItem(key, id);
    return id;
  }

  function clearNewDraftKey(kind) {
    const scope = state.partnerId || 'anon';
    sessionStorage.removeItem('mira_editor_v2_new_' + scope + '_' + kind);
  }

  function scopedTemplateKey(ownerOrNew) {
    const scope = state.partnerId || 'anon';
    return 'mira-service-template:' + scope + ':' + (ownerOrNew || 'new');
  }

  function profileIdFor(kind, category, partnerType, preferred) {
    if (preferred) return preferred;
    if (kind === 'product') {
      const map = {
        clothes: 'product.clothes',
        face: 'product.face',
        body: 'product.body',
        hair: 'product.hair',
        accessories: 'product.accessories',
      };
      return map[category] || 'product.clothes';
    }
    const svc = {
      hair: partnerType === 'clinic' ? 'service.clinic_skin' : 'service.salon_hair_cut',
      nails: 'service.salon_nails',
      makeup: 'service.salon_makeup',
      skin: 'service.clinic_skin',
      laser: 'service.clinic_laser',
      consult: 'service.clinic_consult',
      care: 'service.salon_care',
      teeth: 'service.clinic_teeth',
    };
    if (category && svc[category]) return svc[category];
    return partnerType === 'clinic' ? 'service.clinic.generic' : 'service.salon.generic';
  }

  function onAuthChange(ev) {
    const detail = (ev && ev.detail) || {};
    bumpEpoch('auth-change:' + (detail.reason || ''));
    state.partnerId = null;
    state.accountEmail = localStorage.getItem(ACCOUNT_KEY);
    state.authGeneration = currentAuthSnapshot().authGeneration;
    state.tokenFingerprint = currentAuthSnapshot().tokenFingerprint;
    state.draftRevisionByClientId = Object.create(null);
    state.editContexts = Object.create(null);
    state.enabled = false;
    state.registryReady = false;
  }

  window.addEventListener('mira:auth-change', onAuthChange);

  async function bootstrap(partner) {
    const auth = currentAuthSnapshot();
    state.authGeneration = auth.authGeneration;
    state.tokenFingerprint = auth.tokenFingerprint;
    const nextPartnerId = partner && partner.id ? partner.id : null;
    const nextEmail = localStorage.getItem(ACCOUNT_KEY);
    if (state.partnerId && nextPartnerId && state.partnerId !== nextPartnerId) {
      bumpEpoch('partner-switch');
      state.draftRevisionByClientId = Object.create(null);
      state.editContexts = Object.create(null);
    } else if (!nextPartnerId && state.partnerId) {
      bumpEpoch('logout');
      state.draftRevisionByClientId = Object.create(null);
      state.editContexts = Object.create(null);
    }
    // Never trust a stale mira_partner_id alone — only bind after partner payload arrives.
    state.partnerId = nextPartnerId;
    state.accountEmail = nextEmail;
    state.partnerType = partner && partner.type ? partner.type : null;
    state.sessionEpoch = readEpoch() || bumpEpoch('boot');
    if (nextPartnerId) localStorage.setItem(PARTNER_ID_KEY, nextPartnerId);
    else try { localStorage.removeItem(PARTNER_ID_KEY); } catch (e) {}

    if (!window.PartnersApi || typeof PartnersApi.registry !== 'function') {
      state.enabled = false;
      state.registryReady = false;
      return state;
    }
    try {
      const snap = captureSessionSnapshot();
      const [meta, localHash] = await Promise.all([
        PartnersApi.registry(),
        computeLocalRegistryHash(),
      ]);
      if (!assertSameSession(snap) && snap.partnerId) {
        // Auth changed while loading registry — stay disabled.
        state.enabled = false;
        state.registryReady = false;
        return state;
      }
      // Re-check partner still matches bootstrap target.
      if (nextPartnerId && currentPartnerId() !== nextPartnerId) {
        state.enabled = false;
        return state;
      }
      state.localRegistryHash = localHash;
      state.registryHash = meta.registryHash || null;
      state.schemaVersion = meta.schemaVersion || 2;
      state.registryMismatch = Boolean(
        state.localRegistryHash && state.registryHash && state.localRegistryHash !== state.registryHash,
      );
      state.registryReady = Boolean(state.localRegistryHash && state.registryHash);
      const flagOn = meta.editorV2Enabled === true;
      state.enabled = flagOn && state.registryReady && !state.registryMismatch && !!state.partnerId && !!auth.tokenFingerprint;
    } catch (error) {
      state.enabled = false;
      state.registryReady = false;
      state.registryMismatch = true;
    }
    return state;
  }

  function onStorage(ev) {
    if (!ev) return;
    if (ev.key === 'mira_partner_token' || ev.key === ACCOUNT_KEY || ev.key === PARTNER_ID_KEY) {
      // Cross-tab auth change: cancel immediately; do not trust leftover partner id.
      bumpEpoch('storage-auth-change');
      state.partnerId = null;
      state.accountEmail = localStorage.getItem(ACCOUNT_KEY);
      state.authGeneration = currentAuthSnapshot().authGeneration;
      state.tokenFingerprint = currentAuthSnapshot().tokenFingerprint;
      state.draftRevisionByClientId = Object.create(null);
      state.editContexts = Object.create(null);
      state.enabled = false;
      if (!localStorage.getItem('mira_partner_token')) {
        try { localStorage.removeItem(PARTNER_ID_KEY); } catch (e) {}
      }
    }
  }
  window.addEventListener('storage', onStorage);

  function scheduleAutosave(form, payloadBuilder) {
    if (!state.registryReady || state.registryMismatch) {
      setStatus(form, 'تعذر التحقق من سجل الحقول — حدّثي الصفحة قبل الحفظ', 'error');
      return;
    }
    if (!state.enabled) {
      if (state.registryMismatch) setStatus(form, 'اختلاف سجل الحقول — أوقِف الحفظ لمنع فقد البيانات', 'error');
      return;
    }
    if (!state.partnerId || !currentAuthSnapshot().tokenFingerprint) return;
    const formId = form.id || 'default';
    const snapshot = captureSessionSnapshot();
    snapshot.formId = formId;
    state.seq[formId] = (state.seq[formId] || 0) + 1;
    const mySeq = state.seq[formId];
    state.pending[formId] = { builder: payloadBuilder, snapshot: snapshot, seq: mySeq };
    state.lastFlushResult[formId] = { ok: false, pending: true, seq: mySeq };
    setStatus(form, 'جارٍ الحفظ…', 'saving');
    clearTimeout(state.timers[formId]);
    state.timers[formId] = setTimeout(() => flush(form, mySeq), 650);
  }

  async function flush(form, expectedSeq) {
    const formId = form.id || 'default';
    const empty = { ok: false, cancelled: true, formId: formId };
    if (!state.enabled) {
      state.lastFlushResult[formId] = Object.assign({}, empty, { reason: 'disabled' });
      return state.lastFlushResult[formId];
    }
    const pending = state.pending[formId];
    if (!pending) {
      const last = state.lastFlushResult[formId];
      if (last && last.ok && last.seq === state.seq[formId]) return last;
      state.lastFlushResult[formId] = Object.assign({}, empty, { reason: 'nothing-pending' });
      return state.lastFlushResult[formId];
    }
    if (expectedSeq != null && pending.seq !== expectedSeq) {
      state.lastFlushResult[formId] = Object.assign({}, empty, { reason: 'stale-seq' });
      return state.lastFlushResult[formId];
    }
    if (!assertSameSession(pending.snapshot)) {
      delete state.pending[formId];
      setStatus(form, 'أُلغي الحفظ — تغيّر الحساب', 'error');
      state.lastFlushResult[formId] = { ok: false, cancelled: true, reason: 'auth-changed', formId: formId };
      return state.lastFlushResult[formId];
    }
    if (state.inflight[formId]) {
      state.timers[formId] = setTimeout(() => flush(form, pending.seq), 400);
      return { ok: false, pending: true, reason: 'inflight', formId: formId };
    }
    const built = pending.builder();
    if (!built || !built.clientDraftId) {
      delete state.pending[formId];
      setStatus(form, 'لم يُحفظ — الحمولة غير صالحة أو الحقول غير مكتملة', 'error');
      state.lastFlushResult[formId] = { ok: false, reason: 'invalid-payload', formId: formId };
      return state.lastFlushResult[formId];
    }
    built._session = pending.snapshot;
    state.inflight[formId] = true;
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    if (controller) state.abortByForm[formId] = controller;
    const mySeq = pending.seq;
    try {
      const currentRev = state.draftRevisionByClientId[built.clientDraftId];
      const saved = await PartnersApi.putEditorDraft(
        built.clientDraftId,
        {
          expectedRevision: currentRev == null ? null : currentRev,
          kind: built.kind,
          profileId: built.profileId,
          schemaVersion: state.schemaVersion,
          values: built.values || {},
          targetOwnerId: built.targetOwnerId || null,
        },
        { signal: controller ? controller.signal : undefined },
      );
      if (!assertSameSession(built._session)) {
        setStatus(form, 'تُجاهلت استجابة قديمة بعد تبديل الحساب', 'error');
        state.lastFlushResult[formId] = { ok: false, cancelled: true, reason: 'stale-response', formId: formId };
        return state.lastFlushResult[formId];
      }
      if (state.seq[formId] !== mySeq) {
        // Newer edit landed while this request was in flight — not a confirmed save of current values.
        state.lastFlushResult[formId] = { ok: false, pending: true, reason: 'superseded', formId: formId, revision: saved.revision };
        state.draftRevisionByClientId[built.clientDraftId] = saved.revision;
        return state.lastFlushResult[formId];
      }
      state.draftRevisionByClientId[built.clientDraftId] = saved.revision;
      const ctx = getEditContext(formId);
      if (ctx && ctx.clientDraftId === built.clientDraftId) ctx.revision = saved.revision;
      setStatus(form, 'محفوظ', 'saved');
      if (state.pending[formId] && state.pending[formId].seq === mySeq) delete state.pending[formId];
      state.lastFlushResult[formId] = {
        ok: true,
        revision: saved.revision,
        clientDraftId: built.clientDraftId,
        seq: mySeq,
        formId: formId,
      };
      return state.lastFlushResult[formId];
    } catch (error) {
      if (error && error.name === 'AbortError') {
        state.lastFlushResult[formId] = { ok: false, cancelled: true, reason: 'aborted', formId: formId };
        return state.lastFlushResult[formId];
      }
      if (!assertSameSession(built._session)) {
        state.lastFlushResult[formId] = { ok: false, cancelled: true, reason: 'auth-changed', formId: formId };
        return state.lastFlushResult[formId];
      }
      const msg = String(error && error.message ? error.message : error);
      if (/تعارض|REVISION|409/.test(msg)) setStatus(form, 'تعارض تعديل — احفظي محليًا ثم أعيدي التحميل بقرار صريح', 'conflict');
      else setStatus(form, 'تعذر الحفظ — التعديلات ما زالت محليًا', 'error');
      state.lastFlushResult[formId] = {
        ok: false,
        error: error,
        fieldErrors: error && error.fieldErrors,
        reason: 'save-failed',
        formId: formId,
        seq: mySeq,
      };
      return state.lastFlushResult[formId];
    } finally {
      // Only clear inflight/abort for this generation.
      if (state.abortByForm[formId] === controller) delete state.abortByForm[formId];
      state.inflight[formId] = false;
      if (state.pending[formId] && state.seq[formId] !== mySeq) {
        flush(form, state.seq[formId]);
      }
    }
  }

  /** Flush until pending queue for form is empty or failure. Waits on real inflight, not fixed short spins. */
  async function flushUntilSettled(form, maxRounds) {
    const formId = form.id || 'default';
    let rounds = maxRounds == null ? 40 : maxRounds;
    let last = state.lastFlushResult[formId] || { ok: false };
    while (rounds-- > 0) {
      if (state.inflight[formId]) {
        await new Promise((r) => setTimeout(r, 100));
        last = state.lastFlushResult[formId] || last;
        continue;
      }
      if (state.pending[formId]) {
        last = await flush(form, state.seq[formId]);
        if (last && last.ok === false && !last.pending && !last.cancelled) return last;
        if (last && last.pending) {
          await new Promise((r) => setTimeout(r, 100));
          continue;
        }
        continue;
      }
      if (last && last.ok && last.seq === state.seq[formId]) return last;
      if (state.lastFlushResult[formId] && state.lastFlushResult[formId].ok && state.lastFlushResult[formId].seq === state.seq[formId]) {
        return state.lastFlushResult[formId];
      }
      // Nothing pending and no confirmed save for current seq.
      return last && last.ok ? last : { ok: false, reason: 'nothing-confirmed', formId: formId, last: last };
    }
    return { ok: false, reason: 'flush-timeout', formId: formId, last: last };
  }

  function attachStatus(form) {
    if (!form || form.querySelector('[data-editor-v2-status]')) return;
    const el = document.createElement('p');
    el.className = 'editor-v2-status';
    el.setAttribute('data-editor-v2-status', '1');
    el.setAttribute('aria-live', 'polite');
    form.insertBefore(el, form.firstChild);
  }

  async function listDrafts(opts) {
    if (!state.enabled) throw new Error('محرر v2 غير مفعّل');
    const snap = captureSessionSnapshot();
    const data = await PartnersApi.listEditorDrafts(null, opts);
    if (!assertSameSession(snap)) throw new Error('تبديل حساب أثناء القائمة');
    return data;
  }

  async function openDraft(clientDraftId, opts) {
    if (!state.enabled) throw new Error('محرر v2 غير مفعّل');
    const snap = captureSessionSnapshot();
    const draft = await PartnersApi.getEditorDraft(clientDraftId, opts);
    if (!assertSameSession(snap)) throw new Error('تبديل حساب أثناء الفتح');
    state.draftRevisionByClientId[clientDraftId] = draft.revision;
    return draft;
  }

  async function materialize(clientDraftId, expectedRevision, submitReview, idempotencyKey, opts) {
    if (!state.enabled) throw new Error('محرر v2 غير مفعّل');
    const snap = captureSessionSnapshot();
    const result = await PartnersApi.materializeEditorDraft(
      clientDraftId,
      { expectedRevision: expectedRevision, submitReview: !!submitReview },
      idempotencyKey,
      opts,
    );
    if (!assertSameSession(snap)) throw new Error('تبديل حساب أثناء التحويل');
    if (result && result.kind) clearNewDraftKey(result.targetKind || result.kind);
    else clearNewDraftKey('product');
    clearNewDraftKey('service');
    return result;
  }

  async function importLocalTemplateInteractive(serviceId, localState) {
    if (!state.enabled) throw new Error('محرر v2 غير مفعّل على الخادم');
    if (!serviceId) throw new Error('يلزم حفظ الخدمة قبل الاستيراد إلى الخادم');
    const snap = captureSessionSnapshot();
    const current = await PartnersApi.getServiceProfile(serviceId);
    if (!assertSameSession(snap)) throw new Error('تبديل حساب أثناء الاستيراد');
    const preview = {
      local: localState,
      serverLive: current.serviceProfileJson,
      serverDraft: current.draftServiceProfileJson,
      reviewRevision: current.reviewRevision,
    };
    const ok = window.confirm(
      'استيراد القالب المحلي إلى الخادم؟\n' +
        'القالب: ' + (localState.templateId || '—') + '\n' +
        'إصدار الخادم الحالي: ' + current.reviewRevision + '\n' +
        'لن يُحذف المحلي قبل نجاح الحفظ.',
    );
    if (!ok) return { cancelled: true, preview };
    try {
      const result = await PartnersApi.importLocalTemplate(serviceId, {
        confirm: true,
        expectedRevision: current.reviewRevision,
        force: false,
        templateState: localState,
      });
      if (!assertSameSession(snap)) throw new Error('تبديل حساب بعد الاستيراد');
      return { ok: true, result, preview };
    } catch (error) {
      const msg = String(error && error.message ? error.message : error);
      if (/تعارض|REVISION|409/.test(msg)) {
        const fresh = await PartnersApi.getServiceProfile(serviceId);
        if (!assertSameSession(snap)) throw new Error('تبديل حساب أثناء التعارض');
        const again = window.confirm(
          'تغيّر إصدار الخادم بعد المعاينة (' +
            current.reviewRevision +
            ' → ' +
            fresh.reviewRevision +
            '). إعادة التأكيد على النسخة الحديثة؟\nforce لا يتجاوز إصدارًا أحدث.',
        );
        if (!again) return { cancelled: true, conflict: true, preview };
        const result = await PartnersApi.importLocalTemplate(serviceId, {
          confirm: true,
          expectedRevision: fresh.reviewRevision,
          force: true,
          templateState: localState,
        });
        return { ok: true, result, reconfirmed: true };
      }
      throw error;
    }
  }

  async function pushServiceProfile(serviceId, templateState, expectedRevision) {
    if (!state.enabled || !serviceId || !templateState || !templateState.templateId) return null;
    const snap = captureSessionSnapshot();
    const result = await PartnersApi.putServiceProfile(serviceId, {
      expectedRevision: expectedRevision,
      templateId: templateState.templateId,
      templateVersion: templateState.templateVersion || 1,
      priceMode: templateState.priceMode || 'fixed',
      answers: templateState.answers || {},
    });
    if (!assertSameSession(snap)) throw new Error('تبديل حساب أثناء حفظ القالب');
    return result;
  }

  function __testHooks() {
    return {
      state: state,
      bumpEpoch: bumpEpoch,
      cancelAllPending: cancelAllPending,
      assertSameSession: assertSameSession,
      scheduleAutosave: scheduleAutosave,
      flush: flush,
      captureSessionSnapshot: captureSessionSnapshot,
      onAuthChange: onAuthChange,
    };
  }

  window.MiraEditorV2 = {
    state: state,
    bootstrap: bootstrap,
    attachStatus: attachStatus,
    scheduleAutosave: scheduleAutosave,
    flush: function (form) {
      const formId = form.id || 'default';
      return flush(form, state.seq[formId]);
    },
    flushUntilSettled: flushUntilSettled,
    clientDraftIdFor: clientDraftIdFor,
    allocateNewDraftId: allocateNewDraftId,
    clearNewDraftKey: clearNewDraftKey,
    bindEditContext: bindEditContext,
    getEditContext: getEditContext,
    clearEditContext: clearEditContext,
    scopedTemplateKey: scopedTemplateKey,
    profileIdFor: profileIdFor,
    importLocalTemplateInteractive: importLocalTemplateInteractive,
    pushServiceProfile: pushServiceProfile,
    listDrafts: listDrafts,
    openDraft: openDraft,
    materialize: materialize,
    setStatus: setStatus,
    cancelAllPending: cancelAllPending,
    cancelFormPending: cancelFormPending,
    bumpEpoch: bumpEpoch,
    __testHooks: __testHooks,
  };
})();
