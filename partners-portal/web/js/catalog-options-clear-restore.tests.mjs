/**
 * ACC — clear must wipe customsList; preview/build must use dual-comma split;
 * undo restore must bring back ids + customsList.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const code = fs.readFileSync(path.join(__dirname, 'catalog-options-core.js'), 'utf8');
const sandbox = { console, window: {}, Array, String, Object, JSON, RegExp, Math, Error, Map, Set, Number, Boolean };
sandbox.window = sandbox;
vm.runInNewContext(code, sandbox, { filename: 'catalog-options-core.js' });
const C = sandbox.window.MiraCatalogOptions;
const asList = (v) => Array.from(v || []);

function clearLikeUi(state) {
  // Mirrors catalog-journey clearOptionsStateValues
  state.selected = {};
  state.customs = {};
  state.customsList = {};
  state.inputModes = {};
  state.traits = {};
  state.variants = [];
  state.valueIds = {};
  state.categoryConflict = null;
  state.invalidVariantNote = '';
  state._builtGroups = null;
  state.clearingOptions = true;
  state.clearingVariants = true;
}

const preset = [{ id: 'color', label: 'الألوان', kind: 'color', presets: ['أسود', 'وردي'] }];

// Enter two manual values (Arabic comma)
let state = {
  selected: { color: [] },
  customs: { color: 'مشمشي، زيتوني' },
  customsList: { color: asList(C.splitCustomLabels('مشمشي، زيتوني')) },
  valueIds: {},
  variants: [],
  inputModes: { color: 'manual' },
};
let groups = C.buildOptionGroups(preset, state);
assert.equal(groups[0].values.length, 2);
const idsBefore = asList(groups[0].values.map((v) => v.id));
assert.ok(idsBefore.every((id) => String(id).startsWith('custom:')));

// Save → restore
let restored = C.optionsStateFromServer({ optionsJson: groups });
assert.deepEqual(asList(restored.customsList.color), ['مشمشي', 'زيتوني']);

// Clear (bug was: customs wiped but customsList kept → black + old customs)
const snap = JSON.parse(
  JSON.stringify({
    selected: restored.selected,
    customs: restored.customs,
    customsList: restored.customsList,
    inputModes: restored.inputModes,
    valueIds: restored.valueIds,
    variants: restored.variants || [],
  }),
);
clearLikeUi(restored);
// Choose black only
restored.clearingOptions = false;
restored.selected = { color: ['أسود'] };
restored.inputModes = { color: 'ready' };
groups = C.buildOptionGroups(preset, restored);
assert.equal(groups[0].values.length, 1, 'after clear+black only one value');
assert.equal(groups[0].values[0].labelAr, 'أسود');
assert.equal(groups[0].values[0].id, 'black');

// Regression: if customsList leaked, build would still emit old customs
const leaky = {
  selected: { color: ['أسود'] },
  customs: {},
  customsList: { color: ['مشمشي', 'زيتوني'] },
  valueIds: {},
  variants: [],
  inputModes: { color: 'ready' },
};
const leaked = C.buildOptionGroups(preset, leaky);
assert.equal(leaked[0].values.length, 3, 'documents prior bug when customsList not cleared');
clearLikeUi(leaky);
leaky.clearingOptions = false;
leaky.selected = { color: ['أسود'] };
const fixed = C.buildOptionGroups(preset, leaky);
assert.equal(fixed[0].values.length, 1);
assert.equal(fixed[0].values[0].labelAr, 'أسود');

// Undo restore
Object.assign(restored, snap);
restored.clearingOptions = false;
const undone = C.buildOptionGroups(preset, restored);
assert.deepEqual(asList(undone[0].values.map((v) => v.labelAr)), ['مشمشي', 'زيتوني']);
assert.deepEqual(asList(undone[0].values.map((v) => v.id)), idsBefore);

// English comma path
assert.deepEqual(asList(C.splitCustomLabels('ترابي, رملي خاص')), ['ترابي', 'رملي خاص']);
assert.deepEqual(asList(C.labelsForGroup({ selected: {}, customs: { color: 'أ، ب' }, customsList: null }, 'color')), [
  'أ',
  'ب',
]);

console.log(JSON.stringify({ ok: true, clearKeepsBlackOnly: true, undoRestoresIds: true }));
