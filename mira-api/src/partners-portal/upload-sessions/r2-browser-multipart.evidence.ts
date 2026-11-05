/**
 * V03 / U01_R2 — real isolated R2 multipart from a browser context (Playwright).
 *
 * Required env (values never printed):
 *   MIRA_MEDIA_STORE=s3
 *   MIRA_MEDIA_S3_BUCKET
 *   MIRA_MEDIA_S3_ACCESS_KEY_ID
 *   MIRA_MEDIA_S3_SECRET_ACCESS_KEY
 *   MIRA_MEDIA_S3_ENDPOINT          (R2 S3 API endpoint)
 *   MIRA_MEDIA_S3_REGION            (e.g. auto)
 *   MIRA_MEDIA_S3_TIMEOUT_MS
 *   MIRA_R2_TEST_PREFIX             (optional; default mira-p21-v03-test/)
 *   MIRA_R2_TEST_ORIGIN             (optional CORS origin; default http://127.0.0.1:8879)
 *
 * Run:
 *   npx tsx src/partners-portal/upload-sessions/r2-browser-multipart.evidence.ts
 *
 * Exit 0 with summary.ok=true on full PASS.
 * Exit 0 with summary.blocked=true when credentials/env missing (not a PASS).
 * Exit 1 on failed attempt with credentials present.
 */
import { createHash, randomBytes, randomUUID } from 'node:crypto';
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

type Step = { id: string; ok: boolean | 'BLOCKED' | 'SKIP'; detail?: unknown };
const steps: Step[] = [];
function record(id: string, ok: Step['ok'], detail?: unknown) {
  steps.push({ id, ok, detail });
  console.log(JSON.stringify({ id, ok, detail: detail && typeof detail === 'object' ? summarize(detail) : detail }));
}

function summarize(d: unknown) {
  try {
    return JSON.parse(
      JSON.stringify(d, (_k, v) => {
        if (typeof v === 'string' && (v.startsWith('http') || v.length > 80)) return `[redacted:${v.length}]`;
        return v;
      }),
    );
  } catch {
    return { note: 'unserializable' };
  }
}

