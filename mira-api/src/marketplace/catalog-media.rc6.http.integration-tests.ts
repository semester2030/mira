import 'reflect-metadata';
import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { createServer as createNetServer } from 'node:net';
import { createServer, type Server } from 'node:http';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Module, UnauthorizedException, ValidationPipe, type INestApplication } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { CreateBucketCommand, GetObjectCommand, ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3';
import { PrismaClient } from '@prisma/client';
import { FirebaseIdTokenVerifier, VerifiedFirebaseIdentity } from '../common/auth/firebase-id-token-verifier';
import { AdminApiKeyGuard } from '../common/guards/admin-api-key.guard';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { PartnerTokenGuard } from '../partners-portal/guards/partner-token.guard';
import { PartnersPortalController } from '../partners-portal/partners-portal.controller';
import { PartnersPortalService } from '../partners-portal/partners-portal.service';
import { CatalogContentService } from './catalog-content.service';
import { CatalogMediaController } from './catalog-media.controller';
import { S3CompatibleCatalogMediaStorage } from './catalog-media.s3';
import { CatalogMediaStorage, createCatalogMediaStorage } from './catalog-media.storage';
import { CatalogReviewAdminController } from './catalog-review.admin.controller';
import { MarketplaceController } from './marketplace.controller';
import { MarketplaceService } from './marketplace.service';

const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const ROOT_USER = 'mira-rc6-http';
const ROOT_SECRET = 'mira-rc6-http-secret';
const BUCKET = 'mira-rc6-http';

class ScriptedIdTokenVerifier extends FirebaseIdTokenVerifier {
  async verify(): Promise<VerifiedFirebaseIdentity> {
    throw new UnauthorizedException('Invalid or expired Firebase token');
  }
}

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }), PrismaModule],
  controllers: [PartnersPortalController, CatalogMediaController, CatalogReviewAdminController, MarketplaceController],
  providers: [
    PartnersPortalService,
    PartnerTokenGuard,
    AdminApiKeyGuard,
    CatalogContentService,
    { provide: CatalogMediaStorage, useFactory: (config: ConfigService) => createCatalogMediaStorage(config), inject: [ConfigService] },
    { provide: MarketplaceService, useFactory: (prisma: PrismaService) => new MarketplaceService(prisma), inject: [PrismaService] },
    { provide: FirebaseIdTokenVerifier, useValue: new ScriptedIdTokenVerifier() },
  ],
})
class Rc6HttpTestModule {}

async function freePort(): Promise<number> {
  const server = createNetServer();
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  await new Promise<void>((resolve) => server.close(() => resolve()));
  return port;
}

async function boot(expectS3 = true): Promise<{ base: string; app: INestApplication }> {
  const app = await NestFactory.create(Rc6HttpTestModule, { logger: ['error'] });
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ transform: true }));
  await app.listen(0);
  const address = app.getHttpServer().address();
  const port = typeof address === 'object' && address ? address.port : 0;
  assert.equal(app.get(CatalogMediaStorage) instanceof S3CompatibleCatalogMediaStorage, expectS3);
  return { base: `http://127.0.0.1:${port}`, app };
}

async function objectCount(client: S3Client): Promise<number> {
  const listed = await client.send(new ListObjectsV2Command({ Bucket: BUCKET }));
  return listed.KeyCount ?? 0;
}

