import type { Agent as HttpsAgent } from 'node:https';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { NodeHttpHandler } from '@smithy/node-http-handler';
import {
  CatalogMediaConnectionError,
  CatalogMediaPermissionError,
  CatalogMediaReadError,
  CatalogMediaStorage,
  CatalogMediaUnavailable,
  CatalogMediaWriteError,
} from './catalog-media.contract';

export interface S3MediaSettings {
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  endpoint?: string;
}

export interface S3AdapterDependencies {
  timeoutMs?: number;
  httpsAgent?: HttpsAgent;
  tamperSignature?: boolean;
}

export const DEFAULT_S3_TIMEOUT_MS = 10_000;
export const MAX_S3_TIMEOUT_MS = 120_000;

export type EndpointRejection = 'invalid' | 'protocol' | 'credentials' | 'path' | 'query' | 'hash' | 'http-forbidden';

const NETWORK_CODES = new Set([
  'ECONNREFUSED', 'ECONNRESET', 'EPIPE', 'ETIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN',
  'ECONNABORTED', 'EHOSTUNREACH', 'ENETUNREACH',
]);

class MissingObject extends Error {
  constructor() {
    super('catalog-media-missing-object');
    this.name = 'MissingObject';
  }
}

/** Origin only: https://host[:port] with no user, path, query, or hash. */
export function inspectCatalogEndpoint(
  endpoint: string | undefined,
  options: { production: boolean; allowInsecureLoopback: boolean },
): { ok: true } | { ok: false; reason: EndpointRejection } {
  const value = endpoint?.trim();
  if (!value) return { ok: true };
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return { ok: false, reason: 'invalid' };
  }
  if (url.username || url.password) return { ok: false, reason: 'credentials' };
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return { ok: false, reason: 'protocol' };
  if (url.search) return { ok: false, reason: 'query' };
  if (url.hash) return { ok: false, reason: 'hash' };
  if (url.pathname !== '' && url.pathname !== '/') return { ok: false, reason: 'path' };
  if (url.protocol === 'https:') return { ok: true };
  const host = url.hostname.toLowerCase();
  const loopback = host === 'localhost' || host === '::1' || /^127(?:\.\d{1,3}){3}$/.test(host);
  if (!options.production && options.allowInsecureLoopback && loopback) return { ok: true };
  return { ok: false, reason: 'http-forbidden' };
}

export function readS3TimeoutMs(raw: string | undefined): number | null {
  const value = raw?.trim() ?? '';
  if (!value) return DEFAULT_S3_TIMEOUT_MS;
  if (!/^[1-9]\d*$/.test(value)) return null;
  const parsed = Number(value);
  if (parsed > MAX_S3_TIMEOUT_MS) return null;
  return parsed;
}

/**
 * Candidate S3-compatible adapter. Selecting it is not an approved Mira provider decision.
 * The official AWS SDK signs requests. A local signature check is not production verification.
 */
export class S3CompatibleCatalogMediaStorage extends CatalogMediaStorage {
  private timerCount = 0;

  constructor(
    private readonly settings: S3MediaSettings,
    private readonly dependencies: S3AdapterDependencies = {},
  ) {
    super();
  }

  get openTimers(): number {
    return this.timerCount;
  }

  async put(key: string, bytes: Buffer): Promise<void> {
    try {
      await this.execute('write', (client, signal) => client.send(new PutObjectCommand({
        Bucket: this.settings.bucket,
        Key: key,
        Body: bytes,
        ContentLength: bytes.length,
      }), { abortSignal: signal }));
    } catch (error) {
      if (error instanceof CatalogMediaConnectionError) await this.cleanupAmbiguousPut(key);
      throw error;
    }
  }

  async get(key: string): Promise<Buffer | null> {
    try {
      return await this.execute('read', async (client, signal) => {
        const output = await client.send(new GetObjectCommand({
          Bucket: this.settings.bucket,
          Key: key,
        }), { abortSignal: signal });
        if (!output.Body || typeof output.Body.transformToByteArray !== 'function') {
          console.error('catalog-media-read-failed');
          throw new CatalogMediaReadError();
        }
        return this.readBody(output.Body, signal);
      });
    } catch (error) {
      if (error instanceof MissingObject) return null;
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.execute('write', (client, signal) => client.send(new DeleteObjectCommand({
        Bucket: this.settings.bucket,
        Key: key,
      }), { abortSignal: signal }));
    } catch (error) {
      if (error instanceof MissingObject) return;
      throw error;
    }
  }

  private async cleanupAmbiguousPut(key: string): Promise<void> {
    try {
      await this.delete(key);
    } catch {
      console.error('catalog-media-cleanup-failed', key);
    }
  }

  private assertReady(): void {
    const timeout = this.dependencies.timeoutMs ?? DEFAULT_S3_TIMEOUT_MS;
    if (!Number.isInteger(timeout) || timeout < 1 || timeout > MAX_S3_TIMEOUT_MS) {
      console.error('catalog-media-timeout-invalid');
      throw new CatalogMediaUnavailable();
    }
    const production = (process.env.NODE_ENV ?? '').toLowerCase() === 'production';
    const decision = inspectCatalogEndpoint(this.settings.endpoint, {
      production,
      allowInsecureLoopback: !production && process.env.MIRA_MEDIA_S3_ALLOW_INSECURE_LOOPBACK === 'true',
    });
    if (!decision.ok) {
      console.error('catalog-media-endpoint-rejected', decision.reason);
      throw new CatalogMediaUnavailable();
    }
  }

