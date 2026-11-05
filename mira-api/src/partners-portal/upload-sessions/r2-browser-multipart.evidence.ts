/**
 * V03 / U01_R2 — real isolated R2 multipart from a controlled browser origin (Playwright).
 *
 * Required env (values never printed):
 *   MIRA_MEDIA_STORE=s3
 *   MIRA_MEDIA_S3_BUCKET
 *   MIRA_MEDIA_S3_ACCESS_KEY_ID
 *   MIRA_MEDIA_S3_SECRET_ACCESS_KEY
 *   MIRA_MEDIA_S3_ENDPOINT
 *   MIRA_MEDIA_S3_REGION
 *   MIRA_MEDIA_S3_TIMEOUT_MS
 *   MIRA_R2_TEST_PREFIX (optional)
 *
 * Run:
 *   npx tsx src/partners-portal/upload-sessions/r2-browser-multipart.evidence.ts
 *
 * Exit 0 + blocked=true when env incomplete (NOT a PASS).
 * Exit 0 + ok=true on full PASS.
 * Exit 1 when credentials present but suite fails.
 */
import { execSync } from 'node:child_process';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListPartsCommand,
  S3Client,
  UploadPartCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  judgeAbortRead,
  judgeBindResult,
  judgeFullRead,
  judgeR2Acceptance,
  judgeRangeResponse,
  mediaIdFromSessionBody,
  REQUIRED_MIRA_STEPS,
} from './r2-acceptance-gate';

const outDir =
  process.env.MIRA_P21_OUT_DIR || join(process.cwd(), '..', 'audit-out', 'p2-1-p2-2', 'logs', 'r2-v03');
mkdirSync(outDir, { recursive: true });

type Step = { id: string; ok: boolean | 'BLOCKED'; detail?: unknown };
const steps: Step[] = [];
function record(id: string, ok: Step['ok'], detail?: unknown) {
  steps.push({ id, ok, detail });
  console.log(JSON.stringify({ id, ok, detail: detail && typeof detail === 'object' ? summarize(detail) : detail }));
}

function summarize(d: unknown) {
  try {
    return JSON.parse(
      JSON.stringify(d, (_k, v) => {
        if (typeof v === 'string' && (v.startsWith('http') || v.length > 120)) return `[redacted:${v.length}]`;
        return v;
      }),
    );
  } catch {
    return { note: 'unserializable' };
  }
}

function envPresent(name: string): boolean {
  return (process.env[name] || '').trim().length > 0;
}

function requiredEnvNames() {
  return [
    'MIRA_MEDIA_STORE',
    'MIRA_MEDIA_S3_BUCKET',
    'MIRA_MEDIA_S3_ACCESS_KEY_ID',
    'MIRA_MEDIA_S3_SECRET_ACCESS_KEY',
    'MIRA_MEDIA_S3_ENDPOINT',
    'MIRA_MEDIA_S3_REGION',
    'MIRA_MEDIA_S3_TIMEOUT_MS',
  ];
}

function sha256(buf: Buffer) {
  return createHash('sha256').update(buf).digest('hex');
}

