/**
 * RC13 acceptance validators — shared by browser e2e, field roundtrip, and sensitivity.
 * Sensitivity MUST call these same functions (not a parallel copy).
 */
import { createHash } from 'node:crypto';

export function sha256(buf) {
  return createHash('sha256').update(buf).digest('hex');
}

export function optionValueIds(optionsJson) {
  const groups = Array.isArray(optionsJson) ? optionsJson : [];
  const out = {};
  for (const g of groups) {
    if (!g || !g.id) continue;
    out[g.id] = (Array.isArray(g.values) ? g.values : [])
      .map((v) => (v && v.id) || null)
      .filter(Boolean)
      .sort();
  }
  return out;
}

export function exactOptionsMatch(actualOptions, expectedByGroup) {
  const actual = optionValueIds(actualOptions);
  const expectedKeys = Object.keys(expectedByGroup).sort();
  const actualKeys = Object.keys(actual).sort();
  if (JSON.stringify(actualKeys) !== JSON.stringify(expectedKeys)) {
    return { ok: false, reason: 'group-keys', actual, expected: expectedByGroup };
  }
  for (const k of expectedKeys) {
    const exp = [...expectedByGroup[k]].map(String).sort();
    const act = [...(actual[k] || [])].map(String).sort();
    if (JSON.stringify(act) !== JSON.stringify(exp)) {
      return { ok: false, reason: 'values:' + k, actual: act, expected: exp };
    }
  }
  return { ok: true, actual, expected: expectedByGroup };
}

/** Exact variants by id + selections + priceHalalas + available (order-insensitive by id). */
export function exactVariantsMatch(actualVariants, expectedVariants) {
  const a = Array.isArray(actualVariants) ? actualVariants : [];
  const e = Array.isArray(expectedVariants) ? expectedVariants : [];
  if (a.length !== e.length) {
    return { ok: false, reason: 'count', actual: a.length, expected: e.length };
  }
  const byId = (list) => {
    const m = {};
    for (const v of list) {
      if (!v || !v.id) return { ok: false, reason: 'missing-id' };
      m[v.id] = v;
    }
    return { ok: true, m };
  };
  const am = byId(a);
  const em = byId(e);
  if (!am.ok) return am;
  if (!em.ok) return em;
  const aIds = Object.keys(am.m).sort();
  const eIds = Object.keys(em.m).sort();
  if (JSON.stringify(aIds) !== JSON.stringify(eIds)) {
    return { ok: false, reason: 'ids', actual: aIds, expected: eIds };
  }
  for (const id of eIds) {
    const ev = em.m[id];
    const av = am.m[id];
    const es = JSON.stringify(ev.selections || {}, Object.keys(ev.selections || {}).sort());
    const as = JSON.stringify(av.selections || {}, Object.keys(av.selections || {}).sort());
    if (es !== as) return { ok: false, reason: 'selections:' + id, actual: av.selections, expected: ev.selections };
    if (Number(av.priceHalalas ?? null) !== Number(ev.priceHalalas ?? null)) {
      return { ok: false, reason: 'price:' + id, actual: av.priceHalalas, expected: ev.priceHalalas };
    }
    const ea = ev.available === false ? false : true;
    const aa = av.available === false ? false : true;
    if (aa !== ea) return { ok: false, reason: 'available:' + id, actual: aa, expected: ea };
  }
  return { ok: true };
}

/** Compare every expected answer key; optional clearedKey must be absent/null/'' per contractMode. */
export function exactAnswersMatch(actual, expected, opts = {}) {
  const a = actual && typeof actual === 'object' ? actual : {};
  const e = expected && typeof expected === 'object' ? expected : {};
  for (const k of Object.keys(e).sort()) {
    const av = a[k];
    const ev = e[k];
    if (opts.clearedKey === k) {
      // contractMode: 'empty-string' | 'null' | 'absent'
      const mode = opts.clearMode || 'empty-string';
      if (mode === 'absent') {
        if (Object.prototype.hasOwnProperty.call(a, k) && a[k] != null && String(a[k]) !== '') {
          return { ok: false, key: k, actual: av, expected: 'absent' };
        }
      } else if (mode === 'null') {
        if (av != null) return { ok: false, key: k, actual: av, expected: null };
      } else {
        if (av != null && String(av) !== '') return { ok: false, key: k, actual: av, expected: '' };
      }
      continue;
    }
    const avn = av == null ? '' : String(av);
    const evn = ev == null ? '' : String(ev);
    if (avn !== evn) return { ok: false, key: k, actual: av, expected: ev };
  }
  return { ok: true };
}

