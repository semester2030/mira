import type { Readable } from 'stream';
import { planMediaStream } from './catalog-media.stream';

export class CatalogMediaReadError extends Error {
  constructor() {
    super('catalog-media-read-failed');
    this.name = 'CatalogMediaReadError';
  }
}

export class CatalogMediaUnavailable extends Error {
  constructor() {
    super('catalog-media-durable-unconfigured');
    this.name = 'CatalogMediaUnavailable';
  }
}

export class CatalogMediaConnectionError extends Error {
  constructor() {
    super('catalog-media-connection-failed');
    this.name = 'CatalogMediaConnectionError';
  }
}

export class CatalogMediaPermissionError extends Error {
  constructor() {
    super('catalog-media-permission');
    this.name = 'CatalogMediaPermissionError';
  }
}

export class CatalogMediaWriteError extends Error {
  constructor() {
    super('catalog-media-write-failed');
    this.name = 'CatalogMediaWriteError';
  }
}

/** Successful open — stream or buffer for the selected byte range. */
export type CatalogMediaOpenOk = {
  status: 200 | 206;
  totalSize: number;
  contentLength: number;
  contentRange?: string;
  contentType?: string;
  body: Readable | Buffer;
  abort?: () => void;
};

export type CatalogMediaOpenResult =
  | CatalogMediaOpenOk
  | {
      status: 416;
      totalSize: number;
      contentRange: string;
    };

export abstract class CatalogMediaStorage {
  abstract put(key: string, bytes: Buffer): Promise<void>;
  /** Full-object buffer read — avoid for public video playback. */
  abstract get(key: string): Promise<Buffer | null>;
  abstract delete(key: string): Promise<void>;

  /** Optional size probe; null means missing. */
  async head(key: string): Promise<{ contentLength: number; contentType?: string } | null> {
    const bytes = await this.get(key);
    if (!bytes) return null;
    return { contentLength: bytes.length };
  }

  /**
   * Stream object bytes, honoring HTTP Range without buffering the whole object
   * when the adapter overrides this method (S3). Default slices an in-memory get().
   */
  async open(
    key: string,
    options: {
      rangeHeader?: string;
      signal?: AbortSignal;
      /** Isolated abort evidence: request id from x-mira-media-req */
      abortRequestId?: string;
      mediaId?: string;
    } = {},
  ): Promise<CatalogMediaOpenResult | null> {
    if (options.signal?.aborted) {
      throw Object.assign(new Error('aborted'), { name: 'AbortError' });
    }
    const bytes = await this.get(key);
    if (!bytes) return null;
    const plan = planMediaStream(bytes.length, options.rangeHeader);
    if (plan.status === 416) {
      return { status: 416, totalSize: plan.total, contentRange: plan.contentRange };
    }
    return {
      status: plan.status,
      totalSize: plan.total,
      contentLength: plan.contentLength,
      contentRange: plan.contentRange,
      body: bytes.subarray(plan.start, plan.end + 1),
    };
  }
}