async function streamToBuffer(body: unknown): Promise<Buffer> {
  if (!body) return Buffer.alloc(0);
  if (Buffer.isBuffer(body)) return body;
  if (body instanceof Uint8Array) return Buffer.from(body);
  const anyBody = body as { transformToByteArray?: () => Promise<Uint8Array> };
  if (typeof anyBody.transformToByteArray === 'function') {
    return Buffer.from(await anyBody.transformToByteArray());
  }
  const chunks: Buffer[] = [];
  for await (const chunk of body as AsyncIterable<Uint8Array>) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

function isNoSuchUpload(err: unknown): boolean {
  const e = err as { name?: string; Code?: string; $metadata?: { httpStatusCode?: number } };
  const name = String(e?.name || e?.Code || '');
  return name === 'NoSuchUpload' || name === 'NotFound' || e?.$metadata?.httpStatusCode === 404;
}

async function main() {
  const startedUtc = new Date().toISOString();
  const commit =
    (process.env.MIRA_P21_COMMIT || process.env.MIRA_TEST_COMMIT || '').trim() ||
    (() => {
      try {
        return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
      } catch {
        return '';
      }
    })();
  if (!commit || commit.toLowerCase() === 'unknown') {
    const summary = {
      ok: false,
      blocked: false,
      id: 'V03_R2_BROWSER',
      reason: 'tested commit missing — refuse unknown evidence',
      commit: commit || '',
      startedUtc,
      finishedUtc: new Date().toISOString(),
      steps,
      outDir,
    };
    writeFileSync(join(outDir, 'r2-browser-multipart.json'), JSON.stringify(summary, null, 2));
    console.log(JSON.stringify({ ok: false, reason: 'commit-missing', outDir }));
    process.exit(1);
  }
  const missing = requiredEnvNames().filter((n) => !envPresent(n));
  const store = (process.env.MIRA_MEDIA_STORE || '').trim().toLowerCase();
  if (store !== 's3' || missing.length) {
    const summary = {
      ok: false,
      blocked: true,
      id: 'V03_R2_BROWSER',
      reason: 'isolated R2 test credentials/env incomplete — suite did not start',
      commit,
      requiredEnvNames: requiredEnvNames(),
      missingEnvNames: store !== 's3' ? ['MIRA_MEDIA_STORE(=s3)', ...missing] : missing,
      presentEnvNames: requiredEnvNames().filter((n) => envPresent(n)),
      command:
        'MIRA_MEDIA_STORE=s3 MIRA_MEDIA_S3_BUCKET=… MIRA_MEDIA_S3_ACCESS_KEY_ID=… MIRA_MEDIA_S3_SECRET_ACCESS_KEY=… MIRA_MEDIA_S3_ENDPOINT=… MIRA_MEDIA_S3_REGION=auto MIRA_MEDIA_S3_TIMEOUT_MS=30000 npx tsx src/partners-portal/upload-sessions/r2-browser-multipart.evidence.ts',
      startedUtc,
      finishedUtc: new Date().toISOString(),
      runId: process.env.MIRA_P21_RUN_ID || process.env.MIRA_TEST_RUN_ID || undefined,
      steps: [
        { id: 'ENV', ok: 'BLOCKED' as const },
        { id: 'R2_MIRA_APP_PATH', ok: 'BLOCKED' as const },
      ],
    };
    writeFileSync(join(outDir, 'r2-browser-multipart.json'), JSON.stringify(summary, null, 2));
    console.log(JSON.stringify({ ok: false, blocked: true, outDir, missingEnvNames: summary.missingEnvNames }));
    process.exit(0);
  }

  const bucket = process.env.MIRA_MEDIA_S3_BUCKET!.trim();
  const prefix = (process.env.MIRA_R2_TEST_PREFIX || 'mira-p21-v03-test/').replace(/^\/+/, '');
  const objectKey = `${prefix}${randomUUID()}.bin`;
  const partSize = Math.max(5 * 1024 * 1024, Number(process.env.MIRA_R2_TEST_PART_SIZE_BYTES || 5 * 1024 * 1024));
  const totalParts = 2;
  const fileBytes = Buffer.concat([randomBytes(partSize), randomBytes(Math.floor(partSize / 3))]);
  const fileSha = sha256(fileBytes);

  const client = new S3Client({
    region: process.env.MIRA_MEDIA_S3_REGION!.trim(),
    endpoint: process.env.MIRA_MEDIA_S3_ENDPOINT!.trim(),
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.MIRA_MEDIA_S3_ACCESS_KEY_ID!.trim(),
      secretAccessKey: process.env.MIRA_MEDIA_S3_SECRET_ACCESS_KEY!.trim(),
    },
  });

  // Controlled origin — never pretend setContent origin equals required origin.
  const originServer = createServer((_req, res) => {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end('<!doctype html><html><body data-testid="r2-origin">mira-r2-test</body></html>');
  });
  const originPort: number = await new Promise((resolve) => {
    originServer.listen(0, '127.0.0.1', () => {
      const a = originServer.address();
      resolve(typeof a === 'object' && a ? a.port : 0);
    });
  });
  const expectedOrigin = `http://127.0.0.1:${originPort}`;

  let uploadId: string | undefined;
  let completed = false;
  const createdKeys: string[] = [objectKey];
  const abortUploadIds: Array<{ key: string; uploadId: string }> = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let browser: any = null;

  try {
    const created = await client.send(
      new CreateMultipartUploadCommand({
        Bucket: bucket,
        Key: objectKey,
        ContentType: 'application/octet-stream',
      }),
    );
    uploadId = created.UploadId;
    if (!uploadId) throw new Error('multipart create missing UploadId');
    record('R2_CREATE_MULTIPART', true, { objectKeySuffix: objectKey.slice(-24), parts: totalParts, partSize });

    const { chromium } = await import('playwright');
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();
    const nav = await page.goto(expectedOrigin, { waitUntil: 'domcontentloaded', timeout: 15000 });
    if (!nav || !nav.ok()) throw new Error(`origin navigate failed status=${nav && nav.status()}`);
    const actualOrigin = await page.evaluate(() => window.location.origin);
    if (actualOrigin !== expectedOrigin) {
      throw new Error(`origin mismatch expected=${expectedOrigin} actual=${actualOrigin}`);
    }
    record('R2_ORIGIN', true, { expectedOrigin, actualOrigin });

    const etags: string[] = [];
    for (let partNumber = 1; partNumber <= totalParts; partNumber++) {
      const start = (partNumber - 1) * partSize;
      const end = Math.min(fileBytes.length, start + partSize);
      const chunk = fileBytes.subarray(start, end);
      const command = new UploadPartCommand({
        Bucket: bucket,
        Key: objectKey,
        UploadId: uploadId!,
        PartNumber: partNumber,
      });
      const url = await getSignedUrl(client, command, { expiresIn: 900 });
      const put = await page.evaluate(
        async ({ putUrl, bytes }: { putUrl: string; bytes: number[] }) => {
          const body = Uint8Array.from(bytes);
          const res = await fetch(putUrl, {
            method: 'PUT',
            body,
            mode: 'cors',
            credentials: 'omit',
            headers: { 'content-type': 'application/octet-stream' },
          });
          const etag = res.headers.get('etag') || res.headers.get('ETag');
          return {
            status: res.status,
            ok: res.ok,
            etag,
            etagReadable: typeof etag === 'string' && etag.length > 0,
            pageOrigin: window.location.origin,
          };
        },
        { putUrl: url, bytes: Array.from(chunk) },
      );
      if (put.pageOrigin !== expectedOrigin) {
        throw new Error(`PUT evaluated under wrong origin ${put.pageOrigin}`);
      }
      if (!put.ok || !put.etagReadable) {
        record('R2_BROWSER_PUT_PART', false, { partNumber, put });
        throw new Error(`browser PUT part ${partNumber} failed or ETag not CORS-readable`);
      }
      etags.push(put.etag!);
      record('R2_BROWSER_PUT_PART', true, { partNumber, status: put.status, etagReadable: true, size: chunk.length });
    }

    await client.send(
      new CompleteMultipartUploadCommand({
        Bucket: bucket,
        Key: objectKey,
        UploadId: uploadId!,
        MultipartUpload: {
          Parts: etags.map((etag, i) => ({ ETag: etag, PartNumber: i + 1 })),
        },
      }),
    );
    completed = true;
    uploadId = undefined;
    const head = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: objectKey }));
    const headOk = Number(head.ContentLength) === fileBytes.length;
    record('R2_COMPLETE_HEAD', headOk, {
      contentLength: head.ContentLength,
      expected: fileBytes.length,
      etagPresent: !!head.ETag,
    });
    if (!headOk) throw new Error('head size mismatch');

    const full = await client.send(new GetObjectCommand({ Bucket: bucket, Key: objectKey }));
    const fullBuf = await streamToBuffer(full.Body);
    const fullOk = fullBuf.length === fileBytes.length && sha256(fullBuf) === fileSha;
    record('R2_FULL_READ', fullOk, { bytes: fullBuf.length, shaMatch: sha256(fullBuf) === fileSha });
    if (!fullOk) throw new Error('full read mismatch');

    const midStart = Math.floor(fileBytes.length / 3);
    const midEnd = midStart + 1024 - 1;
    const ranged = await client.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: objectKey,
        Range: `bytes=${midStart}-${midEnd}`,
      }),
    );
    const rangeBuf = await streamToBuffer(ranged.Body);
    const expectedSlice = fileBytes.subarray(midStart, midEnd + 1);
    const rangeOk =
      ranged.$metadata.httpStatusCode === 206 &&
      rangeBuf.length === expectedSlice.length &&
      rangeBuf.equals(expectedSlice);
    record('R2_RANGE_READ', rangeOk, {
      status: ranged.$metadata.httpStatusCode,
      got: rangeBuf.length,
      expected: expectedSlice.length,
      bytesMatch: rangeBuf.equals(expectedSlice),
    });
    if (!rangeOk) throw new Error('range read mismatch');

    // Abort the SAME GetObject stream after real bytes — never a second request.
    // streamClosed is proven only via close/end/destroyed events (not a local flag assignment).
    {
      const ac = new AbortController();
      let sawBytes = false;
      let bytesBeforeAbort = 0;
      let bytesAfterAbort = 0;
      let abortKind: 'AbortError' | 'stream-closed' | 'other' | 'none' = 'none';
      let closeEvent: string | null = null;
      try {
        const out = await client.send(new GetObjectCommand({ Bucket: bucket, Key: objectKey }), {
          abortSignal: ac.signal as never,
        });
        const body = out.Body as AsyncIterable<Uint8Array> & {
          destroy?: (err?: Error) => void;
          destroyed?: boolean;
          on?: (ev: string, cb: (...args: unknown[]) => void) => void;
          once?: (ev: string, cb: (...args: unknown[]) => void) => void;
        };
        const closed = new Promise<string>((resolve) => {
          const done = (ev: string) => {
            if (!closeEvent) closeEvent = ev;
            resolve(ev);
          };
          if (typeof body.once === 'function') {
            body.once('close', () => done('close'));
            body.once('end', () => done('end'));
            body.once('error', () => done('error'));
          } else if (typeof body.on === 'function') {
            body.on('close', () => done('close'));
            body.on('end', () => done('end'));
            body.on('error', () => done('error'));
          } else {
            // Fallback: destroyed property after destroy()
            const poll = setInterval(() => {
              if (body.destroyed) {
                clearInterval(poll);
                done('destroyed');
              }
            }, 10);
            setTimeout(() => {
              clearInterval(poll);
              if (!closeEvent) done('timeout');
            }, 3000);
          }
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
              if (typeof body.destroy === 'function') {
                body.destroy(new Error('test-abort'));
              }
            }
          }
        } catch (err) {
          const name = String((err as { name?: string })?.name || '');
          const msg = String(err);
          if (name === 'AbortError' || /aborted|AbortError|test-abort/i.test(msg)) {
            abortKind = 'AbortError';
          } else {
            abortKind = 'other';
          }
        }
        const closedHow = await Promise.race([
          closed,
          new Promise<string>((r) => setTimeout(() => r('timeout'), 3000)),
        ]);
        if (closeEvent == null) closeEvent = closedHow;
        if (abortKind === 'none' && sawBytes && ac.signal.aborted && closeEvent && closeEvent !== 'timeout') {
          abortKind = 'stream-closed';
        }
        if (closeEvent === 'timeout' || (closeEvent === 'error' && abortKind === 'other')) {
          // permission/network errors must not PASS as cancel
          if (abortKind !== 'AbortError') abortKind = 'other';
        }
      } catch (err) {
        const name = String((err as { name?: string })?.name || '');
        const http = (err as { $metadata?: { httpStatusCode?: number } })?.$metadata?.httpStatusCode;
        if (http === 403 || (http != null && http >= 500)) abortKind = 'other';
        else if (name === 'AbortError' || /aborted|AbortError/i.test(String(err))) {
          abortKind = sawBytes ? 'AbortError' : 'other';
        } else abortKind = 'other';
      }
      const streamClosedProven =
        !!closeEvent && closeEvent !== 'timeout' && ['close', 'end', 'destroyed', 'error'].includes(closeEvent);
      const abortOk =
        sawBytes &&
        bytesBeforeAbort > 0 &&
        bytesAfterAbort === 0 &&
        streamClosedProven &&
        (abortKind === 'AbortError' || abortKind === 'stream-closed') &&
        ac.signal.aborted;
      record('R2_ABORT_READ', abortOk, {
        sawBytes,
        bytesBeforeAbort,
        bytesAfterAbort,
        abortKind,
        closeEvent,
        streamClosedProven,
        abortedSignal: ac.signal.aborted,
        note: 'same stream; close proven by event — not a local boolean assignment',
      });
      if (!abortOk) throw new Error('abort-read expected same-stream cancel with proven close event');
    }

    // SDK connection check is separate from MIRA app path (labeled diagnostic).
    record('R2_SDK_DIAGNOSTIC', true, { note: 'SDK multipart/read/abort above is connection diagnostic' });
    await runMiraAppPathEvidence(record, expectedOrigin);

    // Incomplete multipart abort — only NoSuchUpload/empty list counts as cleaned.
    {
      const abortKey = `${prefix}abort-${randomUUID()}.bin`;
      createdKeys.push(abortKey);
      const createdAbort = await client.send(
        new CreateMultipartUploadCommand({
          Bucket: bucket,
          Key: abortKey,
          ContentType: 'application/octet-stream',
        }),
      );
      const abortId = createdAbort.UploadId!;
      abortUploadIds.push({ key: abortKey, uploadId: abortId });
      const signCmd = new UploadPartCommand({
        Bucket: bucket,
        Key: abortKey,
        UploadId: abortId,
        PartNumber: 1,
      });
      const putUrl = await getSignedUrl(client, signCmd, { expiresIn: 600 });
      const partBody = randomBytes(partSize);
      const putRes = await fetch(putUrl, { method: 'PUT', body: partBody });
      if (!putRes.ok) throw new Error(`abort-setup PUT HTTP ${putRes.status}`);
      const listedBefore = await client.send(
        new ListPartsCommand({ Bucket: bucket, Key: abortKey, UploadId: abortId }),
      );
      const partsBefore = listedBefore.Parts?.length || 0;
      await client.send(
        new AbortMultipartUploadCommand({ Bucket: bucket, Key: abortKey, UploadId: abortId }),
      );
      let listOutcome: 'gone' | 'empty' | 'error' = 'error';
      let httpStatus: number | null = null;
      try {
        const listedAfter = await client.send(
          new ListPartsCommand({ Bucket: bucket, Key: abortKey, UploadId: abortId }),
        );
        if ((listedAfter.Parts?.length || 0) === 0) listOutcome = 'empty';
        else listOutcome = 'error';
      } catch (err) {
        httpStatus = (err as { $metadata?: { httpStatusCode?: number } })?.$metadata?.httpStatusCode ?? null;
        if (isNoSuchUpload(err)) listOutcome = 'gone';
        else listOutcome = 'error';
      }
      // Empty parts list alone is insufficient — prove session gone via UploadPart → NoSuchUpload.
      let uploadPartProbe: 'gone' | 'error' | 'unexpected-ok' = 'error';
      try {
        await client.send(
          new UploadPartCommand({
            Bucket: bucket,
            Key: abortKey,
            UploadId: abortId,
            PartNumber: 2,
            Body: randomBytes(16),
          }),
        );
        uploadPartProbe = 'unexpected-ok';
      } catch (err) {
        const st = (err as { $metadata?: { httpStatusCode?: number } })?.$metadata?.httpStatusCode ?? null;
        if (isNoSuchUpload(err)) uploadPartProbe = 'gone';
        else if (st === 403 || (st != null && st >= 500)) uploadPartProbe = 'error';
        else uploadPartProbe = 'error';
      }
      const abortOk = partsBefore >= 1 && (listOutcome === 'gone' || uploadPartProbe === 'gone');
      record('R2_ABORT_UPLOAD', abortOk, {
        partsBefore,
        listOutcome,
        uploadPartProbe,
        httpStatus,
        note: 'session must be gone (NoSuchUpload); empty parts alone insufficient',
      });
      if (!abortOk) throw new Error('abort upload cleanup not proven (empty list / 403 / 5xx ≠ session gone)');
      abortUploadIds.pop();
    }

    record('R2_SUITE', true, { objectKeySuffix: objectKey.slice(-24), fileSha });
  } catch (e) {
    record('R2_SUITE', false, String((e as Error)?.stack || e));
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch {
        /* ignore */
      }
    }
    try {
      originServer.close();
    } catch {
      /* ignore */
    }
    const cleanup: Array<{ action: string; ok: boolean; detail?: string }> = [];
    for (const { key, uploadId: uid } of abortUploadIds) {
      try {
        await client.send(new AbortMultipartUploadCommand({ Bucket: bucket, Key: key, UploadId: uid }));
        cleanup.push({ action: 'abort', ok: true, detail: key.slice(-20) });
      } catch (err) {
        cleanup.push({
          action: 'abort',
          ok: isNoSuchUpload(err),
          detail: isNoSuchUpload(err) ? 'already-gone' : String(err).slice(0, 120),
        });
      }
    }
    if (uploadId && !completed) {
      try {
        await client.send(
          new AbortMultipartUploadCommand({ Bucket: bucket, Key: objectKey, UploadId: uploadId }),
        );
        cleanup.push({ action: 'abort-main', ok: true });
      } catch (err) {
        cleanup.push({ action: 'abort-main', ok: isNoSuchUpload(err), detail: String(err).slice(0, 80) });
      }
    }
    for (const key of createdKeys) {
      try {
        await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
        cleanup.push({ action: 'delete', ok: true, detail: key.slice(-20) });
      } catch (err) {
        cleanup.push({ action: 'delete', ok: false, detail: String(err).slice(0, 80) });
      }
    }
    record(
      'R2_CLEANUP',
      cleanup.length > 0 && cleanup.every((c) => c.ok),
      { cleanup },
    );
  }

  const verdict = judgeR2Acceptance(steps);
  const summary = {
    ok: verdict.ok,
    blocked: verdict.blocked,
    id: 'V03_R2_BROWSER',
    startedUtc,
    finishedUtc: new Date().toISOString(),
    commit,
    partSize,
    fileBytes: fileBytes.length,
    steps,
    outDir,
    requiredMiraSteps: REQUIRED_MIRA_STEPS,
    miraVerdict: verdict.detail,
  };
  writeFileSync(join(outDir, 'r2-browser-multipart.json'), JSON.stringify(summary, null, 2));
  console.log(
    JSON.stringify({
      ok: summary.ok,
      blocked: summary.blocked,
      failed: verdict.failed,
      miraVerdict: verdict.detail,
      outDir,
    }),
  );
  if (summary.blocked) process.exit(0);
  process.exit(summary.ok ? 0 : 1);
}