export function evaluateRecoveryAcceptance(ev) {
  const fails = [];
  if (!ev.serverExecuted) fails.push('server-not-executed-before-drop');
  if (!ev.droppedOwnerId) fails.push('missing-dropped-owner');
  if (!ev.createdIds || ev.createdIds.length !== 1) fails.push('created-count');
  if (ev.createdIds && ev.createdIds[0] !== ev.droppedOwnerId) fails.push('created-id-mismatch');
  if (ev.duplicateCount != null && ev.duplicateCount !== 1) fails.push('duplicate-owner');
  if (ev.uiOwnerId !== ev.droppedOwnerId) fails.push('ui-owner-mismatch');
  if (ev.listContainsOwner !== true) fails.push('list-missing-owner');
  if (!ev.media || !Array.isArray(ev.media.ids) || ev.media.ids.length < 1) fails.push('media-missing');
  if (ev.media && ev.media.wrongOwner) fails.push('media-wrong-owner');
  if (!ev.mediaBytesOk) fails.push('media-bytes-invalid');
  if (ev.submitReviewStatus !== 'submitted' && ev.reviewSubmitted !== true) {
    fails.push('submit-not-completed');
  }
  if (ev.submitFailed === true) fails.push('submit_failed-while-pass');
  if (ev.valuesOk !== true) fails.push('values-mismatch');
  return { ok: fails.length === 0, fails, ev };
}

/** Legacy success: UI reopen must show media; API alone is not enough. */
export function evaluateLegacyUploadAcceptance(ev) {
  const fails = [];
  if (ev.createdCount !== 1) fails.push('created-count');
  if (ev.saving === '1') fails.push('still-busy');
  if (ev.saveDisabled === true) fails.push('save-disabled');
  if (!ev.ownerId) fails.push('no-owner');
  if (!ev.media || !ev.media.ids || ev.media.ids.length < 1) fails.push('media-missing');
  if (ev.media && ev.media.wrongOwner) fails.push('media-wrong-owner');
  if (!ev.mediaBytesOk) fails.push('media-bytes-invalid');
  if (ev.reopenOpenFailed === true) fails.push('reopen-open-failed');
  if (ev.reopenShowsMedia !== true) fails.push('reopen-media-missing');
  if (ev.reopenMediaLoaded !== true) fails.push('reopen-media-not-loaded');
  if (ev.apiOnlyFallback === true) fails.push('api-only-fallback-forbidden');
  return { ok: fails.length === 0, fails, ev };
}

/** Retry: exactly one media after success; count=2 is FAIL. */
export function evaluateLegacyRetryAcceptance(ev) {
  const fails = [];
  if (ev.firstUploadFailed !== true) fails.push('first-fail-not-observed');
  if (ev.honestFailUi !== true) fails.push('honest-fail-ui');
  if (ev.noMediaAfterFail !== true) fails.push('media-created-on-failed-attempt');
  if (ev.retryOk !== true) fails.push('retry-not-ok');
  if (ev.createdCount !== 1) fails.push('created-count');
  if (ev.ownerBefore && ev.ownerAfter && ev.ownerBefore !== ev.ownerAfter) fails.push('owner-changed-on-retry');
  if (!ev.mediaBytesOk) fails.push('media-bytes-invalid');
  if (ev.mediaCount == null || ev.mediaCount !== 1) fails.push('media-count-not-one');
  if (ev.duplicateMedia === true || (ev.mediaCount != null && ev.mediaCount > 1)) {
    fails.push('duplicate-media');
  }
  if (ev.reopenShowsMedia !== true) fails.push('reopen-media-missing');
  return { ok: fails.length === 0, fails, ev };
}

