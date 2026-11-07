import assert from 'node:assert/strict';
import { mergeAttributesPatch } from './attributes-patch.merge';

function pass(name: string) {
  console.log(`PASS ${name}`);
}

{
  const r = mergeAttributesPatch(
    { material: ['silk', 'cotton'], dimensionsCm: { w: 40, h: 100 } },
    { dimensionsCm: { w: 45 } },
  );
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.deepEqual(r.value, {
      material: ['silk', 'cotton'],
      dimensionsCm: { w: 45, h: 100 },
    });
  }
  pass('A-merge-partial-dimension');
}

{
  const r = mergeAttributesPatch(
    { material: ['silk', 'cotton'], cut: 'abaya' },
    { material: ['linen'] },
  );
  assert.equal(r.ok, true);
  if (r.ok) assert.deepEqual(r.value, { material: ['linen'], cut: 'abaya' });
  pass('A-merge-array-replace');
}

{
  const cur = { material: ['silk'], dimensionsCm: { w: 1, h: 2 } };
  const r = mergeAttributesPatch(cur, {});
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.unchanged, true);
    assert.deepEqual(r.value, cur);
  }
  pass('A-merge-empty-keeps');
}

{
  const r = mergeAttributesPatch({ material: ['silk'] }, null);
  assert.equal(r.ok, false);
  pass('A-merge-null-bag-forbidden');
}

{
  const r = mergeAttributesPatch({ material: ['silk'], cut: 'a' }, { cut: null });
  assert.equal(r.ok, true);
  if (r.ok) assert.deepEqual(r.value, { material: ['silk'] });
  pass('A-merge-key-null-clears');
}

{
  const r = mergeAttributesPatch({ dimensionsCm: { w: 1, h: 2 } }, { dimensionsCm: { w: null } });
  assert.equal(r.ok, false);
  pass('A-merge-nested-null-rejects');
}

{
  const r = mergeAttributesPatch({ a: 1 }, ['x'] as unknown);
  assert.equal(r.ok, false);
  pass('A-merge-array-bag-rejects');
}

console.log('attributes-patch.merge.schema-tests: PASS');