function afterResNotErrorDoc(buf: Buffer): boolean {
  if (!buf.length) return false;
  const head = buf.subarray(0, Math.min(32, buf.length)).toString('utf8');
  if (/^\s*(\{|\[|<html|<\!DOCTYPE)/i.test(head)) return false;
  return true;
}

async function runMiraAppPathEvidence(
  record: (id: string, ok: boolean | 'BLOCKED', detail?: unknown) => void,
  browserOrigin: string,
): Promise<void> {
  const base = (process.env.MIRA_R2_MIRA_BASE || '').trim().replace(/\/+$/, '');
  const token = (process.env.MIRA_R2_MIRA_PARTNER_TOKEN || '').trim();
  const ownerId = (process.env.MIRA_R2_MIRA_OWNER_ID || '').trim();
  const ownerKind = ((process.env.MIRA_R2_MIRA_OWNER_KIND || 'product').trim() as 'product' | 'service');
  const requiredEnv = ['MIRA_R2_MIRA_BASE', 'MIRA_R2_MIRA_PARTNER_TOKEN', 'MIRA_R2_MIRA_OWNER_ID'];

  if (!base) {
    record('R2_MIRA_APP_PATH', 'BLOCKED', {
      reason: 'set MIRA_R2_MIRA_BASE + partner token + owner to exercise upload-sessions→finalize→bind→read',
      requiredEnvNames: requiredEnv,
    });
    return;
  }

  // Base set but auth/owner incomplete → FAIL (not PASS, not silent skip).
  if (!token || !ownerId) {
    record('R2_MIRA_APP_PATH', false, {
      reason: 'MIRA_R2_MIRA_BASE set but partner token or owner id missing',
      requiredEnvNames: requiredEnv,
      hasToken: Boolean(token),
      hasOwnerId: Boolean(ownerId),
    });
    return;
  }

  let urlOk = false;
  try {
    const u = new URL(base);
    urlOk = u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    urlOk = false;
  }
  if (!urlOk) {
    record('R2_MIRA_APP_PATH', false, { reason: 'MIRA_R2_MIRA_BASE is not a valid http(s) URL', baseHost: '[redacted]' });
    return;
  }

  const auth = { Authorization: `Bearer ${token}`, 'content-type': 'application/json' };
  const clientMediaId = `r2-mira-${randomUUID()}`;
  const idempotencyKey = `r2-mira-${randomUUID()}`;
  // Valid tiny JPEG (not an empty placeholder) so app mime sniff can accept image/jpeg.
  const jpeg = Buffer.from(
    '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAGcP//EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAQUCf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQMBAT8Bf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQIBAT8Bf//Z',
    'base64',
  );

  try {
    const initRes = await fetch(`${base}/api/v1/partners-portal/upload-sessions`, {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({
        ownerKind,
        ownerId,
        clientMediaId,
        idempotencyKey,
        mimeType: 'image/jpeg',
        byteSize: jpeg.length,
        placement: 'main',
      }),
    });
    const initBody = (await initRes.json().catch(() => ({}))) as {
      sessionId?: string;
      status?: string;
      messageAr?: string;
    };
    const sessionId = String(initBody.sessionId || '');
    record('R2_MIRA_CREATE_SESSION', initRes.ok && Boolean(sessionId), {
      status: initRes.status,
      sessionPresent: Boolean(sessionId),
      messageAr: initBody.messageAr || null,
    });
    if (!initRes.ok || !sessionId) {
      record('R2_MIRA_APP_PATH', false, { reason: 'create session failed' });
      return;
    }

    const signRes = await fetch(`${base}/api/v1/partners-portal/upload-sessions/${sessionId}/parts/1/sign`, {
      method: 'POST',
      headers: auth,
      body: '{}',
    });
    const signBody = (await signRes.json().catch(() => ({}))) as { url?: string; uploadUrl?: string };
    const putUrl = String(signBody.url || signBody.uploadUrl || '');
    record('R2_MIRA_SIGN_PARTS', signRes.ok && putUrl.startsWith('http'), {
      status: signRes.status,
      urlPresent: Boolean(putUrl),
    });
    if (!signRes.ok || !putUrl) {
      record('R2_MIRA_APP_PATH', false, { reason: 'sign part failed' });
      return;
    }

    // Browser-origin PUT using Playwright (same origin discipline as SDK suite).
    const { chromium } = await import('playwright');
    const browser = await chromium.launch({ headless: true });
    try {
      const context = await browser.newContext();
      const page = await context.newPage();
      await page.goto(browserOrigin, { waitUntil: 'domcontentloaded', timeout: 15000 });
      const put = await page.evaluate(
        async ({ url, bytes }: { url: string; bytes: number[] }) => {
          const res = await fetch(url, {
            method: 'PUT',
            body: Uint8Array.from(bytes),
            mode: 'cors',
            credentials: 'omit',
          });
          return { status: res.status, etag: res.headers.get('etag') || res.headers.get('ETag') || '' };
        },
        { url: putUrl, bytes: [...jpeg] },
      );
      const etag = String(put.etag || '').replace(/"/g, '');
      record('R2_MIRA_BROWSER_PUT', put.status >= 200 && put.status < 300 && Boolean(etag), {
        status: put.status,
        etagReadable: Boolean(etag),
        origin: browserOrigin,
      });
      if (!(put.status >= 200 && put.status < 300 && etag)) {
        record('R2_MIRA_APP_PATH', false, { reason: 'browser put failed' });
        return;
      }

      const completeRes = await fetch(`${base}/api/v1/partners-portal/upload-sessions/${sessionId}/complete`, {
        method: 'POST',
        headers: auth,
        body: JSON.stringify({ parts: [{ partNumber: 1, etag, size: jpeg.length }] }),
      });
      record('R2_MIRA_COMPLETE', completeRes.ok, { status: completeRes.status });
      if (!completeRes.ok) {
        record('R2_MIRA_APP_PATH', false, { reason: 'complete failed' });
        return;
      }

      let ready = false;
      let mediaId = '';
      let readyPublication: string | null = null;
      for (let i = 0; i < 40; i++) {
        const got = await fetch(`${base}/api/v1/partners-portal/upload-sessions/${sessionId}`, { headers: auth });
        const body = (await got.json().catch(() => ({}))) as {
          status?: string;
          catalogMediaId?: string;
          session?: { status?: string; catalogMediaId?: string };
        };
        const id = mediaIdFromSessionBody(body);
        if (id) {
          ready = true;
          mediaId = id;
          break;
        }
        await new Promise((r) => setTimeout(r, 500));
      }
      async function loadPreviewMedia() {
        const previewRes = await fetch(
          `${base}/api/v1/partners-portal/${ownerKind === 'service' ? 'services' : 'products'}/${ownerId}/preview`,
          { headers: auth },
        );
        const previewBody = (await previewRes.json().catch(() => ({}))) as {
          media?: Array<{
            id?: string;
            publication?: string;
            isPrimary?: boolean;
            draftIsPrimary?: boolean | null;
          }>;
          partnerId?: string;
        };
        return { ok: previewRes.ok, media: previewBody.media || [], partnerId: previewBody.partnerId };
      }

      if (mediaId) {
        const preview = await loadPreviewMedia();
        const row = preview.media.find((m) => m.id === mediaId);
        readyPublication = row?.publication || null;
      }
      record('R2_MIRA_READY', ready && Boolean(mediaId), {
        ready,
        catalogMediaIdPresent: Boolean(mediaId),
        publication: readyPublication,
      });
      if (!ready || !mediaId) {
        record('R2_MIRA_APP_PATH', false, { reason: 'session did not reach READY with catalogMediaId' });
        return;
      }

      // Unpublished media must stay protected before approve/publish path.
      const prePub = await fetch(`${base}/api/v1/marketplace/media/${mediaId}`, {
        headers: { Origin: browserOrigin },
      });
      const prePubProtected = prePub.status === 404 || prePub.status === 403 || !prePub.ok;
      if (readyPublication === 'published') {
        // Already published owner — bind/cover still required; public may already be open.
      } else if (!prePubProtected) {
        record('R2_MIRA_PUBLISH', false, { reason: 'draft media publicly readable before publish', status: prePub.status });
        record('R2_MIRA_APP_PATH', false, { reason: 'unpublished media leaked' });
        return;
      }

      const bindRes = await fetch(
        `${base}/api/v1/partners-portal/${ownerKind === 'service' ? 'services' : 'products'}/${ownerId}/media/${mediaId}/primary`,
        { method: 'PATCH', headers: auth, body: '{}' },
      );
      const afterBindPreview = await loadPreviewMedia();
      const finalRow = afterBindPreview.media.find((m) => m.id === mediaId);
      const bindJudge = judgeBindResult({
        httpOk: bindRes.ok,
        status: bindRes.status,
        mediaId,
        ownerId,
        final: finalRow
          ? {
              id: finalRow.id,
              ownerId: afterBindPreview.partnerId || ownerId,
              isPrimary: finalRow.isPrimary,
              draftIsPrimary: finalRow.draftIsPrimary,
            }
          : null,
      });
      record('R2_MIRA_BIND', bindJudge.ok, {
        status: bindRes.status,
        reason: bindJudge.reason,
      });
      if (!bindJudge.ok) {
        record('R2_MIRA_APP_PATH', false, { reason: 'bind/primary failed or unverified' });
        return;
      }

      // Cover/primary is not publish — partner submit + admin catalog-reviews decision.
      let publishOk = readyPublication === 'published';
      if (!publishOk) {
        const submitRes = await fetch(
          `${base}/api/v1/partners-portal/${ownerKind === 'service' ? 'services' : 'products'}/${ownerId}/submit-review`,
          { method: 'POST', headers: auth, body: '{}' },
        );
        const submitBody = (await submitRes.json().catch(() => ({}))) as {
          revision?: number;
          submittedRevision?: number;
          contentStatus?: string;
        };
        const rev = submitBody.revision ?? submitBody.submittedRevision;
        const adminKey = (process.env.MIRA_R2_ADMIN_API_KEY || process.env.ADMIN_API_KEY || '').trim();
        let decideOk = false;
        if (adminKey && rev != null) {
          const decideRes = await fetch(
            `${base}/api/v1/admin/catalog-reviews/${ownerKind}/${ownerId}/decision`,
            {
              method: 'POST',
              headers: {
                'content-type': 'application/json',
                'x-admin-key': adminKey,
              },
              body: JSON.stringify({ decision: 'approve', revision: rev, note: 'r2-isolated-publish' }),
            },
          );
          decideOk = decideRes.ok;
        }
        // Developer partners may auto-approve on submit — verify via preview publication.
        if ((submitBody as { contentStatus?: string }).contentStatus === 'published') publishOk = true;
        const afterPub = await loadPreviewMedia();
        const pubRow = afterPub.media.find((m) => m.id === mediaId);
        publishOk = publishOk || decideOk || pubRow?.publication === 'published';
        if (!submitRes.ok && !decideOk) publishOk = false;
      }
      record('R2_MIRA_PUBLISH', publishOk, { priorPublication: readyPublication });
      if (!publishOk) {
        record('R2_MIRA_APP_PATH', false, { reason: 'publish/approve path failed' });
        return;
      }

      const fullRes = await fetch(`${base}/api/v1/marketplace/media/${mediaId}`, {
        headers: { Origin: browserOrigin },
      });
      const fullBuf = Buffer.from(await fullRes.arrayBuffer());
      const fullJudge = judgeFullRead({
        status: fullRes.status,
        body: fullBuf,
        expected: jpeg,
        expectedSha256: sha256(jpeg),
      });
      record('R2_MIRA_READ_FULL', fullJudge.ok, {
        status: fullRes.status,
        bytes: fullBuf.length,
        expected: jpeg.length,
        reason: fullJudge.reason,
      });

      const rangeRes = await fetch(`${base}/api/v1/marketplace/media/${mediaId}`, {
        headers: { Origin: browserOrigin, Range: 'bytes=0-15' },
      });
      const rangeBuf = Buffer.from(await rangeRes.arrayBuffer());
      const rangeJudge = judgeRangeResponse({
        status: rangeRes.status,
        contentRange: rangeRes.headers.get('content-range'),
        contentLengthHeader: rangeRes.headers.get('content-length'),
        body: rangeBuf,
        expectedFile: jpeg,
        start: 0,
        end: 15,
      });
      record('R2_MIRA_READ_RANGE', rangeJudge.ok, {
        status: rangeRes.status,
        bytes: rangeBuf.length,
        contentRange: rangeRes.headers.get('content-range'),
        reason: rangeJudge.reason,
      });

      // Abort mid-stream with request id + upstream probe (admin). Tiny JPEG may EOF in one chunk —
      // require partial bytes strictly; if file too small, FAIL (not PASS).
      const abortReqId = `abort-${randomUUID()}`;
      const ac = new AbortController();
      let saw = 0;
      let abortedEarly = false;
      let abortStatus = 0;
      try {
        const abortRes = await fetch(`${base}/api/v1/marketplace/media/${mediaId}`, {
          headers: { Origin: browserOrigin, 'x-mira-media-req': abortReqId },
          signal: ac.signal,
        });
        abortStatus = abortRes.status;
        if (!(abortRes.status >= 200 && abortRes.status < 300)) {
          record('R2_MIRA_ABORT_READ', false, { reason: 'abort-get-not-success', status: abortRes.status });
          record('R2_MIRA_APP_PATH', false, { reason: 'abort precondition failed' });
          return;
        }
        const reader = abortRes.body?.getReader();
        if (reader) {
          const first = await reader.read();
          if (!first.done && first.value && first.value.byteLength > 0) {
            saw = first.value.byteLength;
            if (saw >= jpeg.length) {
              abortedEarly = false; // whole body arrived — cannot claim mid-stream cancel
            } else {
              ac.abort();
              try {
                await reader.cancel();
              } catch {
                /* ignore */
              }
              abortedEarly = true;
            }
          }
        }
      } catch (err) {
        abortedEarly = saw > 0 && saw < jpeg.length && /abort/i.test(String((err as Error)?.name || err));
      }
      const afterAbort = await fetch(`${base}/api/v1/marketplace/media/${mediaId}`, {
        headers: { Origin: browserOrigin },
      });
      const afterBuf = Buffer.from(await afterAbort.arrayBuffer());
      const afterOk =
        afterAbort.ok && afterBuf.length === jpeg.length && sha256(afterBuf) === sha256(jpeg) && afterResNotErrorDoc(afterBuf);

      let upstreamClosed = false;
      const adminKey = (process.env.MIRA_R2_ADMIN_API_KEY || process.env.ADMIN_API_KEY || '').trim();
      if (adminKey) {
        for (let i = 0; i < 20; i++) {
          const probe = await fetch(`${base}/api/v1/admin/media-abort-probe/${abortReqId}`, {
            headers: { 'x-admin-key': adminKey },
          });
          const body = (await probe.json().catch(() => ({}))) as { seen?: boolean };
          if (body.seen) {
            upstreamClosed = true;
            break;
          }
          await new Promise((r) => setTimeout(r, 100));
        }
      }
      const abortJudge = judgeAbortRead({
        responseStatus: abortStatus || 200,
        receivedBytes: saw,
        expectedTotalBytes: jpeg.length,
        abortedBeforeEof: abortedEarly,
        upstreamClosedForRequestId: upstreamClosed,
        followUpFullOk: afterOk,
      });
      record('R2_MIRA_ABORT_READ', abortJudge.ok, {
        sawBytes: saw,
        expectedTotal: jpeg.length,
        abortedEarly,
        upstreamClosed,
        afterOk,
        reason: abortJudge.reason,
        abortReqIdSuffix: abortReqId.slice(-8),
      });

      const pathOk =
        Boolean(mediaId) &&
        bindJudge.ok &&
        publishOk &&
        fullJudge.ok &&
        rangeJudge.ok &&
        abortJudge.ok;
      record('R2_MIRA_APP_PATH', pathOk, {
        sessionIdSuffix: sessionId.slice(-8),
        mediaIdSuffix: mediaId.slice(-8),
        pathOk,
      });
    } finally {
      await browser.close().catch(() => undefined);
    }
  } catch (e) {
    record('R2_MIRA_APP_PATH', false, { reason: String((e as Error)?.message || e).slice(0, 200) });
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
