/**
 * ACC — dimensions invalid draft must block save (no stale value);
 * manual custom labels keep original text + non-colliding stable ids.
 * Exercises mount + input/change handlers (not source-text greps).
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const registry = JSON.parse(fs.readFileSync(path.join(__dirname, 'field-registry.v2.json'), 'utf8'));
const attrCode = fs.readFileSync(path.join(__dirname, 'registry-attribute-fields.js'), 'utf8');

function makeEl(tag) {
  const el = {
    tagName: String(tag).toUpperCase(),
    style: {},
    classList: {
      _s: new Set(),
      add(c) {
        this._s.add(c);
      },
      remove(c) {
        this._s.delete(c);
      },
      toggle(c, f) {
        if (f === undefined) {
          if (this._s.has(c)) this._s.delete(c);
          else this._s.add(c);
        } else if (f) this._s.add(c);
        else this._s.delete(c);
      },
      contains(c) {
        return this._s.has(c);
      },
    },
    children: [],
    attrs: {},
    listeners: {},
    value: '',
    checked: false,
    hidden: false,
    disabled: false,
    textContent: '',
    innerHTML: '',
    parent: null,
    setAttribute(k, v) {
      this.attrs[k] = String(v);
      if (k === 'data-testid') this.testId = String(v);
    },
    getAttribute(k) {
      return Object.prototype.hasOwnProperty.call(this.attrs, k) ? this.attrs[k] : null;
    },
    appendChild(c) {
      c.parent = this;
      this.children.push(c);
      return c;
    },
    append(...ns) {
      ns.forEach((n) => this.appendChild(n));
    },
    addEventListener(t, fn) {
      (this.listeners[t] = this.listeners[t] || []).push(fn);
    },
    querySelector(sel) {
      const all = [];
      (function walk(n) {
        all.push(n);
        (n.children || []).forEach(walk);
      })(el);
      let m;
      if ((m = sel.match(/\[data-attr-error="([^"]+)"\]/))) {
        return all.find((x) => x.attrs && x.attrs['data-attr-error'] === m[1]) || null;
      }
      if ((m = sel.match(/\[data-testid="([^"]+)"\]/))) {
        return all.find((x) => x.testId === m[1]) || null;
      }
      return null;
    },
    querySelectorAll() {
      const all = [];
      (function walk(n) {
        all.push(n);
        (n.children || []).forEach(walk);
      })(el);
      return {
        length: all.length,
        forEach(fn) {
          all.forEach(fn);
        },
      };
    },
  };
  return el;
}

function walk(n, acc = []) {
  acc.push(n);
  (n.children || []).forEach((c) => walk(c, acc));
  return acc;
}

function findByTestId(root, id) {
  return walk(root).find((n) => n.testId === id) || null;
}

function fire(el, type) {
  (el.listeners[type] || []).forEach((fn) => fn());
}

const sandbox = {
  console,
  window: {},
  document: {
    createElement: makeEl,
    createTextNode: (t) => ({ textContent: String(t), nodeType: 3 }),
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

// --- Unit: custom ids must not collide; original text kept in label map ---
const a = RAF.customAttrId('جلد طبيعي 100%', 0);
const b = RAF.customAttrId('جلد طبيعي 100', 0);
assert.notEqual(a, b, 'percent vs no-percent must get different ids');
assert.ok(RAF.isAllowedCustomAttrId(a));
assert.ok(RAF.isAllowedCustomAttrId(b));

const labelMap = Object.create(null);
const allocA = RAF.allocateCustomAttrValue('جلد طبيعي 100%', 'material', labelMap, new Set());
const allocB = RAF.allocateCustomAttrValue('جلد طبيعي 100', 'material', labelMap, new Set());
assert.equal(allocA.label, 'جلد طبيعي 100%');
assert.equal(allocB.label, 'جلد طبيعي 100');
assert.notEqual(allocA.id, allocB.id);
assert.equal(labelMap.material[allocA.id], 'جلد طبيعي 100%');
assert.equal(
  RAF.displayLabelForCustomId(allocA.id, 'material', labelMap),
  'جلد طبيعي 100%',
);

// --- Dimensions: 12 → -5 blocks; must not emit stale 12 ---
{
  const host = makeEl('div');
  const mount = RAF.mount(host, {
    registry,
    profileId: 'product.bags',
    initialAttributes: { itemDimensions: { w: 12, h: 8, d: 5 } },
  });
  const w = findByTestId(host, 'attr-dim-itemDimensions-w');
  assert.ok(w, 'width input mounted');
  assert.equal(w.value, '12');
  w.value = '-5';
  fire(w, 'input');
  const v = mount.validate();
  assert.equal(v.ok, false, 'validate must fail on -5');
  assert.equal(mount.hasBlockingErrors(), true);
  const patch = mount.getAttributesPatch();
  assert.ok(!patch.itemDimensions, 'must not send stale dimensions while invalid');
  assert.notEqual(patch.itemDimensions && patch.itemDimensions.w, 12);

  // Keep invalid draft visible after repaint
  mount.repaint();
  const w2 = findByTestId(host, 'attr-dim-itemDimensions-w');
  assert.equal(w2.value, '-5', 'invalid draft remains visible');

  // Fix to 15 succeeds and is emitted
  w2.value = '15';
  fire(w2, 'input');
  fire(w2, 'change');
  assert.equal(mount.validate().ok, true);
  assert.equal(mount.hasBlockingErrors(), false);
  const okPatch = mount.getAttributesPatch();
  assert.equal(okPatch.itemDimensions.w, 15);
  assert.equal(okPatch.dimensionsCm.w, 15);

  // Non-numeric
  const h = findByTestId(host, 'attr-dim-itemDimensions-h');
  h.value = 'abc';
  fire(h, 'input');
  assert.equal(mount.hasBlockingErrors(), true);
  assert.ok(!mount.getAttributesPatch().itemDimensions);

  // Partial clear of one axis via change
  h.value = '';
  fire(h, 'input');
  fire(h, 'change');
  assert.equal(mount.hasBlockingErrors(), false);
  const afterPartial = mount.getAttributesPatch().itemDimensions;
  assert.ok(afterPartial);
  assert.equal(afterPartial.w, 15);
  assert.ok(!Object.prototype.hasOwnProperty.call(afterPartial, 'h'));

  // Full clear
  const clearBtn = findByTestId(host, 'attr-clear-itemDimensions');
  fire(clearBtn, 'click');
  assert.equal(mount.getAttributesPatch().itemDimensions, null);
  assert.equal(mount.getAttributesPatch().dimensionsCm, null);
}

// --- Manual single enum: original text round-trip + distinct ids ---
{
  const host = makeEl('div');
  const mount = RAF.mount(host, {
    registry,
    profileId: 'product.bags',
    initialAttributes: {},
  });
  // Switch carryStyle to manual
  const modeRadios = walk(host).filter(
    (n) => n.tagName === 'INPUT' && n.attrs && String(n.attrs.name || '').includes('attr-mode-') && String(n.attrs.name || '').includes('carryStyle'),
  );
  const manualMode = modeRadios.find((n) => n.attrs.value === 'manual');
  assert.ok(manualMode, 'manual mode radio for carryStyle');
  manualMode.checked = true;
  fire(manualMode, 'change');

  const manualIn = findByTestId(host, 'attr-manual-carryStyle');
  assert.ok(manualIn, 'manual input for carryStyle');
  manualIn.value = 'جلد طبيعي 100%';
  fire(manualIn, 'input');
  const patch1 = mount.getAttributesPatch();
  assert.ok(typeof patch1.carryStyle === 'string' && patch1.carryStyle.startsWith('custom:'));
  assert.equal(patch1.customAttrLabels.carryStyle[patch1.carryStyle], 'جلد طبيعي 100%');

  // Re-open from saved attrs
  const host2 = makeEl('div');
  const mount2 = RAF.mount(host2, {
    registry,
    profileId: 'product.bags',
    initialAttributes: {
      carryStyle: patch1.carryStyle,
      customAttrLabels: patch1.customAttrLabels,
    },
  });
  const manualIn2 = findByTestId(host2, 'attr-manual-carryStyle');
  assert.ok(manualIn2);
  assert.equal(manualIn2.value, 'جلد طبيعي 100%', 'reopen shows original text not slug');

  // Distinct value
  const host3 = makeEl('div');
  const mount3 = RAF.mount(host3, {
    registry,
    profileId: 'product.bags',
    initialAttributes: {},
  });
  const mode3 = walk(host3).find(
    (n) =>
      n.tagName === 'INPUT' &&
      n.attrs &&
      String(n.attrs.name || '').includes('carryStyle') &&
      n.attrs.value === 'manual',
  );
  mode3.checked = true;
  fire(mode3, 'change');
  const in3 = findByTestId(host3, 'attr-manual-carryStyle');
  in3.value = 'جلد طبيعي 100';
  fire(in3, 'input');
  const patch3 = mount3.getAttributesPatch();
  assert.notEqual(patch3.carryStyle, patch1.carryStyle, 'different labels → different ids');
  assert.equal(patch3.customAttrLabels.carryStyle[patch3.carryStyle], 'جلد طبيعي 100');

  // Multi material with Arabic + English commas
  const matMode = walk(host3).find(
    (n) =>
      n.tagName === 'INPUT' &&
      n.attrs &&
      String(n.attrs.name || '').includes('material') &&
      n.attrs.value === 'manual',
  );
  matMode.checked = true;
  fire(matMode, 'change');
  const matIn = findByTestId(host3, 'attr-manual-material');
  matIn.value = 'مشمشي، زيتوني, olive-mix';
  fire(matIn, 'input');
  const matPatch = mount3.getAttributesPatch();
  assert.equal(matPatch.material.length, 3);
  assert.equal(matPatch.customAttrLabels.material[matPatch.material[0]], 'مشمشي');
  assert.equal(matPatch.customAttrLabels.material[matPatch.material[1]], 'زيتوني');
  assert.equal(matPatch.customAttrLabels.material[matPatch.material[2]], 'olive-mix');
  const ids = new Set(matPatch.material);
  assert.equal(ids.size, 3);

  // Re-save without edits keeps ids
  const host4 = makeEl('div');
  const mount4 = RAF.mount(host4, {
    registry,
    profileId: 'product.bags',
    initialAttributes: {
      material: matPatch.material,
      customAttrLabels: matPatch.customAttrLabels,
    },
  });
  const matIn4 = findByTestId(host4, 'attr-manual-material');
  assert.equal(matIn4.value, 'مشمشي، زيتوني، olive-mix');
  // Touch input with same text → same ids
  fire(matIn4, 'input');
  const again = mount4.getAttributesPatch();
  assert.deepEqual(again.material, matPatch.material);
}

// Legacy coalesce still works
const coalesced = RAF.coalesceDimensions({ dimensionsCm: { w: 12, h: 8 } });
assert.equal(JSON.stringify(coalesced.itemDimensions), JSON.stringify({ w: 12, h: 8 }));
assert.equal(JSON.stringify(coalesced.dimensionsCm), JSON.stringify({ w: 12, h: 8 }));

console.log(
  JSON.stringify({
    ok: true,
    dimensionsBlockStale: true,
    customOriginalText: true,
    customNoCollision: true,
  }),
);
