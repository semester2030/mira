/**
 * Beauty lane orb assets (PNG/JPEG) — distinct file per imageKey.
 * Served alongside taxonomy projection so portal and Flutter share one binding.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

export type BeautyIconUrls = {
  key: string;
  smallUrl: string;
  largeUrl: string;
  version: string;
};

type ManifestItem = {
  imageKey: string;
  file: string;
  sha256: string;
  contentType: string;
};

let cached: {
  root: string;
  byKey: Map<string, ManifestItem>;
  fileByName: Map<string, { abs: string; contentType: string; sha256: string }>;
} | null = null;

function beautyRoot(): string {
  const candidates = [
    join(__dirname, 'beauty-icons'),
    join(process.cwd(), 'src/marketplace/taxonomy/beauty-icons'),
    join(process.cwd(), 'dist/marketplace/taxonomy/beauty-icons'),
  ];
  for (const c of candidates) {
    if (existsSync(join(c, 'manifest.json'))) return c;
  }
  throw new Error('BEAUTY_ICONS_MISSING_ROOT');
}

function publicBase(): string {
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
  // Reuse catalog-icons URL prefix but beauty files live under beauty-icons/
  return `${base}/marketplace/beauty-icons/`;
}

function load() {
  if (cached) return cached;
  const root = beautyRoot();
  const manifest = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8')) as {
    items: ManifestItem[];
  };
  const byKey = new Map<string, ManifestItem>();
  for (const item of manifest.items || []) {
    if (byKey.has(item.imageKey)) throw new Error(`Duplicate beauty imageKey: ${item.imageKey}`);
    byKey.set(item.imageKey, item);
  }
  const fileByName = new Map<string, { abs: string; contentType: string; sha256: string }>();
  for (const name of readdirSync(root)) {
    if (name === 'manifest.json') continue;
    if (!/\.(png|jpe?g|webp)$/i.test(name)) continue;
    const abs = join(root, name);
    const buf = readFileSync(abs);
    const sha = createHash('sha256').update(buf).digest('hex');
    const item = [...byKey.values()].find((i) => i.file === name);
    fileByName.set(name, {
      abs,
      contentType: item?.contentType || (name.endsWith('.png') ? 'image/png' : 'image/jpeg'),
      sha256: item?.sha256 || sha,
    });
  }
  for (const item of byKey.values()) {
    const f = fileByName.get(item.file);
    if (!f) throw new Error(`Missing beauty icon file ${item.file}`);
    if (f.sha256 !== item.sha256) throw new Error(`Beauty icon hash mismatch ${item.file}`);
  }
  cached = { root, byKey, fileByName };
  return cached;
}

export function resolveBeautyIcon(imageKey: string | null | undefined): BeautyIconUrls | null {
  if (!imageKey) return null;
  const { byKey } = load();
  const item = byKey.get(imageKey);
  if (!item) return null;
  const base = publicBase();
  const url = new URL(item.file, base).href;
  return { key: item.imageKey, smallUrl: url, largeUrl: url, version: item.sha256 };
}

export function absoluteBeautyIconPath(fileName: string): {
  abs: string;
  contentType: string;
} | null {
  const { fileByName } = load();
  const clean = fileName.replace(/^.*\//, '');
  const hit = fileByName.get(clean);
  if (!hit) return null;
  return { abs: hit.abs, contentType: hit.contentType };
}

export function resetBeautyIconCacheForTests() {
  cached = null;
}
