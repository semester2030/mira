import 'reflect-metadata';
import assert from 'node:assert/strict';
import { Module, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { PrismaClient } from '@prisma/client';
import { AdminApiKeyGuard } from '../common/guards/admin-api-key.guard';
import { PrismaModule } from '../prisma/prisma.module';
import { PartnerTokenGuard } from '../partners-portal/guards/partner-token.guard';
import { CatalogAdAdminController, CatalogAdPartnerController, CatalogAdPublicController } from './catalog-ad.controller';
import { CatalogAdService } from './catalog-ad.service';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }), PrismaModule],
  controllers: [CatalogAdPartnerController, CatalogAdAdminController, CatalogAdPublicController],
  providers: [CatalogAdService, PartnerTokenGuard, AdminApiKeyGuard],
})
class Ph4AdTestModule {}

async function main() {
  const url = process.env.DATABASE_URL ?? '';
  if (!url.includes('localhost') && !url.includes('127.0.0.1')) process.exit(1);
  const prisma = new PrismaClient();
  const seller = await prisma.partner.create({ data: { type: 'brand', status: 'active', nameAr: 'البائع', nameEn: 'Seller', city: 'الرياض' } });
  const celebrity = await prisma.partner.create({ data: { type: 'brand', status: 'active', nameAr: 'المعلن', nameEn: 'Advertiser', city: 'جدة' } });
  const other = await prisma.partner.create({ data: { type: 'brand', status: 'active', nameAr: 'معلن آخر', nameEn: 'Other', city: 'جدة' } });
  await prisma.partnerUser.create({ data: { partnerId: celebrity.id, email: 'ph4-celebrity@test.local', accessToken: 'token-ph4-celebrity' } });
  await prisma.partnerUser.create({ data: { partnerId: other.id, email: 'ph4-other@test.local', accessToken: 'token-ph4-other' } });
  const product = await prisma.product.create({
    data: { partnerId: seller.id, nameAr: 'فستان', nameEn: 'Dress', priceHalalas: 1500, externalUrl: 'https://example.com/dress', concernTags: [], skinTypes: [], contentStatus: 'published', catalogSource: 'catalog', active: true },
  });
  const simulated = await prisma.product.create({
    data: { partnerId: seller.id, nameAr: 'تجريبي', nameEn: 'Sim', priceHalalas: 900, externalUrl: 'https://example.com/sim', concernTags: [], skinTypes: [], contentStatus: 'published', catalogSource: 'simulated', active: true },
  });
  process.env.ADMIN_API_KEY = 'ph4-rc1-admin';
  const app = await NestFactory.create(Ph4AdTestModule, { logger: ['error'] });
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ transform: true }));
  await app.listen(0);
  const address = app.getHttpServer().address();
  const port = typeof address === 'object' && address ? address.port : 0;
  const base = `http://127.0.0.1:${port}`;
  const celebrityHeaders = { authorization: 'Bearer token-ph4-celebrity', 'content-type': 'application/json' };
  const otherHeaders = { authorization: 'Bearer token-ph4-other', 'content-type': 'application/json' };
  const adminHeaders = { 'x-admin-key': 'ph4-rc1-admin', 'content-type': 'application/json' };
  try {
    const priced = await fetch(`${base}/api/v1/partners-portal/ads`, {
      method: 'POST', headers: celebrityHeaders,
      body: JSON.stringify({ targetKind: 'product', targetId: product.id, publisherPartnerId: celebrity.id, priceHalalas: 1 }),
    });
    assert.equal(priced.status, 400);
    const createdResponse = await fetch(`${base}/api/v1/partners-portal/ads`, {
      method: 'POST', headers: celebrityHeaders,
      body: JSON.stringify({ targetKind: 'product', targetId: product.id, publisherPartnerId: celebrity.id, captionAr: 'إعلان الفستان' }),
    });
    assert.equal(createdResponse.status, 201);
    const created = await createdResponse.json() as { id: string; status: string };
    assert.equal(created.status, 'draft');
    assert.equal((await fetch(`${base}/api/v1/marketplace/ads/${created.id}`)).status, 404);
    assert.equal((await fetch(`${base}/api/v1/partners-portal/ads/${created.id}/stats`, { headers: otherHeaders })).status, 404);
    assert.equal((await fetch(`${base}/api/v1/admin/catalog-ads/${created.id}/decision`, {
      method: 'POST', headers: celebrityHeaders, body: JSON.stringify({ decision: 'approve' }),
    })).status, 401);
    assert.equal((await fetch(`${base}/api/v1/partners-portal/ads/${created.id}/submit-review`, { method: 'POST', headers: celebrityHeaders })).status, 201);
    async function submittedRevision(id: string) {
      const body = await (await fetch(`${base}/api/v1/partners-portal/ads/${id}`, { headers: celebrityHeaders })).json() as { submittedRevision: number };
      return body.submittedRevision;
    }
    const simResponse = await fetch(`${base}/api/v1/partners-portal/ads`, {
      method: 'POST', headers: celebrityHeaders,
      body: JSON.stringify({ targetKind: 'product', targetId: simulated.id, publisherPartnerId: celebrity.id }),
    });
    assert.equal(simResponse.status, 404);
    const simBody = JSON.stringify(await simResponse.json());
    assert.equal(simBody.includes('تجريبي'), false);
    assert.equal(simBody.includes('example.com/sim'), false);
    assert.equal(await prisma.catalogAd.count({ where: { targetId: simulated.id } }), 0);
    assert.equal((await fetch(`${base}/api/v1/admin/catalog-ads/${created.id}/decision`, {
      method: 'POST', headers: adminHeaders, body: JSON.stringify({ decision: 'approve', revision: await submittedRevision(created.id) }),
    })).status, 201);
    const published = await (await fetch(`${base}/api/v1/marketplace/ads/${created.id}`)).json() as {
      disclosure: string; seller: { nameAr: string }; advertiser: { nameAr: string }; target: { priceHalalas: number }; actions: { purchaseCompleted: boolean };
    };
    assert.equal(published.disclosure, 'إعلان');
    assert.equal(published.seller.nameAr, 'البائع');
    assert.equal(published.advertiser.nameAr, 'المعلن');
    assert.equal(published.target.priceHalalas, 1500);
    assert.equal(published.actions.purchaseCompleted, false);
    await prisma.product.update({ where: { id: product.id }, data: { priceHalalas: 1800 } });
    const repriced = await (await fetch(`${base}/api/v1/marketplace/ads/${created.id}`)).json() as { target: { priceHalalas: number } };
    assert.equal(repriced.target.priceHalalas, 1800);
    const opened = await fetch(`${base}/api/v1/marketplace/ads/${created.id}/link-open`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ eventId: 'ph4-open-1' }),
    });
    assert.equal(opened.status, 201);
    const replay = await (await fetch(`${base}/api/v1/marketplace/ads/${created.id}/link-open`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ eventId: 'ph4-open-1' }),
    })).json() as { alreadyRecorded: boolean; purchaseCompleted: boolean };
    assert.equal(replay.alreadyRecorded, true);
    assert.equal(replay.purchaseCompleted, false);
    assert.equal(await prisma.catalogAdAction.count({ where: { adId: created.id, action: 'link_open' } }), 1);
    const second = await (await fetch(`${base}/api/v1/partners-portal/ads`, {
      method: 'POST', headers: celebrityHeaders,
      body: JSON.stringify({ targetKind: 'product', targetId: product.id, publisherPartnerId: celebrity.id }),
    })).json() as { id: string };
    await fetch(`${base}/api/v1/partners-portal/ads/${second.id}/submit-review`, { method: 'POST', headers: celebrityHeaders });
    await fetch(`${base}/api/v1/admin/catalog-ads/${second.id}/decision`, { method: 'POST', headers: adminHeaders, body: JSON.stringify({ decision: 'approve', revision: await submittedRevision(second.id) }) });
    await fetch(`${base}/api/v1/marketplace/ads/${second.id}/link-open`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ eventId: 'ph4-open-2' }),
    });
    const firstStats = await (await fetch(`${base}/api/v1/partners-portal/ads/${created.id}/stats`, { headers: celebrityHeaders })).json() as { linkOpens: number; views: { state: string; count: number | null } };
    const secondStats = await (await fetch(`${base}/api/v1/partners-portal/ads/${second.id}/stats`, { headers: celebrityHeaders })).json() as { linkOpens: number };
    assert.equal(firstStats.linkOpens, 1);
    assert.equal(secondStats.linkOpens, 1);
    assert.equal(firstStats.views.state, 'disabled');
    assert.equal(firstStats.views.count, null);
    const counts = await (await fetch(`${base}/api/v1/marketplace/view-counts/product/${product.id}`)).json() as { state: string; count: number | null };
    assert.equal(counts.state, 'disabled');
    assert.equal(counts.count, null);
    const clientTotal = await fetch(`${base}/api/v1/marketplace/view-events`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ targetKind: 'product', targetId: product.id, eventId: 'view-1', eventType: 'qualified_view', count: 9 }),
    });
    assert.equal(clientTotal.status, 400);
    const unapproved = await fetch(`${base}/api/v1/marketplace/view-events`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ targetKind: 'product', targetId: product.id, eventId: 'view-1', eventType: 'qualified_view', policyVersion: 'proposed' }),
    });
    assert.equal(unapproved.status, 503);
    assert.equal(await prisma.catalogAdAction.count({ where: { action: 'qualified_view' } }), 0);
    await prisma.product.update({ where: { id: product.id }, data: { contentStatus: 'withdrawn' } });
    assert.equal((await fetch(`${base}/api/v1/marketplace/ads/${created.id}`)).status, 404);
    const hiddenOpen = await fetch(`${base}/api/v1/marketplace/ads/${created.id}/link-open`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ eventId: 'ph4-open-hidden' }),
    });
    assert.equal(hiddenOpen.status, 404);
    assert.equal(await prisma.catalogAdAction.count({ where: { eventId: 'ph4-open-hidden' } }), 0);
    console.log('view counting stayed disabled; no qualified view was stored');
    console.log('ph4 ad linking passed on local postgres, not a device or production run');
  } finally {
    await app.close();
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? `${error.name}: ${error.message}` : 'failed');
  process.exit(1);
});
