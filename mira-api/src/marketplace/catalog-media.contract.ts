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

export abstract class CatalogMediaStorage {
  abstract put(key: string, bytes: Buffer): Promise<void>;
  abstract get(key: string): Promise<Buffer | null>;
  abstract delete(key: string): Promise<void>;
}
