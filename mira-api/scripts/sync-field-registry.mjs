#!/usr/bin/env node
/**
 * Single source of truth: mira-api/src/partners-portal/registry/field-registry.v2.json
 * Generates partners-portal/web/js/field-registry.v2.json for static offline fallback only.
 * Prefer PartnersApi.registry() at runtime in the portal editor.
 */
import { copyFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const apiPath = join(root, 'mira-api/src/partners-portal/registry/field-registry.v2.json');
const webPath = join(root, 'partners-portal/web/js/field-registry.v2.json');

copyFileSync(apiPath, webPath);
const sha = createHash('sha256').update(readFileSync(apiPath)).digest('hex');
console.log('FIELD_REGISTRY_SYNCED', sha);
console.log('source', apiPath);
console.log('generated', webPath);
