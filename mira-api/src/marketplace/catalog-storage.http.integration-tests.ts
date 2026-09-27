import 'reflect-metadata';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, chmod, copyFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { INestApplication, Module, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { PrismaClient } from '@prisma/client';
import { AdminApiKeyGuard } from '../common/guards/admin-api-key.guard';
import { PrismaModule } from '../prisma/prisma.module';
import { PartnerTokenGuard } from '../partners-portal/guards/partner-token.guard';
import { PartnersPortalController } from '../partners-portal/partners-portal.controller';
import { PartnersPortalService } from '../partners-portal/partners-portal.service';
import { CatalogContentService } from './catalog-content.service';
import { CatalogMediaController } from './catalog-media.controller';
import { CatalogMediaStorage, LocalCatalogMediaStorage } from './catalog-media.storage';
import { CatalogReviewAdminController } from './catalog-review.admin.controller';

const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const HEADER_ONLY_MP4 = Buffer.concat([
  Buffer.alloc(4),
  Buffer.from('ftyp'),
  Buffer.from('isom'),
  Buffer.alloc(24),
]).toString('base64');

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }), PrismaModule],
  controllers: [PartnersPortalController, CatalogMediaController, CatalogReviewAdminController],
  providers: [
    PartnersPortalService,
    PartnerTokenGuard,
    AdminApiKeyGuard,
    CatalogContentService,
    { provide: CatalogMediaStorage, useClass: LocalCatalogMediaStorage },
  ],
})
class StorageHttpTestModule {}

