import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {iconIndex,withCatalogImage} from '../integration/catalog-images.mjs';
const root=new URL('../',import.meta.url),m=JSON.parse(await readFile(new URL('manifest.json',root)));
const index=iconIndex(m); const base='https://assets.example.invalid/icons/';
for (const e of m.items) {
  const c={id:e.knownCategoryId || 'test-id-'+e.imageKey,nameAr:e.labelAr,imageKey:e.imageKey};
  const r=withCatalogImage(c,index,base);
  assert.equal(r.id,c.id);assert.equal(r.icon.key,c.imageKey);
  assert.equal(r.icon.smallUrl,base+e.files['160'].path);
  assert.equal(r.icon.largeUrl,base+e.files['640'].path);
}
assert.throws(()=>withCatalogImage({imageKey:'missing'},index,base));
assert.throws(()=>iconIndex({items:[m.items[0],m.items[0]]}));
console.log('OK: local response contract; unknown and duplicate keys rejected.');
