// Usage: node tools/check-deployed.mjs portal-visible-categories.json flutter-visible-categories.json
// Supply arrays of {id,imageKey,icon:{key,version,smallUrl,largeUrl}} captured
// on each actual surface in the same environment, covering these icons.
// Does NOT create evidence of a UI tap/session. Keep those captures separately.
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const [p,a]=process.argv.slice(2); if(!p||!a)throw Error('Two real category captures required');
const load=async x=>JSON.parse(await readFile(x));
const manifest=await load(new URL('../manifest.json',import.meta.url));
const [portal,app]=await Promise.all([load(p),load(a)]);
for(const e of manifest.items){
  const ids=[];
  for(const surface of [portal,app]){
    const rows=surface.filter(r=>r.imageKey===e.imageKey);
    assert(rows.length>0,'Missing '+e.imageKey);
    assert(rows.every(r=>typeof r.id==='string'&&r.id.length>0));
    ids.push(rows.map(r=>r.id).sort());
    for(const row of rows){
      assert.equal(row.icon.key,e.imageKey);assert.equal(row.icon.version,e.files['640'].sha256);
      for(const [size,k] of [[160,'smallUrl'],[640,'largeUrl']]){
        const url=new URL(row.icon[k]);assert.equal(url.protocol,'https:');
        const res=await fetch(url,{signal:AbortSignal.timeout(10000)});
        assert.equal(res.status,200); assert.match(res.headers.get('content-type')||'',/^image\/webp/i);
        assert.equal(createHash('sha256').update(Buffer.from(await res.arrayBuffer())).digest('hex'),e.files[size].sha256);
      }
    }
  }
  assert.deepEqual(ids[0],ids[1],'category mismatch '+e.imageKey);
}
console.log('PASS: captured mappings and remote image bytes match; confirm navigation separately.');
