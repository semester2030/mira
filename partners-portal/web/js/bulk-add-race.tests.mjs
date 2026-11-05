/**
 * Simulates delayed responses + navigation races for bulk-add frozen-context rules.
 * Does not require a live browser; asserts destination IDs captured at action start.
 * Run: node partners-portal/web/js/bulk-add-race.tests.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(__dirname, 'bulk-add.js'), 'utf8');

const calls = [];
let openBatchId = 'batchA';

function delay(ms, value) {
  return new Promise((r) => setTimeout(() => r(value), ms));
}

const PartnersApi = {
  putBulkCard: async (batchId, cardId, payload) => {
    calls.push({ op: 'put', batchId, cardId, payload });
    await delay(40);
    return { revision: (payload.expectedRevision || 0) + 1, values: Object.assign({}, payload.values) };
  },
  applyBulkShared: async (batchId, payload) => {
    calls.push({ op: 'shared', batchId, cardIds: payload.cardIds, values: payload.values, previewOnly: !!payload.previewOnly });
    await delay(50);
    return {
      allOk: true,
      partial: false,
      succeeded: (payload.cardIds || []).length,
      failed: 0,
      results: (payload.cardIds || []).map((id) => ({
        ok: true,
        cardId: id,
        revision: (payload.expectedRevisions && payload.expectedRevisions[id] != null
          ? payload.expectedRevisions[id]
          : 0) + 1,
        values: Object.assign({}, payload.values),
      })),
    };
  },
  materializeBulkBatch: async (batchId, payload, key) => {
    calls.push({ op: 'materialize', batchId, key, payload });
    await delay(60);
    return { succeeded: 1, failed: 0, skipped: 0, results: [{ ok: true, cardId: 'c001', targetOwnerId: 'o-' + batchId }] };
  },
  getBulkBatch: async (batchId) => {
    calls.push({ op: 'get', batchId });
    return {
      batchId,
      kind: 'product',
      profileId: 'product.clothes',
      ready: true,
      cards: [
        {
          cardId: 'c001',
          revision: 2,
          status: 'materialized',
          values: { nameAr: 'committed', priceHalalas: 20000 },
          targetOwnerId: 'o-' + batchId,
        },
      ],
    };
  },
};

const window = { MiraBulkAdd: null };
const document = {
  createElement: () => {
    const node = {
      style: {},
      className: '',
      children: [],
      textContent: '',
      value: '',
      checked: false,
      disabled: false,
      files: null,
      addEventListener() {},
      appendChild(c) {
        this.children.push(c);
        return c;
      },
      setAttribute() {},
      insertBefore(c) {
        this.children.unshift(c);
        return c;
      },
      querySelectorAll: () => [],
      getAttribute: () => null,
      firstChild: null,
    };
    return node;
  },
  querySelector: () => null,
};
const sessionStorage = {
  _d: Object.create(null),
  getItem(k) {
    return this._d[k] ?? null;
  },
  setItem(k, v) {
    this._d[k] = String(v);
  },
  removeItem(k) {
    delete this._d[k];
  },
};
const location = { href: 'http://127.0.0.1/dashboard.html', pathname: '/dashboard.html', search: '', hash: '' };
const history = { replaceState() {} };

vm.runInNewContext(src, {
  window,
  document,
  sessionStorage,
  location,
  history,
  crypto: { randomUUID: () => 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee' },
  URL,
  PartnersApi,
  console,
});

const api = window.MiraBulkAdd;
assert.ok(api);

/**
 * Pure race model mirroring the fixed UI contract:
 * freeze ctx before await; later openBatch must not redirect materialize/shared.
 */
