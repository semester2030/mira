import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdir, readFile, rm, writeFile } from 'fs/promises';
import * as path from 'path';
import {
  CatalogMediaPermissionError,
  CatalogMediaReadError,
  CatalogMediaStorage,
  CatalogMediaUnavailable,
} from './catalog-media.contract';
import { inspectCatalogEndpoint, readS3TimeoutMs, S3CompatibleCatalogMediaStorage, S3MediaSettings } from './catalog-media.s3';

export {
  CatalogMediaConnectionError,
  CatalogMediaPermissionError,
  CatalogMediaReadError,
  CatalogMediaStorage,
  CatalogMediaUnavailable,
  CatalogMediaWriteError,
} from './catalog-media.contract';

export class UnavailableCatalogMediaStorage extends CatalogMediaStorage {
  constructor(private readonly reason: string) {
    super();
  }

  async put(): Promise<void> {
    this.fail();
  }

  async get(): Promise<Buffer | null> {
    this.fail();
  }

  async delete(): Promise<void> {
    this.fail();
  }

  private fail(): never {
    console.error('catalog-media-durable-unconfigured', this.reason);
    throw new CatalogMediaUnavailable();
  }
}

@Injectable()
export class LocalCatalogMediaStorage extends CatalogMediaStorage {
  constructor(private readonly config: ConfigService) {
    super();
  }

  private root(): string {
    return this.config?.get<string>('MIRA_MEDIA_DIR')
      ?? process.env.MIRA_MEDIA_DIR
      ?? path.join(process.cwd(), 'var', 'catalog-media');
  }

  private safe(key: string): string {
    if (!/^[a-zA-Z0-9._-]+$/.test(key)) throw new Error('invalid media key');
    return path.join(this.root(), key);
  }

  private refuseProduction(): void {
    if ((process.env.NODE_ENV ?? '').toLowerCase() !== 'production') return;
    console.error('catalog-media-local-refused');
    throw new CatalogMediaUnavailable();
  }

  async put(key: string, bytes: Buffer): Promise<void> {
    this.refuseProduction();
    const file = this.safe(key);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, bytes);
  }

  async get(key: string): Promise<Buffer | null> {
    this.refuseProduction();
    try {
      return await readFile(this.safe(key));
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === 'ENOENT') return null;
      if (code === 'EACCES' || code === 'EPERM') {
        console.error('catalog-media-permission');
        throw new CatalogMediaPermissionError();
      }
      console.error('catalog-media-read-failed');
      throw new CatalogMediaReadError();
    }
  }

  async delete(key: string): Promise<void> {
    this.refuseProduction();
    try {
      await rm(this.safe(key), { force: true });
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === 'EACCES' || code === 'EPERM') {
        console.error('catalog-media-permission');
        throw new CatalogMediaPermissionError();
      }
      throw error;
    }
  }
}

export class MemoryCatalogMediaStorage extends CatalogMediaStorage {
  readonly files = new Map<string, Buffer>();

  async put(key: string, bytes: Buffer): Promise<void> {
    this.files.set(key, Buffer.from(bytes));
  }

  async get(key: string): Promise<Buffer | null> {
    const found = this.files.get(key);
    return found ? Buffer.from(found) : null;
  }

  async delete(key: string): Promise<void> {
    this.files.delete(key);
  }
}

function setting(config: ConfigService, name: string): string {
  return (config?.get<string>(name) ?? process.env[name] ?? '').trim();
}

export function readS3MediaSettings(config: ConfigService): S3MediaSettings | null {
  const bucket = setting(config, 'MIRA_MEDIA_S3_BUCKET');
  const region = setting(config, 'MIRA_MEDIA_S3_REGION');
  const accessKeyId = setting(config, 'MIRA_MEDIA_S3_ACCESS_KEY_ID');
  const secretAccessKey = setting(config, 'MIRA_MEDIA_S3_SECRET_ACCESS_KEY');
  if (!bucket || !region || !accessKeyId || !secretAccessKey) return null;
  const endpoint = setting(config, 'MIRA_MEDIA_S3_ENDPOINT');
  return { bucket, region, accessKeyId, secretAccessKey, endpoint: endpoint || undefined };
}

export function readS3TimeoutSetting(config: ConfigService): number | null {
  return readS3TimeoutMs(setting(config, 'MIRA_MEDIA_S3_TIMEOUT_MS'));
}

export function createCatalogMediaStorage(config: ConfigService): CatalogMediaStorage {
  const production = (process.env.NODE_ENV ?? '').toLowerCase() === 'production';
  const store = setting(config, 'MIRA_MEDIA_STORE').toLowerCase();
  if (!production && (store === '' || store === 'local')) {
    return new LocalCatalogMediaStorage(config);
  }
  if (store === 's3') {
    const s3 = readS3MediaSettings(config);
    if (!s3) {
      console.error('catalog-media-provider-incomplete');
      return new UnavailableCatalogMediaStorage('incomplete');
    }
    const timeoutMs = readS3TimeoutSetting(config);
    if (timeoutMs === null) {
      console.error('catalog-media-timeout-invalid');
      return new UnavailableCatalogMediaStorage('timeout-invalid');
    }
    const endpoint = inspectCatalogEndpoint(s3.endpoint, {
      production,
      allowInsecureLoopback: !production && setting(config, 'MIRA_MEDIA_S3_ALLOW_INSECURE_LOOPBACK') === 'true',
    });
    if (!endpoint.ok) {
      console.error('catalog-media-endpoint-rejected', endpoint.reason);
      return new UnavailableCatalogMediaStorage(`endpoint-${endpoint.reason}`);
    }
    return new S3CompatibleCatalogMediaStorage(s3, { timeoutMs });
  }
  const reason = !store ? 'unset' : store === 'local' ? 'local-forbidden' : store === 'external' ? 'external-without-adapter' : 'unknown';
  console.error('catalog-media-durable-unconfigured', reason);
  return new UnavailableCatalogMediaStorage(reason);
}

