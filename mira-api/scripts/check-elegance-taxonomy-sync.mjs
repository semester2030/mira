#!/usr/bin/env node
/**
 * Drift detector: elegance taxonomy integrity + write-enabled profiles exist in field-registry.v2.json.
 * Source of truth for fields/profiles: mira-api/src/partners-portal/registry/field-registry.v2.json
 * Taxonomy projection source: mira-api/src/marketplace/taxonomy/elegance-taxonomy.v1.json
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const taxonomyPath = join(root, 'src/marketplace/taxonomy/elegance-taxonomy.v1.json');
const registryPath = join(root, 'src/partners-portal/registry/field-registry.v2.json');

function sha(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

const taxonomyRaw = readFileSync(taxonomyPath, 'utf8');
const registryRaw = readFileSync(registryPath, 'utf8');
const taxonomy = JSON.parse(taxonomyRaw);
const registry = JSON.parse(registryRaw);

if (taxonomy.lane !== 'elegance') {
  console.error('ELEGANCE_TAXONOMY_SYNC_FAIL lane');
  process.exit(1);
}

const byId = new Map();
for (const n of taxonomy.nodes || []) {
  if (byId.has(n.id)) {
    console.error('ELEGANCE_TAXONOMY_SYNC_FAIL dup', n.id);
    process.exit(1);
  }
  byId.set(n.id, n);
}

const profileIds = new Set((registry.profiles || []).map((p) => p.id));
const missing = [];
for (const n of byId.values()) {
  if (!n.profileId) continue;
  if (n.writeEnabled === false) continue;
  if (!profileIds.has(n.profileId)) missing.push(`${n.id}:${n.profileId}`);
}
if (missing.length) {
  console.error('ELEGANCE_TAXONOMY_SYNC_FAIL missing_profiles');
  for (const m of missing) console.error(' ', m);
  process.exit(1);
}

const order = ['elegance.all', 'clothes', 'bags', 'shoes', 'face', 'body', 'hair', 'accessories'];
const top = [...byId.values()]
  .filter((n) => n.parentId == null)
  .sort((a, b) => a.sort - b.sort || a.id.localeCompare(b.id))
  .map((n) => n.id);
if (JSON.stringify(top) !== JSON.stringify(order)) {
  console.error('ELEGANCE_TAXONOMY_SYNC_FAIL section_order', top);
  process.exit(1);
}

console.log('ELEGANCE_TAXONOMY_SYNC_OK');
console.log('taxonomySha', sha(taxonomyPath));
console.log('registrySha', sha(registryPath));
console.log('definitionsVersion', taxonomy.definitionsVersion);
console.log('nodes', byId.size);
