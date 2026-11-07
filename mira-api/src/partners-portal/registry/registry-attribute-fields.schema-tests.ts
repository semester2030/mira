/**
 * E2 corrections — pure + minimal DOM tests for shared attribute fields.
 * Run: npx tsx src/partners-portal/registry/registry-attribute-fields.schema-tests.ts
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const registryPath = path.join(__dirname, 'field-registry.v2.json');
const taxonomyPath = path.resolve(
  __dirname,
  '../../marketplace/taxonomy/elegance-taxonomy.v1.json',
);
const webModulePath = path.resolve(
  __dirname,
  '../../../../partners-portal/web/js/registry-attribute-fields.js',
);

const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
const taxonomy = JSON.parse(fs.readFileSync(taxonomyPath, 'utf8'));

/** Minimal DOM enough for MiraRegistryAttributeFields.mount */
function makeDom() {
  class FakeEl {
    tagName: string;
    className = '';
    textContent = '';
    innerHTML = '';
    value = '';
    checked = false;
    disabled = false;
    hidden = false;
    childNodes: FakeEl[] = [];
    attrs: Record<string, string> = {};
    listeners: Record<string, Function[]> = {};
    style: Record<string, string> = {};
    dataset: Record<string, string> = {};
    classList = {
      add: (...parts: string[]) => {
        const set = new Set(String(this.className).split(/\s+/).filter(Boolean));
        parts.forEach((p) => set.add(p));
        this.className = Array.from(set).join(' ');
      },
      remove: (...parts: string[]) => {
        const set = new Set(String(this.className).split(/\s+/).filter(Boolean));
        parts.forEach((p) => set.delete(p));
        this.className = Array.from(set).join(' ');
      },
      toggle: (p: string, force?: boolean) => {
        const has = String(this.className).split(/\s+/).includes(p);
        if (force === true || (!has && force !== false)) this.classList.add(p);
        else this.classList.remove(p);
      },
      contains: (p: string) => String(this.className).split(/\s+/).includes(p),
    };
    constructor(tag: string) {
      this.tagName = tag.toUpperCase();
    }
    setAttribute(k: string, v: string) {
      this.attrs[k] = String(v);
      if (k === 'data-testid') this.dataset.testid = String(v);
    }
    getAttribute(k: string) {
      return this.attrs[k] ?? null;
    }
    appendChild(c: FakeEl) {
      this.childNodes.push(c);
      return c;
    }
    addEventListener(type: string, fn: Function) {
      (this.listeners[type] = this.listeners[type] || []).push(fn);
    }
    querySelectorAll(sel: string): FakeEl[] {
      const out: FakeEl[] = [];
      const walk = (n: FakeEl) => {
        if (sel === 'input[type=radio]' && n.tagName === 'INPUT' && n.attrs.type === 'radio') out.push(n);
        if (sel === '.mira-attr-choice' && (n.className || '').includes('mira-attr-choice')) out.push(n);
        if (sel.startsWith('[data-attr-error=') && n.attrs['data-attr-error']) {
          const id = sel.slice('[data-attr-error="'.length, -2);
          if (n.attrs['data-attr-error'] === id) out.push(n);
        }
        n.childNodes.forEach(walk);
      };
      walk(this);
      return out;
    }
    querySelector(sel: string): FakeEl | null {
      return this.querySelectorAll(sel)[0] || null;
    }
    click() {
      (this.listeners.click || []).forEach((fn) => fn({ target: this }));
    }
    dispatch(type: string) {
      (this.listeners[type] || []).forEach((fn) => fn({ target: this }));
    }
  }
  const document = {
    createElement: (tag: string) => new FakeEl(tag),
    createTextNode: (t: string) => {
      const n = new FakeEl('#text');
      n.textContent = t;
      return n;
    },
  };
  return { FakeEl, document, host: new FakeEl('div') };
}

const code = fs.readFileSync(webModulePath, 'utf8');
const { document, host } = makeDom();
const sandbox: any = { console, document, window: { document }, globalThis: {} };
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.runInNewContext(code, sandbox);
const M = sandbox.MiraRegistryAttributeFields;
assert.ok(M, 'module exported');

function pass(id: string) {
  console.log('PASS', id);
}

{
  const onlyOcc = M.extractAttributesFromValues({ occasion: ['eid'] });
  assert.equal(JSON.stringify(onlyOcc), JSON.stringify({ occasion: ['eid'] }));
  const onlyLen = M.extractAttributesFromValues({ lengthCm: 0 });
  assert.equal(onlyLen.lengthCm, 0);
  const cleared = M.extractAttributesFromValues({ lengthCm: null });
  assert.equal(Object.prototype.hasOwnProperty.call(cleared, 'lengthCm'), true);
  assert.equal(cleared.lengthCm, null);
  const missing = M.extractAttributesFromValues({ nameAr: 'x' });
  assert.equal(JSON.stringify(missing), '{}');
  const flatWins = M.extractAttributesFromValues({
    attributes: { material: ['silk'] },
    material: ['cotton'],
  });
  assert.equal(JSON.stringify(flatWins.material), JSON.stringify(['cotton']));
  pass('E2c-extract-independent-keys');
}

