import assert from 'node:assert/strict';
import {
  decodeCatalogCursor,
  encodeCatalogCursor,
  normalizeFilterFingerprint,
  parseCatalogLimit,
} from './catalog-cursor';

assert.deepEqual(parseCatalogLimit(undefined), { ok: true, limit: 8 });
assert.deepEqual(parseCatalogLimit('24'), { ok: true, limit: 24 });
assert.equal(parseCatalogLimit('0').ok, false);
assert.equal(parseCatalogLimit('-1').ok, false);
assert.equal(parseCatalogLimit('25').ok, false);
assert.equal(parseCatalogLimit('1.5').ok, false);

const fpA = normalizeFilterFingerprint({ sort: 'price_asc', variantSelections: { color: ['black'] } });
const fpB = normalizeFilterFingerprint({ sort: 'price_desc', variantSelections: { color: ['black'] } });
assert.notEqual(fpA, fpB);

const cursor = encodeCatalogCursor({ sort: 'price_asc', fingerprint: fpA, kind: 'product', id: 'abc' });
const ok = decodeCatalogCursor(cursor, { sort: 'price_asc', fingerprint: fpA });
assert.equal(ok.ok, true);
if (ok.ok) {
  assert.equal(ok.kind, 'product');
  assert.equal(ok.id, 'abc');
}

const mismatchSort = decodeCatalogCursor(cursor, { sort: 'price_desc', fingerprint: fpA });
assert.equal(mismatchSort.ok, false);

const mismatchFp = decodeCatalogCursor(cursor, { sort: 'price_asc', fingerprint: fpB });
assert.equal(mismatchFp.ok, false);

assert.equal(decodeCatalogCursor('not-a-cursor', { sort: 'key', fingerprint: fpA }).ok, false);

console.log('catalog-cursor.schema-tests: PASS');
