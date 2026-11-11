import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  catalogIconsPublicBase,
  listCatalogIconKeys,
  resetCatalogIconCacheForTests,
  resolveCatalogIcon,
} from './catalog-icon-assets';
import { loadLaneTaxonomyDoc } from './taxonomy.load';

resetCatalogIconCacheForTests();
const keys = listCatalogIconKeys();
assert.equal(keys.length, 33);

const byImageKey = new Map<string, string[]>();
for (const lane of ['jewelry', 'occasions', 'gifts'] as const) {
  const { doc } = loadLaneTaxonomyDoc(lane);
  for (const n of doc.nodes) {
    if (!n.imageKey) continue;
    const icon = resolveCatalogIcon(n.imageKey);
    if (!icon) continue;
    assert.equal(icon.key, n.imageKey);
    assert.match(icon.smallUrl, /\/marketplace\/catalog-icons\/images\//);
    assert.match(icon.largeUrl, /\/marketplace\/catalog-icons\/images\//);
    assert.ok(icon.version.length === 64);
    const bag = byImageKey.get(n.imageKey) || [];
    bag.push(n.id);
    byImageKey.set(n.imageKey, bag);
  }
}
assert.equal(byImageKey.size, 33, `expected 33 mapped keys, got ${byImageKey.size}`);

// Critical id ↔ imageKey contracts
const jewelry = loadLaneTaxonomyDoc('jewelry').doc;
const bracelets = jewelry.nodes.find((n) => n.id === 'jewelry.bracelets');
assert.equal(bracelets?.imageKey, 'jewelry.bangles');
const gem = jewelry.nodes.find((n) => n.id === 'jewelry.stone.gemstones');
assert.equal(gem?.browseOnly, true);
assert.equal(gem?.imageKey, 'materials.gemstones');

const occasions = loadLaneTaxonomyDoc('occasions').doc;
const tables = occasions.nodes.find((n) => n.id === 'occasions.tables_decor');
assert.equal(tables?.imageKey, 'occasions.tables');
const decor = occasions.nodes.find((n) => n.id === 'occasions.decor');
assert.notEqual(decor?.imageKey, 'occasions.tables');
const perfume = occasions.nodes.find((n) => n.id === 'occasions.perfume_corner');
assert.equal(perfume?.offerKind, 'service');
assert.equal(perfume?.imageKey, 'occasions.perfume');

const gifts = loadLaneTaxonomyDoc('gifts').doc;
const fragrance = gifts.nodes.find((n) => n.id === 'gifts.perfume_incense');
assert.equal(fragrance?.offerKind, 'product');
assert.equal(fragrance?.imageKey, 'gifts.fragrance');

assert.ok(catalogIconsPublicBase().endsWith('/'));
console.log('OK catalog-icons schema', { keys: keys.length, mapped: byImageKey.size, base: catalogIconsPublicBase() });