{
  const vEmpty = M.validateNumberValue({ id: 'lengthCm', min: 0, max: 300 }, '');
  assert.equal(vEmpty.ok, true);
  assert.equal(vEmpty.value, null);
  const vZero = M.validateNumberValue({ id: 'lengthCm', min: 0, max: 300 }, '0');
  assert.equal(vZero.ok, true);
  assert.equal(vZero.value, 0);
  const vBad = M.validateNumberValue({ id: 'lengthCm', min: 0, max: 300 }, 'abc');
  assert.equal(vBad.ok, false);
  const vHi = M.validateNumberValue({ id: 'lengthCm', min: 0, max: 300 }, '999');
  assert.equal(vHi.ok, false);
  pass('E2c-number-validation-contract');
}

{
  const subs = M.subcategoriesFromTaxonomy(taxonomy, 'clothes');
  const ids = subs.map((s: any) => s.value);
  assert.ok(ids.includes('clothes.wedding_dress'));
  assert.ok(ids.includes('clothes.abaya'));
  assert.ok(ids.includes('clothes.evening'));
  assert.ok(!ids.includes('clothes.all'), 'browseOnly excluded');
  assert.ok(!ids.includes('clothes'), 'root without usable parent excluded');
  pass('E2c-taxonomy-subcategories');
}

{
  const defs = M.attributeFieldDefsForProfile(registry, 'product.clothes');
  const projected = M.projectStateOntoDefs(
    {
      values: { material: ['silk'], cut: 'fitted', unknownX: 1 },
      cleared: { occasion: true },
      dirty: { material: true, occasion: true, unknownX: true },
    },
    defs,
  );
  assert.deepEqual(projected.values.material, ['silk']);
  assert.equal(projected.cleared.occasion, true);
  assert.ok(projected.incompatible.unknownX === 1);
  pass('E2c-project-state-compatible');
}

{
  const hostA = makeDom().host;
  const hostB = makeDom().host;
  // Re-bind document for createElement during mount
  sandbox.document = makeDom().document;
  const a = M.mount(hostA, {
    registry,
    profileId: 'product.clothes',
    mountId: 'card-A',
    initialAttributes: { cut: 'regular' },
  });
  const b = M.mount(hostB, {
    registry,
    profileId: 'product.clothes',
    mountId: 'card-B',
    initialAttributes: { cut: 'loose' },
  });
  assert.equal(a.getRadioGroupName('cut'), 'mira-attr-card-A-cut');
  assert.equal(b.getRadioGroupName('cut'), 'mira-attr-card-B-cut');
  assert.notEqual(a.getRadioGroupName('cut'), a.getRadioGroupName('occasion'));
  // Simulate A→B→A via API of mark through setFromAttributes + capture
  a.setFromAttributes({ cut: 'fitted' });
  assert.equal(a.getSelectedSingle('cut'), 'fitted');
  a.setFromAttributes({ cut: 'regular' });
  assert.equal(a.getSelectedSingle('cut'), 'regular');
  pass('E2c-radio-group-names-per-card');
}

{
  const h = makeDom().host;
  sandbox.document = makeDom().document;
  const m = M.mount(h, {
    registry,
    profileId: 'product.bags',
    mountId: 'carry-fixture',
    includeComponentContract: true,
    persistComponentContract: true,
    initialAttributes: { carryStyle: 'hand' },
  });
  assert.equal(m.getSelectedSingle('carryStyle'), 'hand');
  assert.equal(m.getRadioGroupName('carryStyle'), 'mira-attr-carry-fixture-carryStyle');
  // Replacement via state API (same component instance)
  m.setFromAttributes({ carryStyle: 'shoulder' });
  assert.equal(m.getSelectedSingle('carryStyle'), 'shoulder');
  m.setFromAttributes({ carryStyle: 'hand' });
  assert.equal(m.getSelectedSingle('carryStyle'), 'hand');
  pass('E2c-carryStyle-component-fixture');
}

{
  const webReg = JSON.parse(
    fs.readFileSync(
      path.resolve(__dirname, '../../../../partners-portal/web/js/field-registry.v2.json'),
      'utf8',
    ),
  );
  assert.deepEqual(webReg.fields.material, registry.fields.material);
  assert.deepEqual(webReg.fields.carryStyle, registry.fields.carryStyle);
  pass('E2c-registry-copies-sync');
}

console.log('registry-attribute-fields.schema-tests: PASS');
