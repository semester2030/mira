import 'reflect-metadata';
import assert from 'node:assert/strict';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { INestApplication, Module, UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { PrismaClient } from '@prisma/client';
import { json, type NextFunction, type Request, type Response } from 'express';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { FirebaseIdTokenVerifier, VerifiedFirebaseIdentity } from '../common/auth/firebase-id-token-verifier';
import { AdminApiKeyGuard } from '../common/guards/admin-api-key.guard';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { PartnerTokenGuard } from '../partners-portal/guards/partner-token.guard';
import { PartnersPortalController } from '../partners-portal/partners-portal.controller';
import { PartnersPortalService } from '../partners-portal/partners-portal.service';
import { CatalogContentService } from './catalog-content.service';
import { CatalogMediaController } from './catalog-media.controller';
import { MemoryCatalogMediaStorage, CatalogMediaStorage } from './catalog-media.storage';
import { CatalogReviewAdminController } from './catalog-review.admin.controller';
import { MarketplaceController } from './marketplace.controller';
import { MarketplaceService } from './marketplace.service';
import { IMAGE_MAX_BYTES, VIDEO_MAX_BYTES, catalogRequestLimit } from './catalog-content.policy';

const execFileAsync = promisify(execFile);
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

class ScriptedIdTokenVerifier extends FirebaseIdTokenVerifier {
  async verify(): Promise<VerifiedFirebaseIdentity> {
    throw new UnauthorizedException('Invalid or expired Firebase token');
  }
}

class CleanupFailStorage extends MemoryCatalogMediaStorage {
  failDelete = false;

  override async delete(key: string): Promise<void> {
    if (this.failDelete) throw new Error('cleanup failed');
    await super.delete(key);
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
    { provide: CatalogMediaStorage, useClass: CleanupFailStorage },
    { provide: MarketplaceService, useFactory: (prisma: PrismaService) => new MarketplaceService(prisma), inject: [PrismaService] },
    { provide: FirebaseIdTokenVerifier, useValue: new ScriptedIdTokenVerifier() },
  ],
})
class Rc3HttpTestModule {}

