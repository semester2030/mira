#!/usr/bin/env node
/**
 * Fails when portal static registry drifts from the API canonical file.
 * Canonical: mira-api/src/partners-portal/registry/field-registry.v2.json
 * Generated fallback: partners-portal/web/js/field-registry.v2.json
 * Fix: npm run sync:field-registry
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const apiPath = join(root, 'mira-api/src/partners-portal/registry/field-registry.v2.json');
const webPath = join(root, 'partners-portal/web/js/field-registry.v2.json');

function sha(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

const mode = process.argv[2] || 'check';

if (mode === '--prove-drift') {
  const original = readFileSync(webPath);
  try {
    writeFileSync(webPath, original.toString('utf8') + '\n/* intentional-drift */\n');
    const api = sha(apiPath);
    const web = sha(webPath);
    if (api === web) {
      console.error('PROVE_DRIFT_FAIL: hashes still match after mutation');
      process.exit(1);
    }
    console.log('PROVE_DRIFT_OK detected intentional mismatch');
    console.log('api', api);
    console.log('web', web);
  } finally {
    writeFileSync(webPath, original);
  }
  process.exit(0);
}

if (mode === '--fix') {
  copyFileSync(apiPath, webPath);
  console.log('FIELD_REGISTRY_FIXED', sha(apiPath));
  process.exit(0);
}

const api = sha(apiPath);
const web = sha(webPath);
if (api !== web) {
  console.error('FIELD_REGISTRY_SYNC_FAIL');
  console.error('api', api);
  console.error('web', web);
  console.error('canonical:', apiPath);
  console.error('fix: npm run sync:field-registry');
  process.exit(1);
}
console.log('FIELD_REGISTRY_SYNC_OK', api);
