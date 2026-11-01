import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { playbackContentType, sliceMediaRange } from './catalog-media.http';
import { planMediaStream } from './catalog-media.stream';
import { MemoryCatalogMediaStorage } from './catalog-media.storage';

async function main() {
  assert.deepEqual(sliceMediaRange(100, 'bytes=0-0'), {
    status: 206,
    start: 0,
    end: 0,
    total: 100,
  });

  const plan = planMediaStream(1000, 'bytes=100-199');
  assert.equal(plan.status, 206);
  if (plan.status !== 206) throw new Error('expected 206');
  assert.equal(plan.contentLength, 100);
  assert.equal(plan.contentRange, 'bytes 100-199/1000');

  const invalid = planMediaStream(10, 'bytes=99-200');
  assert.equal(invalid.status, 416);

  const mem = new MemoryCatalogMediaStorage();
  const payload = Buffer.alloc(64, 7);
  payload.write('ftyp', 4);
  payload.write('isom', 8);
  await mem.put('clip', payload);

  const full = await mem.open('clip');
  assert.ok(full && full.status === 200);
  assert.equal(full!.contentLength, 64);

  const ranged = await mem.open('clip', { rangeHeader: 'bytes=0-11' });
  assert.ok(ranged && ranged.status === 206);
  assert.equal(ranged!.contentLength, 12);
  assert.ok(Buffer.isBuffer(ranged!.body));
  assert.equal(playbackContentType(ranged!.body as Buffer, 'video/mp4'), 'video/mp4');

  const missing = await mem.open('nope');
  assert.equal(missing, null);

  const ac = new AbortController();
  ac.abort();
  await assert.rejects(() => mem.open('clip', { signal: ac.signal }));

  const streamBody = Readable.from(Buffer.from('abc'));
  assert.equal(typeof streamBody.pipe, 'function');

  console.log('catalog-media-recovery schema tests: ok');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