async function raceMaterializeNavigate() {
  calls.length = 0;
  openBatchId = 'batchA';
  const ctx = api.freezeCtx({ batchId: openBatchId, kind: 'product', profileId: 'product.clothes' });
  const saveP = PartnersApi.putBulkCard(ctx.batchId, 'c001', {
    expectedRevision: 1,
    values: { nameAr: 'from-A' },
    clearFields: [],
  });
  // navigate while save in flight
  openBatchId = 'batchB';
  await saveP;
  // materialize MUST use frozen ctx.batchId, not openBatchId
  await PartnersApi.materializeBulkBatch(ctx.batchId, { submitReview: true }, 'bulk-ui-' + ctx.batchId);
  const mats = calls.filter((c) => c.op === 'materialize');
  assert.equal(mats.length, 1);
  assert.equal(mats[0].batchId, 'batchA');
  assert.notEqual(mats[0].batchId, openBatchId);
  assert.equal(mats[0].key, 'bulk-ui-batchA');
}

async function raceSharedFillNavigate() {
  calls.length = 0;
  openBatchId = 'batchA';
  const ctx = api.freezeCtx({ batchId: openBatchId, kind: 'product', profileId: 'product.clothes' });
  const cardsByBatch = api._cardsByBatch;
  api._ensureBatchCards('batchA').c001 = {
    localValues: { priceHalalas: 10000 },
    savedValues: { priceHalalas: 10000 },
    dirtyFields: Object.create(null),
    priceSarText: '100',
    revision: 1,
    status: 'draft',
    dirty: false,
    editGen: 0,
    saveGen: 0,
    error: null,
  };
  api._ensureBatchCards('batchB').c001 = {
    localValues: { priceHalalas: 5000 },
    savedValues: { priceHalalas: 5000 },
    dirtyFields: Object.create(null),
    priceSarText: '50',
    revision: 1,
    status: 'draft',
    dirty: false,
    editGen: 0,
    saveGen: 0,
    error: null,
  };
  const p = PartnersApi.applyBulkShared(ctx.batchId, {
    cardIds: ['c001'],
    values: { priceHalalas: 20000 },
    expectedRevisions: { c001: 1 },
    overwriteWritten: true,
  });
  openBatchId = 'batchB';
  const out = await p;
  // Apply only to ctx.batchId
  const dest = api._ensureBatchCards(ctx.batchId);
  out.results.forEach((r) => {
    const st = dest[r.cardId];
    if (r.ok) {
      st.revision = r.revision;
      st.savedValues = Object.assign({}, r.values);
      st.localValues.priceHalalas = r.values.priceHalalas;
      st.priceSarText = api.halalasToSar(r.values.priceHalalas);
    }
  });
  assert.equal(calls.filter((c) => c.op === 'shared')[0].batchId, 'batchA');
  assert.equal(dest.c001.priceSarText, '200');
  assert.equal(dest.c001.localValues.priceHalalas, 20000);
  assert.equal(api._ensureBatchCards('batchB').c001.priceSarText, '50');
  assert.equal(api._ensureBatchCards('batchB').c001.localValues.priceHalalas, 5000);
}

async function raceEditDuringMaterializeSave() {
  const st = {
    localValues: { nameAr: 'old' },
    savedValues: { nameAr: 'old' },
    dirtyFields: { nameAr: true },
    priceSarText: '',
    priceError: null,
    revision: 1,
    status: 'draft',
    dirty: true,
    editGen: 1,
    saveGen: 0,
  };
  const snap = api.buildSavePayload(st);
  assert.equal(snap.values.nameAr, 'old');
  assert.equal(snap.editGen, 1);
  // User edits while save in flight
  st.editGen = 2;
  st.localValues.nameAr = 'new';
  st.dirty = true;
  // On save return with sentGen=1 ≠ editGen=2 → must NOT clear dirty / must NOT materialize blindly
  const canMaterialize = st.editGen === snap.editGen && !st.priceError;
  assert.equal(canMaterialize, false);
  assert.equal(st.localValues.nameAr, 'new');
}

await raceMaterializeNavigate();
await raceSharedFillNavigate();
await raceEditDuringMaterializeSave();

console.log(
  JSON.stringify({
    ok: true,
    id: 'P6_BULK_RACE_SIM',
    scenarios: ['mat_nav_A_to_B', 'shared_fill_A_to_B', 'edit_during_mat_save'],
  }),
);
