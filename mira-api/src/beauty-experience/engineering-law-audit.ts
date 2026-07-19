/**
 * Engineering law audit for Beauty Experience Foundation.
 * Run: npm run audit:beauty-eng-laws
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { PROVIDER_CAPABILITY_MATRIX } from './provider-manager/provider-matrix';
import { defaultCapabilityRegistry } from './capability/capability-registry';

const ROOT = path.join(__dirname);

function walk(dir: string, acc: string[] = []): string[] {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, acc);
    else if (ent.name.endsWith('.ts') && !ent.name.endsWith('.schema-tests.ts')) {
      acc.push(p);
    }
  }
  return acc;
}

function main(): void {
  // No Face/Skin intelligence imports from beauty-experience (except shared ports)
  const files = walk(ROOT);
  for (const f of files) {
    const src = fs.readFileSync(f, 'utf8');
    assert.ok(
      !src.includes("from '../../intelligence/face-intelligence"),
      `Face Intel import forbidden: ${f}`,
    );
    assert.ok(
      !src.includes("from '../../intelligence/skin-intelligence"),
      `Skin Intel import forbidden: ${f}`,
    );
    // Adapters must not contain Perfect/Banuba SDK package imports
    if (f.includes(`${path.sep}adapters${path.sep}`)) {
      assert.ok(!src.includes('banuba_sdk'), `Banuba SDK in ${f}`);
      assert.ok(!src.includes('@perfectcorp'), `Perfect SDK in ${f}`);
      assert.ok(!src.includes('makeupar.com'), `Direct Perfect API in foundation adapter ${f}`);
    }
  }

  // Every matrix capability is registered
  for (const e of PROVIDER_CAPABILITY_MATRIX) {
    assert.ok(
      defaultCapabilityRegistry.has(e.capabilityId),
      `Matrix capability missing from registry: ${e.capabilityId}`,
    );
  }

  // One capability → multiple providers (lip)
  const lipProviders = PROVIDER_CAPABILITY_MATRIX.filter(
    (e) => e.capabilityId === 'lip' && e.supported,
  );
  assert.ok(lipProviders.length >= 2, 'Lip must support multiple providers');

  console.log('beauty engineering laws OK');
}

main();
