/**
 * Server-owned catalog icons (jewelry / occasions / gifts / materials).
 * Taxonomy nodes keep stable category ids; imageKey binds to package keys.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

export type CatalogIconUrls = {
  key: string;
  smallUrl: string;
  largeUrl: string;
  version: string;
};

type ManifestFile = { path: string; sha256: string };
type ManifestItem = {
  imageKey: string;
  labelAr: string;
  group: string;
  files: { '160': ManifestFile; '640': ManifestFile };
  knownCategoryId?: string;
};

type Manifest = { schemaVersion: number; items: ManifestItem[] };

let cached: {
  root: string;
  byKey: Map<string, ManifestItem>;
  fileByName: Map<string, string>;
} | null = null;

function catalogRoot(): string {
  const candidates = [
    join(__dirname, 'catalog-icons'),
    join(process.cwd(), 'src/marketplace/taxonomy/catalog-icons'),
    join(process.cwd(), 'dist/marketplace/taxonomy/catalog-icons'),
  ];
  for (const c of candidates) {
    if (existsSync(join(c, 'manifest.json'))) return c;
  }
  throw new Error('CATALOG_ICONS_MISSING_ROOT');
}

function load() {
  if (cached) return cached;
  const root = catalogRoot();
  const manifest = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8')) as Manifest;
  const byKey = new Map<string, ManifestItem>();
  for (const item of manifest.items || []) {
    if (byKey.has(item.imageKey)) throw new Error(`Duplicate imageKey: ${item.imageKey}`);
    byKey.set(item.imageKey, item);
  }
  if (byKey.size !== 33) throw new Error(`Expected 33 catalog icons, got ${byKey.size}`);
  const fileByName = new Map<string, string>();
  const imagesDir = join(root, 'images');
  for (const name of readdirSync(imagesDir)) {
    if (!name.endsWith('.webp')) continue;
    fileByName.set(name, join(imagesDir, name));
  }
  if (fileByName.size !== 66) throw new Error(`Expected 66 webp files, got ${fileByName.size}`);
  for (const item of byKey.values()) {
    for (const size of ['160', '640'] as const) {
      const rel = item.files[size].path.replace(/^images\//, '');
      const abs = fileByName.get(rel);
      if (!abs) throw new Error(`Missing icon file ${rel}`);
      const buf = readFileSync(abs);
      const sha = createHash('sha256').update(buf).digest('hex');
      if (sha !== item.files[size].sha256) {
        throw new Error(`Icon hash mismatch ${rel}`);
      }
    }
  }
  cached = { root, byKey, fileByName };
  return cached;
}

/** Public HTTPS base ending with `/` for catalog icon files. */
export function catalogIconsPublicBase(): string {
  const fromEnv =
    process.env.MIRA_CATALOG_ICONS_PUBLIC_BASE ||
    process.env.MIRA_PUBLIC_API_BASE ||
    process.env.RENDER_EXTERNAL_URL ||
    '';
  let base = (fromEnv || 'https://mira-api-n4p3.onrender.com').replace(/\/+$/, '');
  if (!base.includes('/api/')) {
    const prefix = (process.env.API_PREFIX || 'api/v1').replace(/^\/+|\/+$/g, '');
    base = `${base}/${prefix}`;
  }
  return `${base}/marketplace/catalog-icons/`;
}

export function resolveCatalogIcon(imageKey: string | null | undefined): CatalogIconUrls | null {
  if (!imageKey) return null;
  const { byKey } = load();
  const item = byKey.get(imageKey);
  if (!item) return null;
  const base = catalogIconsPublicBase();
  if (!base.endsWith('/')) throw new Error('Asset base must end in /');
  const uri = (size: '160' | '640') => new URL(item.files[size].path, base).href;
  return {
    key: item.imageKey,
    smallUrl: uri('160'),
    largeUrl: uri('640'),
    version: item.files['640'].sha256,
  };
}

export function absoluteCatalogIconPath(fileName: string): string | null {
  const { fileByName } = load();
  const clean = fileName.replace(/^.*\//, '');
  return fileByName.get(clean) || null;
}

export function listCatalogIconKeys(): string[] {
  return [...load().byKey.keys()].sort();
}

/** Test helper — force reload after file changes. */
export function resetCatalogIconCacheForTests() {
  cached = null;
}
