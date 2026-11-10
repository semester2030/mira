/**
 * ACC — bags/shoes presets + profile mapping + dual-comma custom values.
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

assert.equal(C.categoryFromProfileId('product.bags'), 'bags');
assert.equal(C.categoryFromProfileId('product.shoes'), 'shoes');
assert.equal(C.categoryFromProfileId('product.clothes'), 'clothes');

const bags = C.optionPresets('bags');
assert.ok(bags.groups.length >= 1, 'bags presets must not be empty');
assert.ok(bags.groups.some((g) => g.id === 'color' && (g.presets || []).length > 0));

const shoes = C.optionPresets('shoes');
assert.ok(shoes.groups.some((g) => g.id === 'color'));
assert.ok(shoes.groups.some((g) => g.id === 'size' && (g.presets || []).includes('38')));

const hairTools = C.optionPresets('hair', 'hair.tools');
assert.ok(!hairTools.groups.some((g) => g.id === 'volume'), 'hair tools must not expose shampoo volumes');
assert.ok((hairTools.traits || []).length > 0);

const skirt = C.optionPresets('clothes', 'clothes.skirt');
const blouse = C.optionPresets('clothes', 'clothes.blouse');
assert.ok(skirt.groups.some((g) => g.id === 'size'));
assert.ok(blouse.groups.some((g) => g.id === 'size'));
assert.notDeepEqual(
  skirt.groups.find((g) => g.id === 'size').presets,
  blouse.groups.find((g) => g.id === 'size').presets,
  'skirt size presets differ from blouse',
);

// vm sandbox Arrays are cross-realm — compare via values, not deepStrictEqual on Array identity.
const asList = (v) => Array.from(v || []);
assert.deepEqual(asList(C.splitCustomLabels('مشمشي، زيتوني')), ['مشمشي', 'زيتوني']);
assert.deepEqual(asList(C.splitCustomLabels('مشمشي, زيتوني')), ['مشمشي', 'زيتوني']);
assert.deepEqual(asList(C.splitCustomLabels('أ، ب, ج')), ['أ', 'ب', 'ج']);

const state = {
  selected: { color: [] },
  customs: { color: 'مشمشي، زيتوني' },
  customsList: { color: C.splitCustomLabels('مشمشي، زيتوني') },
  valueIds: {},
  variants: [],
  inputModes: { color: 'manual' },
};
const groups = C.buildOptionGroups(
  [{ id: 'color', label: 'الألوان', kind: 'color', presets: ['أسود'] }],
  state,
);
assert.equal(groups[0].values.length, 2);
assert.deepEqual(asList(groups[0].values.map((v) => v.labelAr)), ['مشمشي', 'زيتوني']);
assert.ok(groups[0].values.every((v) => String(v.id).startsWith('custom:')));
const idsRound1 = asList(groups[0].values.map((v) => v.id));

// Simulate save → restore → rebuild without mutation.
const row = { optionsJson: groups };
const restored = C.optionsStateFromServer(row);
assert.equal(restored.inputModes.color, 'manual');
assert.deepEqual(asList(restored.customsList.color), ['مشمشي', 'زيتوني']);
assert.ok(String(restored.customs.color).includes('مشمشي'));
assert.ok(String(restored.customs.color).includes('زيتوني'));

const groups2 = C.buildOptionGroups(
  [{ id: 'color', label: 'الألوان', kind: 'color', presets: ['أسود'] }],
  restored,
);
assert.equal(groups2[0].values.length, 2);
assert.deepEqual(asList(groups2[0].values.map((v) => v.labelAr)), ['مشمشي', 'زيتوني']);
assert.deepEqual(
  asList(groups2[0].values.map((v) => v.id)),
  idsRound1,
  'stable ids must survive save→restore→save',
);

// English comma input path
const eng = {
  selected: { color: [] },
  customs: { color: 'ترابي, رملي خاص' },
  customsList: { color: C.splitCustomLabels('ترابي, رملي خاص') },
  valueIds: {},
  variants: [],
  inputModes: { color: 'manual' },
};
const engGroups = C.buildOptionGroups(
  [{ id: 'color', label: 'الألوان', kind: 'color', presets: [] }],
  eng,
);
assert.equal(engGroups[0].values.length, 2);
assert.ok(engGroups[0].values.every((v) => String(v.id).startsWith('custom:')));

console.log(
  JSON.stringify({
    ok: true,
    bagsColors: bags.groups.find((g) => g.id === 'color').presets.length,
    shoesSizes: shoes.groups.find((g) => g.id === 'size').presets.length,
    customIdsStable: true,
  }),
);
