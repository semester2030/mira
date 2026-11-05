/**
 * Local proof that abort acceptance requires storage Body close — not abort() alone.
 * Run: npx tsx src/marketplace/media-abort-storage-probe.unit.ts
 */
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import {
  clearMediaUpstreamAborts,
  mediaStorageAbortSeen,
  mediaUpstreamAbortSeen,
  noteMediaClientDisconnect,
  noteMediaStorageReadClosed,
  takeMediaUpstreamAbort,
} from './catalog-media-abort-probe';
import { judgeAbortRead } from '../partners-portal/upload-sessions/r2-acceptance-gate';

clearMediaUpstreamAborts();

{
  // Positive: storage adapter recorded Body destroy due to abort.
  noteMediaStorageReadClosed('req-ok', 'media-1');
  assert.equal(mediaStorageAbortSeen('req-ok'), true);
  assert.equal(mediaUpstreamAbortSeen('req-ok'), true);
  takeMediaUpstreamAbort('req-ok');
  assert.equal(mediaStorageAbortSeen('req-ok'), false);
}

{
  // Negative: client disconnect / abort() alone must NOT satisfy the probe.
  noteMediaClientDisconnect('req-client', 'media-2');
  assert.equal(mediaUpstreamAbortSeen('req-client'), false);
  const judge = judgeAbortRead({
    responseStatus: 200,
    receivedBytes: 64,
    expectedTotalBytes: 10_000,
    abortedBeforeEof: true,
    upstreamClosedForRequestId: mediaUpstreamAbortSeen('req-client'),
    followUpFullOk: true,
  });
  assert.equal(judge.ok, false);
  assert.equal(judge.reason, 'upstream-close-unproven');
}

{
  // Negative integration-style: slow readable ignores abort signal — no storage note.
  clearMediaUpstreamAborts();
  const reqId = 'req-slow';
  let destroyed = false;
  const slow = new Readable({
    read() {
      /* stays open until destroy */
    },
    destroy(err, cb) {
      destroyed = true;
      // Deliberately do NOT call noteMediaStorageReadClosed — simulates stuck upstream.
      cb(err || null);
    },
  });
  const ac = new AbortController();
  ac.signal.addEventListener('abort', () => {
    // Bug-shaped handler: mark client abort but leave storage body "open" (no probe note).
    noteMediaClientDisconnect(reqId, 'media-slow');
  });
  ac.abort();
  assert.equal(destroyed, false, 'body still open');
  assert.equal(mediaUpstreamAbortSeen(reqId), false);
  const judge = judgeAbortRead({
    responseStatus: 200,
    receivedBytes: 100,
    expectedTotalBytes: 5_000_000,
    abortedBeforeEof: true,
    upstreamClosedForRequestId: mediaUpstreamAbortSeen(reqId),
    followUpFullOk: true,
  });
  assert.equal(judge.ok, false);
  assert.equal(judge.reason, 'upstream-close-unproven');
  slow.destroy();
}

{
  // Positive path after real storage note.
  clearMediaUpstreamAborts();
  noteMediaStorageReadClosed('req-real', 'media-3');
  const judge = judgeAbortRead({
    responseStatus: 200,
    receivedBytes: 128,
    expectedTotalBytes: 5_000_000,
    abortedBeforeEof: true,
    upstreamClosedForRequestId: mediaUpstreamAbortSeen('req-real'),
    followUpFullOk: true,
  });
  assert.equal(judge.ok, true);
}

console.log(JSON.stringify({ ok: true, id: 'MEDIA_ABORT_STORAGE_PROBE_UNIT' }));
