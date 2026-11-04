/**
 * RC12 acceptance validators — used by browser e2e and acceptance-sensitivity.
 * Pure functions so negative samples can prove FAIL without a browser.
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

/** Exact match of option group value-id sets (order-insensitive within a group). */
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

/** Compare every expected answer key exactly; actual may hold other in-contract keys. */
export function exactAnswersMatch(actual, expected) {
  const a = actual && typeof actual === 'object' ? actual : {};
  const e = expected && typeof expected === 'object' ? expected : {};
  for (const k of Object.keys(e).sort()) {
    const av = a[k] == null ? '' : String(a[k]);
    const ev = e[k] == null ? '' : String(e[k]);
    if (av !== ev) return { ok: false, key: k, actual: a[k], expected: e[k] };
  }
  return { ok: true };
}

/**
 * Recovery acceptance gate — ALL must hold.
 * Rejects the RC11 OR-shortcut that treated list membership as UI-owner success.
 */
export function evaluateRecoveryAcceptance(ev) {
  const fails = [];
  if (!ev.serverExecuted) fails.push('server-not-executed-before-drop');
  if (!ev.droppedOwnerId) fails.push('missing-dropped-owner');
  if (!ev.createdIds || ev.createdIds.length !== 1) fails.push('created-count');
  if (ev.createdIds && ev.createdIds[0] !== ev.droppedOwnerId) fails.push('created-id-mismatch');
  if (ev.duplicateCount != null && ev.duplicateCount !== 1) fails.push('duplicate-owner');
  // Independent mandatory: UI context owner MUST equal recovered owner (no OR with list membership).
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

export function evaluateLegacyUploadAcceptance(ev) {
  const fails = [];
  if (ev.createdCount !== 1) fails.push('created-count');
  if (ev.saving === '1') fails.push('still-busy');
  if (ev.saveDisabled === true) fails.push('save-disabled');
  if (!ev.ownerId) fails.push('no-owner');
  if (!ev.media || !ev.media.ids || ev.media.ids.length < 1) fails.push('media-missing');
  if (ev.media && ev.media.wrongOwner) fails.push('media-wrong-owner');
  if (!ev.mediaBytesOk) fails.push('media-bytes-invalid');
  if (ev.reopenShowsMedia !== true) fails.push('reopen-media-missing');
  return { ok: fails.length === 0, fails, ev };
}

export function evaluateLegacyRetryAcceptance(ev) {
  const fails = [];
  if (ev.firstUploadFailed !== true) fails.push('first-fail-not-observed');
  if (ev.honestFailUi !== true) fails.push('honest-fail-ui');
  if (ev.retryOk !== true) fails.push('retry-not-ok');
  if (ev.createdCount !== 1) fails.push('created-count');
  if (!ev.mediaBytesOk) fails.push('media-bytes-invalid');
  if (ev.mediaCount != null && ev.mediaCount < 1) fails.push('media-count');
  if (ev.duplicateMedia === true) fails.push('duplicate-media');
  return { ok: fails.length === 0, fails, ev };
}

export function evaluatePublicProductExact(ev) {
  const fails = [];
  if (ev.bodyId !== ev.expected.id) fails.push('id');
  if (ev.priceHalalas !== ev.expected.priceHalalas) fails.push('price');
  const opt = exactOptionsMatch(ev.optionsJson, ev.expected.optionGroups);
  if (!opt.ok) fails.push('options:' + opt.reason);
  if (ev.expected.absentInGroups) {
    for (const [g, ids] of Object.entries(ev.expected.absentInGroups)) {
      const present = (opt.actual && opt.actual[g]) || [];
      for (const id of ids) {
        if (present.includes(id)) fails.push('absent-still-present:' + g + '/' + id);
      }
    }
  }
  if (ev.expected.variantsAbsentIds) {
    const vids = (Array.isArray(ev.variantsJson) ? ev.variantsJson : []).map((v) => v && v.id).filter(Boolean);
    for (const id of ev.expected.variantsAbsentIds) {
      if (vids.includes(id)) fails.push('variant-still-present:' + id);
    }
  }
  return { ok: fails.length === 0, fails, opt };
}

export function evaluatePublicServiceExact(ev) {
  const fails = [];
  const e = ev.expected;
  if (ev.bodyId !== e.id) fails.push('id');
  if (ev.priceHalalas !== e.priceHalalas) fails.push('price');
  if (!ev.doc) fails.push('doc-missing');
  else {
    if (ev.doc.templateId !== e.templateId) fails.push('templateId');
    if (Number(ev.doc.templateVersion) !== Number(e.templateVersion)) fails.push('templateVersion');
    if (ev.doc.priceMode !== e.priceMode) fails.push('priceMode');
    const ans = exactAnswersMatch(ev.doc.answers || {}, e.answers || {});
    if (!ans.ok) fails.push('answers:' + ans.key);
  }
  return { ok: fails.length === 0, fails };
}

/** Negative samples required by RC12 acceptance-sensitivity. */
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
    // Exact matcher rejects surplus values; absentInGroups also flags L if groups matched loosely.
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
      },
    },
    mustFailWith: 'answers:excludes',
  },
};

export function runNegativeSample(id) {
  const sample = NEGATIVE_SAMPLES[id];
  if (!sample) return { ok: false, reason: 'unknown-sample' };
  let result;
  if (sample.fn === 'recovery') result = evaluateRecoveryAcceptance(sample.ev);
  else if (sample.fn === 'legacy') result = evaluateLegacyUploadAcceptance(sample.ev);
  else if (sample.fn === 'public-product') result = evaluatePublicProductExact(sample.ev);
  else if (sample.fn === 'public-service') result = evaluatePublicServiceExact(sample.ev);
  else return { ok: false, reason: 'unknown-fn' };
  const rejected = !result.ok && result.fails.some((f) => f.includes(sample.mustFailWith) || f === sample.mustFailWith);
  return { ok: rejected, sampleId: id, mustFailWith: sample.mustFailWith, fails: result.fails };
}

export const REQUIRED_ACCEPTANCE_IDS = [
  'RC12-10-product-inform',
  'RC12-10-product-reload',
  'RC12-10-service-inform',
  'RC12-10-service-reload',
  'RC12-14-legacy-product',
  'RC12-14-legacy-service',
  'RC12-14-legacy-product-retry',
  'RC12-14-legacy-service-retry',
  'RC12-12-product-exact-delete',
  'RC12-12-service-exact-clear',
  'RC12-11-product-dbl',
  'RC12-11-service-dbl',
  'RC12-F2-URL',
  'RC12-F2-BUSY',
];
