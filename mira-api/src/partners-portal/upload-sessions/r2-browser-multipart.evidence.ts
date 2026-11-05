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
  const commit = process.env.MIRA_P21_COMMIT || 'unknown';
  const missing = requiredEnvNames().filter((n) => !envPresent(n));
  const store = (process.env.MIRA_MEDIA_STORE || '').trim().toLowerCase();
  if (store !== 's3' || missing.length) {
    const summary = {
      ok: false,
      blocked: true,
      id: 'V03_R2_BROWSER',
      reason: 'isolated R2 test credentials/env incomplete — suite did not start',
      requiredEnvNames: requiredEnvNames(),
      missingEnvNames: store !== 's3' ? ['MIRA_MEDIA_STORE(=s3)', ...missing] : missing,
      presentEnvNames: requiredEnvNames().filter((n) => envPresent(n)),
      command:
        'MIRA_MEDIA_STORE=s3 MIRA_MEDIA_S3_BUCKET=… MIRA_MEDIA_S3_ACCESS_KEY_ID=… MIRA_MEDIA_S3_SECRET_ACCESS_KEY=… MIRA_MEDIA_S3_ENDPOINT=… MIRA_MEDIA_S3_REGION=auto MIRA_MEDIA_S3_TIMEOUT_MS=30000 npx tsx src/partners-portal/upload-sessions/r2-browser-multipart.evidence.ts',
      startedUtc,
      finishedUtc: new Date().toISOString(),
      commit,
      steps: [{ id: 'ENV', ok: 'BLOCKED' as const }],
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
  let browser: { close: () => Promise<void> } | null = null;

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
        async ({ putUrl, bytes }) => {
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

    // Abort after bytes have started flowing (not immediately before first chunk).
    {
      const ac = new AbortController();
      let sawBytes = false;
      let abortKind: 'AbortError' | 'other' | 'none' = 'none';
      try {
        const out = await client.send(new GetObjectCommand({ Bucket: bucket, Key: objectKey }));
        const body = out.Body as AsyncIterable<Uint8Array>;
        const reader = (async () => {
          for await (const chunk of body) {
            if (chunk && chunk.length) {
              sawBytes = true;
              ac.abort();
            }
            if (ac.signal.aborted) break;
          }
        })();
        // Also abort via AbortController on a second concurrent get to prove cancel path.
        const pending = client.send(new GetObjectCommand({ Bucket: bucket, Key: objectKey }), {
          abortSignal: ac.signal as never,
        });
        await reader.catch(() => undefined);
        try {
          await pending;
          abortKind = 'none';
        } catch (err) {
          const name = String((err as { name?: string })?.name || '');
          abortKind = name === 'AbortError' || /aborted|AbortError/i.test(String(err)) ? 'AbortError' : 'other';
        }
      } catch (err) {
        const name = String((err as { name?: string })?.name || '');
        abortKind = name === 'AbortError' || /aborted|AbortError/i.test(String(err)) ? 'AbortError' : 'other';
      }
      const abortOk = sawBytes && abortKind === 'AbortError';
      record('R2_ABORT_READ', abortOk, { sawBytes, abortKind });
      if (!abortOk) throw new Error('abort-read expected AbortError after receiving bytes');
    }

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
        else if (httpStatus === 403 || (httpStatus != null && httpStatus >= 500)) listOutcome = 'error';
        else listOutcome = 'error';
      }
      const abortOk = partsBefore >= 1 && (listOutcome === 'gone' || listOutcome === 'empty');
      record('R2_ABORT_UPLOAD', abortOk, { partsBefore, listOutcome, httpStatus });
      if (!abortOk) throw new Error('abort upload cleanup not proven (403/5xx/timeout ≠ success)');
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

  const failed = steps.filter((s) => s.ok === false);
  const summary = {
    ok: failed.length === 0 && steps.some((s) => s.id === 'R2_SUITE' && s.ok === true),
    blocked: false,
    id: 'V03_R2_BROWSER',
    startedUtc,
    finishedUtc: new Date().toISOString(),
    commit,
    partSize,
    fileBytes: fileBytes.length,
    steps,
    outDir,
  };
  writeFileSync(join(outDir, 'r2-browser-multipart.json'), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify({ ok: summary.ok, blocked: false, failed: failed.map((f) => f.id), outDir }));
  process.exit(summary.ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
