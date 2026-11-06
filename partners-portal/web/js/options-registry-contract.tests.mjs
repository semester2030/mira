/**
 * P1 RC4 — UI option chips → canonical ids → payload shape accepted by registry contract.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const code = fs.readFileSync(path.join(__dirname, 'catalog-options-core.js'), 'utf8');
const sandbox = { console, window: {} };
sandbox.window = sandbox;
vm.runInNewContext(code, sandbox, { filename: 'catalog-options-core.js' });
const C = sandbox.window.MiraCatalogOptions;

const presets = [
  { id: 'size', label: 'المقاس', kind: 'size', presets: ['XS', 'S', 'M', 'L'] },
  { id: 'color', label: 'اللون', kind: 'color', presets: ['أسود', 'وردي'] },
];
const state = {
  selected: { size: ['M'], color: ['أسود'] },
  customs: {},
  valueIds: {},
  variants: [],
};
const groups = C.buildOptionGroups(presets, state);
assert.equal(groups[0].values[0].id, 'M');
assert.equal(groups[0].values[0].labelAr, 'M');
assert.equal(groups[1].values[0].id, 'black');
assert.equal(groups[1].values[0].labelAr, 'أسود');

// custom color keeps custom: id, not coerced to a standard color
state.selected.color.push('ذهبي خاص');
const groups2 = C.buildOptionGroups(presets, state);
const custom = groups2[1].values.find((v) => v.labelAr === 'ذهبي خاص');
assert.ok(custom.id.startsWith('custom:'));

const payload = {
  optionsJson: groups2,
  colors: groups2[1].values.map((v) => v.id).filter((id) => !id.startsWith('custom:')),
  sizes: groups2[0].values.map((v) => v.id).filter((id) => ['XS','S','M','L','XL','XXL'].includes(id)),
};
assert.deepEqual(payload.colors, ['black']);
assert.deepEqual(payload.sizes, ['M']);
assert.ok(payload.optionsJson[1].values.some((v) => v.id.startsWith('custom:')));

console.log(JSON.stringify({ ok: true, payloadSummary: { colors: payload.colors, sizes: payload.sizes, customKept: true } }));