export function evaluatePublicProductExact(ev) {
  const fails = [];
  if (!ev.expected || !ev.expected.id) fails.push('expected-id-missing');
  if (ev.bodyId !== ev.expected.id) fails.push('id');
  if (ev.priceHalalas !== ev.expected.priceHalalas) fails.push('price');
  const opt = exactOptionsMatch(ev.optionsJson, ev.expected.optionGroups || {});
  if (!opt.ok) fails.push('options:' + opt.reason);
  if (ev.expected.absentInGroups) {
    for (const [g, ids] of Object.entries(ev.expected.absentInGroups)) {
      const present = (opt.actual && opt.actual[g]) || [];
      for (const id of ids) {
        if (present.includes(id)) fails.push('absent-still-present:' + g + '/' + id);
      }
    }
  }
  if (ev.expected.variants != null) {
    const vm = exactVariantsMatch(ev.variantsJson, ev.expected.variants);
    if (!vm.ok) fails.push('variants:' + vm.reason);
  } else if (ev.expected.variantsAbsentIds) {
    const vids = (Array.isArray(ev.variantsJson) ? ev.variantsJson : []).map((v) => v && v.id).filter(Boolean);
    for (const id of ev.expected.variantsAbsentIds) {
      if (vids.includes(id)) fails.push('variant-still-present:' + id);
    }
  }
  if (ev.beforeGateRequired === true && ev.beforeGateOk !== true) fails.push('before-delete-not-proven');
  if (ev.sameOwnerRequired === true && ev.sameOwner !== true) fails.push('owner-changed');
  if (ev.sameOwnerRequired === true && !ev.ownerId) fails.push('owner-empty');
  return { ok: fails.length === 0, fails, opt };
}

export function evaluatePublicServiceExact(ev) {
  const fails = [];
  const e = ev.expected;
  if (!e || !e.id) fails.push('expected-id-missing');
  if (ev.bodyId !== e.id) fails.push('id');
  if (ev.priceHalalas !== e.priceHalalas) fails.push('price');
  if (!ev.doc) fails.push('doc-missing');
  else {
    if (ev.doc.templateId !== e.templateId) fails.push('templateId');
    if (Number(ev.doc.templateVersion) !== Number(e.templateVersion)) fails.push('templateVersion');
    if (ev.doc.priceMode !== e.priceMode) fails.push('priceMode');
    const ans = exactAnswersMatch(ev.doc.answers || {}, e.answers || {}, {
      clearedKey: e.clearedKey,
      clearMode: e.clearMode,
    });
    if (!ans.ok) fails.push('answers:' + ans.key);
  }
  if (ev.expectedCopiedFromActual === true) fails.push('expected-copied-from-actual');
  if (ev.clearedUiMissing === true) fails.push('cleared-ui-missing');
  if (ev.fieldMissingOnReopen === true) fails.push('field-missing-on-reopen');
  return { ok: fails.length === 0, fails };
}

/**
 * Field roundtrip gate — DOM alone is insufficient.
 * Requires: gateStarted, midKept, payloadOk, serverOk, reopenOk, honestStatus.
 */
export function evaluateFieldRoundtrip(ev) {
  const fails = [];
  if (ev.required === true && ev.skipped === true) fails.push('required-skipped');
  if (ev.gateStarted !== true) fails.push('gate-never-started');
  if (ev.ungatedFallback === true) fails.push('ungated-fallback-forbidden');
  if (ev.midUiValue !== ev.editedValue) fails.push('mid-ui-mismatch');
  if (ev.wipedToOld === true) fails.push('wiped-to-old');
  if (ev.claimedSavedWhileDirty === true) fails.push('claimed-saved-while-dirty');
  if (ev.payloadValue !== ev.editedValue && ev.payloadNormalized !== ev.editedNormalized) {
    fails.push('payload-mismatch');
  }
  if (ev.serverValue !== ev.editedValue && ev.serverNormalized !== ev.editedNormalized) {
    fails.push('server-mismatch');
  }
  if (ev.reopenedValue !== ev.editedValue && ev.reopenedNormalized !== ev.editedNormalized) {
    fails.push('reopen-mismatch');
  }
  if (ev.timeoutSwallowed === true) fails.push('timeout-swallowed');
  return { ok: fails.length === 0, fails, ev };
}

