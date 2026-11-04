/**
 * V02 — split-process memory evidence for the real large fixture.
 * Client process uploads via HTTP; server process runs Nest + Disk multipart + ffmpeg verify.
 * Reports baseline RSS, peak RSS (server + ffmpeg children), elapsed, concurrency, and 512MiB budget.
 */
import 'reflect-metadata';
import { Module, ValidationPipe } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { json, raw, type NextFunction, type Request, type Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync, mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';
import { PrismaModule } from '../../prisma/prisma.module';
import { CatalogMediaStorage, LocalCatalogMediaStorage } from '../../marketplace/catalog-media.storage';
import { DiskMultipartUploadStore, MultipartUploadStore } from './multipart.store';
import { UploadCleanupService } from './upload-cleanup.service';
import { UploadFinalizeService } from './upload-finalize.service';
import { UploadSessionsController } from './upload-sessions.controller';
import { UploadSessionsService } from './upload-sessions.service';
import { PartnerTokenGuard } from '../guards/partner-token.guard';
import { UPLOAD_FINALIZE_CONCURRENCY } from './upload-sessions.policy';

const role = process.argv.includes('--server')
  ? 'server'
  : process.argv.includes('--client')
    ? 'client'
    : 'orchestrator';

function sampleRssKb(pid: number): number | null {
  try {
    const out = require('node:child_process')
      .execFileSync('ps', ['-o', 'rss=', '-p', String(pid)], { encoding: 'utf8' })
      .trim();
    const n = Number(out);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

function sampleTreeRssBytes(rootPid: number): { totalBytes: number; pids: number[] } {
  // Include root + descendants (ffmpeg children) via pgrep -P recursively.
  const seen = new Set<number>();
  const queue = [rootPid];
  while (queue.length) {
    const pid = queue.shift()!;
    if (seen.has(pid)) continue;
    seen.add(pid);
    try {
      const kids = require('node:child_process')
        .execFileSync('pgrep', ['-P', String(pid)], { encoding: 'utf8' })
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .map(Number);
      for (const k of kids) if (Number.isFinite(k)) queue.push(k);
    } catch {
      /* no children */
    }
  }
  let totalKb = 0;
  for (const pid of seen) {
    const kb = sampleRssKb(pid);
    if (kb != null) totalKb += kb;
  }
  return { totalBytes: totalKb * 1024, pids: [...seen] };
}

async function serverMain() {
  const diskRoot = process.env.MIRA_UPLOAD_DISK_ROOT!;
  const mediaDir = process.env.MIRA_MEDIA_DIR!;
  const listenPort = Number(process.env.MIRA_V02_PORT || '0');
  process.env.MIRA_MEDIA_DIR = mediaDir;
  process.env.MIRA_PARTNER_UPLOAD_SESSION = 'true';
  process.env.NODE_ENV = 'test';
  process.env.MIRA_UPLOAD_ALLOW_DIRECT_PARTS = 'true';
  process.env.MIRA_UPLOAD_PART_SIZE_BYTES = process.env.MIRA_UPLOAD_PART_SIZE_BYTES || String(16 * 1024 * 1024);
  process.env.MIRA_UPLOAD_FINALIZE_CONCURRENCY = process.env.MIRA_UPLOAD_FINALIZE_CONCURRENCY || '2';

  const store = new DiskMultipartUploadStore(diskRoot);

  @Module({
    imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }), PrismaModule],
    controllers: [UploadSessionsController],
    providers: [
      PartnerTokenGuard,
      UploadSessionsService,
      UploadFinalizeService,
      UploadCleanupService,
      { provide: MultipartUploadStore, useValue: store },
      {
        provide: CatalogMediaStorage,
        useFactory: (config: ConfigService) => new LocalCatalogMediaStorage(config),
        inject: [ConfigService],
      },
    ],
  })
  class Srv {}

  const app = await NestFactory.create(Srv, { bodyParser: false, logger: ['error'] });
  app.use((req: Request, res: Response, next: NextFunction) => {
    const path = (req.originalUrl || req.url || '').split('?')[0];
    if (req.method === 'PUT' && /\/upload-sessions\/[^/]+\/direct-parts\/\d+$/.test(path)) {
      return raw({ type: '*/*', limit: '64mb' })(req, res, next);
    }
    return json({ limit: '4mb' })(req, res, next);
  });
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ transform: true }));
  await app.listen(listenPort, '127.0.0.1');
  const address = app.getHttpServer().address();
  const port = typeof address === 'object' && address ? address.port : listenPort;
  console.log(JSON.stringify({ ready: true, port, pid: process.pid, concurrency: UPLOAD_FINALIZE_CONCURRENCY }));
}

