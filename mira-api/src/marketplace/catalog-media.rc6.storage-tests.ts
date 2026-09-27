import 'reflect-metadata';
import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { createServer as createNetServer } from 'node:net';
import { createServer, type Server } from 'node:http';
import { createServer as createHttpsServer } from 'node:https';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Agent } from 'node:https';
import { ConfigService } from '@nestjs/config';
import { CreateBucketCommand, ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3';
import { CatalogMediaConnectionError, CatalogMediaPermissionError, CatalogMediaUnavailable } from './catalog-media.contract';
import { S3CompatibleCatalogMediaStorage } from './catalog-media.s3';
import { createCatalogMediaStorage } from './catalog-media.storage';

const exec = promisify(execFile);
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const ROOT_USER = 'mira-rc6-test';
const ROOT_SECRET = 'mira-rc6-test-secret';
const LIMITED_USER = 'mira-rc6-readonly';
const LIMITED_SECRET = 'mira-rc6-readonly-secret';
const BUCKET = 'mira-rc6-catalog';
const SECRETS = [ROOT_SECRET, LIMITED_SECRET];

function redact(text: string): string {
  let safe = text;
  for (const secret of SECRETS) safe = safe.split(secret).join('[redacted]');
  return safe
    .replace(/authorization:[^\n]*/gi, 'authorization:[redacted]')
    .replace(/Credential=[^,\s]+/g, 'Credential=[redacted]')
    .replace(/Signature=[0-9a-f]+/gi, 'Signature=[redacted]');
}

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

function listen(server: Server): Promise<number> {
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      resolve(typeof address === 'object' && address ? address.port : 0);
    });
  });
}

function close(server: Server): Promise<void> {
  return new Promise((resolve) => server.close(() => resolve()));
}

async function freePort(): Promise<number> {
  const server = createNetServer();
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  await new Promise<void>((resolve) => server.close(() => resolve()));
  return port;
}

function storage(endpoint: string, overrides: { accessKeyId?: string; secretAccessKey?: string; timeoutMs?: number; tamperSignature?: boolean; httpsAgent?: Agent } = {}) {
  return new S3CompatibleCatalogMediaStorage({
    bucket: BUCKET,
    region: 'us-east-1',
    accessKeyId: overrides.accessKeyId ?? ROOT_USER,
    secretAccessKey: overrides.secretAccessKey ?? ROOT_SECRET,
    endpoint,
  }, {
    timeoutMs: overrides.timeoutMs ?? 400,
    tamperSignature: overrides.tamperSignature,
    httpsAgent: overrides.httpsAgent,
  });
}