export function evaluateFieldCoverageMatrix(ev) {
  const fails = [];
  const required = ev.requiredFields || [];
  const rows = ev.rows || [];
  const by = {};
  for (const r of rows) by[r.field + '|' + (r.scope || '')] = r;
  for (const f of required) {
    const hits = rows.filter((r) => r.field === f);
    if (!hits.length) fails.push('missing-required:' + f);
    else if (hits.every((h) => h.status === 'SKIP' || h.status === 'NOT_RUN')) fails.push('required-all-skipped:' + f);
    else if (hits.some((h) => h.status === 'FAIL')) fails.push('required-failed:' + f);
    else if (!hits.some((h) => h.status === 'PASS_LOCAL')) fails.push('required-not-passed:' + f);
  }
  if (ev.allRequiredSkipped === true) fails.push('all-required-skipped');
  return { ok: fails.length === 0, fails };
}

/** RC12 negatives + RC13 eight independent-review cases. */
export const NEGATIVE_SAMPLES = {
  'ui-owner-wrong': {
    fn: 'recovery',
    ev: {
      serverExecuted: true,
      droppedOwnerId: 'A',
      createdIds: ['A'],
      duplicateCount: 1,
      uiOwnerId: 'B',
      listContainsOwner: true,
      media: { ids: ['m1'], wrongOwner: false },
      mediaBytesOk: true,
      submitReviewStatus: 'submitted',
      valuesOk: true,
    },
    mustFailWith: 'ui-owner-mismatch',
  },
  'media-absent': {
    fn: 'recovery',
    ev: {
      serverExecuted: true,
      droppedOwnerId: 'A',
      createdIds: ['A'],
      duplicateCount: 1,
      uiOwnerId: 'A',
      listContainsOwner: true,
      media: { ids: [] },
      mediaBytesOk: false,
      submitReviewStatus: 'submitted',
      valuesOk: true,
    },
    mustFailWith: 'media-missing',
  },
  'media-wrong-owner': {
    fn: 'recovery',
    ev: {
      serverExecuted: true,
      droppedOwnerId: 'A',
      createdIds: ['A'],
      duplicateCount: 1,
      uiOwnerId: 'A',
      listContainsOwner: true,
      media: { ids: ['m1'], wrongOwner: true },
      mediaBytesOk: true,
      submitReviewStatus: 'submitted',
      valuesOk: true,
    },
    mustFailWith: 'media-wrong-owner',
  },
  'media-empty-body': {
    fn: 'recovery',
    ev: {
      serverExecuted: true,
      droppedOwnerId: 'A',
      createdIds: ['A'],
      duplicateCount: 1,
      uiOwnerId: 'A',
      listContainsOwner: true,
      media: { ids: ['m1'], wrongOwner: false },
      mediaBytesOk: false,
      submitReviewStatus: 'submitted',
      valuesOk: true,
    },
    mustFailWith: 'media-bytes-invalid',
  },
  'submit-failed': {
    fn: 'recovery',
    ev: {
      serverExecuted: true,
      droppedOwnerId: 'A',
      createdIds: ['A'],
      duplicateCount: 1,
      uiOwnerId: 'A',
      listContainsOwner: true,
      media: { ids: ['m1'], wrongOwner: false },
      mediaBytesOk: true,
      submitReviewStatus: 'failed',
      submitFailed: true,
      valuesOk: true,
    },
    mustFailWith: 'submit-not-completed',
  },
  'legacy-upload-failed': {
    fn: 'legacy',
    ev: {
      createdCount: 1,
      saving: '',
      saveDisabled: false,
      ownerId: 'A',
      media: { ids: [] },
      mediaBytesOk: false,
      reopenShowsMedia: false,
      reopenMediaLoaded: false,
    },
    mustFailWith: 'media-missing',
  },
  'extra-option': {
    fn: 'public-product',
    ev: {
      bodyId: 'P',
      priceHalalas: 1000,
      optionsJson: [{ id: 'size', values: [{ id: 'M' }, { id: 'L' }] }],
      variantsJson: [],
      expected: { id: 'P', priceHalalas: 1000, optionGroups: { size: ['M'] }, absentInGroups: { size: ['L'] } },
    },
    mustFailWith: 'options:',
  },
  'service-answer-uncleared': {
    fn: 'public-service',
    ev: {
      bodyId: 'S',
      priceHalalas: 9000,
      doc: {
        templateId: 'salon_hair_cut',
        templateVersion: 1,
        priceMode: 'fixed',
        answers: { session_kind: 'single', excludes: 'قديم' },
      },
      expected: {
        id: 'S',
        priceHalalas: 9000,
        templateId: 'salon_hair_cut',
        templateVersion: 1,
        priceMode: 'fixed',
        answers: { session_kind: 'single', excludes: '' },
        clearedKey: 'excludes',
        clearMode: 'empty-string',
      },
    },
    mustFailWith: 'answers:excludes',
  },
  // ——— RC13 eight cases from independent review ———
  'field-dom-new-server-old': {
    fn: 'field-roundtrip',
    ev: {
      required: true,
      skipped: false,
      gateStarted: true,
      editedValue: 'new',
      editedNormalized: 'new',
      midUiValue: 'new',
      payloadValue: 'new',
      payloadNormalized: 'new',
      serverValue: 'old',
      serverNormalized: 'old',
      reopenedValue: 'old',
      reopenedNormalized: 'old',
    },
    mustFailWith: 'server-mismatch',
  },
  'all-required-skipped': {
    fn: 'field-matrix',
    ev: {
      requiredFields: ['nameAr', 'priceSar'],
      rows: [
        { field: 'nameAr', scope: 'product', status: 'SKIP' },
        { field: 'priceSar', scope: 'product', status: 'SKIP' },
      ],
      allRequiredSkipped: true,
    },
    mustFailWith: 'all-required-skipped',
  },
  'unexpected-variant': {
    fn: 'public-product',
    ev: {
      bodyId: 'P',
      priceHalalas: 14000,
      optionsJson: [{ id: 'size', values: [{ id: 'M' }] }, { id: 'color', values: [{ id: 'black' }] }],
      variantsJson: [
        { id: 'keep', selections: { size: 'M', color: 'black' }, priceHalalas: null, available: true },
        { id: 'extra', selections: { size: 'L', color: 'black' }, priceHalalas: null, available: true },
      ],
      expected: {
        id: 'P',
        priceHalalas: 14000,
        optionGroups: { size: ['M'], color: ['black'] },
        variants: [{ id: 'keep', selections: { size: 'M', color: 'black' }, priceHalalas: null, available: true }],
      },
      beforeGateOk: true,
      sameOwner: true,
      ownerId: 'P',
      sameOwnerRequired: true,
    },
    mustFailWith: 'variants:',
  },
  'before-delete-unproven': {
    fn: 'public-product',
    ev: {
      bodyId: 'P',
      priceHalalas: 14000,
      optionsJson: [{ id: 'size', values: [{ id: 'M' }] }, { id: 'color', values: [{ id: 'black' }] }],
      variantsJson: [],
      expected: { id: 'P', priceHalalas: 14000, optionGroups: { size: ['M'], color: ['black'] } },
      beforeGateRequired: true,
      beforeGateOk: false,
      sameOwnerRequired: true,
      sameOwner: true,
      ownerId: 'P',
    },
    mustFailWith: 'before-delete-not-proven',
  },
  'service-expected-from-actual': {
    fn: 'public-service',
    ev: {
      bodyId: 'S',
      priceHalalas: 9000,
      doc: {
        templateId: 'salon_hair_cut',
        templateVersion: 1,
        priceMode: 'fixed',
        answers: { session_kind: 'single', excludes: 'wrong-but-copied' },
      },
      expected: {
        id: 'S',
        priceHalalas: 9000,
        templateId: 'salon_hair_cut',
        templateVersion: 1,
        priceMode: 'fixed',
        answers: { session_kind: 'single', excludes: 'wrong-but-copied' },
      },
      expectedCopiedFromActual: true,
    },
    mustFailWith: 'expected-copied-from-actual',
  },
  'service-field-missing-reopen': {
    fn: 'public-service',
    ev: {
      bodyId: 'S',
      priceHalalas: 9000,
      doc: {
        templateId: 'salon_hair_cut',
        templateVersion: 1,
        priceMode: 'fixed',
        answers: { session_kind: 'single', excludes: '' },
      },
      expected: {
        id: 'S',
        priceHalalas: 9000,
        templateId: 'salon_hair_cut',
        templateVersion: 1,
        priceMode: 'fixed',
        answers: { session_kind: 'single', excludes: '' },
        clearedKey: 'excludes',
        clearMode: 'empty-string',
      },
      fieldMissingOnReopen: true,
      clearedUiMissing: true,
    },
    mustFailWith: 'cleared-ui-missing',
  },
  'legacy-retry-two-media': {
    fn: 'legacy-retry',
    ev: {
      firstUploadFailed: true,
      honestFailUi: true,
      noMediaAfterFail: true,
      retryOk: true,
      createdCount: 1,
      ownerBefore: 'A',
      ownerAfter: 'A',
      mediaBytesOk: true,
      mediaCount: 2,
      duplicateMedia: true,
      reopenShowsMedia: true,
    },
    mustFailWith: 'media-count-not-one',
  },
  'legacy-reopen-ui-missing-api-ok': {
    fn: 'legacy',
    ev: {
      createdCount: 1,
      saving: '',
      saveDisabled: false,
      ownerId: 'A',
      media: { ids: ['m1'], wrongOwner: false },
      mediaBytesOk: true,
      reopenShowsMedia: false,
      reopenMediaLoaded: false,
      apiOnlyFallback: true,
    },
    mustFailWith: 'reopen-media-missing',
  },
};