async function clientMain() {
  const base = process.env.MIRA_V02_BASE!;
  const token = process.env.MIRA_V02_TOKEN!;
  const ownerId = process.env.MIRA_V02_OWNER_ID!;
  const fixturePath = process.env.MIRA_V02_FIXTURE!;
  const bytes = readFileSync(fixturePath);
  const auth = { authorization: `Bearer ${token}`, 'content-type': 'application/json' };

  async function abs(u: string) {
    return u.startsWith('http') ? u : `${base.replace(/\/api\/v1$/, '')}${u.startsWith('/') ? u : '/' + u}`;
  }

  async function uploadOne() {
    const init = await (
      await fetch(`${base}/partners-portal/upload-sessions`, {
        method: 'POST',
        headers: auth,
        body: JSON.stringify({
          ownerKind: 'product',
          ownerId,
          clientMediaId: randomUUID(),
          idempotencyKey: randomUUID(),
          mimeType: 'video/mp4',
          byteSize: bytes.length,
          checksum: createHash('sha256').update(bytes).digest('hex'),
        }),
      })
    ).json();
    if (!init.sessionId) throw new Error('init failed ' + JSON.stringify(init));
    const completed: Array<{ partNumber: number; etag: string; size: number }> = [];
    for (let n = 1; n <= init.totalParts; n++) {
      const start = (n - 1) * init.partSizeBytes;
      const chunk = bytes.subarray(start, Math.min(bytes.length, start + init.partSizeBytes));
      const sign = await (
        await fetch(`${base}/partners-portal/upload-sessions/${init.sessionId}/parts/${n}/sign`, {
          method: 'POST',
          headers: auth,
          body: '{}',
        })
      ).json();
      const put = await fetch(await abs(sign.url), {
        method: 'PUT',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/octet-stream' },
        body: new Uint8Array(chunk),
      });
      const body = await put.json();
      if (!put.ok) throw new Error('put fail ' + JSON.stringify(body));
      completed.push({ partNumber: n, etag: body.etag, size: chunk.length });
    }
    await fetch(`${base}/partners-portal/upload-sessions/${init.sessionId}/complete`, {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({ parts: completed }),
    });
    const deadline = Date.now() + 180_000;
    while (Date.now() < deadline) {
      const st = await (await fetch(`${base}/partners-portal/upload-sessions/${init.sessionId}`, { headers: auth })).json();
      if (st.status === 'ready' && st.catalogMediaId) return st;
      if (st.status === 'failed' && st.failureClass === 'permanent') return st;
      await new Promise((r) => setTimeout(r, 200));
    }
    throw new Error('timeout waiting ready');
  }

  const [a, b] = await Promise.all([uploadOne(), uploadOne()]);
  console.log(JSON.stringify({ clientDone: true, statuses: [a.status, b.status], media: [a.catalogMediaId, b.catalogMediaId] }));
}