async function main() {
  const url = process.env.DATABASE_URL ?? '';
  if (!url.includes('localhost') && !url.includes('127.0.0.1')) process.exit(1);
  const dir = await mkdtemp(join(tmpdir(), 'mira-rc2-media-'));
  process.env.MIRA_MEDIA_DIR = dir;
  process.env.ADMIN_API_KEY = 'ph3-admin-test-key';
  const prisma = new PrismaClient();
  const partner = await prisma.partner.create({
    data: { type: 'brand', status: 'active', nameAr: 'تخزين محلي', nameEn: 'Local storage', city: 'الرياض' },
  });
  await prisma.partnerUser.create({ data: { partnerId: partner.id, email: 'storage-ph3@test.local', accessToken: 'token-storage-ph3' } });
  const app = await NestFactory.create(StorageHttpTestModule, { logger: ['error'] });
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ transform: true }));
  await app.listen(0);
  const address = app.getHttpServer().address();
  const port = typeof address === 'object' && address ? address.port : 0;
  const base = `http://127.0.0.1:${port}`;
  const headers = { authorization: 'Bearer token-storage-ph3', 'content-type': 'application/json' };
  const admin = { 'x-admin-key': 'ph3-admin-test-key', 'content-type': 'application/json' };
  const created = await (await fetch(`${base}/api/v1/partners-portal/products`, {
    method: 'POST', headers,
    body: JSON.stringify({ nameAr: 'ملف محلي', nameEn: 'Local file', priceHalalas: 1000, externalUrl: 'https://example.com/local', concernTags: ['لون'] }),
  })).json() as { id: string };
  const bad = await fetch(`${base}/api/v1/partners-portal/products/${created.id}/media`, {
    method: 'POST', headers, body: JSON.stringify({ mimeType: 'image/png', dataBase64: Buffer.from('nope').toString('base64') }),
  });
  assert.equal(bad.status, 400);
  const image = await (await fetch(`${base}/api/v1/partners-portal/products/${created.id}/media`, {
    method: 'POST', headers, body: JSON.stringify({ mimeType: 'image/png', dataBase64: PNG }),
  })).json() as { id: string; storageKey: string };
  const headerOnly = await fetch(`${base}/api/v1/partners-portal/products/${created.id}/media`, {
    method: 'POST', headers, body: JSON.stringify({ mimeType: 'video/mp4', dataBase64: HEADER_ONLY_MP4 }),
  });
  assert.equal(headerOnly.status, 400);
  const mp4 = (await readFile(join(process.cwd(), 'src/marketplace/fixtures/ph3-rc3-sample.mp4'))).toString('base64');
  const video = await fetch(`${base}/api/v1/partners-portal/products/${created.id}/media`, {
    method: 'POST', headers, body: JSON.stringify({ mimeType: 'video/mp4', dataBase64: mp4 }),
  });
  assert.equal(video.status, 201);
  const row = await prisma.catalogMedia.findUniqueOrThrow({ where: { id: image.id } });
  const disk = await readFile(join(dir, row.storageKey!));
  assert.equal(disk.length, row.byteSize);
  await fetch(`${base}/api/v1/partners-portal/products/${created.id}/submit-review`, { method: 'POST', headers });
  const preview = await (await fetch(`${base}/api/v1/admin/catalog-reviews/product/${created.id}`, { headers: admin })).json() as { submittedRevision: number };
  const approved = await fetch(`${base}/api/v1/admin/catalog-reviews/product/${created.id}/decision`, {
    method: 'POST', headers: admin, body: JSON.stringify({ decision: 'approve', revision: preview.submittedRevision }),
  });
  assert.equal(approved.status, 201, await approved.clone().text());
  const published = await fetch(`${base}/api/v1/marketplace/media/${image.id}`);
  assert.equal(published.status, 200);
  await app.close();
  const restarted = new LocalCatalogMediaStorage({ get: () => dir } as never);
  const again = await restarted.get(row.storageKey!);
  assert.ok(again && again.length === disk.length);
  const reopened = await NestFactory.create(StorageHttpTestModule, { logger: ['error'] });
  reopened.setGlobalPrefix('api/v1');
  await reopened.listen(0);
  const address2 = reopened.getHttpServer().address();
  const port2 = typeof address2 === 'object' && address2 ? address2.port : 0;
  const next = `http://127.0.0.1:${port2}`;
  assert.equal((await fetch(`${next}/api/v1/marketplace/media/${image.id}`)).status, 200);
  await fetch(`${next}/api/v1/partners-portal/products/${created.id}`, {
    method: 'PATCH', headers,
    body: JSON.stringify({ nameAr: 'مسودة بعد النشر', nameEn: 'Local file', priceHalalas: 1000, externalUrl: 'https://example.com/local', concernTags: ['لون'] }),
  });
  const draft = await (await fetch(`${next}/api/v1/partners-portal/products/${created.id}/media`, {
    method: 'POST', headers, body: JSON.stringify({ mimeType: 'image/png', dataBase64: PNG }),
  })).json() as { id: string };
  await fetch(`${next}/api/v1/partners-portal/products/${created.id}/submit-review`, { method: 'POST', headers });
  const preview2 = await (await fetch(`${next}/api/v1/admin/catalog-reviews/product/${created.id}`, { headers: admin })).json() as { submittedRevision: number };
  await fetch(`${next}/api/v1/admin/catalog-reviews/product/${created.id}/decision`, {
    method: 'POST', headers: admin, body: JSON.stringify({ decision: 'reject', note: 'أبقوا الملف', revision: preview2.submittedRevision }),
  });
  const kept = await prisma.catalogMedia.findUniqueOrThrow({ where: { id: image.id } });
  assert.equal((await restarted.get(kept.storageKey!))?.length, disk.length);
  assert.equal((await fetch(`${next}/api/v1/marketplace/media/${image.id}`)).status, 200);
  assert.equal((await fetch(`${next}/api/v1/marketplace/media/${draft.id}`)).status, 404);
  const notes: string[] = [];
  const originalError = console.error;
  console.error = (...args: unknown[]) => { notes.push(args.map(String).join(' ')); };
  const storedPath = join(dir, kept.storageKey!);
  await chmod(storedPath, 0);
  const denied = await fetch(`${next}/api/v1/marketplace/media/${image.id}`);
  const deniedBody = await denied.text();
  assert.equal(denied.status, 404);
  assert.equal(deniedBody.includes(dir), false);
  assert.equal(deniedBody.includes(storedPath), false);
  assert.ok(notes.some((line) => line.includes('catalog-media-permission')));
  await chmod(storedPath, 0o644);
  const aside = `${storedPath}.aside`;
  await copyFile(storedPath, aside);
  await rm(storedPath);
  notes.length = 0;
  const missing = await fetch(`${next}/api/v1/marketplace/media/${image.id}`);
  assert.equal(missing.status, 404);
  assert.equal((await missing.text()).includes(dir), false);
  assert.ok(notes.some((line) => line.includes('catalog-media-missing')));
  console.error = originalError;
  await copyFile(aside, storedPath);
  await rm(aside);
  await fetch(`${next}/api/v1/admin/catalog-reviews/product/${created.id}/decision`, {
    method: 'POST', headers: admin, body: JSON.stringify({ decision: 'withdraw', note: 'سحب' }),
  });
  assert.equal((await fetch(`${next}/api/v1/marketplace/media/${image.id}`)).status, 404);
  assert.ok(await restarted.get(kept.storageKey!));
  await chmod(dir, 0o555);
  const beforeRows = await prisma.catalogMedia.count({ where: { ownerId: created.id } });
  const blocked = await fetch(`${next}/api/v1/partners-portal/products/${created.id}/media`, {
    method: 'POST', headers, body: JSON.stringify({ mimeType: 'image/png', dataBase64: PNG }),
  });
  assert.equal(blocked.status, 400);
  assert.equal(await prisma.catalogMedia.count({ where: { ownerId: created.id } }), beforeRows);
  await chmod(dir, 0o755);
  console.log('ph3 local storage http passed');
  console.log(`storage=local dir=${dir}`);
  await reopened.close();
  await prisma.$disconnect();
  await rm(dir, { recursive: true, force: true });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
