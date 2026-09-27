import 'reflect-metadata';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Module, UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { json, type NextFunction, type Request, type Response } from 'express';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { PrismaClient } from '@prisma/client';
import { FirebaseIdTokenVerifier, VerifiedFirebaseIdentity } from '../common/auth/firebase-id-token-verifier';
import { AdminApiKeyGuard } from '../common/guards/admin-api-key.guard';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { PartnerTokenGuard } from '../partners-portal/guards/partner-token.guard';
import { PartnersPortalController } from '../partners-portal/partners-portal.controller';
import { PartnersPortalService } from '../partners-portal/partners-portal.service';
import { IMAGE_MAX_BYTES, catalogRequestLimit } from './catalog-content.policy';
import { CatalogContentService } from './catalog-content.service';
import { CatalogMediaController } from './catalog-media.controller';
import { CatalogMediaStorage, createCatalogMediaStorage } from './catalog-media.storage';
import { CatalogReviewAdminController } from './catalog-review.admin.controller';
import { MarketplaceController } from './marketplace.controller';
import { MarketplaceService } from './marketplace.service';

const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

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
class Rc5HttpTestModule {}

async function main() {
  const url = process.env.DATABASE_URL ?? '';
  if (!url.includes('localhost') && !url.includes('127.0.0.1')) process.exit(1);
  const dir = await mkdtemp(join(tmpdir(), 'mira-rc5-http-'));
  const prisma = new PrismaClient();
  const brand = await prisma.partner.create({ data: { type: 'brand', status: 'active', nameAr: 'تخزين RC5', nameEn: 'RC5 storage', city: 'الرياض' } });
  const other = await prisma.partner.create({ data: { type: 'brand', status: 'active', nameAr: 'شريك آخر', nameEn: 'Other', city: 'جدة' } });
  await prisma.partnerUser.create({ data: { partnerId: brand.id, email: 'rc5-brand@test.local', accessToken: 'token-rc5-brand' } });
  await prisma.partnerUser.create({ data: { partnerId: other.id, email: 'rc5-other@test.local', accessToken: 'token-rc5-other' } });
  process.env.ADMIN_API_KEY = 'ph3-rc5-admin';
  process.env.MIRA_MEDIA_DIR = dir;
  process.env.NODE_ENV = 'production';
  process.env.MIRA_MEDIA_STORE = 'external';
  const blocked = await NestFactory.create(Rc5HttpTestModule, { logger: ['error'] });
  blocked.setGlobalPrefix('api/v1');
  blocked.useGlobalPipes(new ValidationPipe({ transform: true }));
  await blocked.listen(0);
  const blockedAddress = blocked.getHttpServer().address();
  const blockedPort = typeof blockedAddress === 'object' && blockedAddress ? blockedAddress.port : 0;
  const blockedBase = `http://127.0.0.1:${blockedPort}`;
  const brandHeaders = { authorization: 'Bearer token-rc5-brand', 'content-type': 'application/json' };
  const created = await (await fetch(`${blockedBase}/api/v1/partners-portal/products`, {
    method: 'POST', headers: brandHeaders,
    body: JSON.stringify({ nameAr: 'قبل التخزين', nameEn: 'Before storage', priceHalalas: 1500, externalUrl: 'https://example.com/rc5', concernTags: ['لون'] }),
  })).json() as { id: string };
  const refused = await fetch(`${blockedBase}/api/v1/partners-portal/products/${created.id}/media`, {
    method: 'POST', headers: brandHeaders, body: JSON.stringify({ mimeType: 'image/png', dataBase64: PNG }),
  });
  const refusedText = await refused.text();
  assert.equal(refused.status, 503);
  assert.equal(refusedText.includes(dir), false);
  assert.equal(await prisma.catalogMedia.count({ where: { ownerId: created.id } }), 0);
  assert.deepEqual(await readdir(dir), []);
  await blocked.close();
  console.log('http production external refused without a media row or local file');

  delete process.env.NODE_ENV;
  process.env.MIRA_MEDIA_STORE = 'local';
  const app = await NestFactory.create(Rc5HttpTestModule, { logger: ['error'], bodyParser: false });
  app.setGlobalPrefix('api/v1');
  app.use((req: Request, res: Response, next: NextFunction) => {
    const path = (req.originalUrl || req.url || '').split('?')[0];
    return json({ limit: catalogRequestLimit(req.method || 'GET', path) })(req, res, next);
  });
  app.useGlobalPipes(new ValidationPipe({ transform: true }));
  await app.listen(0);
  const address = app.getHttpServer().address();
  const port = typeof address === 'object' && address ? address.port : 0;
  const base = `http://127.0.0.1:${port}`;
  const adminHeaders = { 'x-admin-key': 'ph3-rc5-admin', 'content-type': 'application/json' };
  const otherHeaders = { authorization: 'Bearer token-rc5-other' };
  const oversized = Buffer.alloc(IMAGE_MAX_BYTES + 1);
  oversized.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const tooBig = await fetch(`${base}/api/v1/partners-portal/products/${created.id}/media`, {
    method: 'POST', headers: brandHeaders, body: JSON.stringify({ mimeType: 'image/png', dataBase64: oversized.toString('base64') }),
  });
  assert.equal(tooBig.status, 400);
  const imageResponse = await fetch(`${base}/api/v1/partners-portal/products/${created.id}/media`, {
    method: 'POST', headers: brandHeaders, body: JSON.stringify({ mimeType: 'image/png', dataBase64: PNG }),
  });
  assert.equal(imageResponse.status, 201);
  const image = await imageResponse.json() as { id: string; storageKey: string };
  const mp4 = (await readFile(join(process.cwd(), 'src/marketplace/fixtures/ph3-rc3-sample.mp4'))).toString('base64');
  const videoResponse = await fetch(`${base}/api/v1/partners-portal/products/${created.id}/media`, {
    method: 'POST', headers: brandHeaders, body: JSON.stringify({ mimeType: 'video/mp4', dataBase64: mp4 }),
  });
  assert.equal(videoResponse.status, 201);
  const video = await videoResponse.json() as { id: string; storageKey: string };
  const imageBytes = await readFile(join(dir, image.storageKey));
  const videoBytes = await readFile(join(dir, video.storageKey));
  assert.equal(imageBytes.toString('base64'), PNG);
  assert.ok(videoBytes.includes(Buffer.from('moov')));
  assert.equal((await fetch(`${base}/api/v1/marketplace/media/${image.id}`)).status, 404);
  assert.equal((await fetch(`${base}/api/v1/partners-portal/media/${image.id}`, { headers: otherHeaders })).status, 404);
  const content = app.get(CatalogContentService);
  const beforeKeys = await readdir(dir);
  await content.addMedia(brand.id, 'product', created.id, { mimeType: 'image/png', dataBase64: PNG, sourceMediaKey: 'same-source' });
  await content.addMedia(brand.id, 'product', created.id, { mimeType: 'image/png', dataBase64: PNG, sourceMediaKey: 'same-source' });
  const afterKeys = await readdir(dir);
  assert.equal(afterKeys.length, beforeKeys.length + 1);
  await fetch(`${base}/api/v1/partners-portal/products/${created.id}/submit-review`, { method: 'POST', headers: brandHeaders });
  const preview = await (await fetch(`${base}/api/v1/admin/catalog-reviews/product/${created.id}`, { headers: adminHeaders })).json() as { submittedRevision: number };
  assert.equal((await fetch(`${base}/api/v1/admin/catalog-reviews/product/${created.id}/decision`, {
    method: 'POST', headers: adminHeaders, body: JSON.stringify({ decision: 'approve', revision: preview.submittedRevision }),
  })).status, 201);
  const published = await fetch(`${base}/api/v1/marketplace/media/${image.id}`);
  assert.equal(published.status, 200);
  assert.equal(Buffer.from(await published.arrayBuffer()).toString('base64'), PNG);
  assert.equal((await fetch(`${base}/api/v1/admin/catalog-reviews/product/${created.id}/decision`, {
    method: 'POST', headers: adminHeaders, body: JSON.stringify({ decision: 'withdraw', note: 'سحب' }),
  })).status, 201);
  assert.equal((await fetch(`${base}/api/v1/marketplace/media/${image.id}`)).status, 404);
  assert.ok(await readFile(join(dir, image.storageKey)));
  const imported = await (await fetch(`${base}/api/v1/partners-portal/import/simulated`, {
    method: 'POST', headers: brandHeaders,
    body: JSON.stringify({ items: [{ externalId: 'rc5-sim', nameAr: 'تجريبي RC5', priceHalalas: 900, media: [{ mimeType: 'image/png', dataBase64: PNG }] }] }),
  })).json() as { mode: string };
  assert.equal(imported.mode, 'simulated');
  const simulated = await prisma.product.findFirstOrThrow({ where: { partnerId: brand.id, nameAr: 'تجريبي RC5' } });
  assert.equal((await fetch(`${base}/api/v1/marketplace/catalog/product/${simulated.id}`)).status, 404);
  console.log('Firebase verifier in this run is a test double and does not prove a live Firebase connection');
  console.log('rc5 http storage passed on the explicit local adapter');
  await app.close();
  await prisma.$disconnect();
  await rm(dir, { recursive: true, force: true });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
