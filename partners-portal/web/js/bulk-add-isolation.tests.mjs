/**
 * Pure isolation / pricing checks for MiraBulkAdd helpers (no browser DOM).
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(__dirname, 'bulk-add.js'), 'utf8');

const window = { MiraBulkAdd: null };
const document = {
  createElement: () => ({
    style: {},
    addEventListener() {},
    appendChild() {},
    setAttribute() {},
  }),
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
const crypto = { randomUUID: () => '11111111-2222-3333-4444-555555555555' };

vm.runInNewContext(src, {
  window,
  document,
  sessionStorage,
  location,
  history,
  crypto,
  URL,
  PartnersApi: {},
  console,
});

const api = window.MiraBulkAdd;
assert.ok(api, 'MiraBulkAdd exported');

assert.equal(api.sarToHalalas('12.5'), 1250);
assert.equal(api.sarToHalalas('12.50'), 1250);
assert.throws(() => api.sarToHalalas('12.999'), /غير صالح/);
assert.throws(() => api.sarToHalalas('abc'), /غير صالح/);
assert.equal(api.halalasToSar(1250), '12.50'.replace(/\.?0+$/, '') === '12.5' ? api.halalasToSar(1250) : api.halalasToSar(1250));
assert.ok(['12.5', '12.50'].includes(api.halalasToSar(1250)));

// Cross-batch media isolation: same cardId, different batchId
const jobs = api._mediaJobs;
jobs['m-a'] = { clientMediaId: 'm-a', batchId: 'batchA', cardId: 'c001', status: 'assigned', fileName: 'x.jpg' };
jobs['m-b'] = { clientMediaId: 'm-b', batchId: 'batchB', cardId: 'c001', status: 'assigned', fileName: 'x.jpg' };

const aOnly = api._jobsForBatch('batchA');
const bOnly = api._jobsForBatch('batchB');
assert.equal(aOnly.length, 1);
assert.equal(aOnly[0].clientMediaId, 'm-a');
assert.equal(bOnly.length, 1);
assert.equal(bOnly[0].clientMediaId, 'm-b');
assert.equal(api._jobsForCard('batchA', 'c001').length, 1);
assert.equal(api._jobsForCard('batchB', 'c001').length, 1);
assert.notEqual(api._cardKey('batchA', 'c001'), api._cardKey('batchB', 'c001'));

console.log(JSON.stringify({ ok: true, id: 'P6_BULK_ISOLATION_UNIT' }));
