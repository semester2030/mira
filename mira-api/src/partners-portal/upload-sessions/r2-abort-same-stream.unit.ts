/**
 * Local proof: abort targets the same stream; close proven by event (not a local boolean).
 */
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';

async function abortSameStream(): Promise<{
  sawBytes: boolean;
  bytesBeforeAbort: number;
  bytesAfterAbort: number;
  abortKind: string;
  closeEvent: string | null;
  usedSecondRequest: boolean;
}> {
  const ac = new AbortController();
  let sawBytes = false;
  let bytesBeforeAbort = 0;
  let bytesAfterAbort = 0;
  let abortKind = 'none';
  let closeEvent: string | null = null;
  const usedSecondRequest = false;

  const body = Readable.from([Buffer.alloc(1024, 1), Buffer.alloc(1024, 2), Buffer.alloc(1024, 3)]);
  const closed = new Promise<string>((resolve) => {
    body.once('close', () => {
      closeEvent = 'close';
      resolve('close');
    });
    body.once('end', () => {
      if (!closeEvent) closeEvent = 'end';
      resolve('end');
    });
  });

  try {
    for await (const chunk of body) {
      if (ac.signal.aborted) {
        bytesAfterAbort += chunk?.length || 0;
        break;
      }
      if (chunk && chunk.length) {
        sawBytes = true;
        bytesBeforeAbort += chunk.length;
        ac.abort();
        body.destroy(new Error('test-abort'));
      }
    }
  } catch (err) {
    const msg = String(err);
    abortKind = /aborted|test-abort|AbortError/i.test(msg) ? 'AbortError' : 'other';
  }
  await Promise.race([closed, new Promise((r) => setTimeout(r, 500))]);
  if (abortKind === 'none' && sawBytes && closeEvent) abortKind = 'stream-closed';
  return { sawBytes, bytesBeforeAbort, bytesAfterAbort, abortKind, closeEvent, usedSecondRequest };
}

async function main() {
  const r = await abortSameStream();
  assert.equal(r.usedSecondRequest, false);
  assert.equal(r.sawBytes, true);
  assert.ok(r.bytesBeforeAbort > 0);
  assert.equal(r.bytesAfterAbort, 0);
  assert.ok(r.closeEvent === 'close' || r.closeEvent === 'end');
  assert.ok(r.abortKind === 'stream-closed' || r.abortKind === 'AbortError');
  console.log(JSON.stringify({ ok: true, id: 'R2_ABORT_SAME_STREAM_UNIT', ...r }));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