  private createClient(): S3Client {
    const timeout = this.dependencies.timeoutMs ?? DEFAULT_S3_TIMEOUT_MS;
    const handler = new GuardedHandler(new NodeHttpHandler({
      connectionTimeout: timeout,
      requestTimeout: timeout,
      throwOnRequestTimeout: true,
      httpsAgent: this.dependencies.httpsAgent,
    }), this.dependencies.tamperSignature === true);
    return new S3Client({
      region: this.settings.region,
      endpoint: this.settings.endpoint,
      forcePathStyle: Boolean(this.settings.endpoint),
      credentials: {
        accessKeyId: this.settings.accessKeyId,
        secretAccessKey: this.settings.secretAccessKey,
      },
      maxAttempts: 1,
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
      requestHandler: handler,
      logger: { debug() {}, info() {}, warn() {}, error() {}, trace() {} },
    });
  }

  private async execute<T>(
    operation: 'read' | 'write',
    run: (client: S3Client, signal: AbortSignal) => Promise<T>,
  ): Promise<T> {
    this.assertReady();
    const client = this.createClient();
    const timeout = this.dependencies.timeoutMs ?? DEFAULT_S3_TIMEOUT_MS;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    this.timerCount += 1;
    try {
      return await run(client, controller.signal);
    } catch (error) {
      if (error instanceof CatalogMediaConnectionError || error instanceof CatalogMediaReadError || error instanceof CatalogMediaWriteError || error instanceof CatalogMediaPermissionError || error instanceof CatalogMediaUnavailable) {
        throw error;
      }
      if (controller.signal.aborted || isAbort(error) || isTimeout(error)) {
        console.error('catalog-media-connection-failed', 'timeout');
        throw new CatalogMediaConnectionError();
      }
      if (nameOf(error) === 'CatalogRedirectBlocked') throw new CatalogMediaConnectionError();
      if (isMissing(error)) throw new MissingObject();
      throw this.classify(error, operation);
    } finally {
      clearTimeout(timer);
      this.timerCount -= 1;
      client.destroy();
    }
  }

  private async readBody(
    body: { transformToByteArray: () => Promise<Uint8Array>; destroy?: () => void },
    signal: AbortSignal,
  ): Promise<Buffer> {
    try {
      const bytes = await new Promise<Uint8Array>((resolve, reject) => {
        const abort = () => {
          body.destroy?.();
          reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
        };
        if (signal.aborted) {
          abort();
          return;
        }
        signal.addEventListener('abort', abort, { once: true });
        body.transformToByteArray().then(
          (value) => {
            signal.removeEventListener('abort', abort);
            resolve(value);
          },
          (error) => {
            signal.removeEventListener('abort', abort);
            reject(error);
          },
        );
      });
      return Buffer.from(bytes);
    } catch (error) {
      if (signal.aborted || isAbort(error)) throw error;
      console.error('catalog-media-connection-failed', 'body');
      throw new CatalogMediaConnectionError();
    }
  }

  private classify(error: unknown, operation: 'read' | 'write'): Error {
    const name = nameOf(error);
    const status = statusOf(error);
    if (name === 'AccessDenied' || name === 'AllAccessDisabled') {
      console.error('catalog-media-permission');
      return new CatalogMediaPermissionError();
    }
    if (
      name === 'SignatureDoesNotMatch'
      || name === 'InvalidAccessKeyId'
      || name === 'AuthorizationHeaderMalformed'
      || status === 401
      || status === 403
    ) {
      console.error('catalog-media-auth-rejected');
      return new CatalogMediaPermissionError();
    }
    if (isNetwork(error) || status === 502 || status === 503 || status === 504) {
      console.error('catalog-media-connection-failed', 'transport');
      return new CatalogMediaConnectionError();
    }
    console.error(operation === 'read' ? 'catalog-media-read-failed' : 'catalog-media-write-failed');
    return operation === 'read' ? new CatalogMediaReadError() : new CatalogMediaWriteError();
  }
}

class GuardedHandler {
  readonly metadata = { handlerProtocol: 'http/1.1' };

  constructor(
    private readonly inner: NodeHttpHandler,
    private readonly tamperSignature: boolean,
  ) {}

  handle: NodeHttpHandler['handle'] = async (request, options) => {
    if (this.tamperSignature && request.headers.authorization) {
      const value = request.headers.authorization;
      request.headers.authorization = `${value.slice(0, -1)}${value.endsWith('0') ? '1' : '0'}`;
    }
    const result = await this.inner.handle(request, options);
    const response = result.response as { statusCode?: number; status?: number } | undefined;
    const status = response?.statusCode ?? response?.status ?? 0;
    if (status >= 300 && status < 400) {
      const body = result.response?.body as { destroy?: () => void } | undefined;
      body?.destroy?.();
      console.error('catalog-media-redirect-blocked');
      throw Object.assign(new Error('redirect-blocked'), { name: 'CatalogRedirectBlocked' });
    }
    return result;
  }

  destroy(): void {
    this.inner.destroy();
  }
}

function nameOf(error: unknown): string {
  return error instanceof Error ? error.name : '';
}

function statusOf(error: unknown): number | undefined {
  return (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
}

function isMissing(error: unknown): boolean {
  const name = nameOf(error);
  return name === 'NoSuchKey' || name === 'NotFound' || statusOf(error) === 404;
}

function isAbort(error: unknown): boolean {
  const name = nameOf(error);
  return name === 'AbortError' || name === 'RequestAbortedError';
}

function isTimeout(error: unknown): boolean {
  return nameOf(error) === 'TimeoutError';
}

function isNetwork(error: unknown): boolean {
  const code = (error as { code?: string }).code;
  return Boolean(code && NETWORK_CODES.has(code)) || isAbort(error) || isTimeout(error);
}
