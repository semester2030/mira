/**
 * E2 pure tests for shared registry attribute field helpers (portal module).
 * Run: npx tsx src/partners-portal/registry/registry-attribute-fields.schema-tests.ts
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const registryPath = path.join(__dirname, 'field-registry.v2.json');
const webModulePath = path.resolve(
  __dirname,
  '../../../../partners-portal/web/js/registry-attribute-fields.js',
);

const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
const code = fs.readFileSync(webModulePath, 'utf8');
const sandbox: any = { console, globalThis: {} };
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.runInNewContext(code, sandbox);
const M = sandbox.MiraRegistryAttributeFields;
assert.ok(M, 'MiraRegistryAttributeFields exported');

function pass(id: string) {
  console.log('PASS', id);
}

{
  const defs = M.attributeFieldDefsForProfile(registry, 'product.clothes');
  const ids = defs.map((d: any) => d.id);
  assert.ok(ids.includes('material'), 'material write field');
  assert.ok(ids.includes('cut'), 'cut write field');
  assert.equal(defs.find((d: any) => d.id === 'material').supportTier, 'write');
  assert.equal(defs.find((d: any) => d.id === 'cut').supportTier, 'write');
  assert.ok(!ids.includes('carryStyle'), 'carryStyle not on clothes without component flag');
  pass('E2-schema-clothes-write-fields');
}

{
  const defs = M.attributeFieldDefsForProfile(registry, 'product.bags', {
    includeComponentContract: true,
  });
  const carry = defs.find((d: any) => d.id === 'carryStyle');
  assert.ok(carry, 'carryStyle on bags with component contract');
  assert.equal(carry.supportTier, 'component');
  pass('E2-schema-carryStyle-component-tier');
}

{
  // Single-select must replace prior value (carryStyle / cut contract).
  assert.equal(M.applySingleSelect('hand', 'shoulder'), 'shoulder');
  assert.equal(M.applySingleSelect('hand', undefined), 'hand');
  assert.equal(M.applySingleSelect('regular', 'fitted'), 'fitted');
  pass('E2-schema-single-select-replaces');
}

{
  let arr = M.applyMultiSelect([], 'silk', true);
  arr = M.applyMultiSelect(arr, 'cotton', true);
  assert.deepEqual(arr, ['silk', 'cotton']);
  arr = M.applyMultiSelect(arr, 'silk', false);
  assert.deepEqual(arr, ['cotton']);
  pass('E2-schema-multi-select-preserves');
}

{
  const def = M.fieldDef(registry, 'material');
  assert.equal(M.labelFor(def, 'silk'), 'حرير');
  assert.equal(M.storageAttrKey(def), 'material');
  pass('E2-schema-labels-storage');
}

{
  // Registry copies must stay in sync (server vs web).
  const webReg = JSON.parse(
    fs.readFileSync(
      path.resolve(__dirname, '../../../../partners-portal/web/js/field-registry.v2.json'),
      'utf8',
    ),
  );
  assert.deepEqual(webReg.fields.material, registry.fields.material);
  assert.deepEqual(webReg.fields.carryStyle, registry.fields.carryStyle);
  assert.deepEqual(
    webReg.profiles.find((p: any) => p.id === 'product.bags'),
    registry.profiles.find((p: any) => p.id === 'product.bags'),
  );
  pass('E2-schema-registry-copies-sync');
}

console.log('registry-attribute-fields.schema-tests: PASS');
void require;
