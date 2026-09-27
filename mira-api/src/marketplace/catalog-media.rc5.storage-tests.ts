import 'reflect-metadata';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer, Server } from 'node:http';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ConfigService } from '@nestjs/config';
import { CatalogMediaConnectionError, CatalogMediaPermissionError, CatalogMediaUnavailable } from './catalog-media.contract';
import { S3CompatibleCatalogMediaStorage } from './catalog-media.s3';
import { LocalCatalogMediaStorage, createCatalogMediaStorage } from './catalog-media.storage';

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

function config(): ConfigService {
  return { get: (name: string) => process.env[name] } as ConfigService;
}

async function withEnv(values: Record<string, string | undefined>, run: () => Promise<void>) {
  const previous = new Map<string, string | undefined>();
  for (const [key, value] of Object.entries(values)) {
    previous.set(key, process.env[key]);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    await run();
  } finally {
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

async function assertEmpty(dir: string) {
  const names = await readdir(dir);
  assert.deepEqual(names, []);
}

async function main() {
  if (process.env.MIRA_RC5_CHILD === '1') {
    const storage = new S3CompatibleCatalogMediaStorage({
      bucket: process.env.MIRA_MEDIA_S3_BUCKET || '',
      region: process.env.MIRA_MEDIA_S3_REGION || '',
      accessKeyId: process.env.MIRA_MEDIA_S3_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.MIRA_MEDIA_S3_SECRET_ACCESS_KEY || '',
      endpoint: process.env.MIRA_MEDIA_S3_ENDPOINT,
    });
    const bytes = await storage.get(process.env.MIRA_RC5_KEY || '');
    console.log(`child-bytes=${bytes?.length ?? 0}`);
    if (!bytes || bytes.length !== PNG.length) process.exit(1);
    return;
  }

  const dir = await mkdtemp(join(tmpdir(), 'mira-rc5-local-'));
  const local = new LocalCatalogMediaStorage(config());
  await withEnv({ NODE_ENV: 'production', MIRA_MEDIA_STORE: 'external', MIRA_MEDIA_DIR: dir }, async () => {
    await assert.rejects(() => local.put('draft-key', PNG), CatalogMediaUnavailable);
    await assert.rejects(() => local.get('draft-key'), CatalogMediaUnavailable);
    await assert.rejects(() => local.delete('draft-key'), CatalogMediaUnavailable);
    await assertEmpty(dir);
    assert.equal(createCatalogMediaStorage(config()) instanceof LocalCatalogMediaStorage, false);
  });
  console.log('production external does not write locally');

  await withEnv({ NODE_ENV: 'production', MIRA_MEDIA_STORE: undefined, MIRA_MEDIA_DIR: dir }, async () => {
    await assert.rejects(() => createCatalogMediaStorage(config()).put('a', PNG), CatalogMediaUnavailable);
    await assertEmpty(dir);
  });
  console.log('production without storage config refuses');

  await withEnv({ NODE_ENV: 'production', MIRA_MEDIA_STORE: 'not-a-provider', MIRA_MEDIA_DIR: dir }, async () => {
    await assert.rejects(() => createCatalogMediaStorage(config()).put('a', PNG), CatalogMediaUnavailable);
    await assertEmpty(dir);
  });
  console.log('production unknown provider refuses');

  await withEnv({
    NODE_ENV: 'production',
    MIRA_MEDIA_STORE: 's3',
    MIRA_MEDIA_DIR: dir,
    MIRA_MEDIA_S3_BUCKET: 'catalog',
    MIRA_MEDIA_S3_REGION: 'auto',
    MIRA_MEDIA_S3_ACCESS_KEY_ID: 'test-key',
    MIRA_MEDIA_S3_SECRET_ACCESS_KEY: undefined,
    MIRA_MEDIA_S3_ENDPOINT: undefined,
  }, async () => {
    await assert.rejects(() => createCatalogMediaStorage(config()).put('a', PNG), CatalogMediaUnavailable);
    await assertEmpty(dir);
  });
  console.log('production incomplete provider config refuses');

  await withEnv({
    NODE_ENV: 'production',
    MIRA_MEDIA_STORE: 's3',
    MIRA_MEDIA_DIR: dir,
    MIRA_MEDIA_S3_BUCKET: 'catalog',
    MIRA_MEDIA_S3_REGION: 'auto',
    MIRA_MEDIA_S3_ACCESS_KEY_ID: 'test-key',
    MIRA_MEDIA_S3_SECRET_ACCESS_KEY: 'test-secret',
    MIRA_MEDIA_S3_ENDPOINT: 'http://127.0.0.1:9',
    MIRA_MEDIA_S3_ALLOW_INSECURE_LOOPBACK: 'true',
  }, async () => {
    await assert.rejects(() => createCatalogMediaStorage(config()).put('a', PNG), CatalogMediaUnavailable);
    await assertEmpty(dir);
  });
  console.log('production http endpoint is refused before the network');

  await withEnv({
    NODE_ENV: 'production',
    MIRA_MEDIA_STORE: 's3',
    MIRA_MEDIA_DIR: dir,
    MIRA_MEDIA_S3_BUCKET: 'catalog',
    MIRA_MEDIA_S3_REGION: 'us-east-1',
    MIRA_MEDIA_S3_ACCESS_KEY_ID: 'test-key',
    MIRA_MEDIA_S3_SECRET_ACCESS_KEY: 'test-secret',
    MIRA_MEDIA_S3_ENDPOINT: 'https://127.0.0.1:9',
  }, async () => {
    await assert.rejects(() => createCatalogMediaStorage(config()).put('a', PNG), CatalogMediaConnectionError);
    await assertEmpty(dir);
  });
  console.log('production https connection failure does not fall back to local disk');

  await withEnv({ NODE_ENV: undefined, MIRA_MEDIA_STORE: 'local', MIRA_MEDIA_DIR: dir }, async () => {
    const allowed = createCatalogMediaStorage(config());
    assert.equal(allowed instanceof LocalCatalogMediaStorage, true);
    await allowed.put('kept', PNG);
    const read = await allowed.get('kept');
    assert.ok(read && read.equals(PNG));
    await allowed.delete('kept');
    assert.equal(await allowed.get('kept'), null);
  });
  console.log('explicit local test store still reads and writes');

  const objects = new Map<string, Buffer>();
  const server: Server = createServer((req, res) => {
    const key = decodeURIComponent((req.url || '').split('?')[0].split('/').pop() || '');
    if (req.headers.authorization?.includes('Credential=deny-key/')) {
      res.writeHead(403);
      res.end();
      return;
    }
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      if (req.method === 'PUT') {
        objects.set(key, Buffer.concat(chunks));
        res.writeHead(200);
        res.end();
        return;
      }
      if (req.method === 'GET') {
        const found = objects.get(key);
        if (!found) {
          res.writeHead(404);
          res.end();
          return;
        }
        res.writeHead(200);
        res.end(found);
        return;
      }
      if (req.method === 'DELETE') {
        objects.delete(key);
        res.writeHead(204);
        res.end();
        return;
      }
      res.writeHead(500);
      res.end();
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  const endpoint = `http://127.0.0.1:${port}`;
  const settings = {
    bucket: 'catalog-test',
    region: 'auto',
    accessKeyId: 'test-key',
    secretAccessKey: 'test-secret',
    endpoint,
  };
  process.env.MIRA_MEDIA_S3_ALLOW_INSECURE_LOOPBACK = 'true';
  const first = new S3CompatibleCatalogMediaStorage(settings);
  const video = Buffer.concat([Buffer.from('ftyp'), Buffer.from('moov-test-video')]);
  await first.put('image-key', PNG);
  await first.put('video-key', video);
  assert.ok((await first.get('image-key'))?.equals(PNG));
  assert.ok((await first.get('video-key'))?.equals(video));
  const emptyDir = await mkdtemp(join(tmpdir(), 'mira-rc5-empty-'));
  const child = spawn('npx', ['--no-install', 'tsx', 'src/marketplace/catalog-media.rc5.storage-tests.ts'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      NODE_ENV: 'development',
      MIRA_RC5_CHILD: '1',
      MIRA_RC5_KEY: 'image-key',
      MIRA_MEDIA_DIR: emptyDir,
      MIRA_MEDIA_STORE: 's3',
      MIRA_MEDIA_S3_BUCKET: settings.bucket,
      MIRA_MEDIA_S3_REGION: settings.region,
      MIRA_MEDIA_S3_ACCESS_KEY_ID: settings.accessKeyId,
      MIRA_MEDIA_S3_SECRET_ACCESS_KEY: settings.secretAccessKey,
      MIRA_MEDIA_S3_ENDPOINT: endpoint,
      MIRA_MEDIA_S3_ALLOW_INSECURE_LOOPBACK: 'true',
    },
  });
  let childOut = '';
  child.stdout.on('data', (chunk) => { childOut += String(chunk); });
  child.stderr.on('data', (chunk) => { childOut += String(chunk); });
  const childCode = await new Promise<number>((resolve) => child.on('exit', (code) => resolve(code ?? 1)));
  assert.equal(childCode, 0, childOut);
  assert.match(childOut, new RegExp(`child-bytes=${PNG.length}`));
  await assertEmpty(emptyDir);
  console.log('second process read the emulator object without the previous local directory');
  const denied = new S3CompatibleCatalogMediaStorage({ ...settings, accessKeyId: 'deny-key' });
  await assert.rejects(() => denied.put('blocked', PNG), CatalogMediaPermissionError);
  await first.delete('image-key');
  assert.equal(await first.get('image-key'), null);
  server.close();
  await rm(dir, { recursive: true, force: true });
  await rm(emptyDir, { recursive: true, force: true });
  console.log('rc5 storage adapter tests passed against a local emulator, not a live bucket');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
