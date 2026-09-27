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
class Ph4Rc6AdTestModule {}

async function main() {
  const url = process.env.DATABASE_URL ?? '';
  if (!url.includes('localhost') && !url.includes('127.0.0.1')) process.exit(1);
  const prisma = new PrismaClient();
  const seller = await prisma.partner.create({ data: { type: 'brand', status: 'active', nameAr: 'البائع', nameEn: 'Seller', city: 'الرياض' } });
  const celebrity = await prisma.partner.create({ data: { type: 'brand', status: 'active', nameAr: 'المعلن', nameEn: 'Advertiser', city: 'جدة' } });
  await prisma.partnerUser.create({ data: { partnerId: celebrity.id, email: 'ph4-rc6-celebrity@test.local', accessToken: 'token-ph4-rc6-celebrity' } });
  const product = await prisma.product.create({
    data: { partnerId: seller.id, nameAr: 'فستان', nameEn: 'Dress', priceHalalas: 1500, externalUrl: 'https://example.com/dress', concernTags: [], skinTypes: [], contentStatus: 'published', catalogSource: 'catalog', active: true },
  });
  process.env.ADMIN_API_KEY = 'ph4-rc6-admin';
  const app = await NestFactory.create(Ph4Rc6AdTestModule, { logger: ['error'] });
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ transform: true }));
  await app.listen(0);
  const address = app.getHttpServer().address();
  const port = typeof address === 'object' && address ? address.port : 0;
  const base = `http://127.0.0.1:${port}`;
  const celebrityHeaders = { authorization: 'Bearer token-ph4-rc6-celebrity', 'content-type': 'application/json' };
  const adminHeaders = { 'x-admin-key': 'ph4-rc6-admin', 'content-type': 'application/json' };
  try {
    async function publish(caption: string) {
      const created = await (await fetch(`${base}/api/v1/partners-portal/ads`, {
        method: 'POST', headers: celebrityHeaders,
        body: JSON.stringify({ targetKind: 'product', targetId: product.id, publisherPartnerId: celebrity.id, captionAr: caption }),
      })).json() as { id: string };
      await fetch(`${base}/api/v1/partners-portal/ads/${created.id}/submit-review`, { method: 'POST', headers: celebrityHeaders });
      const submitted = await (await fetch(`${base}/api/v1/partners-portal/ads/${created.id}`, { headers: celebrityHeaders })).json() as { submittedRevision: number };
      const approved = await fetch(`${base}/api/v1/admin/catalog-ads/${created.id}/decision`, {
        method: 'POST', headers: adminHeaders, body: JSON.stringify({ decision: 'approve', revision: submitted.submittedRevision }),
      });
      assert.equal(approved.status, 201);
      return created.id;
    }

    const first = await publish('إعلان أول');
    const second = await publish('إعلان ثان');
    const open = (id: string, eventId: string) => fetch(`${base}/api/v1/marketplace/ads/${id}/link-open`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ eventId }),
    });
    const one = await open(first, 'rc6-open-a');
    const two = await open(first, 'rc6-open-b');
    assert.equal(one.status, 201);
    assert.equal(two.status, 201);
    assert.equal(await prisma.catalogAdAction.count({ where: { adId: first, action: 'link_open' } }), 2);
    const replay = await (await open(first, 'rc6-open-a')).json() as { alreadyRecorded: boolean; purchaseCompleted: boolean; action: string };
    assert.equal(replay.alreadyRecorded, true);
    assert.equal(replay.purchaseCompleted, false);
    assert.equal(replay.action, 'link_open');
    assert.equal(await prisma.catalogAdAction.count({ where: { adId: first, action: 'link_open' } }), 2);
    const conflict = await open(second, 'rc6-open-a');
    assert.equal(conflict.status, 409);
    assert.equal(await prisma.catalogAdAction.count({ where: { eventId: 'rc6-open-a' } }), 1);
    assert.equal(await prisma.catalogAdAction.count({ where: { adId: second, action: 'link_open' } }), 0);
    const missing = await open('missing-ad', 'rc6-open-missing');
    assert.equal(missing.status, 404);
    const counted = await fetch(`${base}/api/v1/marketplace/view-events`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ targetKind: 'product', targetId: product.id, eventId: 'rc6-view', eventType: 'qualified_view', policyVersion: 'proposed' }),
    });
    assert.equal(counted.status, 503);
    assert.equal(await prisma.catalogAdAction.count({ where: { action: 'qualified_view' } }), 0);
    await prisma.product.update({ where: { id: product.id }, data: { contentStatus: 'withdrawn' } });
    const hidden = await open(first, 'rc6-open-hidden');
    assert.equal(hidden.status, 404);
    assert.equal(await prisma.catalogAdAction.count({ where: { eventId: 'rc6-open-hidden' } }), 0);
    console.log('ph4 rc6 link events: two rows, replay without a third row, conflict and ineligible rejected');
  } finally {
    await app.close();
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? `${error.name}: ${error.message}` : 'failed');
  process.exit(1);
});
