/**
 * ACC — itemDimensions def is writable; dimensions coalesce; custom: ids for manual attrs.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const registry = JSON.parse(fs.readFileSync(path.join(__dirname, 'field-registry.v2.json'), 'utf8'));
const attrCode = fs.readFileSync(path.join(__dirname, 'registry-attribute-fields.js'), 'utf8');
const sandbox = {
  console,
  window: {},
  document: {
    createElement: () => ({
      style: {},
      classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
      setAttribute() {},
      getAttribute() { return null; },
      appendChild() {},
      append() {},
      addEventListener() {},
      children: [],
    }),
    createTextNode: (t) => ({ textContent: String(t) }),
  },
  Array,
  String,
  Object,
  JSON,
  RegExp,
  Math,
  Error,
  Number,
  Boolean,
  Map,
  Set,
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.runInNewContext(attrCode, sandbox, { filename: 'registry-attribute-fields.js' });
const RAF = sandbox.window.MiraRegistryAttributeFields;

const bagsDefs = RAF.attributeFieldDefsForProfile(registry, 'product.bags', {
  includeComponentContract: true,
});
const itemDim = bagsDefs.find((d) => d.id === 'itemDimensions');
assert.ok(itemDim, 'product.bags includes itemDimensions');
assert.equal(itemDim.widget, 'dimensions');
assert.equal(itemDim.supportTier, 'write');
assert.ok(attrCode.includes("data-testid': 'attr-dimensions-") || attrCode.includes('attr-dimensions-'), 'dimensions widget present in source');
assert.ok(!attrCode.match(/itemDimensions[\s\S]{0,200}نوع الحقل غير معروض/), 'itemDimensions must not fall through to unsupported message alone');

const coalesced = RAF.coalesceDimensions({ dimensionsCm: { w: 12, h: 8 } });
assert.equal(JSON.stringify(coalesced.itemDimensions), JSON.stringify({ w: 12, h: 8 }));
assert.equal(JSON.stringify(coalesced.dimensionsCm), JSON.stringify({ w: 12, h: 8 }));

const mat = bagsDefs.find((d) => d.id === 'material');
assert.ok(RAF.supportsManualInput(mat));
const carry = bagsDefs.find((d) => d.id === 'carryStyle');
assert.ok(RAF.supportsManualInput(carry));
assert.ok(RAF.isAllowedCustomAttrId(RAF.customAttrId('مشمشي', 0)));
assert.ok(!RAF.isAllowedCustomAttrId('random-open-string'));

// Shoes heel dependsOn still in registry
const shoesDefs = RAF.attributeFieldDefsForProfile(registry, 'product.shoes');
const heel = shoesDefs.find((d) => d.id === 'heelHeightCm');
assert.ok(heel && heel.dependsOn && heel.dependsOn.field === 'subcategory');

console.log(JSON.stringify({ ok: true, itemDimensionsWrite: true, coalesce: true, manualContract: true }));