async function main() {
  const url = process.env.DATABASE_URL ?? '';
  if (!url.includes('localhost') && !url.includes('127.0.0.1')) process.exit(1);
  process.env.ADMIN_API_KEY = 'ph3-rc3-admin';
  const prisma = new PrismaClient();
  const brand = await prisma.partner.create({
    data: { type: 'brand', status: 'active', nameAr: 'ماركة RC3', nameEn: 'RC3 brand', city: 'الرياض' },
  });
  const other = await prisma.partner.create({
    data: { type: 'brand', status: 'active', nameAr: 'أخرى RC3', nameEn: 'Other', city: 'جدة' },
  });
  const clinic = await prisma.partner.create({
    data: { type: 'clinic', status: 'active', nameAr: 'عيادة RC3', nameEn: 'RC3 clinic', city: 'الرياض' },
  });
  await prisma.partnerUser.create({ data: { partnerId: brand.id, email: 'rc3-brand@test.local', accessToken: 'token-rc3-brand' } });
  await prisma.partnerUser.create({ data: { partnerId: other.id, email: 'rc3-other@test.local', accessToken: 'token-rc3-other' } });
  await prisma.partnerUser.create({ data: { partnerId: clinic.id, email: 'rc3-clinic@test.local', accessToken: 'token-rc3-clinic' } });
  const app = await NestFactory.create(Rc3HttpTestModule, { logger: ['error'], bodyParser: false });
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
  const brandHeaders = { authorization: 'Bearer token-rc3-brand', 'content-type': 'application/json' };
  const otherHeaders = { authorization: 'Bearer token-rc3-other', 'content-type': 'application/json' };
  const clinicHeaders = { authorization: 'Bearer token-rc3-clinic', 'content-type': 'application/json' };
  const adminHeaders = { 'x-admin-key': 'ph3-rc3-admin', 'content-type': 'application/json' };
  const storage = app.get(CatalogMediaStorage) as CleanupFailStorage;

  async function revision(kind: string, id: string) {
    const body = await (await fetch(`${base}/api/v1/admin/catalog-reviews/${kind}/${id}`, { headers: adminHeaders })).json() as { submittedRevision: number };
    return body.submittedRevision;
  }

  const sampleMp4 = await readFile(join(process.cwd(), 'src/marketplace/fixtures/ph3-rc3-sample.mp4'));
  const probed = await execFileAsync('ffprobe', ['-v', 'error', '-show_entries', 'format=format_name', '-of', 'csv=p=0', join(process.cwd(), 'src/marketplace/fixtures/ph3-rc3-sample.mp4')]);
  assert.match(probed.stdout, /mp4/);

  const created = await (await fetch(`${base}/api/v1/partners-portal/products`, {
    method: 'POST', headers: brandHeaders,
    body: JSON.stringify({ nameAr: 'فستان RC3', nameEn: 'Dress', priceHalalas: 8900, externalUrl: 'https://example.com/rc3', concernTags: ['لون'] }),
  })).json() as { id: string };
  assert.equal((await fetch(`${base}/api/v1/partners-portal/products/${created.id}`, {
    method: 'PATCH', headers: otherHeaders,
    body: JSON.stringify({ nameAr: 'اختراق', nameEn: 'Dress', priceHalalas: 8900, externalUrl: 'https://example.com/rc3', concernTags: ['لون'] }),
  })).status, 404);
  const first = await (await fetch(`${base}/api/v1/partners-portal/products/${created.id}/media`, {
    method: 'POST', headers: brandHeaders, body: JSON.stringify({ mimeType: 'image/png', dataBase64: PNG }),
  })).json() as { id: string };
  const second = await (await fetch(`${base}/api/v1/partners-portal/products/${created.id}/media`, {
    method: 'POST', headers: brandHeaders, body: JSON.stringify({ mimeType: 'video/mp4', dataBase64: sampleMp4.toString('base64') }),
  })).json() as { id: string };
  assert.ok(second.id);
  await fetch(`${base}/api/v1/partners-portal/products/${created.id}/submit-review`, { method: 'POST', headers: brandHeaders });
  const seen = await revision('product', created.id);
  await fetch(`${base}/api/v1/partners-portal/products/${created.id}/media/order`, {
    method: 'PATCH', headers: brandHeaders, body: JSON.stringify({ ids: [first.id, second.id] }),
  });
  const staleMedia = await fetch(`${base}/api/v1/admin/catalog-reviews/product/${created.id}/decision`, {
    method: 'POST', headers: adminHeaders, body: JSON.stringify({ decision: 'approve', revision: seen }),
  });
  assert.equal(staleMedia.status, 409);
  assert.equal((await prisma.product.findUniqueOrThrow({ where: { id: created.id } })).contentStatus, 'draft');

  await fetch(`${base}/api/v1/partners-portal/products/${created.id}/submit-review`, { method: 'POST', headers: brandHeaders });
  process.env.MIRA_CATALOG_FAIL_PUBLISH = '1';
  const failedPublish = await fetch(`${base}/api/v1/admin/catalog-reviews/product/${created.id}/decision`, {
    method: 'POST', headers: adminHeaders, body: JSON.stringify({ decision: 'approve', revision: await revision('product', created.id) }),
  });
  delete process.env.MIRA_CATALOG_FAIL_PUBLISH;
  assert.equal(failedPublish.status, 500);
  const afterFail = await prisma.product.findUniqueOrThrow({ where: { id: created.id } });
  assert.equal(afterFail.nameAr, 'فستان RC3');
  assert.equal(afterFail.reviewStatus, 'in_review');

  const logsBefore = await prisma.catalogReviewLog.count({ where: { ownerId: created.id, action: 'approve' } });
  const approved = await fetch(`${base}/api/v1/admin/catalog-reviews/product/${created.id}/decision`, {
    method: 'POST', headers: adminHeaders, body: JSON.stringify({ decision: 'approve', revision: await revision('product', created.id) }),
  });
  assert.equal(approved.status, 201);
  const repeat = await fetch(`${base}/api/v1/admin/catalog-reviews/product/${created.id}/decision`, {
    method: 'POST', headers: adminHeaders, body: JSON.stringify({ decision: 'approve', revision: 0 }),
  });
  assert.equal(((await repeat.json()) as { alreadyApplied: boolean }).alreadyApplied, true);
  assert.equal(await prisma.catalogReviewLog.count({ where: { ownerId: created.id, action: 'approve' } }), logsBefore + 1);
  await fetch(`${base}/api/v1/partners-portal/products/${created.id}`, {
    method: 'PATCH', headers: brandHeaders,
    body: JSON.stringify({ nameAr: '<b>مسودة أحدث</b>', nameEn: 'Dress', descriptionAr: '"وصف"', priceHalalas: 8900, externalUrl: 'https://example.com/rc3', concernTags: ['لون'] }),
  });
  const logsAfterRepeat = await prisma.catalogReviewLog.count({ where: { ownerId: created.id, action: 'approve' } });
  const repeatAfterDraft = await fetch(`${base}/api/v1/admin/catalog-reviews/product/${created.id}/decision`, {
    method: 'POST', headers: adminHeaders, body: JSON.stringify({ decision: 'approve', revision: 0 }),
  });
  assert.equal(repeatAfterDraft.status, 409);
  assert.equal(await prisma.catalogReviewLog.count({ where: { ownerId: created.id, action: 'approve' } }), logsAfterRepeat);
  assert.equal((await (await fetch(`${base}/api/v1/marketplace/catalog/product/${created.id}`)).json() as { nameAr: string }).nameAr, 'فستان RC3');

  const service = await (await fetch(`${base}/api/v1/partners-portal/services`, {
    method: 'POST', headers: clinicHeaders,
    body: JSON.stringify({ nameAr: 'جلسة RC3', nameEn: 'Session', durationMin: 30, priceHalalas: 4500, concernTags: ['عناية'] }),
  })).json() as { id: string };
  const serviceImage = await (await fetch(`${base}/api/v1/partners-portal/services/${service.id}/media`, {
    method: 'POST', headers: clinicHeaders, body: JSON.stringify({ mimeType: 'image/png', dataBase64: PNG }),
  })).json() as { id: string };
  const serviceImage2 = await (await fetch(`${base}/api/v1/partners-portal/services/${service.id}/media`, {
    method: 'POST', headers: clinicHeaders, body: JSON.stringify({ mimeType: 'image/png', dataBase64: PNG }),
  })).json() as { id: string };
  await fetch(`${base}/api/v1/partners-portal/services/${service.id}/submit-review`, { method: 'POST', headers: clinicHeaders });
  const serviceSeen = await revision('service', service.id);
  await fetch(`${base}/api/v1/partners-portal/services/${service.id}/media/order`, {
    method: 'PATCH', headers: clinicHeaders, body: JSON.stringify({ ids: [serviceImage2.id, serviceImage.id] }),
  });
  assert.equal((await fetch(`${base}/api/v1/admin/catalog-reviews/service/${service.id}/decision`, {
    method: 'POST', headers: adminHeaders, body: JSON.stringify({ decision: 'approve', revision: serviceSeen }),
  })).status, 409);
  await fetch(`${base}/api/v1/partners-portal/services/${service.id}/submit-review`, { method: 'POST', headers: clinicHeaders });
  assert.equal((await fetch(`${base}/api/v1/admin/catalog-reviews/service/${service.id}/decision`, {
    method: 'POST', headers: adminHeaders, body: JSON.stringify({ decision: 'approve', revision: await revision('service', service.id) }),
  })).status, 201);

  await fetch(`${base}/api/v1/partners-portal/products/${created.id}/submit-review`, { method: 'POST', headers: brandHeaders });
  const lockedRevision = await revision('product', created.id);
  let releaseHold: () => void = () => undefined;
  const hold = new Promise<void>((resolve) => { releaseHold = resolve; });
  let lockHeld = false;
  const locked = prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT id FROM products WHERE id = ${created.id} FOR UPDATE`;
    lockHeld = true;
    await hold;
    await tx.product.update({ where: { id: created.id }, data: { draftNameAr: 'تحت القفل', reviewRevision: { increment: 1 } } });
  });
  for (let attempt = 0; attempt < 100 && !lockHeld; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  assert.equal(lockHeld, true);
  const blockedDecision = fetch(`${base}/api/v1/admin/catalog-reviews/product/${created.id}/decision`, {
    method: 'POST', headers: adminHeaders, body: JSON.stringify({ decision: 'approve', revision: lockedRevision }),
  });
  await new Promise((resolve) => setTimeout(resolve, 50));
  releaseHold();
  const [blockedResult] = await Promise.all([blockedDecision, locked]);
  assert.equal(blockedResult.status, 409);
  assert.equal((await (await fetch(`${base}/api/v1/marketplace/catalog/product/${created.id}`)).json() as { nameAr: string }).nameAr, 'فستان RC3');

  await fetch(`${base}/api/v1/partners-portal/products/${created.id}/submit-review`, { method: 'POST', headers: brandHeaders });
  const liveRevision = await revision('product', created.id);
  const [approveRace, withdrawRace] = await Promise.all([
    fetch(`${base}/api/v1/admin/catalog-reviews/product/${created.id}/decision`, {
      method: 'POST', headers: adminHeaders, body: JSON.stringify({ decision: 'approve', revision: liveRevision }),
    }),
    fetch(`${base}/api/v1/admin/catalog-reviews/product/${created.id}/decision`, {
      method: 'POST', headers: adminHeaders, body: JSON.stringify({ decision: 'withdraw', note: 'سحب متزامن' }),
    }),
  ]);
  assert.ok([200, 201, 409].includes(approveRace.status));
  assert.equal(withdrawRace.status, 201);
  assert.equal((await prisma.product.findUniqueOrThrow({ where: { id: created.id } })).contentStatus, 'withdrawn');
  assert.equal((await fetch(`${base}/api/v1/marketplace/catalog/product/${created.id}`)).status, 404);

  const previousEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  const productionImport = await fetch(`${base}/api/v1/partners-portal/import/simulated`, {
    method: 'POST', headers: brandHeaders,
    body: JSON.stringify({ items: [{ externalId: 'prod-block', nameAr: 'ممنوع', priceHalalas: 100 }] }),
  });
  if (previousEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = previousEnv;
  assert.equal(productionImport.status, 403);

  const imported = await (await fetch(`${base}/api/v1/partners-portal/import/simulated`, {
    method: 'POST', headers: brandHeaders,
    body: JSON.stringify({ items: [{ externalId: 'sim-1', nameAr: 'تجريبي', priceHalalas: 1500, media: [{ mimeType: 'image/png', dataBase64: PNG }] }] }),
  })).json() as { mode: string; connected: boolean; created: number };
  assert.equal(imported.mode, 'simulated');
  assert.equal(imported.connected, false);
  assert.equal(imported.created, 1);
  const link = await prisma.catalogSourceLink.findUniqueOrThrow({
    where: { partnerId_source_externalId: { partnerId: brand.id, source: 'simulated', externalId: 'sim-1' } },
  });
  await fetch(`${base}/api/v1/partners-portal/products/${link.ownerId}/submit-review`, { method: 'POST', headers: brandHeaders });
  const simSeen = await revision('product', link.ownerId);
  await fetch(`${base}/api/v1/partners-portal/import/simulated`, {
    method: 'POST', headers: brandHeaders,
    body: JSON.stringify({ items: [{ externalId: 'sim-1', nameAr: 'اسم بعد المعاينة', priceHalalas: 1600 }] }),
  });
  assert.equal((await fetch(`${base}/api/v1/admin/catalog-reviews/product/${link.ownerId}/decision`, {
    method: 'POST', headers: adminHeaders, body: JSON.stringify({ decision: 'approve', revision: simSeen }),
  })).status, 409);
  assert.equal((await prisma.product.findUniqueOrThrow({ where: { id: link.ownerId } })).nameAr, 'تجريبي');
  await fetch(`${base}/api/v1/partners-portal/products/${link.ownerId}/submit-review`, { method: 'POST', headers: brandHeaders });
  assert.equal((await fetch(`${base}/api/v1/admin/catalog-reviews/product/${link.ownerId}/decision`, {
    method: 'POST', headers: adminHeaders, body: JSON.stringify({ decision: 'approve', revision: await revision('product', link.ownerId) }),
  })).status, 201);
  assert.equal((await prisma.product.findUniqueOrThrow({ where: { id: link.ownerId } })).catalogSource, 'simulated');
  assert.equal((await fetch(`${base}/api/v1/marketplace/catalog/product/${link.ownerId}`)).status, 404);
  const feed = await (await fetch(`${base}/api/v1/marketplace/catalog?q=${encodeURIComponent('اسم بعد المعاينة')}&limit=24`)).json() as { items: { id: string }[] };
  assert.equal(feed.items.some((item) => item.id === link.ownerId), false);
  const store = await (await fetch(`${base}/api/v1/marketplace/partners/${brand.id}`)).json() as { products: { id: string }[] };
  assert.equal(store.products.some((item) => item.id === link.ownerId), false);
  const simMedia = await prisma.catalogMedia.findFirstOrThrow({ where: { ownerId: link.ownerId, kind: 'image' } });
  assert.equal((await fetch(`${base}/api/v1/marketplace/media/${simMedia.id}`)).status, 404);
  const matched = await (await fetch(`${base}/api/v1/marketplace/match`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ skinTypeAr: 'مختلطة', concernScores: { لون: 3 } }),
  })).json() as { products: { id: string }[] };
  assert.equal(matched.products.some((item) => item.id === link.ownerId), false);
  await fetch(`${base}/api/v1/admin/catalog-reviews/product/${link.ownerId}/decision`, {
    method: 'POST', headers: adminHeaders, body: JSON.stringify({ decision: 'withdraw', note: 'سحب إداري' }),
  });
  await fetch(`${base}/api/v1/partners-portal/import/simulated`, {
    method: 'POST', headers: brandHeaders,
    body: JSON.stringify({ items: [{ externalId: 'sim-1', nameAr: 'عودة التوفر', priceHalalas: 1700, available: true }] }),
  });
  const stillWithdrawn = await prisma.product.findUniqueOrThrow({ where: { id: link.ownerId } });
  assert.equal(stillWithdrawn.contentStatus, 'withdrawn');
  assert.equal(stillWithdrawn.active, false);
  const priceBeforeEdit = stillWithdrawn.priceHalalas;
  assert.equal((await fetch(`${base}/api/v1/partners-portal/products/${link.ownerId}`, {
    method: 'PATCH', headers: brandHeaders,
    body: JSON.stringify({ nameAr: 'تعديل شريك', nameEn: 'Linked', priceHalalas: 99999, externalUrl: 'https://example.com/simulated', concernTags: [] }),
  })).status, 200);
  assert.equal((await prisma.product.findUniqueOrThrow({ where: { id: link.ownerId } })).priceHalalas, priceBeforeEdit);

  const [raceMediaA, raceMediaB] = await Promise.all([
    fetch(`${base}/api/v1/partners-portal/import/simulated`, {
      method: 'POST', headers: brandHeaders,
      body: JSON.stringify({ items: [{ externalId: 'rc3-race-media', nameAr: 'تزامن وسائط', priceHalalas: 2100, media: [{ mimeType: 'image/png', dataBase64: PNG }] }] }),
    }),
    fetch(`${base}/api/v1/partners-portal/import/simulated`, {
      method: 'POST', headers: brandHeaders,
      body: JSON.stringify({ items: [{ externalId: 'rc3-race-media', nameAr: 'تزامن وسائط', priceHalalas: 2200, media: [{ mimeType: 'image/png', dataBase64: PNG }] }] }),
    }),
  ]);
  assert.equal(raceMediaA.status, 201);
  assert.equal(raceMediaB.status, 201);
  assert.equal(await prisma.catalogSourceLink.count({ where: { partnerId: brand.id, externalId: 'rc3-race-media' } }), 1);
  const raceLink = await prisma.catalogSourceLink.findUniqueOrThrow({
    where: { partnerId_source_externalId: { partnerId: brand.id, source: 'simulated', externalId: 'rc3-race-media' } },
  });
  assert.equal(await prisma.catalogMedia.count({ where: { ownerId: raceLink.ownerId, sourceMediaKey: '0' } }), 1);

  const edited = await (await fetch(`${base}/api/v1/partners-portal/products`, {
    method: 'POST', headers: brandHeaders,
    body: JSON.stringify({ nameAr: 'قبل التعديل', nameEn: 'Before', descriptionAr: 'وصف منشور', priceHalalas: 5000, externalUrl: 'https://example.com/edit', concernTags: ['لون'] }),
  })).json() as { id: string };
  await fetch(`${base}/api/v1/partners-portal/products/${edited.id}/media`, {
    method: 'POST', headers: brandHeaders, body: JSON.stringify({ mimeType: 'image/png', dataBase64: PNG }),
  });
  await fetch(`${base}/api/v1/partners-portal/products/${edited.id}/submit-review`, { method: 'POST', headers: brandHeaders });
  assert.equal((await fetch(`${base}/api/v1/admin/catalog-reviews/product/${edited.id}/decision`, {
    method: 'POST', headers: adminHeaders, body: JSON.stringify({ decision: 'approve', revision: await revision('product', edited.id) }),
  })).status, 201);
  assert.equal((await fetch(`${base}/api/v1/partners-portal/products/${edited.id}`, {
    method: 'PATCH', headers: brandHeaders,
    body: JSON.stringify({ nameAr: '<b>مسودة مرفوضة</b>', nameEn: 'Before', descriptionAr: '"اقتباس"', priceHalalas: 5000, externalUrl: 'https://example.com/edit', concernTags: ['لون'] }),
  })).status, 200);
  assert.equal((await prisma.product.findUniqueOrThrow({ where: { id: edited.id } })).nameAr, 'قبل التعديل');
  await fetch(`${base}/api/v1/partners-portal/products/${edited.id}/submit-review`, { method: 'POST', headers: brandHeaders });
  assert.equal((await fetch(`${base}/api/v1/admin/catalog-reviews/product/${edited.id}/decision`, {
    method: 'POST', headers: adminHeaders, body: JSON.stringify({ decision: 'reject', revision: await revision('product', edited.id), note: 'أبقوا الاسم' }),
  })).status, 201);
  assert.equal((await (await fetch(`${base}/api/v1/marketplace/catalog/product/${edited.id}`)).json() as { nameAr: string }).nameAr, 'قبل التعديل');
  await fetch(`${base}/api/v1/partners-portal/products/${edited.id}/submit-review`, { method: 'POST', headers: brandHeaders });
  assert.equal((await fetch(`${base}/api/v1/admin/catalog-reviews/product/${edited.id}/decision`, {
    method: 'POST', headers: adminHeaders, body: JSON.stringify({ decision: 'approve', revision: await revision('product', edited.id) }),
  })).status, 201);
  const publishedEdit = await (await fetch(`${base}/api/v1/marketplace/catalog/product/${edited.id}`)).json() as { id: string; nameAr: string };
  assert.equal(publishedEdit.id, edited.id);
  assert.equal(publishedEdit.nameAr, '<b>مسودة مرفوضة</b>');

  const batch = (count: number, prefix: string) => Array.from({ length: count }, (_, index) => ({
    externalId: `${prefix}-${index}`, nameAr: `دفعة ${prefix} ${index}`, priceHalalas: 1000 + index, available: true,
  }));
  assert.equal(((await (await fetch(`${base}/api/v1/partners-portal/import/simulated`, {
    method: 'POST', headers: brandHeaders, body: JSON.stringify({ items: batch(50, 'rc3-50') }),
  })).json()) as { created: number }).created, 50);
  assert.equal(((await (await fetch(`${base}/api/v1/partners-portal/import/simulated`, {
    method: 'POST', headers: brandHeaders, body: JSON.stringify({ items: batch(50, 'rc3-50') }),
  })).json()) as { created: number; updated: number }).created, 0);
  assert.equal(await prisma.catalogSourceLink.count({ where: { partnerId: brand.id, externalId: { startsWith: 'rc3-50-' } } }), 50);
  assert.equal(((await (await fetch(`${base}/api/v1/partners-portal/import/simulated`, {
    method: 'POST', headers: brandHeaders, body: JSON.stringify({ items: batch(200, 'rc3-200') }),
  })).json()) as { created: number }).created, 200);
  assert.equal(await prisma.product.count({ where: { partnerId: brand.id, nameAr: { startsWith: 'دفعة rc3-200' } } }), 200);

  const padded = Buffer.alloc(IMAGE_MAX_BYTES);
  Buffer.from(PNG, 'base64').copy(padded);
  assert.equal((await fetch(`${base}/api/v1/partners-portal/products/${created.id}/media`, {
    method: 'POST', headers: brandHeaders, body: JSON.stringify({ mimeType: 'image/png', dataBase64: padded.toString('base64') }),
  })).status, 201);
  const tooBig = Buffer.alloc(IMAGE_MAX_BYTES + 1);
  Buffer.from(PNG, 'base64').copy(tooBig);
  assert.equal((await fetch(`${base}/api/v1/partners-portal/products/${created.id}/media`, {
    method: 'POST', headers: brandHeaders, body: JSON.stringify({ mimeType: 'image/png', dataBase64: tooBig.toString('base64') }),
  })).status, 400);
  const videoLimit = Buffer.alloc(VIDEO_MAX_BYTES);
  sampleMp4.copy(videoLimit);
  assert.equal((await fetch(`${base}/api/v1/partners-portal/products/${created.id}/media`, {
    method: 'POST', headers: brandHeaders, body: JSON.stringify({ mimeType: 'video/mp4', dataBase64: videoLimit.toString('base64') }),
  })).status, 201);
  const videoOver = Buffer.alloc(VIDEO_MAX_BYTES + 1);
  sampleMp4.copy(videoOver);
  assert.equal((await fetch(`${base}/api/v1/partners-portal/products/${created.id}/media`, {
    method: 'POST', headers: brandHeaders, body: JSON.stringify({ mimeType: 'video/mp4', dataBase64: videoOver.toString('base64') }),
  })).status, 400);
  const overflow = await fetch(`${base}/api/v1/partners-portal/products/${created.id}/media`, {
    method: 'POST', headers: brandHeaders, body: 'x'.repeat(catalogRequestLimit('POST', `/api/v1/partners-portal/products/${created.id}/media`) + 32),
  });
  assert.equal(overflow.status, 413);

  storage.failDelete = true;
  const removalOwner = await (await fetch(`${base}/api/v1/partners-portal/products`, {
    method: 'POST', headers: brandHeaders,
    body: JSON.stringify({ nameAr: 'تنظيف', nameEn: 'Cleanup', priceHalalas: 1000, externalUrl: 'https://example.com/clean', concernTags: ['لون'] }),
  })).json() as { id: string };
  const removalImage = await (await fetch(`${base}/api/v1/partners-portal/products/${removalOwner.id}/media`, {
    method: 'POST', headers: brandHeaders, body: JSON.stringify({ mimeType: 'image/png', dataBase64: PNG }),
  })).json() as { id: string };
  const extra = await (await fetch(`${base}/api/v1/partners-portal/products/${removalOwner.id}/media`, {
    method: 'POST', headers: brandHeaders, body: JSON.stringify({ mimeType: 'image/png', dataBase64: PNG }),
  })).json() as { id: string };
  await fetch(`${base}/api/v1/partners-portal/products/${removalOwner.id}/submit-review`, { method: 'POST', headers: brandHeaders });
  assert.equal((await fetch(`${base}/api/v1/admin/catalog-reviews/product/${removalOwner.id}/decision`, {
    method: 'POST', headers: adminHeaders, body: JSON.stringify({ decision: 'approve', revision: await revision('product', removalOwner.id) }),
  })).status, 201);
  await fetch(`${base}/api/v1/partners-portal/products/${removalOwner.id}/media/${extra.id}`, { method: 'DELETE', headers: brandHeaders });
  await fetch(`${base}/api/v1/partners-portal/products/${removalOwner.id}/submit-review`, { method: 'POST', headers: brandHeaders });
  const cleaned = await fetch(`${base}/api/v1/admin/catalog-reviews/product/${removalOwner.id}/decision`, {
    method: 'POST', headers: adminHeaders, body: JSON.stringify({ decision: 'approve', revision: await revision('product', removalOwner.id) }),
  });
  const cleanedBody = await cleaned.json() as { cleanupPending: boolean; contentStatus: string };
  assert.equal(cleaned.status, 201);
  assert.equal(cleanedBody.contentStatus, 'published');
  assert.equal(cleanedBody.cleanupPending, true);
  assert.equal((await prisma.catalogMedia.count({ where: { id: removalImage.id } })), 1);

  console.log('Firebase verifier in this run is a test double and does not prove a live Firebase connection');
  console.log('ph3 rc3 http passed');
  await app.close();
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