function envPresent(name: string): boolean {
  const v = (process.env[name] || '').trim();
  return v.length > 0;
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
      reason: 'isolated R2 test credentials/env incomplete',
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
  const origin = (process.env.MIRA_R2_TEST_ORIGIN || 'http://127.0.0.1:8879').trim();
  // Provider-valid part size (≥5 MiB for S3/R2 multipart non-last parts).
  const partSize = Math.max(5 * 1024 * 1024, Number(process.env.MIRA_R2_TEST_PART_SIZE_BYTES || 5 * 1024 * 1024));
  const totalParts = 2;
  const fileBytes = Buffer.concat([
    randomBytes(partSize),
    randomBytes(Math.floor(partSize / 3)),
  ]);
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

  let uploadId: string | undefined;
  let completed = false;
  const createdKeys: string[] = [];
  const abortUploadIds: Array<{ key: string; uploadId: string }> = [];

  try {
    // 1) Create multipart
    const created = await client.send(
      new CreateMultipartUploadCommand({
        Bucket: bucket,
        Key: objectKey,
        ContentType: 'application/octet-stream',
      }),
    );
    uploadId = created.UploadId;
    if (!uploadId) throw new Error('multipart create missing UploadId');
    createdKeys.push(objectKey);
    record('R2_CREATE_MULTIPART', true, { objectKeySuffix: objectKey.slice(-24), parts: totalParts, partSize });

    // 2–3) Browser PUTs with signed URLs + CORS ETag
    const { chromium } = await import('playwright');
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(origin).catch(async () => {
      // Origin may not serve HTML — use blank page with fake origin via route.
      await page.setContent('<html><body>r2-test</body></html>');
    });

    const etags: string[] = [];
    for (let partNumber = 1; partNumber <= totalParts; partNumber++) {
      const start = (partNumber - 1) * partSize;
      const end = Math.min(fileBytes.length, start + partSize);
      const chunk = fileBytes.subarray(start, end);
      const command = new UploadPartCommand({
        Bucket: bucket,
        Key: objectKey,
        UploadId: uploadId,
        PartNumber: partNumber,
      });
      const url = await getSignedUrl(client, command, { expiresIn: 900 });
      const put = await page.evaluate(
        async ({ putUrl, bytes, corsOrigin }) => {
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
            // Prove CORS exposed ETag (null means header blocked)
            etagReadable: typeof etag === 'string' && etag.length > 0,
            origin: corsOrigin,
          };
        },
        { putUrl: url, bytes: Array.from(chunk), corsOrigin: origin },
      );
      if (!put.ok || !put.etagReadable) {
        record('R2_BROWSER_PUT_PART', false, { partNumber, put });
        throw new Error(`browser PUT part ${partNumber} failed or ETag not readable via CORS`);
      }
      etags.push(put.etag!);
      record('R2_BROWSER_PUT_PART', true, { partNumber, status: put.status, etagReadable: true, size: chunk.length });
    }
    await browser.close();

    // 4) Complete + head size/etag
    await client.send(
      new CompleteMultipartUploadCommand({
        Bucket: bucket,
        Key: objectKey,
        UploadId: uploadId,
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

    // 5) Full read + sha256
    const full = await client.send(new GetObjectCommand({ Bucket: bucket, Key: objectKey }));
    const fullBuf = await streamToBuffer(full.Body);
    const fullOk = fullBuf.length === fileBytes.length && sha256(fullBuf) === fileSha;
    record('R2_FULL_READ', fullOk, { bytes: fullBuf.length, shaMatch: sha256(fullBuf) === fileSha });
    if (!fullOk) throw new Error('full read mismatch');

    // 6) Range mid-file
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

    // 7) Abort in-flight GetObject (cancel) — verify AbortController path frees resources
    {
      const ac = new AbortController();
      const pending = client.send(
        new GetObjectCommand({ Bucket: bucket, Key: objectKey }),
        { abortSignal: ac.signal as never },
      );
      ac.abort();
      let aborted = false;
      try {
        await pending;
      } catch {
        aborted = true;
      }
      record('R2_ABORT_READ', aborted, { aborted });
      if (!aborted) throw new Error('expected aborted get');
    }

    // 8) Abort incomplete multipart + list parts empty/cleanup
    {
      const abortKey = `${prefix}abort-${randomUUID()}.bin`;
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
      // Upload one part via Node fetch (browser already proven); then abort upload.
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
      let partsAfter = -1;
      let listGone = false;
      try {
        const listedAfter = await client.send(
          new ListPartsCommand({ Bucket: bucket, Key: abortKey, UploadId: abortId }),
        );
        partsAfter = listedAfter.Parts?.length || 0;
      } catch {
        listGone = true;
        partsAfter = 0;
      }
      const abortOk = partsBefore >= 1 && (listGone || partsAfter === 0);
      record('R2_ABORT_UPLOAD', abortOk, { partsBefore, partsAfter, listGone });
      if (!abortOk) throw new Error('abort upload did not clean parts');
      // mark cleaned
      abortUploadIds.pop();
    }

    record('R2_SUITE', true, { objectKeySuffix: objectKey.slice(-24), fileSha });
  } catch (e) {
    record('R2_SUITE', false, String((e as Error)?.stack || e));
  } finally {
    // 9) Cleanup only this test's resources
    const cleanup: Array<{ action: string; ok: boolean; detail?: string }> = [];
    for (const { key, uploadId: uid } of abortUploadIds) {
      try {
        await client.send(new AbortMultipartUploadCommand({ Bucket: bucket, Key: key, UploadId: uid }));
        cleanup.push({ action: 'abort', ok: true, detail: key.slice(-20) });
      } catch (err) {
        cleanup.push({ action: 'abort', ok: false, detail: String(err) });
      }
    }
    if (uploadId && !completed) {
      try {
        await client.send(
          new AbortMultipartUploadCommand({ Bucket: bucket, Key: objectKey, UploadId: uploadId }),
        );
        cleanup.push({ action: 'abort-main', ok: true });
      } catch (err) {
        cleanup.push({ action: 'abort-main', ok: false, detail: String(err) });
      }
    }
    for (const key of createdKeys) {
      try {
        await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
        cleanup.push({ action: 'delete', ok: true, detail: key.slice(-20) });
      } catch (err) {
        cleanup.push({ action: 'delete', ok: false, detail: String(err) });
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
