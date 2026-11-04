import { createHmac, randomUUID, timingSafeEqual } from 'crypto';
import { createReadStream, createWriteStream } from 'fs';
import { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
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
import { ConfigService } from '@nestjs/config';
import {
  inspectCatalogEndpoint,
  readS3TimeoutMs,
  S3MediaSettings,
} from '../../marketplace/catalog-media.s3';
import { readS3MediaSettings } from '../../marketplace/catalog-media.storage';
import { CatalogMediaStorage } from '../../marketplace/catalog-media.contract';
import { UPLOAD_PART_URL_TTL_SECONDS } from './upload-sessions.policy';

export type CompletedPart = { partNumber: number; etag: string; size: number };

export interface MultipartCreateResult {
  storageUploadId: string;
}

export interface MultipartSignResult {
  url: string;
  method: 'PUT';
  headers: Record<string, string>;
  expiresAt: string;
  /** When true, browser PUTs to Mira API (memory/local adapter), not R2. */
  directToApi: boolean;
}

export abstract class MultipartUploadStore {
  abstract create(objectKey: string, contentType: string): Promise<MultipartCreateResult>;
  abstract signPart(
    objectKey: string,
    storageUploadId: string,
    partNumber: number,
    sessionId: string,
  ): Promise<MultipartSignResult>;
  abstract complete(
    objectKey: string,
    storageUploadId: string,
    parts: CompletedPart[],
  ): Promise<void>;
  abstract abort(objectKey: string, storageUploadId: string): Promise<void>;
  abstract head(objectKey: string): Promise<{ contentLength: number; contentType?: string; etag?: string } | null>;
  /** List uploaded parts from storage (paginated for S3). Empty if upload already completed/aborted. */
  abstract listParts(objectKey: string, storageUploadId: string): Promise<CompletedPart[]>;
  /** Stream object bytes to a temp file for bounded-memory verification; caller must cleanup. */
  abstract materializeToTemp(objectKey: string): Promise<{ filePath: string; cleanup: () => Promise<void> }>;
  /** Delete a completed object by exact key. No-op if missing. Never prefix-delete. */
  abstract deleteObject(objectKey: string): Promise<void>;
}

function partSignSecret(): string {
  return (
    process.env.MIRA_UPLOAD_PART_HMAC_SECRET ||
    process.env.JWT_SECRET ||
    'mira-local-upload-part-secret'
  ).trim();
}

export function signDirectPartToken(sessionId: string, partNumber: number, exp: number): string {
  const payload = `${sessionId}.${partNumber}.${exp}`;
  return createHmac('sha256', partSignSecret()).update(payload).digest('hex');
}

export function verifyDirectPartToken(sessionId: string, partNumber: number, exp: number, token: string): boolean {
  if (!/^\d+$/.test(String(exp)) || exp * 1000 < Date.now()) return false;
  const expected = signDirectPartToken(sessionId, partNumber, exp);
  try {
    const a = Buffer.from(expected, 'hex');
    const b = Buffer.from(String(token || ''), 'hex');
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/** In-process multipart for local/tests — no R2 required. Never enabled in production. */
export class MemoryMultipartUploadStore extends MultipartUploadStore {
  readonly uploads = new Map<
    string,
    { objectKey: string; contentType: string; parts: Map<number, { bytes: Buffer; etag: string }> }
  >();
  readonly objects = new Map<string, { bytes: Buffer; contentType: string; etag: string }>();
  /** Simulate storage complete succeeding then DB failure by throwing after object write. */
  failNextCompleteDbHook: (() => void) | null = null;

  async create(objectKey: string, contentType: string): Promise<MultipartCreateResult> {
    const storageUploadId = randomUUID();
    this.uploads.set(storageUploadId, { objectKey, contentType, parts: new Map() });
    return { storageUploadId };
  }

  async signPart(
    objectKey: string,
    storageUploadId: string,
    partNumber: number,
    sessionId: string,
  ): Promise<MultipartSignResult> {
    const up = this.uploads.get(storageUploadId);
    if (!up || up.objectKey !== objectKey) throw new Error('upload-not-found');
    const exp = Math.floor(Date.now() / 1000) + UPLOAD_PART_URL_TTL_SECONDS;
    const token = signDirectPartToken(sessionId, partNumber, exp);
    const base = (process.env.MIRA_PUBLIC_API_BASE || '').replace(/\/$/, '');
    const pathUrl = `/api/v1/partners-portal/upload-sessions/${encodeURIComponent(sessionId)}/direct-parts/${partNumber}?exp=${exp}&sig=${token}`;
    return {
      url: base ? `${base}${pathUrl}` : pathUrl,
      method: 'PUT',
      headers: { 'Content-Type': 'application/octet-stream' },
      expiresAt: new Date(exp * 1000).toISOString(),
      directToApi: true,
    };
  }

  async putPartDirect(
    _sessionId: string,
    objectKey: string,
    storageUploadId: string,
    partNumber: number,
    body: Buffer,
  ): Promise<{ etag: string; size: number }> {
    const up = this.uploads.get(storageUploadId);
    if (!up || up.objectKey !== objectKey) throw new Error('upload-not-found');
    const etag = `"mem-${partNumber}-${body.length}-${createHmac('sha256', 'etag').update(body).digest('hex').slice(0, 16)}"`;
    up.parts.set(partNumber, { bytes: Buffer.from(body), etag });
    return { etag, size: body.length };
  }

  async listParts(objectKey: string, storageUploadId: string): Promise<CompletedPart[]> {
    const up = this.uploads.get(storageUploadId);
    if (!up || up.objectKey !== objectKey) return [];
    return [...up.parts.entries()]
      .map(([partNumber, part]) => ({ partNumber, etag: part.etag, size: part.bytes.length }))
      .sort((a, b) => a.partNumber - b.partNumber);
  }

  async complete(objectKey: string, storageUploadId: string, parts: CompletedPart[]): Promise<void> {
    const up = this.uploads.get(storageUploadId);
    if (!up || up.objectKey !== objectKey) {
      // Already completed — treat as success if object present (lost-response recovery).
      if (this.objects.has(objectKey)) return;
      throw new Error('upload-not-found');
    }
    const ordered = [...parts].sort((a, b) => a.partNumber - b.partNumber);
    const chunks: Buffer[] = [];
    for (const p of ordered) {
      const part = up.parts.get(p.partNumber);
      if (!part) throw new Error('missing-part-' + p.partNumber);
      if (part.bytes.length !== p.size) throw new Error('part-size-mismatch-' + p.partNumber);
      chunks.push(part.bytes);
    }
    const bytes = Buffer.concat(chunks);
    const etag = `"mem-obj-${createHmac('sha256', 'obj').update(bytes).digest('hex').slice(0, 16)}"`;
    this.objects.set(objectKey, { bytes, contentType: up.contentType, etag });
    this.uploads.delete(storageUploadId);
  }

  /** Test hook: inject abort failures (connection-like). */
  failNextAbort: Error | null = null;

  async abort(objectKey: string, storageUploadId: string): Promise<void> {
    if (this.failNextAbort) {
      const err = this.failNextAbort;
      this.failNextAbort = null;
      throw err;
    }
    const up = this.uploads.get(storageUploadId);
    if (up && up.objectKey === objectKey) this.uploads.delete(storageUploadId);
    // Missing upload id is a no-op (equivalent to NoSuchUpload).
  }

  async head(objectKey: string) {
    const obj = this.objects.get(objectKey);
    if (!obj) return null;
    return { contentLength: obj.bytes.length, contentType: obj.contentType, etag: obj.etag };
  }

  async materializeToTemp(objectKey: string) {
    const obj = this.objects.get(objectKey);
    if (!obj) throw new Error('object-missing');
    const dir = await mkdtemp(path.join(os.tmpdir(), 'mira-upload-'));
    const filePath = path.join(dir, 'object.bin');
    await writeFile(filePath, obj.bytes);
    return {
      filePath,
      cleanup: async () => {
        await rm(dir, { recursive: true, force: true });
      },
    };
  }

  /** Mirror completed object into CatalogMediaStorage key space for partner reads — stream copy. */
  async copyToCatalogStorage(storage: CatalogMediaStorage, objectKey: string, catalogKey: string): Promise<void> {
    const obj = this.objects.get(objectKey);
    if (!obj) throw new Error('object-missing');
    await storage.put(catalogKey, obj.bytes);
  }

  /** Test/cleanup helper: delete orphan completed object when not bound. */
  async deleteObject(objectKey: string): Promise<void> {
    this.objects.delete(objectKey);
  }
}

export class S3MultipartUploadStore extends MultipartUploadStore {
  private readonly client: S3Client;

  constructor(private readonly settings: S3MediaSettings, timeoutMs: number) {
    super();
    this.client = new S3Client({
      region: settings.region,
      endpoint: settings.endpoint,
      forcePathStyle: !!settings.endpoint,
      credentials: {
        accessKeyId: settings.accessKeyId,
        secretAccessKey: settings.secretAccessKey,
      },
      requestHandler: undefined,
      maxAttempts: 2,
    });
    void timeoutMs;
  }

  async create(objectKey: string, contentType: string): Promise<MultipartCreateResult> {
    const out = await this.client.send(
      new CreateMultipartUploadCommand({
        Bucket: this.settings.bucket,
        Key: objectKey,
        ContentType: contentType,
      }),
    );
    if (!out.UploadId) throw new Error('multipart-create-failed');
    return { storageUploadId: out.UploadId };
  }

  async signPart(
    objectKey: string,
    storageUploadId: string,
    partNumber: number,
    _sessionId: string,
  ): Promise<MultipartSignResult> {
    const command = new UploadPartCommand({
      Bucket: this.settings.bucket,
      Key: objectKey,
      UploadId: storageUploadId,
      PartNumber: partNumber,
    });
    const url = await getSignedUrl(this.client, command, { expiresIn: UPLOAD_PART_URL_TTL_SECONDS });
    return {
      url,
      method: 'PUT',
      headers: {},
      expiresAt: new Date(Date.now() + UPLOAD_PART_URL_TTL_SECONDS * 1000).toISOString(),
      directToApi: false,
    };
  }

  async listParts(objectKey: string, storageUploadId: string): Promise<CompletedPart[]> {
    const parts: CompletedPart[] = [];
    let partNumberMarker: string | undefined;
    for (;;) {
      const out = await this.client.send(
        new ListPartsCommand({
          Bucket: this.settings.bucket,
          Key: objectKey,
          UploadId: storageUploadId,
          PartNumberMarker: partNumberMarker,
          MaxParts: 1000,
        }),
      );
      for (const p of out.Parts || []) {
        if (p.PartNumber == null || !p.ETag) continue;
        parts.push({
          partNumber: p.PartNumber,
          etag: p.ETag,
          size: Number(p.Size ?? 0),
        });
      }
      if (!out.IsTruncated) break;
      partNumberMarker = out.NextPartNumberMarker;
      if (!partNumberMarker) break;
    }
    return parts.sort((a, b) => a.partNumber - b.partNumber);
  }

  async complete(objectKey: string, storageUploadId: string, parts: CompletedPart[]): Promise<void> {
    try {
      await this.client.send(
        new CompleteMultipartUploadCommand({
          Bucket: this.settings.bucket,
          Key: objectKey,
          UploadId: storageUploadId,
          MultipartUpload: {
            Parts: [...parts]
              .sort((a, b) => a.partNumber - b.partNumber)
              .map((p) => ({ ETag: p.etag, PartNumber: p.partNumber })),
          },
        }),
      );
    } catch (error) {
      // Lost-response recovery: Complete already succeeded → UploadId gone; object present.
      const head = await this.head(objectKey);
      if (head && head.contentLength > 0) return;
      throw error;
    }
  }

  async abort(objectKey: string, storageUploadId: string): Promise<void> {
    try {
      await this.client.send(
        new AbortMultipartUploadCommand({
          Bucket: this.settings.bucket,
          Key: objectKey,
          UploadId: storageUploadId,
        }),
      );
    } catch (error) {
      const name = String((error as { name?: string; Code?: string })?.name || (error as { Code?: string })?.Code || '');
      // Expected: already completed or previously aborted
      if (name === 'NoSuchUpload' || name === 'NotFound') return;
      throw error;
    }
  }

  async head(objectKey: string) {
    try {
      const out = await this.client.send(
        new HeadObjectCommand({ Bucket: this.settings.bucket, Key: objectKey }),
      );
      return {
        contentLength: Number(out.ContentLength ?? 0),
        contentType: out.ContentType,
        etag: out.ETag,
      };
    } catch (error) {
      const name = String((error as { name?: string })?.name || '');
      if (name === 'NotFound' || name === 'NoSuchKey') return null;
      throw error;
    }
  }

  async materializeToTemp(objectKey: string) {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'mira-upload-'));
    const filePath = path.join(dir, 'object.bin');
    const cleanup = async () => {
      await rm(dir, { recursive: true, force: true });
    };
    try {
      const out = await this.client.send(
        new GetObjectCommand({ Bucket: this.settings.bucket, Key: objectKey }),
      );
      if (!out.Body) {
        await cleanup();
        throw new Error('empty-body');
      }
      const body = out.Body as Readable;
      await pipeline(body, createWriteStream(filePath));
      return { filePath, cleanup };
    } catch (error) {
      try {
        await cleanup();
      } catch {
        /* ignore */
      }
      throw error;
    }
  }

  async deleteObject(objectKey: string): Promise<void> {
    try {
      await this.client.send(
        new DeleteObjectCommand({
          Bucket: this.settings.bucket,
          Key: objectKey,
        }),
      );
    } catch (error) {
      const name = String((error as { name?: string })?.name || '');
      if (name === 'NotFound' || name === 'NoSuchKey') return;
      throw error;
    }
  }
}

/**
 * Disk-backed multipart for streaming / memory proofs (U11).
 * Parts and completed objects live on disk — never retain full object Buffers in RSS.
 */
export class DiskMultipartUploadStore extends MultipartUploadStore {
  readonly root: string;
  private readonly uploads = new Map<string, { objectKey: string; contentType: string; partDir: string }>();
  failNextAbort: Error | null = null;
  failNextCompleteDbHook: (() => void) | null = null;

  constructor(rootDir?: string) {
    super();
    this.root = rootDir || path.join(os.tmpdir(), `mira-upload-disk-${randomUUID()}`);
  }

  private async ensureRoot() {
    await mkdir(this.root, { recursive: true });
  }

  /**
   * Re-attach an in-progress multipart after process restart (parts already on disk).
   * Required for OS-level crash recovery proofs — Map state is process-local.
   */
  adoptUpload(objectKey: string, storageUploadId: string, contentType = 'application/octet-stream') {
    const partDir = path.join(this.root, 'uploads', storageUploadId);
    this.uploads.set(storageUploadId, { objectKey, contentType, partDir });
  }

  async create(objectKey: string, contentType: string): Promise<MultipartCreateResult> {
    await this.ensureRoot();
    const storageUploadId = randomUUID();
    const partDir = path.join(this.root, 'uploads', storageUploadId);
    await mkdir(partDir, { recursive: true });
    this.uploads.set(storageUploadId, { objectKey, contentType, partDir });
    return { storageUploadId };
  }

  async signPart(
    objectKey: string,
    storageUploadId: string,
    partNumber: number,
    sessionId: string,
  ): Promise<MultipartSignResult> {
    const up = this.uploads.get(storageUploadId);
    if (!up || up.objectKey !== objectKey) throw new Error('upload-not-found');
    const exp = Math.floor(Date.now() / 1000) + UPLOAD_PART_URL_TTL_SECONDS;
    const token = signDirectPartToken(sessionId, partNumber, exp);
    const base = (process.env.MIRA_PUBLIC_API_BASE || '').replace(/\/$/, '');
    const pathUrl = `/api/v1/partners-portal/upload-sessions/${encodeURIComponent(sessionId)}/direct-parts/${partNumber}?exp=${exp}&sig=${token}`;
    return {
      url: base ? `${base}${pathUrl}` : pathUrl,
      method: 'PUT',
      headers: { 'Content-Type': 'application/octet-stream' },
      expiresAt: new Date(exp * 1000).toISOString(),
      directToApi: true,
    };
  }

  async putPartDirect(
    _sessionId: string,
    objectKey: string,
    storageUploadId: string,
    partNumber: number,
    body: Buffer,
  ): Promise<{ etag: string; size: number }> {
    const up = this.uploads.get(storageUploadId);
    if (!up || up.objectKey !== objectKey) throw new Error('upload-not-found');
    const etag = `"disk-${partNumber}-${body.length}-${createHmac('sha256', 'etag').update(body).digest('hex').slice(0, 16)}"`;
    await writeFile(path.join(up.partDir, `${partNumber}.part`), body);
    await writeFile(path.join(up.partDir, `${partNumber}.etag`), etag, 'utf8');
    return { etag, size: body.length };
  }

  async listParts(objectKey: string, storageUploadId: string): Promise<CompletedPart[]> {
    const up = this.uploads.get(storageUploadId);
    if (!up || up.objectKey !== objectKey) return [];
    const names = await readdir(up.partDir).catch(() => [] as string[]);
    const parts: CompletedPart[] = [];
    for (const name of names) {
      const m = /^(\d+)\.part$/.exec(name);
      if (!m) continue;
      const partNumber = Number(m[1]);
      const filePath = path.join(up.partDir, name);
      const st = await stat(filePath);
      const etag = await readFile(path.join(up.partDir, `${partNumber}.etag`), 'utf8').catch(() => `"disk-${partNumber}"`);
      parts.push({ partNumber, etag: etag.trim(), size: Number(st.size) });
    }
    return parts.sort((a, b) => a.partNumber - b.partNumber);
  }

  private objectPath(objectKey: string) {
    const safe = createHmac('sha256', 'key').update(objectKey).digest('hex');
    return path.join(this.root, 'objects', safe);
  }

  async complete(objectKey: string, storageUploadId: string, parts: CompletedPart[]): Promise<void> {
    const up = this.uploads.get(storageUploadId);
    const dest = this.objectPath(objectKey);
    if (!up || up.objectKey !== objectKey) {
      try {
        await stat(dest);
        return;
      } catch {
        throw new Error('upload-not-found');
      }
    }
    await mkdir(path.dirname(dest), { recursive: true });
    // Stream parts to object file without buffering the full video in one Buffer.
    const out = createWriteStream(dest);
    try {
      for (const p of [...parts].sort((a, b) => a.partNumber - b.partNumber)) {
        const partPath = path.join(up.partDir, `${p.partNumber}.part`);
        const st = await stat(partPath);
        if (Number(st.size) !== p.size) throw new Error('part-size-mismatch-' + p.partNumber);
        await new Promise<void>((resolve, reject) => {
          const rs = createReadStream(partPath, { highWaterMark: 1024 * 1024 });
          rs.on('error', reject);
          out.on('error', reject);
          rs.on('data', (chunk: Buffer | string) => {
            const buf = typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
            if (!out.write(buf)) {
              rs.pause();
              out.once('drain', () => rs.resume());
            }
          });
          rs.on('end', () => resolve());
        });
      }
      await new Promise<void>((resolve, reject) => {
        out.end(() => resolve());
        out.on('error', reject);
      });
    } catch (error) {
      out.destroy();
      await rm(dest, { force: true }).catch(() => undefined);
      throw error;
    }
    await rm(up.partDir, { recursive: true, force: true });
    this.uploads.delete(storageUploadId);
    if (this.failNextCompleteDbHook) {
      const hook = this.failNextCompleteDbHook;
      this.failNextCompleteDbHook = null;
      hook();
    }
  }

  async abort(objectKey: string, storageUploadId: string): Promise<void> {
    if (this.failNextAbort) {
      const err = this.failNextAbort;
      this.failNextAbort = null;
      throw err;
    }
    const up = this.uploads.get(storageUploadId);
    if (up && up.objectKey === objectKey) {
      await rm(up.partDir, { recursive: true, force: true });
      this.uploads.delete(storageUploadId);
    }
  }

  async head(objectKey: string) {
    try {
      const st = await stat(this.objectPath(objectKey));
      return { contentLength: Number(st.size) };
    } catch {
      return null;
    }
  }

  async materializeToTemp(objectKey: string) {
    const src = this.objectPath(objectKey);
    try {
      await stat(src);
    } catch {
      throw new Error('object-missing');
    }
    const dir = await mkdtemp(path.join(os.tmpdir(), 'mira-upload-'));
    const filePath = path.join(dir, 'object.bin');
    const cleanup = async () => {
      await rm(dir, { recursive: true, force: true });
    };
    try {
      await pipeline(createReadStream(src), createWriteStream(filePath));
      return { filePath, cleanup };
    } catch (error) {
      await cleanup().catch(() => undefined);
      throw error;
    }
  }

  async copyToCatalogStorage(storage: CatalogMediaStorage, objectKey: string, catalogKey: string): Promise<void> {
    const src = this.objectPath(objectKey);
    const bytes = await readFile(src);
    await storage.put(catalogKey, bytes);
  }

  async deleteObject(objectKey: string): Promise<void> {
    await rm(this.objectPath(objectKey), { force: true });
  }
}

export function createMultipartUploadStore(config: ConfigService): MultipartUploadStore {
  const production = (process.env.NODE_ENV ?? '').toLowerCase() === 'production';
  const store = (config?.get<string>('MIRA_MEDIA_STORE') ?? process.env.MIRA_MEDIA_STORE ?? '').trim().toLowerCase();
  if (store === 's3') {
    const s3 = readS3MediaSettings(config);
    if (!s3) throw new Error('s3-incomplete');
    const timeoutMs = readS3TimeoutMs((config?.get<string>('MIRA_MEDIA_S3_TIMEOUT_MS') ?? process.env.MIRA_MEDIA_S3_TIMEOUT_MS ?? '').trim());
    if (timeoutMs == null) throw new Error('s3-timeout-invalid');
    const endpoint = inspectCatalogEndpoint(s3.endpoint, {
      production,
      allowInsecureLoopback: !production && process.env.MIRA_MEDIA_S3_ALLOW_INSECURE_LOOPBACK === 'true',
    });
    if (!endpoint.ok) throw new Error('s3-endpoint-' + endpoint.reason);
    return new S3MultipartUploadStore(s3, timeoutMs);
  }
  if (store === 'disk' || process.env.MIRA_UPLOAD_DISK_STORE === '1') {
    return new DiskMultipartUploadStore(process.env.MIRA_UPLOAD_DISK_ROOT || undefined);
  }
  // Local / memory adapter for development and isolated tests
  return new MemoryMultipartUploadStore();
}