async function main() {
  if (process.env.MIRA_RC6_CHILD === '1') {
    const client = new S3CompatibleCatalogMediaStorage({
      bucket: process.env.MIRA_MEDIA_S3_BUCKET || '',
      region: process.env.MIRA_MEDIA_S3_REGION || '',
      accessKeyId: process.env.MIRA_MEDIA_S3_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.MIRA_MEDIA_S3_SECRET_ACCESS_KEY || '',
      endpoint: process.env.MIRA_MEDIA_S3_ENDPOINT,
    });
    const bytes = await client.get(process.env.MIRA_RC6_KEY || '');
    console.log(`child-bytes=${bytes?.length ?? 0}`);
    if (!bytes || bytes.length !== Number(process.env.MIRA_RC6_EXPECT || '0')) process.exit(1);
    return;
  }

  const notes: string[] = [];
  const originalError = console.error;
  console.error = (...args: unknown[]) => {
    notes.push(redact(args.map((item) => String(item)).join(' ')));
  };
  const dir = await mkdtemp(join(tmpdir(), 'mira-rc6-local-'));
  process.env.MIRA_MEDIA_DIR = dir;
  let minio: ChildProcess | undefined;
  let minioData = '';
  let mcConfig = '';
  const servers: Server[] = [];
  try {
    let connections = 0;
    const decoy = createServer((_req, res) => { res.end('nope'); });
    decoy.on('connection', () => { connections += 1; });
    servers.push(decoy);
    const decoyPort = await listen(decoy);
    await withEnv({
      NODE_ENV: 'production',
      MIRA_MEDIA_STORE: 's3',
      MIRA_MEDIA_S3_BUCKET: BUCKET,
      MIRA_MEDIA_S3_REGION: 'us-east-1',
      MIRA_MEDIA_S3_ACCESS_KEY_ID: ROOT_USER,
      MIRA_MEDIA_S3_SECRET_ACCESS_KEY: ROOT_SECRET,
      MIRA_MEDIA_S3_ENDPOINT: `http://127.0.0.1:${decoyPort}`,
      MIRA_MEDIA_S3_ALLOW_INSECURE_LOOPBACK: 'true',
    }, async () => {
      const started = Date.now();
      await assert.rejects(() => storage(`http://127.0.0.1:${decoyPort}`).put('blocked', PNG), CatalogMediaUnavailable);
      await assert.rejects(() => createCatalogMediaStorage(config()).put('blocked', PNG), CatalogMediaUnavailable);
      assert.ok(Date.now() - started < 500);
    });
    assert.equal(connections, 0);
    assert.deepEqual(await readdir(dir), []);
    console.log('production http endpoint refused before any network request');

    const invalidCases: Array<[string, string]> = [
      ['not a url', 'invalid'],
      ['ftp://127.0.0.1/file', 'protocol'],
      ['https://user:s3cret@127.0.0.1', 'credentials'],
      ['https://127.0.0.1/bucket', 'path'],
      ['https://127.0.0.1/?token=1', 'query'],
    ];
    for (const [endpoint, reason] of invalidCases) {
      const before = notes.length;
      await withEnv({ NODE_ENV: 'production' }, async () => {
        await assert.rejects(() => storage(endpoint).put('blocked', PNG), CatalogMediaUnavailable);
      });
      assert.equal(notes.slice(before).some((line) => line.includes(`catalog-media-endpoint-rejected ${reason}`)), true, reason);
      assert.equal(notes.slice(before).some((line) => line.includes(endpoint) || line.includes('s3cret')), false, reason);
    }
    console.log('invalid endpoint, protocol, credentials, path, and query are rejected without logging them');

    await withEnv({ NODE_ENV: 'development', MIRA_MEDIA_S3_ALLOW_INSECURE_LOOPBACK: undefined }, async () => {
      const started = Date.now();
      await assert.rejects(() => storage('http://203.0.113.10').put('blocked', PNG), CatalogMediaUnavailable);
      assert.ok(Date.now() - started < 500);
    });
    await withEnv({ NODE_ENV: 'development', MIRA_MEDIA_S3_ALLOW_INSECURE_LOOPBACK: 'true' }, async () => {
      const started = Date.now();
      await assert.rejects(() => storage('http://203.0.113.10').put('blocked', PNG), CatalogMediaUnavailable);
      assert.ok(Date.now() - started < 500);
    });
    console.log('external http is refused outside production, including with the loopback test flag');

    const silent = createServer(() => undefined);
    servers.push(silent);
    const silentPort = await listen(silent);
    const slow = storage(`http://127.0.0.1:${silentPort}`, { timeoutMs: 300 });
    await withEnv({ NODE_ENV: undefined, MIRA_MEDIA_S3_ALLOW_INSECURE_LOOPBACK: 'true' }, async () => {
      const started = Date.now();
      await assert.rejects(() => slow.put('stall-put', PNG), CatalogMediaConnectionError);
      const elapsed = Date.now() - started;
      assert.ok(elapsed >= 250 && elapsed < 2000, `put timeout ${elapsed}`);
      assert.equal(slow.openTimers, 0);
      const methods: string[] = [];
      const counted = createServer((req) => { methods.push(req.method || ''); });
      servers.push(counted);
      const countedPort = await listen(counted);
      const countedStorage = storage(`http://127.0.0.1:${countedPort}`, { timeoutMs: 300 });
      await assert.rejects(() => countedStorage.put('stall-counted', PNG), CatalogMediaConnectionError);
      await assert.rejects(() => countedStorage.delete('stall-counted'), CatalogMediaConnectionError);
      assert.equal(methods.filter((method) => method === 'PUT').length, 1);
      assert.equal(methods.filter((method) => method === 'DELETE').length, 2);
      assert.equal(countedStorage.openTimers, 0);

      const hangBody = createServer((req, res) => {
        if (req.method === 'GET') {
          res.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Content-Length': '1000000' });
          res.write(Buffer.alloc(16));
          return;
        }
        res.writeHead(200);
        res.end();
      });
      servers.push(hangBody);
      const hangPort = await listen(hangBody);
      const hangStorage = storage(`http://127.0.0.1:${hangPort}`, { timeoutMs: 300 });
      const hangStarted = Date.now();
      await assert.rejects(() => hangStorage.get('hang-body'), CatalogMediaConnectionError);
      assert.ok(Date.now() - hangStarted < 2000);
      assert.equal(hangStorage.openTimers, 0);

      const dropBody = createServer((req, res) => {
        if (req.method === 'GET') {
          res.writeHead(200, { 'Content-Length': '1000' });
          res.write(Buffer.alloc(10));
          res.destroy();
          return;
        }
        res.writeHead(200);
        res.end();
      });
      servers.push(dropBody);
      const dropPort = await listen(dropBody);
      await assert.rejects(() => storage(`http://127.0.0.1:${dropPort}`, { timeoutMs: 1000 }).get('dropped'), CatalogMediaConnectionError);

      const okServer = createServer((req, res) => {
        const chunks: Buffer[] = [];
        req.on('data', (chunk) => chunks.push(chunk));
        req.on('end', () => {
          res.writeHead(req.method === 'GET' ? 200 : 204);
          res.end(req.method === 'GET' ? Buffer.concat(chunks.length ? chunks : [PNG]) : undefined);
        });
      });
      servers.push(okServer);
      const okPort = await listen(okServer);
      const okStorage = storage(`http://127.0.0.1:${okPort}`, { timeoutMs: 2000 });
      const timersBefore = process.getActiveResourcesInfo().filter((item) => item === 'Timeout').length;
      await okStorage.put('ok', PNG);
      assert.ok((await okStorage.get('ok'))?.equals(PNG));
      await okStorage.delete('ok');
      assert.equal(okStorage.openTimers, 0);
      assert.equal(process.getActiveResourcesInfo().filter((item) => item === 'Timeout').length, timersBefore);
    });
    assert.deepEqual(await readdir(dir), []);
    console.log('timeouts cover headers and body; success leaves no timer; failure writes no local file');

    const certDir = await mkdtemp(join(tmpdir(), 'mira-rc6-cert-'));
    const keyPath = join(certDir, 'key.pem');
    const certPath = join(certDir, 'cert.pem');
    await exec('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-keyout', keyPath, '-out', certPath, '-days', '1', '-nodes', '-subj', '/CN=localhost', '-addext', 'subjectAltName=DNS:localhost']);
    const cert = await readFile(certPath);
    const key = await readFile(keyPath);
    const agent = new Agent({ ca: cert, servername: 'localhost' });
    let httpHits = 0;
    const httpRedirect = createServer((_req, res) => {
      httpHits += 1;
      res.end('followed');
    });
    servers.push(httpRedirect);
    const httpPort = await listen(httpRedirect);
    const httpsRedirect = createHttpsServer({ key, cert }, (_req, res) => {
      res.writeHead(302, { Location: `http://127.0.0.1:${httpPort}/mira-rc6-catalog/redirected` });
      res.end();
    });
    servers.push(httpsRedirect);
    const httpsPort = await listen(httpsRedirect);
    await withEnv({ NODE_ENV: 'production', MIRA_MEDIA_S3_ALLOW_INSECURE_LOOPBACK: undefined }, async () => {
      await assert.rejects(
        () => storage(`https://localhost:${httpsPort}`, { timeoutMs: 2000, httpsAgent: agent }).put('redirected', PNG),
        CatalogMediaConnectionError,
      );
    });
    assert.equal(httpHits, 0);
    console.log('https to http redirect was not followed');

    const objects = new Map<string, Buffer>();
    const httpsOk = createHttpsServer({ key, cert }, (req, res) => {
      const objectKey = decodeURIComponent((req.url || '').split('?')[0].split('/').pop() || '');
      const chunks: Buffer[] = [];
      req.on('data', (chunk) => chunks.push(chunk));
      req.on('end', () => {
        if (req.method === 'PUT') objects.set(objectKey, Buffer.concat(chunks));
        if (req.method === 'GET') {
          const found = objects.get(objectKey);
          if (!found) {
            res.writeHead(404);
            res.end();
            return;
          }
          res.writeHead(200);
          res.end(found);
          return;
        }
        res.writeHead(200);
        res.end();
      });
    });
    servers.push(httpsOk);
    const httpsOkPort = await listen(httpsOk);
    await withEnv({ NODE_ENV: 'production' }, async () => {
      const httpsStorage = storage(`https://localhost:${httpsOkPort}`, { timeoutMs: 2000, httpsAgent: agent });
      await httpsStorage.put('secure-image', PNG);
      assert.ok((await httpsStorage.get('secure-image'))?.equals(PNG));
    });
    console.log('valid https reached the adapter');
    await rm(certDir, { recursive: true, force: true });

    const minioBinary = process.env.MIRA_RC6_MINIO_BIN || '/tmp/mira-rc6-tools/minio';
    const mcBinary = process.env.MIRA_RC6_MC_BIN || '/tmp/mira-rc6-tools/mc';
    const version = (await exec(minioBinary, ['--version'])).stdout;
    assert.match(version, /RELEASE\.2025-09-07T16-13-09Z/);
    console.log('minio version RELEASE.2025-09-07T16-13-09Z signature verification enabled');
    const apiPort = await freePort();
    const consolePort = await freePort();
    minioData = await mkdtemp(join(tmpdir(), 'mira-rc6-minio-'));
    mcConfig = await mkdtemp(join(tmpdir(), 'mira-rc6-mc-'));
    minio = spawn(minioBinary, ['server', minioData, '--address', `127.0.0.1:${apiPort}`, '--console-address', `127.0.0.1:${consolePort}`], {
      env: { ...process.env, MINIO_ROOT_USER: ROOT_USER, MINIO_ROOT_PASSWORD: ROOT_SECRET },
      stdio: 'ignore',
    });
    const endpoint = `http://127.0.0.1:${apiPort}`;
    let ready = false;
    for (let attempt = 0; attempt < 40; attempt += 1) {
      try {
        const health = await fetch(`${endpoint}/minio/health/live`);
        if (health.ok) {
          ready = true;
          break;
        }
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
    }
    if (!ready) throw new Error('minio did not become ready');
    const admin = new S3Client({
      region: 'us-east-1',
      endpoint,
      forcePathStyle: true,
      credentials: { accessKeyId: ROOT_USER, secretAccessKey: ROOT_SECRET },
      maxAttempts: 1,
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    });
    await admin.send(new CreateBucketCommand({ Bucket: BUCKET }));
    await withEnv({ NODE_ENV: undefined, MIRA_MEDIA_S3_ALLOW_INSECURE_LOOPBACK: 'true' }, async () => {
      const live = storage(endpoint, { timeoutMs: 5000 });
      await live.put('protocol-image', PNG);
      const video = await readFile(join(process.cwd(), 'src/marketplace/fixtures/ph3-rc3-sample.mp4'));
      await live.put('protocol-video', video);
      assert.ok((await live.get('protocol-image'))?.equals(PNG));
      const readVideo = await live.get('protocol-video');
      assert.ok(readVideo?.equals(video));
      assert.ok(readVideo?.includes(Buffer.from('moov')));
      const listed = await admin.send(new ListObjectsV2Command({ Bucket: BUCKET }));
      assert.equal(listed.KeyCount, 2);
      await live.put('protocol-image', PNG);
      const again = await admin.send(new ListObjectsV2Command({ Bucket: BUCKET }));
      assert.equal(again.KeyCount, 2);
      await assert.rejects(() => storage(endpoint, { secretAccessKey: 'wrong-secret-value', timeoutMs: 5000 }).put('rejected-secret', PNG), CatalogMediaPermissionError);
      await assert.rejects(() => storage(endpoint, { timeoutMs: 5000, tamperSignature: true }).put('rejected-tamper', PNG), CatalogMediaPermissionError);
      const afterRejects = await admin.send(new ListObjectsV2Command({ Bucket: BUCKET }));
      assert.equal(afterRejects.Contents?.some((item) => item.Key === 'rejected-secret' || item.Key === 'rejected-tamper'), false);
      assert.equal(await live.get('missing-object'), null);
      const emptyDir = await mkdtemp(join(tmpdir(), 'mira-rc6-empty-'));
      const child = spawn('npx', ['--no-install', 'tsx', 'src/marketplace/catalog-media.rc6.storage-tests.ts'], {
        cwd: process.cwd(),
        env: {
          ...process.env,
          NODE_ENV: 'development',
          MIRA_RC6_CHILD: '1',
          MIRA_RC6_KEY: 'protocol-image',
          MIRA_RC6_EXPECT: String(PNG.length),
          MIRA_MEDIA_DIR: emptyDir,
          MIRA_MEDIA_STORE: 's3',
          MIRA_MEDIA_S3_BUCKET: BUCKET,
          MIRA_MEDIA_S3_REGION: 'us-east-1',
          MIRA_MEDIA_S3_ACCESS_KEY_ID: ROOT_USER,
          MIRA_MEDIA_S3_SECRET_ACCESS_KEY: ROOT_SECRET,
          MIRA_MEDIA_S3_ENDPOINT: endpoint,
          MIRA_MEDIA_S3_ALLOW_INSECURE_LOOPBACK: 'true',
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      let childOut = '';
      child.stdout?.on('data', (chunk) => { childOut += String(chunk); });
      child.stderr?.on('data', (chunk) => { childOut += String(chunk); });
      const childCode = await new Promise<number>((resolve) => child.on('exit', (code) => resolve(code ?? 1)));
      assert.equal(childCode, 0, redact(childOut));
      assert.match(childOut, new RegExp(`child-bytes=${PNG.length}`));
      assert.deepEqual(await readdir(emptyDir), []);
      await rm(emptyDir, { recursive: true, force: true });
      console.log('second process read the minio object without the previous local directory');

      await exec(mcBinary, ['alias', 'set', 'rc6', endpoint, ROOT_USER, ROOT_SECRET], { env: { ...process.env, MC_CONFIG_DIR: mcConfig } });
      await exec(mcBinary, ['admin', 'user', 'add', 'rc6', LIMITED_USER, LIMITED_SECRET], { env: { ...process.env, MC_CONFIG_DIR: mcConfig } });
      await exec(mcBinary, ['admin', 'policy', 'attach', 'rc6', 'readonly', '--user', LIMITED_USER], { env: { ...process.env, MC_CONFIG_DIR: mcConfig } });
      const beforePermission = notes.length;
      await assert.rejects(() => storage(endpoint, { accessKeyId: LIMITED_USER, secretAccessKey: LIMITED_SECRET, timeoutMs: 5000 }).put('not-allowed', PNG), CatalogMediaPermissionError);
      assert.equal(notes.slice(beforePermission).some((line) => line.includes('catalog-media-permission')), true);
      assert.equal(notes.slice(beforePermission).some((line) => line.includes('catalog-media-connection-failed')), false);
      const beforeDown = notes.length;
      await assert.rejects(() => storage('http://127.0.0.1:9', { timeoutMs: 400 }).put('down', PNG), CatalogMediaConnectionError);
      assert.equal(notes.slice(beforeDown).some((line) => line.includes('catalog-media-connection-failed')), true);
      assert.deepEqual(await readdir(dir), []);
      await live.delete('protocol-image');
      await live.delete('protocol-video');
      assert.equal(await live.get('protocol-image'), null);
    });
    admin.destroy();
    console.log('minio accepted a correct signature and rejected a wrong secret and a tampered signature');
    console.log('local protocol verification only; live Mira resource verification was not run');
    const joined = notes.join('\n');
    assert.equal(joined.includes('Authorization'), false);
    assert.equal(joined.includes(ROOT_SECRET), false);
    assert.equal(joined.includes(LIMITED_SECRET), false);
    assert.equal(joined.includes('s3cret'), false);
    console.log('rc6 storage tests passed');
  } finally {
    console.error = originalError;
    for (const server of servers) await close(server);
    if (minio) {
      minio.kill('SIGTERM');
      await new Promise((resolve) => minio?.once('exit', resolve));
    }
    if (minioData) await rm(minioData, { recursive: true, force: true });
    if (mcConfig) await rm(mcConfig, { recursive: true, force: true });
    await rm(dir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  const text = error instanceof Error ? `${error.name}: ${error.message}` : 'failed';
  console.error(redact(text));
  process.exit(1);
});
