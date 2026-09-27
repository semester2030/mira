import assert from 'node:assert/strict';
import { pageCatalogItems } from './catalog-page';

const rows = [
  { kind: 'product' as const, id: 'a' },
  { kind: 'product' as const, id: 'b' },
  { kind: 'product' as const, id: 'c' },
  { kind: 'service' as const, id: 'a' },
];

const first = pageCatalogItems(rows, undefined, 2);
assert.equal(first.ok, true);
if (!first.ok) throw new Error('first page');
assert.deepEqual(first.items.map((item) => `${item.kind}:${item.id}`), ['product:a', 'product:b']);

const withoutCursorRow = rows.filter((item) => item.id !== 'b' || item.kind !== 'product');
const continued = pageCatalogItems(withoutCursorRow, 'product:b', 2);
assert.equal(continued.ok, true);
if (!continued.ok) throw new Error('continued');
assert.deepEqual(continued.items.map((item) => `${item.kind}:${item.id}`), ['product:c', 'service:a']);

const natural = pageCatalogItems(rows, first.nextCursor ?? undefined, 8);
assert.equal(natural.ok, true);
if (!natural.ok) throw new Error('natural');
const seen = new Set([...first.items, ...natural.items].map((item) => `${item.kind}:${item.id}`));
assert.equal(seen.size, rows.length);

const invalid = pageCatalogItems(rows, 'missing-row', 2);
assert.deepEqual(invalid, { ok: false, reason: 'invalid_cursor' });

const sameId = pageCatalogItems(rows, 'product:a', 1);
assert.equal(sameId.ok, true);
if (!sameId.ok) throw new Error('same id');
assert.equal(sameId.items[0].kind, 'product');
assert.equal(sameId.items[0].id, 'b');

function allPages(rows: { kind: 'product' | 'service'; id: string }[]) {
  const seen: string[] = [];
  let cursor: string | undefined;
  for (let guard = 0; guard < 20; guard += 1) {
    const page = pageCatalogItems(rows, cursor, 1);
    assert.equal(page.ok, true);
    if (!page.ok) throw new Error('page');
    if (page.items.length === 0) break;
    seen.push(`${page.items[0].kind}:${page.items[0].id}`);
    if (!page.nextCursor) break;
    cursor = page.nextCursor;
  }
  return seen;
}

const caseRows = [
  { kind: 'product' as const, id: 'a' },
  { kind: 'product' as const, id: 'A' },
  { kind: 'product' as const, id: 'b' },
];
assert.deepEqual(allPages(caseRows), ['product:A', 'product:a', 'product:b']);

const punctRows = [
  { kind: 'product' as const, id: 'a-b' },
  { kind: 'product' as const, id: 'a_b' },
  { kind: 'product' as const, id: 'ab' },
];
assert.deepEqual(allPages(punctRows), ['product:a-b', 'product:a_b', 'product:ab']);

const sharedId = [
  { kind: 'service' as const, id: 'same' },
  { kind: 'product' as const, id: 'same' },
];
assert.deepEqual(allPages(sharedId), ['product:same', 'service:same']);

console.log('catalog-page tests passed');
