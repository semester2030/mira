/**
 * Partner editor v2 helpers: server drafts autosave + local template import.
 * Server flag MIRA_PARTNER_EDITOR_V2 owns activation; query params cannot enable it.
 */
(function () {
  const ACCOUNT_KEY = 'mira_partner_email';
  const state = {
    enabled: false,
    registryHash: null,
    schemaVersion: 2,
    partnerType: null,
    account: null,
    draftRevisionByClientId: Object.create(null),
    timers: Object.create(null),
    inflight: Object.create(null),
    pending: Object.create(null),
    seq: Object.create(null),
  };

  function statusEl(form) {
    return (form && form.querySelector('[data-editor-v2-status]')) || null;
  }

  function setStatus(form, text, kind) {
    const el = statusEl(form);
    if (!el) return;
    el.textContent = text || '';
    el.dataset.kind = kind || '';
  }

  function clientDraftIdFor(kind, itemId) {
    if (itemId) return 'owner:' + kind + ':' + itemId;
    let key = 'mira_editor_v2_new_' + kind;
    let id = sessionStorage.getItem(key);
    if (!id) {
      id = 'new:' + kind + ':' + (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random());
      sessionStorage.setItem(key, id);
    }
    return id;
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
    state.account = localStorage.getItem(ACCOUNT_KEY);
    state.partnerType = partner && partner.type ? partner.type : null;
    if (!window.PartnersApi || typeof PartnersApi.registry !== 'function') {
      state.enabled = false;
      return state;
    }
    try {
      const meta = await PartnersApi.registry();
      state.enabled = meta.editorV2Enabled === true;
      state.registryHash = meta.registryHash || null;
      state.schemaVersion = meta.schemaVersion || 2;
      if (meta.registry && meta.registryHash && window.MiraFieldRegistryLocalHash) {
        if (window.MiraFieldRegistryLocalHash !== meta.registryHash) {
          console.warn('editor-v2 registry hash mismatch', window.MiraFieldRegistryLocalHash, meta.registryHash);
        }
      }
    } catch (error) {
      state.enabled = false;
    }
    return state;
  }

  function onAccountSwitch() {
    const email = localStorage.getItem(ACCOUNT_KEY);
    if (state.account && email && state.account !== email) {
      Object.keys(state.timers).forEach((k) => clearTimeout(state.timers[k]));
      state.timers = Object.create(null);
      state.pending = Object.create(null);
      state.draftRevisionByClientId = Object.create(null);
    }
    state.account = email;
  }

  function scheduleAutosave(form, payloadBuilder) {
    if (!state.enabled) return;
    onAccountSwitch();
    const formId = form.id || 'default';
    state.seq[formId] = (state.seq[formId] || 0) + 1;
    const mySeq = state.seq[formId];
    state.pending[formId] = payloadBuilder;
    setStatus(form, 'جارٍ الحفظ…', 'saving');
    clearTimeout(state.timers[formId]);
    state.timers[formId] = setTimeout(() => flush(form, mySeq), 650);
  }

  async function flush(form, expectedSeq) {
    if (!state.enabled) return;
    const formId = form.id || 'default';
    if (expectedSeq != null && state.seq[formId] !== expectedSeq) return;
    if (state.inflight[formId]) {
      state.timers[formId] = setTimeout(() => flush(form, state.seq[formId]), 400);
      return;
    }
    const builder = state.pending[formId];
    if (!builder) return;
    const built = builder();
    if (!built) return;
    state.inflight[formId] = true;
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
      state.draftRevisionByClientId[built.clientDraftId] = saved.revision;
      if (state.seq[formId] === expectedSeq) setStatus(form, 'محفوظ', 'saved');
    } catch (error) {
      const msg = String(error && error.message ? error.message : error);
      if (/تعارض|REVISION|409/.test(msg)) setStatus(form, 'تعارض تعديل — أعدي فتح المسودة', 'conflict');
      else setStatus(form, 'تعذر الحفظ — التعديلات ما زالت محليًا', 'error');
    } finally {
      state.inflight[formId] = false;
      if (state.pending[formId] && state.seq[formId] !== expectedSeq) {
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

  /**
   * Import localStorage template into server for an owned service.
   * Never auto-imports on account switch. Requires explicit confirm.
   */
  async function importLocalTemplateInteractive(serviceId, localState) {
    if (!state.enabled) throw new Error('محرر v2 غير مفعّل على الخادم');
    if (!serviceId) throw new Error('يلزم حفظ الخدمة قبل الاستيراد إلى الخادم');
    const current = await PartnersApi.getServiceProfile(serviceId);
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
      return { ok: true, result, preview };
    } catch (error) {
      const msg = String(error && error.message ? error.message : error);
      if (/تعارض|REVISION|409/.test(msg)) {
        const fresh = await PartnersApi.getServiceProfile(serviceId);
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
    return PartnersApi.putServiceProfile(serviceId, {
      expectedRevision: expectedRevision,
      templateId: templateState.templateId,
      templateVersion: templateState.templateVersion || 1,
      priceMode: templateState.priceMode || 'fixed',
      answers: templateState.answers || {},
    });
  }

  window.MiraEditorV2 = {
    state,
    bootstrap,
    attachStatus,
    scheduleAutosave,
    flush: (form) => flush(form, state.seq[form.id || 'default']),
    clientDraftIdFor,
    profileIdFor,
    importLocalTemplateInteractive,
    pushServiceProfile,
    setStatus,
  };
})();
