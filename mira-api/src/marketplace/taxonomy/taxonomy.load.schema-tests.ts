/**
 * E1-01: taxonomy load integrity — duplicates, missing refs, cycles, profiles.
 */
import assert from 'node:assert/strict';
import { writeFileSync, unlinkSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  loadEleganceTaxonomyDoc,
  validateTaxonomyIntegrity,
  validateTaxonomyProfilesExist,
} from './taxonomy.load';
import type { EleganceTaxonomyDoc } from './taxonomy.types';

function pass(name: string) {
  console.log(`PASS ${name}`);
}

const loaded = loadEleganceTaxonomyDoc();
assert.equal(loaded.doc.lane, 'elegance');
assert.ok(loaded.hash.length === 64);
assert.equal(validateTaxonomyIntegrity(loaded.doc).length, 0);
pass('E1-01-load-ok');

const ids = loaded.doc.nodes.map((n) => n.id);
assert.equal(new Set(ids).size, ids.length);
assert.ok(ids.includes('elegance.all'));
assert.ok(ids.includes('clothes'));
assert.ok(ids.includes('bags'));
assert.ok(ids.includes('shoes'));
const order = ['elegance.all', 'clothes', 'bags', 'shoes', 'face', 'body', 'hair', 'accessories'];
const top = loaded.doc.nodes
  .filter((n) => n.parentId == null)
  .sort((a, b) => a.sort - b.sort || a.id.localeCompare(b.id))
  .map((n) => n.id);
assert.deepEqual(top, order);
pass('E1-01-section-order');

const dup: EleganceTaxonomyDoc = JSON.parse(JSON.stringify(loaded.doc));
dup.nodes.push({ ...dup.nodes[0], id: 'clothes' });
assert.ok(validateTaxonomyIntegrity(dup).some((i) => i.code === 'TAXONOMY_DUP_ID'));
pass('E1-01-dup-detect');

const missingParent: EleganceTaxonomyDoc = JSON.parse(JSON.stringify(loaded.doc));
missingParent.nodes.push({
  id: 'orphan.x',
  parentId: 'no.such.parent',
  labelAr: 'يتيم',
  sort: 99,
  active: true,
  children: [],
});
assert.ok(validateTaxonomyIntegrity(missingParent).some((i) => i.code === 'TAXONOMY_MISSING_PARENT'));
pass('E1-01-missing-parent');

const cycle: EleganceTaxonomyDoc = JSON.parse(JSON.stringify(loaded.doc));
const a = cycle.nodes.find((n) => n.id === 'clothes.abaya')!;
const b = cycle.nodes.find((n) => n.id === 'clothes')!;
a.parentId = 'clothes';
b.parentId = 'clothes.abaya';
assert.ok(validateTaxonomyIntegrity(cycle).some((i) => i.code === 'TAXONOMY_CYCLE'));
pass('E1-01-cycle-detect');

const dir = mkdtempSync(join(tmpdir(), 'e1-tax-'));
const badPath = join(dir, 'bad.json');
writeFileSync(badPath, JSON.stringify(dup));
assert.throws(() => loadEleganceTaxonomyDoc(badPath));
unlinkSync(badPath);
pass('E1-01-load-throws-on-bad');

const known = new Set(
  loaded.doc.nodes.filter((n) => n.profileId && n.writeEnabled !== false).map((n) => n.profileId!),
);
// Intentionally drop one required profile
const incomplete = new Set([...known].slice(0, Math.max(0, known.size - 1)));
if (known.size > 0) {
  const issues = validateTaxonomyProfilesExist(loaded.doc, incomplete);
  assert.ok(issues.some((i) => i.code === 'TAXONOMY_UNKNOWN_PROFILE'));
  pass('E1-01-profile-missing');
} else {
  pass('E1-01-profile-missing-skipped');
}

console.log('E1-01 ALL PASS');
