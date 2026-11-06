import assert from 'node:assert/strict';
import {
  decodeCatalogCursor,
  emptyCatalogFingerprint,
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

// Context fields change fingerprint (type/venue/visual/lane).
{
  const base = normalizeFilterFingerprint({ sort: 'key' });
  const withVisual = normalizeFilterFingerprint({ sort: 'key' }, { visual: '1' });
  const withType = normalizeFilterFingerprint({ sort: 'key' }, { type: 'clinic' });
  assert.notEqual(base, withVisual);
  assert.notEqual(base, withType);
}

// Legacy cursor rejected when filters are active.
{
  const empty = emptyCatalogFingerprint();
  const legacyOk = decodeCatalogCursor('product:abc', { sort: 'key', fingerprint: empty });
  assert.equal(legacyOk.ok, true);
  const legacyBlocked = decodeCatalogCursor('product:abc', { sort: 'key', fingerprint: fpA });
  assert.equal(legacyBlocked.ok, false);
}

console.log('catalog-cursor.schema-tests: PASS');
