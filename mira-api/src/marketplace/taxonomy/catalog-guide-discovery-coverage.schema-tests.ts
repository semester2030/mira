/**
 * Discovery binding sheet — which of 74 services have a direct taxonomy icon leaf.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CatalogGuideService } from './catalog-guide.service';

const guide = new CatalogGuideService();
guide.onModuleInit();
const cov = JSON.parse(
  readFileSync(join(__dirname, 'catalog-guide-discovery-coverage.v1.json'), 'utf8'),
) as {
  summary: Record<string, number>;
  services: Array<{ serviceId: string; taxonomyLeafId: string | null; bind: string; phraseSampleAr: string | null }>;
};

assert.equal(cov.summary.total, 74);
assert.equal(cov.summary.direct_icon, 4);

const byId = Object.fromEntries(cov.services.map((s) => [s.serviceId, s]));
assert.equal(byId.S042.bind, 'direct_icon');
assert.equal(byId.S042.taxonomyLeafId, 'beauty.face_care.cleanse');
assert.equal(byId.S043.bind, 'direct_icon');
assert.equal(byId.S043.taxonomyLeafId, 'beauty.face_care.hydrate');
assert.equal(byId.S044.bind, 'direct_icon');
assert.equal(byId.S044.taxonomyLeafId, 'beauty.face_care.pre_makeup');
assert.match(String(byId.S044.phraseSampleAr), /مكياج/);
assert.equal(byId.S098.bind, 'direct_icon');
assert.equal(byId.S098.taxonomyLeafId, 'beauty.face_care.peel');
assert.match(String(byId.S098.phraseSampleAr), /تقشير/);
assert.notEqual(byId.S098.taxonomyLeafId, byId.S044.taxonomyLeafId);

assert.equal(guide.getService('S098')?.taxonomyLeafId, 'beauty.face_care.peel');
assert.equal(guide.getService('S044')?.taxonomyLeafId, 'beauty.face_care.pre_makeup');

console.log('OK catalog-guide-discovery-coverage', cov.summary);
