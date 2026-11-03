/**
 * Partner editor v2 — server drafts autosave with partner/session isolation (P1 RC2).
 * Server flag owns activation; query params cannot enable a disabled flag.
 */
(function () {
  const PARTNER_ID_KEY = 'mira_partner_id';
  const ACCOUNT_KEY = 'mira_partner_email';
  const EPOCH_KEY = 'mira_editor_v2_session_epoch';

  const state = {
    enabled: false,
    registryHash: null,
    localRegistryHash: null,
    schemaVersion: 2,
    partnerType: null,
    partnerId: null,
    accountEmail: null,
    sessionEpoch: 0,
    registryMismatch: false,
    draftRevisionByClientId: Object.create(null),
    timers: Object.create(null),
    inflight: Object.create(null),
    pending: Object.create(null),
    seq: Object.create(null),
    abortByForm: Object.create(null),
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

  function assertSameSession(snapshot) {
    if (!snapshot) return false;
    if (snapshot.sessionEpoch !== state.sessionEpoch) return false;
    if (snapshot.partnerId !== state.partnerId) return false;
    if (currentPartnerId() !== snapshot.partnerId) return false;
    return true;
  }

  function clientDraftIdFor(kind, itemId) {
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

  function clearNewDraftKey(kind) {
    const scope = state.partnerId || 'anon';
    sessionStorage.removeItem('mira_editor_v2_new_' + scope + '_' + kind);
  }

  function profileIdFor(kind, category, partnerType) {
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

  async function bootstrap(partner) {
    const nextPartnerId = partner && partner.id ? partner.id : currentPartnerId();
    const nextEmail = localStorage.getItem(ACCOUNT_KEY);
    if (state.partnerId && nextPartnerId && state.partnerId !== nextPartnerId) {
      bumpEpoch('partner-switch');
      state.draftRevisionByClientId = Object.create(null);
    } else if (!nextPartnerId && state.partnerId) {
      bumpEpoch('logout');
      state.draftRevisionByClientId = Object.create(null);
    }
    state.partnerId = nextPartnerId;
    state.accountEmail = nextEmail;
    state.partnerType = partner && partner.type ? partner.type : null;
    state.sessionEpoch = readEpoch() || bumpEpoch('boot');
    if (nextPartnerId) localStorage.setItem(PARTNER_ID_KEY, nextPartnerId);
    if (!window.PartnersApi || typeof PartnersApi.registry !== 'function') {
      state.enabled = false;
      return state;
    }
    try {
      const meta = await PartnersApi.registry();
      if (currentPartnerId() !== state.partnerId) return state;
      state.enabled = meta.editorV2Enabled === true;
      state.registryHash = meta.registryHash || null;
      state.schemaVersion = meta.schemaVersion || 2;
      state.localRegistryHash = window.MiraFieldRegistryLocalHash || null;
      state.registryMismatch = Boolean(
        state.localRegistryHash && state.registryHash && state.localRegistryHash !== state.registryHash,
      );
      if (state.registryMismatch) {
        state.enabled = false;
      }
    } catch (error) {
      state.enabled = false;
    }
    return state;
  }

  function onStorage(ev) {
    if (!ev) return;
    if (ev.key === PARTNER_ID_KEY || ev.key === 'mira_partner_token' || ev.key === ACCOUNT_KEY) {
      const pid = currentPartnerId();
      if (pid !== state.partnerId) {
        bumpEpoch('storage-partner-change');
        state.partnerId = pid;
        state.accountEmail = localStorage.getItem(ACCOUNT_KEY);
        state.draftRevisionByClientId = Object.create(null);
        state.enabled = false;
      }
      if (!localStorage.getItem('mira_partner_token')) {
        bumpEpoch('logout-storage');
        state.enabled = false;
        state.partnerId = null;
      }
    }
  }
  window.addEventListener('storage', onStorage);

  function scheduleAutosave(form, payloadBuilder) {
    if (!state.enabled || state.registryMismatch) {
      if (state.registryMismatch) setStatus(form, 'اختلاف سجل الحقول — أوقِف الحفظ لمنع فقد البيانات', 'error');
      return;
    }
    if (!state.partnerId) return;
    const formId = form.id || 'default';
    const snapshot = {
      partnerId: state.partnerId,
      sessionEpoch: state.sessionEpoch,
      formId: formId,
    };
    state.seq[formId] = (state.seq[formId] || 0) + 1;
    const mySeq = state.seq[formId];
    state.pending[formId] = { builder: payloadBuilder, snapshot: snapshot, seq: mySeq };
    setStatus(form, 'جارٍ الحفظ…', 'saving');
    clearTimeout(state.timers[formId]);
    state.timers[formId] = setTimeout(() => flush(form, mySeq), 650);
  }

  async function flush(form, expectedSeq) {
    if (!state.enabled) return;
    const formId = form.id || 'default';
    const pending = state.pending[formId];
    if (!pending) return;
    if (expectedSeq != null && pending.seq !== expectedSeq) return;
    if (!assertSameSession(pending.snapshot)) {
      delete state.pending[formId];
      setStatus(form, 'أُلغي الحفظ — تغيّر الحساب', 'error');
      return;
    }
    if (state.inflight[formId]) {
      state.timers[formId] = setTimeout(() => flush(form, pending.seq), 400);
      return;
    }
    const built = pending.builder();
    if (!built) return;
    built._session = pending.snapshot;
    state.inflight[formId] = true;
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    if (controller) state.abortByForm[formId] = controller;
    try {
      const currentRev = state.draftRevisionByClientId[built.clientDraftId];
      const saved = await PartnersApi.putEditorDraft(built.clientDraftId, {
        expectedRevision: currentRev == null ? null : currentRev,
        kind: built.kind,
        profileId: built.profileId,
        schemaVersion: state.schemaVersion,
        values: built.values || {},
        targetOwnerId: built.targetOwnerId || null,
      });
      if (!assertSameSession(built._session) || currentPartnerId() !== built._session.partnerId) {
        setStatus(form, 'تُجاهلت استجابة قديمة بعد تبديل الحساب', 'error');
        return;
      }
      state.draftRevisionByClientId[built.clientDraftId] = saved.revision;
      if (state.seq[formId] === pending.seq) setStatus(form, 'محفوظ', 'saved');
      if (state.pending[formId] && state.pending[formId].seq === pending.seq) delete state.pending[formId];
    } catch (error) {
      if (!assertSameSession(built._session)) return;
      const msg = String(error && error.message ? error.message : error);
      if (/تعارض|REVISION|409/.test(msg)) setStatus(form, 'تعارض تعديل — أعدي فتح المسودة من الخادم', 'conflict');
      else setStatus(form, 'تعذر الحفظ — التعديلات ما زالت محليًا', 'error');
    } finally {
      state.inflight[formId] = false;
      delete state.abortByForm[formId];
      if (state.pending[formId] && state.seq[formId] !== pending.seq) {
        flush(form, state.seq[formId]);
      }
    }
  }

  function attachStatus(form) {
    if (!form || form.querySelector('[data-editor-v2-status]')) return;
    const el = document.createElement('p');
    el.className = 'editor-v2-status';
    el.setAttribute('data-editor-v2-status', '1');
    el.setAttribute('aria-live', 'polite');
    form.insertBefore(el, form.firstChild);
  }

  async function listDrafts() {
    if (!state.enabled) throw new Error('محرر v2 غير مفعّل');
    return PartnersApi.listEditorDrafts();
  }

  async function openDraft(clientDraftId) {
    if (!state.enabled) throw new Error('محرر v2 غير مفعّل');
    const draft = await PartnersApi.getEditorDraft(clientDraftId);
    if (currentPartnerId() !== state.partnerId) throw new Error('تبديل حساب أثناء الفتح');
    state.draftRevisionByClientId[clientDraftId] = draft.revision;
    return draft;
  }

  async function materialize(clientDraftId, expectedRevision, submitReview, idempotencyKey) {
    if (!state.enabled) throw new Error('محرر v2 غير مفعّل');
    const snap = { partnerId: state.partnerId, sessionEpoch: state.sessionEpoch };
    const result = await PartnersApi.materializeEditorDraft(
      clientDraftId,
      { expectedRevision: expectedRevision, submitReview: !!submitReview },
      idempotencyKey,
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
    const snap = { partnerId: state.partnerId, sessionEpoch: state.sessionEpoch };
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
    const snap = { partnerId: state.partnerId, sessionEpoch: state.sessionEpoch };
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

  /** Test seam: expose isolation helpers without secrets. */
  function __testHooks() {
    return {
      state: state,
      bumpEpoch: bumpEpoch,
      cancelAllPending: cancelAllPending,
      assertSameSession: assertSameSession,
      scheduleAutosave: scheduleAutosave,
      flush: flush,
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
    clientDraftIdFor: clientDraftIdFor,
    clearNewDraftKey: clearNewDraftKey,
    profileIdFor: profileIdFor,
    importLocalTemplateInteractive: importLocalTemplateInteractive,
    pushServiceProfile: pushServiceProfile,
    listDrafts: listDrafts,
    openDraft: openDraft,
    materialize: materialize,
    setStatus: setStatus,
    cancelAllPending: cancelAllPending,
    bumpEpoch: bumpEpoch,
    __testHooks: __testHooks,
  };
})();
