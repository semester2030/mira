import assert from 'node:assert/strict';
import {
  filterPlayableCatalogMedia,
  isCatalogMediaAllowedInFeed,
  isPlayableCatalogStorageKey,
  PROVEN_BROKEN_CATALOG_MEDIA_IDS,
} from './catalog-media-playable';

// UUID key shape alone must NOT hide media.
assert.equal(isPlayableCatalogStorageKey('8a8b9f42-fa08-45b9-9277-6a451f7d4e62'), true);
assert.equal(
  isPlayableCatalogStorageKey(
    'upload/50f4a5c0-7558-4570-a766-bd83512fef85/product/x/y',
  ),
  true,
);
assert.equal(isPlayableCatalogStorageKey(null), false);
assert.equal(isPlayableCatalogStorageKey(''), false);

// Proven broken mediaId is hidden; a different UUID-key row stays.
const brokenId = [...PROVEN_BROKEN_CATALOG_MEDIA_IDS][0]!;
assert.equal(isCatalogMediaAllowedInFeed(brokenId), false);
assert.equal(isCatalogMediaAllowedInFeed('aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'), true);

const filtered = filterPlayableCatalogMedia([
  { id: brokenId, storageKey: '8a8b9f42-fa08-45b9-9277-6a451f7d4e62' },
  {
    id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    storageKey: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  },
  {
    id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    storageKey: 'upload/partner/product/x/y',
  },
]);
assert.deepEqual(
  filtered.map((r) => r.id),
  ['bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'],
);

console.log('catalog-media-playable.schema-tests: ok');