async function orchestratorMain() {
  const outDir =
    process.env.MIRA_P21_OUT_DIR || join(process.cwd(), '..', 'audit-out', 'p2-1-p2-2', 'logs', 'memory-v02');
  mkdirSync(outDir, { recursive: true });
  const url = process.env.DATABASE_URL || '';
  const host = new URL(url).hostname;
  if (!['localhost', '127.0.0.1', '::1'].includes(host)) {
    console.error('REFUSE non-local DB');
    process.exit(1);
  }
  const fixture =
    process.env.MIRA_V02_FIXTURE || join(__dirname, 'fixtures', 'valid-u11-16m.mp4');
  if (!existsSync(fixture)) {
    console.error('missing fixture', fixture);
    process.exit(1);
  }
  const fileBytes = readFileSync(fixture).length;
  const budgetBytes = 512 * 1024 * 1024;
  const prisma = new PrismaClient();
  const suffix = randomUUID().slice(0, 8);
  const brand = await prisma.partner.create({
    data: { type: 'brand', status: 'active', nameAr: `V02 ${suffix}`, nameEn: 'V02', city: 'الرياض' },
  });
  const token = `token-v02-${suffix}`;
  await prisma.partnerUser.create({
    data: { partnerId: brand.id, email: `v02-${suffix}@test.local`, accessToken: token },
  });
  const product = await prisma.product.create({
    data: {
      partnerId: brand.id,
      nameAr: 'V02',
      nameEn: 'V02',
      priceHalalas: 1000,
      externalUrl: '',
      concernTags: [],
      skinTypes: [],
      contentStatus: 'draft',
      reviewStatus: 'draft',
    },
  });

  const diskRoot = mkdtempSync(join(tmpdir(), 'mira-v02-disk-'));
  const mediaDir = mkdtempSync(join(tmpdir(), 'mira-v02-media-'));

  const server = spawn(
    process.execPath,
    ['--import', 'tsx', join(__dirname, 'memory-split-process.evidence.ts'), '--server'],
    {
      env: {
        ...process.env,
        MIRA_UPLOAD_DISK_ROOT: diskRoot,
        MIRA_MEDIA_DIR: mediaDir,
        MIRA_V02_PORT: '0',
        DATABASE_URL: url,
        MIRA_UPLOAD_PART_SIZE_BYTES: String(16 * 1024 * 1024),
        MIRA_UPLOAD_FINALIZE_CONCURRENCY: '2',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  let serverOut = '';
  server.stdout?.on('data', (c) => {
    serverOut += c.toString();
  });
  server.stderr?.on('data', (c) => {
    serverOut += c.toString();
  });

  const ready = await new Promise<{ port: number; pid: number }>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('server start timeout')), 30_000);
    const tick = () => {
      const lines = serverOut.split('\n');
      for (const line of lines) {
        try {
          const j = JSON.parse(line);
          if (j.ready && j.port) {
            clearTimeout(t);
            resolve({ port: j.port, pid: j.pid });
            return;
          }
        } catch {
          /* continue */
        }
      }
      setTimeout(tick, 50);
    };
    tick();
  });

  const baseline = sampleTreeRssBytes(ready.pid);
  let peak = baseline.totalBytes;
  const monitor = setInterval(() => {
    const snap = sampleTreeRssBytes(ready.pid);
    if (snap.totalBytes > peak) peak = snap.totalBytes;
  }, 100);

  const t0 = Date.now();
  const client = spawn(
    process.execPath,
    ['--import', 'tsx', join(__dirname, 'memory-split-process.evidence.ts'), '--client'],
    {
      env: {
        ...process.env,
        MIRA_V02_BASE: `http://127.0.0.1:${ready.port}/api/v1`,
        MIRA_V02_TOKEN: token,
        MIRA_V02_OWNER_ID: product.id,
        MIRA_V02_FIXTURE: fixture,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  let clientOut = '';
  let clientErr = '';
  client.stdout?.on('data', (c) => {
    clientOut += c.toString();
  });
  client.stderr?.on('data', (c) => {
    clientErr += c.toString();
  });
  const clientCode: number = await new Promise((r) => client.on('exit', (c) => r(c ?? 1)));
  clearInterval(monitor);
  const elapsedMs = Date.now() - t0;
  const after = sampleTreeRssBytes(ready.pid);

  let clientResult: { statuses?: string[] } = {};
  try {
    clientResult = JSON.parse(clientOut.trim().split('\n').pop() || '{}');
  } catch {
    /* ignore */
  }

  const bothReady = Array.isArray(clientResult.statuses) && clientResult.statuses.every((s) => s === 'ready');
  const underBudget = peak <= budgetBytes;
  const report = {
    ok: clientCode === 0 && bothReady && underBudget,
    id: 'V02',
    storeMode: 'disk',
    processSplit: true,
    serverPid: ready.pid,
    clientPid: client.pid,
    concurrency: 2,
    partSizeBytes: 16 * 1024 * 1024,
    fileBytes,
    expectedParts: Math.ceil(fileBytes / (16 * 1024 * 1024)),
    baselineRssBytes: baseline.totalBytes,
    peakRssBytes: peak,
    afterRssBytes: after.totalBytes,
    peakDeltaBytes: peak - baseline.totalBytes,
    budgetBytes,
    budgetMeaning:
      '512MiB compares against server process tree RSS (Nest + Disk multipart + ffmpeg children), not peakDelta alone',
    elapsedMs,
    bothReady,
    underBudget,
    clientCode,
    clientOut: clientOut.trim().slice(0, 1000),
    clientErr: clientErr.slice(0, 500),
    fixtureSha256: createHash('sha256').update(readFileSync(fixture)).digest('hex'),
  };
  writeFileSync(join(outDir, 'MEMORY_V02_SPLIT.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  server.kill('SIGTERM');
  await prisma.$disconnect();
  rmSync(diskRoot, { recursive: true, force: true });
  rmSync(mediaDir, { recursive: true, force: true });
  process.exit(report.ok ? 0 : 1);
}

if (role === 'server') {
  serverMain().catch((e) => {
    console.error(e);
    process.exit(2);
  });
} else if (role === 'client') {
  clientMain().catch((e) => {
    console.error(e);
    process.exit(2);
  });
} else {
  orchestratorMain().catch((e) => {
    console.error(e);
    process.exit(2);
  });
}
