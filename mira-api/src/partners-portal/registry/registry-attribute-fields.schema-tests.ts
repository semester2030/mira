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

// --- E2-C01: park incompatible values across profile remount; explicit clear stays cleared ---
{
  const st1 = {
    values: { occasion: ['work'], material: ['cotton'], lengthCm: 0 },
    cleared: {},
    dirty: { occasion: true, material: true, lengthCm: true },
    invalidInputs: { lengthCm: 'nope' },
  };
  const abayaDefs = M.attributeFieldDefsForProfile(registry, 'product.abaya');
  const toAbaya = M.projectStateOntoDefs(st1, abayaDefs);
  assert.ok(Object.prototype.hasOwnProperty.call(toAbaya.parked, 'occasion'), 'occasion parked on abaya');
  assert.ok(!Object.prototype.hasOwnProperty.call(toAbaya.values, 'occasion'));
  assert.deepEqual(toAbaya.values.material, ['cotton']);
  assert.equal(toAbaya.values.lengthCm, 0);
  // lengthCm is compatible with abaya — invalid typed input stays active, not parked
  assert.equal(toAbaya.invalidInputs.lengthCm, 'nope');

  sandbox.document = makeDom().document;
  const abayaMount = M.mount(makeDom().host, {
    registry,
    profileId: 'product.abaya',
    mountId: 'c01-single',
    preserveState: st1,
    initialAttributes: {},
  });
  assert.ok(abayaMount.getParkedKeys().includes('occasion'));
  const st2 = abayaMount.captureEditorState();
  assert.ok(Object.prototype.hasOwnProperty.call(st2.parked, 'occasion'));

  const clothesDefs = M.attributeFieldDefsForProfile(registry, 'product.clothes');
  const back = M.projectStateOntoDefs(st2, clothesDefs);
  assert.deepEqual(back.values.occasion, ['work']);
  assert.ok(!Object.prototype.hasOwnProperty.call(back.parked, 'occasion'));

  // explicit clear must not resurrect parked value
  const clearedState = {
    values: { material: ['silk'] },
    cleared: { occasion: true },
    dirty: { occasion: true, material: true },
    parked: {},
    parkedCleared: {},
  };
  const clearedProj = M.projectStateOntoDefs(clearedState, clothesDefs);
  assert.equal(clearedProj.cleared.occasion, true);
  assert.ok(!Object.prototype.hasOwnProperty.call(clearedProj.values, 'occasion'));

  // clear while on clothes, then abaya, then back — stays cleared
  const clearThenSwitch = M.projectStateOntoDefs(
    {
      values: { material: ['silk'] },
      cleared: { occasion: true },
      dirty: { occasion: true },
    },
    abayaDefs,
  );
  assert.equal(clearThenSwitch.parkedCleared.occasion, true);
  const clearBack = M.projectStateOntoDefs(
    {
      values: clearThenSwitch.values,
      cleared: clearThenSwitch.cleared,
      dirty: clearThenSwitch.dirty,
      parked: clearThenSwitch.parked,
      parkedCleared: clearThenSwitch.parkedCleared,
      parkedDirty: clearThenSwitch.parkedDirty,
    },
    clothesDefs,
  );
  assert.equal(clearBack.cleared.occasion, true);
  assert.ok(!Object.prototype.hasOwnProperty.call(clearBack.values, 'occasion'));
  pass('E2-C01-park-restore-and-explicit-clear');
}

// --- E2-C02: stale server snapshot must not overwrite newer dirty field ---
{
  sandbox.document = makeDom().document;
  const host = makeDom().host;
  const m = M.mount(host, {
    registry,
    profileId: 'product.clothes',
    mountId: 'c02',
    initialAttributes: { material: ['silk'] },
  });
  const rev0 = m.getEditRevision();
  m.setFromAttributes({ material: ['linen'] });
  // mark dirty via project+seed path: use applyServerSnapshot after dirtying through capture
  const dirtyMount = M.mount(makeDom().host, {
    registry,
    profileId: 'product.clothes',
    mountId: 'c02b',
    preserveState: {
      values: { material: ['linen'] },
      cleared: {},
      dirty: { material: true },
      invalidInputs: {},
    },
    initialAttributes: { material: ['silk'] },
  });
  assert.equal(JSON.stringify(dirtyMount.getValues().material), JSON.stringify(['linen']));
  dirtyMount.applyServerSnapshot({ material: ['silk'] }, { onlyClean: true });
  assert.equal(JSON.stringify(dirtyMount.getValues().material), JSON.stringify(['linen']));
  assert.equal(dirtyMount.hasDirty(), true);
  assert.ok(dirtyMount.getEditRevision() >= rev0);
  pass('E2-C02-stale-snapshot-preserves-dirty');
}

// --- E2-C04: derive field ids from registry; id≠storage; deferred stays non-writable ---
{
  const fixture = JSON.parse(JSON.stringify(registry));
  const root = fixture.registry || fixture;
  root.fields.e2aTestAttr = {
    labelAr: 'حقل اختبار E2أ',
    type: 'text',
    storage: 'attributes.e2aTestKey',
    currentStatus: 'ATTRIBUTES_JSON',
    editable: true,
  };
  root.fields.e2aDeferredAttr = {
    labelAr: 'مؤجل',
    type: 'text',
    storage: 'attributes.e2aDeferredKey',
    currentStatus: 'PROPOSED',
    editable: true,
  };
  const clothes = (root.profiles || []).find((p: any) => p.id === 'product.clothes');
  clothes.fields.push('e2aTestAttr', 'e2aDeferredAttr');

  const ids = M.attrFieldIdsFromRegistry(fixture);
  assert.ok(ids.includes('e2aTestAttr'), 'test field derived without FLAT list');
  assert.ok(!ids.includes('e2aDeferredAttr'), 'deferred not writable extract id');

  const extracted = M.extractAttributesFromValues(
    { e2aTestAttr: 'hello', attributes: { material: ['silk'] } },
    fixture,
  );
  assert.equal(extracted.e2aTestKey, 'hello');
  assert.deepEqual(extracted.material, ['silk']);

  assert.equal(M.classifyField(Object.assign({ id: 'e2aDeferredAttr' }, root.fields.e2aDeferredAttr)), 'deferred');
  const defs = M.attributeFieldDefsForProfile(fixture, 'product.clothes');
  assert.ok(defs.some((d: any) => d.id === 'e2aTestAttr'));
  assert.ok(!defs.some((d: any) => d.id === 'e2aDeferredAttr'));
  pass('E2-C04-registry-derived-storage-key-deferred');
}

{
  // Independent mounts must not share editor/parked state
  sandbox.document = makeDom().document;
  const a = M.mount(makeDom().host, {
    registry,
    profileId: 'product.clothes',
    mountId: 'card-1',
    preserveState: {
      values: {},
      parked: { occasion: ['work'] },
      parkedDirty: { occasion: true },
      dirty: {},
      cleared: {},
    },
  });
  const b = M.mount(makeDom().host, {
    registry,
    profileId: 'product.clothes',
    mountId: 'card-2',
    initialAttributes: {},
  });
  assert.deepEqual(a.getValues().occasion, ['work']);
  assert.equal(b.getValues().occasion, undefined);
  assert.equal(b.getParkedKeys().length, 0);
  pass('E2-C01-card-isolation');
}

console.log('registry-attribute-fields.schema-tests: PASS');
