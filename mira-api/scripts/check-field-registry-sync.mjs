#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const apiPath = join(root, 'mira-api/src/partners-portal/registry/field-registry.v2.json');
const webPath = join(root, 'partners-portal/web/js/field-registry.v2.json');

function sha(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

const api = sha(apiPath);
const web = sha(webPath);
if (api !== web) {
  console.error('FIELD_REGISTRY_SYNC_FAIL');
  console.error('api', api);
  console.error('web', web);
  process.exit(1);
}
console.log('FIELD_REGISTRY_SYNC_OK', api);