async function main() {
  const url = process.env.DATABASE_URL ?? '';
  if (!url.includes('localhost') && !url.includes('127.0.0.1')) process.exit(1);
  const dir = await mkdtemp(join(tmpdir(), 'mira-rc6-http-'));
  const prisma = new PrismaClient();
  const brand = await prisma.partner.create({ data: { type: 'brand', status: 'active', nameAr: 'تخزين RC6', nameEn: 'RC6 storage', city: 'الرياض' } });
  const other = await prisma.partner.create({ data: { type: 'brand', status: 'active', nameAr: 'شريك آخر', nameEn: 'Other', city: 'جدة' } });
  await prisma.partnerUser.create({ data: { partnerId: brand.id, email: 'rc6-brand@test.local', accessToken: 'token-rc6-brand' } });
  await prisma.partnerUser.create({ data: { partnerId: other.id, email: 'rc6-other@test.local', accessToken: 'token-rc6-other' } });
  process.env.ADMIN_API_KEY = 'ph3-rc6-admin';
  process.env.MIRA_MEDIA_DIR = dir;
  process.env.MIRA_MEDIA_STORE = 's3';
  process.env.MIRA_MEDIA_S3_BUCKET = BUCKET;
  process.env.MIRA_MEDIA_S3_REGION = 'us-east-1';
  process.env.MIRA_MEDIA_S3_ACCESS_KEY_ID = ROOT_USER;
  process.env.MIRA_MEDIA_S3_SECRET_ACCESS_KEY = ROOT_SECRET;
  const brandHeaders = { authorization: 'Bearer token-rc6-brand', 'content-type': 'application/json' };
  const otherHeaders = { authorization: 'Bearer token-rc6-other' };
  const adminHeaders = { 'x-admin-key': 'ph3-rc6-admin', 'content-type': 'application/json' };
  let minio: ChildProcess | undefined;
  let minioData = '';
  let decoy: Server | undefined;
  let admin: S3Client | undefined;
  try {
    let connections = 0;
    decoy = createServer((_req, res) => res.end('nope'));
    decoy.on('connection', () => { connections += 1; });
    await new Promise<void>((resolve) => decoy?.listen(0, '127.0.0.1', () => resolve()));
    const decoyAddress = decoy.address();
    const decoyPort = typeof decoyAddress === 'object' && decoyAddress ? decoyAddress.port : 0;
    process.env.NODE_ENV = 'production';
    process.env.MIRA_MEDIA_S3_ENDPOINT = `http://127.0.0.1:${decoyPort}`;
    process.env.MIRA_MEDIA_S3_ALLOW_INSECURE_LOOPBACK = 'true';
    const blocked = await boot(false);
    const created = await (await fetch(`${blocked.base}/api/v1/partners-portal/products`, {
      method: 'POST', headers: brandHeaders,
      body: JSON.stringify({ nameAr: 'قبل التخزين', nameEn: 'Before storage', priceHalalas: 1500, externalUrl: 'https://example.com/rc6', concernTags: ['لون'] }),
    })).json() as { id: string };
    const refused = await fetch(`${blocked.base}/api/v1/partners-portal/products/${created.id}/media`, {
      method: 'POST', headers: brandHeaders, body: JSON.stringify({ mimeType: 'image/png', dataBase64: PNG }),
    });
    const refusedText = await refused.text();
    assert.equal(refused.status, 503);
    assert.equal(refusedText.includes(dir), false);
    assert.equal(refusedText.includes(ROOT_SECRET), false);
    assert.equal(refusedText.toLowerCase().includes('authorization'), false);
    assert.equal(connections, 0);
    assert.equal(await prisma.catalogMedia.count({ where: { ownerId: created.id } }), 0);
    assert.deepEqual(await readdir(dir), []);
    await blocked.app.close();
    console.log('http production rejected an http endpoint before the network and wrote no media row');

    delete process.env.NODE_ENV;
    process.env.MIRA_MEDIA_S3_ENDPOINT = 'http://127.0.0.1:9';
    const down = await boot();
    const downResponse = await fetch(`${down.base}/api/v1/partners-portal/products/${created.id}/media`, {
      method: 'POST', headers: brandHeaders, body: JSON.stringify({ mimeType: 'image/png', dataBase64: PNG }),
    });
    const downText = await downResponse.text();
    assert.equal(downResponse.status, 503);
    assert.equal(downText.includes(ROOT_SECRET), false);
    assert.equal(await prisma.catalogMedia.count({ where: { ownerId: created.id } }), 0);
    assert.deepEqual(await readdir(dir), []);
    await down.app.close();
    console.log('http connection failure created no media row and no local file');

    const minioBinary = process.env.MIRA_RC6_MINIO_BIN || '/tmp/mira-rc6-tools/minio';
    const apiPort = await freePort();
    const consolePort = await freePort();
    minioData = await mkdtemp(join(tmpdir(), 'mira-rc6-http-minio-'));
    minio = spawn(minioBinary, ['server', minioData, '--address', `127.0.0.1:${apiPort}`, '--console-address', `127.0.0.1:${consolePort}`], {
      env: { ...process.env, MINIO_ROOT_USER: ROOT_USER, MINIO_ROOT_PASSWORD: ROOT_SECRET },
      stdio: 'ignore',
    });
    const endpoint = `http://127.0.0.1:${apiPort}`;
    let ready = false;
    for (let attempt = 0; attempt < 40; attempt += 1) {
      try {
        if ((await fetch(`${endpoint}/minio/health/live`)).ok) {
          ready = true;
          break;
        }
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
    }
    if (!ready) throw new Error('minio did not become ready');
    process.env.MIRA_MEDIA_S3_ENDPOINT = endpoint;
    admin = new S3Client({
      region: 'us-east-1',
      endpoint,
      forcePathStyle: true,
      credentials: { accessKeyId: ROOT_USER, secretAccessKey: ROOT_SECRET },
      maxAttempts: 1,
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    });
    await admin.send(new CreateBucketCommand({ Bucket: BUCKET }));
    const live = await boot();
    const imageResponse = await fetch(`${live.base}/api/v1/partners-portal/products/${created.id}/media`, {
      method: 'POST', headers: brandHeaders, body: JSON.stringify({ mimeType: 'image/png', dataBase64: PNG }),
    });
    assert.equal(imageResponse.status, 201);
    const image = await imageResponse.json() as { id: string; storageKey: string };
    const mp4 = (await readFile(join(process.cwd(), 'src/marketplace/fixtures/ph3-rc3-sample.mp4'))).toString('base64');
    const videoResponse = await fetch(`${live.base}/api/v1/partners-portal/products/${created.id}/media`, {
      method: 'POST', headers: brandHeaders, body: JSON.stringify({ mimeType: 'video/mp4', dataBase64: mp4 }),
    });
    assert.equal(videoResponse.status, 201);
    assert.deepEqual(await readdir(dir), []);
    assert.equal((await fetch(`${live.base}/api/v1/marketplace/media/${image.id}`)).status, 404);
    assert.equal((await fetch(`${live.base}/api/v1/partners-portal/media/${image.id}`, { headers: otherHeaders })).status, 404);
    const catalog = live.app.get(CatalogContentService);
    const beforeDuplicate = await objectCount(admin);
    await catalog.addMedia(brand.id, 'product', created.id, { mimeType: 'image/png', dataBase64: PNG, sourceMediaKey: 'same-source' });
    await catalog.addMedia(brand.id, 'product', created.id, { mimeType: 'image/png', dataBase64: PNG, sourceMediaKey: 'same-source' });
    assert.equal(await objectCount(admin), beforeDuplicate + 1);
    process.env.MIRA_CATALOG_FAIL_MEDIA_TX = '1';
    const failed = await fetch(`${live.base}/api/v1/partners-portal/products/${created.id}/media`, {
      method: 'POST', headers: brandHeaders, body: JSON.stringify({ mimeType: 'image/png', dataBase64: PNG }),
    });
    const failedText = await failed.text();
    delete process.env.MIRA_CATALOG_FAIL_MEDIA_TX;
    assert.equal(failed.status, 500);
    assert.equal(failedText.includes(ROOT_SECRET), false);
    assert.equal(failedText.includes(image.storageKey), false);
    assert.equal(await objectCount(admin), beforeDuplicate + 1);
    await fetch(`${live.base}/api/v1/partners-portal/products/${created.id}/submit-review`, { method: 'POST', headers: brandHeaders });
    const preview = await (await fetch(`${live.base}/api/v1/admin/catalog-reviews/product/${created.id}`, { headers: adminHeaders })).json() as { submittedRevision: number };
    assert.equal((await fetch(`${live.base}/api/v1/admin/catalog-reviews/product/${created.id}/decision`, {
      method: 'POST', headers: adminHeaders, body: JSON.stringify({ decision: 'approve', revision: preview.submittedRevision }),
    })).status, 201);
    const published = await fetch(`${live.base}/api/v1/marketplace/media/${image.id}`);
    assert.equal(published.status, 200);
    assert.equal(Buffer.from(await published.arrayBuffer()).toString('base64'), PNG);
    assert.equal((await fetch(`${live.base}/api/v1/admin/catalog-reviews/product/${created.id}/decision`, {
      method: 'POST', headers: adminHeaders, body: JSON.stringify({ decision: 'withdraw', note: 'سحب' }),
    })).status, 201);
    assert.equal((await fetch(`${live.base}/api/v1/marketplace/media/${image.id}`)).status, 404);
    const kept = await admin.send(new GetObjectCommand({ Bucket: BUCKET, Key: image.storageKey }));
    assert.equal(Buffer.from(await kept.Body!.transformToByteArray()).toString('base64'), PNG);
    const imported = await (await fetch(`${live.base}/api/v1/partners-portal/import/simulated`, {
      method: 'POST', headers: brandHeaders,
      body: JSON.stringify({ items: [{ externalId: 'rc6-sim', nameAr: 'تجريبي RC6', priceHalalas: 900, media: [{ mimeType: 'image/png', dataBase64: PNG }] }] }),
    })).json() as { mode: string };
    assert.equal(imported.mode, 'simulated');
    const simulated = await prisma.product.findFirstOrThrow({ where: { partnerId: brand.id, nameAr: 'تجريبي RC6' } });
    assert.equal((await fetch(`${live.base}/api/v1/marketplace/catalog/product/${simulated.id}`)).status, 404);
    assert.deepEqual(await readdir(dir), []);
    console.log('Firebase verifier in this run is a test double and does not prove a live Firebase connection');
    console.log('rc6 http storage passed through the s3 adapter and database, against local minio, not a live Mira resource');
    await live.app.close();
    admin.destroy();
  } finally {
    if (decoy) await new Promise<void>((resolve) => decoy?.close(() => resolve()));
    if (minio) {
      minio.kill('SIGTERM');
      await new Promise((resolve) => minio?.once('exit', resolve));
    }
    if (minioData) await rm(minioData, { recursive: true, force: true });
    await prisma.$disconnect();
    await rm(dir, { recursive: true, force: true });
    delete process.env.NODE_ENV;
    delete process.env.MIRA_CATALOG_FAIL_MEDIA_TX;
  }
}

main().catch((error) => {
  const text = error instanceof Error ? `${error.name}: ${error.message}` : 'failed';
  console.error(text.split(ROOT_SECRET).join('[redacted]'));
  process.exit(1);
});
