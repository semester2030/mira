/**
 * P3.1 — color swatch styles + empty≠0 stock in options state.
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(__dirname, 'catalog-options-core.js'), 'utf8');
const sandbox = { console, globalThis: {} };
sandbox.globalThis = sandbox;
vm.runInNewContext(src, sandbox);
const M = sandbox.MiraCatalogOptions;
assert.ok(M && typeof M.colorSwatchStyle === 'function');

const black = M.colorSwatchStyle('أسود');
assert.equal(black.background, '#1a1a1a');
const pink = M.colorSwatchStyle('وردي');
assert.ok(pink.background.includes('e86fa9') || pink.background === '#e86fa9');
const multi = M.colorSwatchStyle('متعدد الألوان');
assert.ok(String(multi.background).startsWith('conic'));

const state = M.optionsStateFromServer({
  inventoryMode: 'variant',
  optionsJson: [{ id: 'color', labelAr: 'اللون', values: [{ id: 'black', labelAr: 'أسود' }] }],
  variantsJson: [
    { id: 'v1', selections: { color: 'black' }, available: true, stockQty: null, mediaIds: [] },
    { id: 'v2', selections: { color: 'black' }, available: true, stockQty: 0, mediaIds: [] },
  ],
});
assert.equal(state.inventoryMode, 'variant');
assert.equal(state.variants[0].stockQty, null);
assert.equal(state.variants[1].stockQty, 0);

console.log(JSON.stringify({ ok: true, id: 'P31_SWATCH_UNIT' }));