export function runNegativeSample(id) {
  const sample = NEGATIVE_SAMPLES[id];
  if (!sample) return { ok: false, reason: 'unknown-sample' };
  let result;
  if (sample.fn === 'recovery') result = evaluateRecoveryAcceptance(sample.ev);
  else if (sample.fn === 'legacy') result = evaluateLegacyUploadAcceptance(sample.ev);
  else if (sample.fn === 'legacy-retry') result = evaluateLegacyRetryAcceptance(sample.ev);
  else if (sample.fn === 'public-product') result = evaluatePublicProductExact(sample.ev);
  else if (sample.fn === 'public-service') result = evaluatePublicServiceExact(sample.ev);
  else if (sample.fn === 'field-roundtrip') result = evaluateFieldRoundtrip(sample.ev);
  else if (sample.fn === 'field-matrix') result = evaluateFieldCoverageMatrix(sample.ev);
  else return { ok: false, reason: 'unknown-fn' };
  const rejected =
    !result.ok && result.fails.some((f) => f.includes(sample.mustFailWith) || f === sample.mustFailWith);
  return { ok: rejected, sampleId: id, mustFailWith: sample.mustFailWith, fails: result.fails };
}

export const REQUIRED_ACCEPTANCE_IDS = [
  'RC13-10-product-inform',
  'RC13-10-product-reload',
  'RC13-10-service-inform',
  'RC13-10-service-reload',
  'RC13-14-legacy-product',
  'RC13-14-legacy-service',
  'RC13-14-legacy-product-retry',
  'RC13-14-legacy-service-retry',
  'RC13-12-product-exact-delete',
  'RC13-12-service-exact-clear',
  'RC13-11-product-dbl',
  'RC13-11-service-dbl',
  'RC13-F2-URL',
  'RC13-F2-BUSY',
];

export const REQUIRED_FIELD_IDS = [
  'RC13-FIELD-product-nameAr',
  'RC13-FIELD-product-nameEn',
  'RC13-FIELD-product-descriptionAr',
  'RC13-FIELD-product-priceSar',
  'RC13-FIELD-product-category',
  'RC13-FIELD-product-concernTags',
  'RC13-FIELD-product-purchaseMode',
  'RC13-FIELD-product-externalUrl',
  'RC13-FIELD-product-stockQty',
  'RC13-FIELD-product-deliveryFeeSar',
  'RC13-FIELD-product-optionsJson',
  'RC13-FIELD-product-variantsJson',
  'RC13-FIELD-product-skinTypes',
  'RC13-FIELD-product-stepAr',
  'RC13-FIELD-service-nameAr',
  'RC13-FIELD-service-priceSar',
  'RC13-FIELD-service-durationMin',
  'RC13-FIELD-service-bookingEnabled',
  'RC13-FIELD-service-availabilityJson',
  'RC13-FIELD-service-serviceTemplate',
  'RC13-FIELD-service-templateVersion',
  'RC13-FIELD-service-priceMode',
  'RC13-FIELD-service-templateAnswers',
];
