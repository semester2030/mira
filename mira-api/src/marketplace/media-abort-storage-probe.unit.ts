/**
 * Local proof that abort acceptance requires storage Body close — not destroy()/abort() alone.
 * Runs through LocalCatalogMediaStorage.open (real adapter), not Boolean injection into the judge.
 *
 * Run: npx tsx src/marketplace/media-abort-storage-probe.unit.ts
 */
import assert from 'node:assert/strict';
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { tmpdir } from 'node:os';
import { ConfigService } from '@nestjs/config';
import {
  clearMediaUpstreamAborts,
  mediaAbortProbeSizes,
  mediaStorageAbortRequested,
  mediaStorageAbortSeen,
  mediaUpstreamAbortSeen,
  noteMediaClientDisconnect,
  noteMediaStorageAbortRequested,
  noteMediaStorageReadClosed,
  takeMediaUpstreamAbort,
  waitMediaStorageAbortClosed,
} from './catalog-media-abort-probe';
import { LocalCatalogMediaStorage } from './catalog-media.storage';
import { judgeAbortRead } from '../partners-portal/upload-sessions/r2-acceptance-gate';

async function main() {
  const root = join(tmpdir(), `mira-abort-probe-${process.pid}`);
  mkdirSync(root, { recursive: true });
  process.env.MIRA_MEDIA_DIR = root;
  process.env.NODE_ENV = 'test';

  const storage = new LocalCatalogMediaStorage({
    get: (k: string) => (k === 'MIRA_MEDIA_DIR' ? root : undefined),
  } as unknown as ConfigService);

  clearMediaUpstreamAborts();

  {
    noteMediaStorageReadClosed('req-no-prior', 'm');
    assert.equal(mediaStorageAbortSeen('req-no-prior'), false);
  }

  {
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
    clearMediaUpstreamAborts();
    const key = 'abort-slow.bin';
    // Larger than LocalCatalogMediaStorage highWaterMark (1MiB) so first chunk is partial.
    const payload = Buffer.alloc(3 * 1024 * 1024, 7);
    await storage.put(key, payload);
    const ac = new AbortController();
    const opened = await storage.open(key, {
      signal: ac.signal,
      abortRequestId: 'req-adapter-ok',
      mediaId: 'media-slow',
    });
    assert.ok(opened && opened.body);
    assert.ok(opened && 'body' in opened && opened.body);
    const body = opened.body as Readable;
    body.on('error', () => {
      /* abort destroy emits AbortError — expected */
    });
    let received = 0;
    body.on('data', (c: Buffer) => {
      received += c.length;
      // Pause so a single large chunk cannot complete EOF before abort.
      body.pause();
      if (!ac.signal.aborted) ac.abort();
    });
    await new Promise<void>((resolve) => body.once('close', () => resolve()));
    const closed = await waitMediaStorageAbortClosed('req-adapter-ok', 2000);
    assert.equal(closed, true, 'storage close must be observed after abort');
    assert.ok(received > 0 && received < payload.length, `partial then abort got=${received}`);
    const judge = judgeAbortRead({
      responseStatus: 200,
      receivedBytes: received,
      expectedTotalBytes: payload.length,
      abortedBeforeEof: true,
      upstreamClosedForRequestId: mediaUpstreamAbortSeen('req-adapter-ok'),
      followUpFullOk: true,
    });
    assert.equal(judge.ok, true);
    takeMediaUpstreamAbort('req-adapter-ok');
  }

  {
    clearMediaUpstreamAborts();
    const reqId = 'req-stuck';
    noteMediaStorageAbortRequested(reqId, 'media-stuck');
    assert.equal(mediaStorageAbortRequested(reqId), true);
    assert.equal(mediaStorageAbortSeen(reqId), false);
    const closed = await waitMediaStorageAbortClosed(reqId, 150);
    assert.equal(closed, false);
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
  }

  {
    clearMediaUpstreamAborts();
    const key = 'abort-eof.bin';
    const payload = Buffer.from('hello-eof-natural');
    await storage.put(key, payload);
    const opened = await storage.open(key, {
      abortRequestId: 'req-eof',
      mediaId: 'media-eof',
    });
    assert.ok(opened && 'body' in opened && opened.body);
    const chunks: Buffer[] = [];
    for await (const c of opened.body as Readable) chunks.push(c as Buffer);
    await new Promise((r) => setTimeout(r, 50));
    assert.equal(Buffer.concat(chunks).equals(payload), true);
    assert.equal(mediaStorageAbortSeen('req-eof'), false, 'EOF must not count as abort');
    assert.equal(mediaStorageAbortRequested('req-eof'), false);
  }

  {
    clearMediaUpstreamAborts();
    const reqId = 'req-delay';
    noteMediaStorageAbortRequested(reqId, 'm');
    assert.equal(mediaStorageAbortSeen(reqId), false);
    noteMediaStorageReadClosed(reqId, 'm');
    assert.equal(mediaStorageAbortSeen(reqId), true);
    takeMediaUpstreamAbort(reqId);
  }

  {
    clearMediaUpstreamAborts();
    const key = 'abort-follow.bin';
    const payload = Buffer.alloc(32_000, 9);
    await storage.put(key, payload);
    const ac = new AbortController();
    const first = await storage.open(key, {
      signal: ac.signal,
      abortRequestId: 'req-follow-abort',
      mediaId: 'media-follow',
    });
    assert.ok(first && 'body' in first && first.body);
    const firstBody = first.body as Readable;
    firstBody.on('error', () => {
      /* expected on abort */
    });
    let got = 0;
    firstBody.on('data', (c: Buffer) => {
      got += c.length;
      firstBody.pause();
      if (!ac.signal.aborted) ac.abort();
    });
    await new Promise<void>((resolve) => firstBody.once('close', () => resolve()));
    assert.equal(await waitMediaStorageAbortClosed('req-follow-abort', 2000), true);
    takeMediaUpstreamAbort('req-follow-abort');
    const second = await storage.open(key, { abortRequestId: 'req-follow-full', mediaId: 'media-follow' });
    assert.ok(second && 'body' in second && second.body);
    const full: Buffer[] = [];
    for await (const c of second.body as Readable) full.push(c as Buffer);
    assert.equal(Buffer.concat(full).length, payload.length);
    assert.equal(mediaStorageAbortSeen('req-follow-full'), false);
  }

  {
    clearMediaUpstreamAborts();
    for (let i = 0; i < 100; i += 1) {
      noteMediaStorageAbortRequested(`flood-${i}`, 'm');
      noteMediaStorageReadClosed(`flood-${i}`, 'm');
    }
    const sizes = mediaAbortProbeSizes();
    assert.ok(sizes.closed <= sizes.maxEntries, `closed=${sizes.closed}`);
    clearMediaUpstreamAborts();
    assert.deepEqual(mediaAbortProbeSizes(), {
      closed: 0,
      requested: 0,
      client: 0,
      maxEntries: sizes.maxEntries,
    });
  }

  rmSync(root, { recursive: true, force: true });
  console.log(JSON.stringify({ ok: true, id: 'MEDIA_ABORT_STORAGE_PROBE_UNIT' }));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
