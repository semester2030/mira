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
class Ph4Rc2AdTestModule {}

async function main() {
  const url = process.env.DATABASE_URL ?? '';
  if (!url.includes('localhost') && !url.includes('127.0.0.1')) process.exit(1);
  const prisma = new PrismaClient();
  const seller = await prisma.partner.create({ data: { type: 'brand', status: 'active', nameAr: 'جهة الأصل', nameEn: 'Seller', city: 'الرياض' } });
  const clinic = await prisma.partner.create({ data: { type: 'clinic', status: 'active', nameAr: 'العيادة', nameEn: 'Clinic', city: 'الرياض' } });
  const celebrity = await prisma.partner.create({ data: { type: 'brand', status: 'active', nameAr: 'المعلن <script>', nameEn: 'Advertiser', city: 'جدة' } });
  const publisher = await prisma.partner.create({ data: { type: 'brand', status: 'active', nameAr: 'ناشر آخر', nameEn: 'Publisher', city: 'جدة' } });
  const other = await prisma.partner.create({ data: { type: 'brand', status: 'active', nameAr: 'حساب آخر', nameEn: 'Other', city: 'جدة' } });
  await prisma.partnerUser.create({ data: { partnerId: celebrity.id, email: 'ph4-rc2-celebrity@test.local', accessToken: 'token-ph4-rc2-celebrity' } });
  await prisma.partnerUser.create({ data: { partnerId: other.id, email: 'ph4-rc2-other@test.local', accessToken: 'token-ph4-rc2-other' } });
  const product = await prisma.product.create({
    data: { partnerId: seller.id, nameAr: 'فستان "اقتباس"', nameEn: 'Dress', priceHalalas: 1500, externalUrl: 'https://example.com/dress', concernTags: [], skinTypes: [], contentStatus: 'published', catalogSource: 'catalog', active: true },
  });
  const service = await prisma.service.create({
    data: { partnerId: clinic.id, nameAr: 'جلسة', nameEn: 'Session', durationMin: 30, priceHalalas: 4500, concernTags: [], contentStatus: 'published', catalogSource: 'catalog', active: true, bookingEnabled: true },
  });
  process.env.ADMIN_API_KEY = 'ph4-rc2-admin';
  delete process.env.MIRA_AD_FAIL_DECIDE;
  const app = await NestFactory.create(Ph4Rc2AdTestModule, { logger: ['error'] });
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ whitelist: false, transform: false }));
  await app.listen(0);
  const address = app.getHttpServer().address();
  const port = typeof address === 'object' && address ? address.port : 0;
  const base = `http://127.0.0.1:${port}`;
  const celebrityHeaders = { authorization: 'Bearer token-ph4-rc2-celebrity', 'content-type': 'application/json' };
  const otherHeaders = { authorization: 'Bearer token-ph4-rc2-other', 'content-type': 'application/json' };
  const adminHeaders = { 'x-admin-key': 'ph4-rc2-admin', 'content-type': 'application/json' };

  async function call(path: string, method: string, headers: Record<string, string>, body?: unknown) {
    return fetch(`${base}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  }
  async function revisionOf(id: string) {
    const body = await (await call(`/api/v1/partners-portal/ads/${id}`, 'GET', celebrityHeaders)).json() as { submittedRevision: number; reviewRevision: number; status: string };
    return body;
  }

  try {
    const delegated = await call('/api/v1/partners-portal/ads', 'POST', celebrityHeaders, {
      targetKind: 'product', targetId: product.id, publisherPartnerId: publisher.id, captionAr: 'باسم غيري',
    });
    assert.equal(delegated.status, 403);
    const createdResponse = await call('/api/v1/partners-portal/ads', 'POST', celebrityHeaders, {
      targetKind: 'product', targetId: product.id, captionAr: '<script>alert(1)</script> "اقتباس"',
    });
    assert.equal(createdResponse.status, 201);
    const created = await createdResponse.json() as { id: string; publisherPartnerId: string; captionAr: string };
    assert.equal(created.publisherPartnerId, celebrity.id);
    assert.equal(created.captionAr, '<script>alert(1)</script> "اقتباس"');
    assert.equal((await call(`/api/v1/partners-portal/ads/${created.id}`, 'PATCH', otherHeaders, { captionAr: 'تعديل دخيل' })).status, 404);
    assert.equal((await call(`/api/v1/partners-portal/ads/${created.id}/withdraw`, 'POST', otherHeaders, {})).status, 404);
    assert.equal((await call(`/api/v1/partners-portal/ads/${created.id}/stats`, 'GET', otherHeaders)).status, 404);

    const decisionsBefore = await prisma.catalogAdDecision.count({ where: { adId: created.id } });
    for (const body of [
      {},
      { decision: 'publish', revision: 0 },
      { decision: 'approve', revision: '0' },
      { decision: 'approve', revision: 1.5 },
      { decision: 'approve' },
    ]) {
      const rejected = await call(`/api/v1/admin/catalog-ads/${created.id}/decision`, 'POST', adminHeaders, body);
      assert.equal(rejected.status, 400);
    }
    assert.equal(await prisma.catalogAdDecision.count({ where: { adId: created.id } }), decisionsBefore);
    assert.equal((await prisma.catalogAd.findUniqueOrThrow({ where: { id: created.id } })).status, 'draft');

    await call(`/api/v1/partners-portal/ads/${created.id}/submit-review`, 'POST', celebrityHeaders, {});
    const seen = await revisionOf(created.id);
    assert.equal(seen.submittedRevision, seen.reviewRevision);
    const rejected = await call(`/api/v1/admin/catalog-ads/${created.id}/decision`, 'POST', adminHeaders, {
      decision: 'reject', revision: seen.submittedRevision, note: 'النص يحتاج توضيحًا',
    });
    assert.equal(rejected.status, 201);
    const afterReject = await revisionOf(created.id);
    assert.equal(afterReject.status, 'rejected');
    assert.equal((await revisionOf(created.id)).status, 'rejected');
    const preview = await (await call(`/api/v1/partners-portal/ads/${created.id}`, 'GET', celebrityHeaders)).json() as { reviewNote: string; reviewRevision: number };
    assert.equal(preview.reviewNote, 'النص يحتاج توضيحًا');
    await call(`/api/v1/partners-portal/ads/${created.id}`, 'PATCH', celebrityHeaders, { captionAr: 'نسخة أحدث' });
    await call(`/api/v1/partners-portal/ads/${created.id}/submit-review`, 'POST', celebrityHeaders, {});
    const stale = await call(`/api/v1/admin/catalog-ads/${created.id}/decision`, 'POST', adminHeaders, {
      decision: 'approve', revision: seen.submittedRevision,
    });
    assert.equal(stale.status, 409);
    assert.notEqual((await prisma.catalogAd.findUniqueOrThrow({ where: { id: created.id } })).status, 'published');
    const current = await revisionOf(created.id);
    const approved = await call(`/api/v1/admin/catalog-ads/${created.id}/decision`, 'POST', adminHeaders, {
      decision: 'approve', revision: current.submittedRevision,
    });
    assert.equal(approved.status, 201);
    const repeated = await (await call(`/api/v1/admin/catalog-ads/${created.id}/decision`, 'POST', adminHeaders, {
      decision: 'approve', revision: current.submittedRevision,
    })).json() as { alreadyApplied: boolean };
    assert.equal(repeated.alreadyApplied, true);
    assert.equal(await prisma.catalogAdDecision.count({ where: { adId: created.id, decision: 'approve' } }), 1);

    const blockedEdit = await call(`/api/v1/partners-portal/ads/${created.id}`, 'PATCH', celebrityHeaders, { captionAr: 'بعد النشر' });
    assert.equal(blockedEdit.status, 409);
    assert.equal((await prisma.catalogAd.findUniqueOrThrow({ where: { id: created.id } })).captionAr, 'نسخة أحدث');

    let releaseHold: () => void = () => undefined;
    const hold = new Promise<void>((resolve) => { releaseHold = resolve; });
    let lockHeld = false;
    const draft = await (await call('/api/v1/partners-portal/ads', 'POST', celebrityHeaders, {
      targetKind: 'product', targetId: product.id, captionAr: 'قبل القفل',
    })).json() as { id: string };
    const lockedUpdate = prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT id FROM catalog_ads WHERE id = ${draft.id} FOR UPDATE`;
      lockHeld = true;
      await hold;
      await tx.catalogAd.update({
        where: { id: draft.id },
        data: { status: 'in_review', submittedRevision: 0 },
      });
    });
    for (let attempt = 0; attempt < 100 && !lockHeld; attempt += 1) await new Promise((resolve) => setTimeout(resolve, 20));
    assert.equal(lockHeld, true);
    const lateEdit = call(`/api/v1/partners-portal/ads/${draft.id}`, 'PATCH', celebrityHeaders, { captionAr: 'تعديل غير مراجع' });
    await new Promise((resolve) => setTimeout(resolve, 50));
    releaseHold();
    const [lateResult] = await Promise.all([lateEdit, lockedUpdate]);
    assert.equal(lateResult.status, 409);
    assert.equal((await prisma.catalogAd.findUniqueOrThrow({ where: { id: draft.id } })).captionAr, 'قبل القفل');

    const race = await (await call('/api/v1/partners-portal/ads', 'POST', celebrityHeaders, {
      targetKind: 'service', targetId: service.id, captionAr: 'إعلان الخدمة',
    })).json() as { id: string };
    await call(`/api/v1/partners-portal/ads/${race.id}/submit-review`, 'POST', celebrityHeaders, {});
    const raceRevision = (await revisionOf(race.id)).submittedRevision;
    let releaseWithdraw: () => void = () => undefined;
    const withdrawHold = new Promise<void>((resolve) => { releaseWithdraw = resolve; });
    let withdrawLock = false;
    const withdrawLocked = prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT id FROM catalog_ads WHERE id = ${race.id} FOR UPDATE`;
      withdrawLock = true;
      await withdrawHold;
      await tx.catalogAd.update({
        where: { id: race.id },
        data: { status: 'withdrawn', reviewRevision: { increment: 1 }, submittedRevision: null },
      });
    });
    for (let attempt = 0; attempt < 100 && !withdrawLock; attempt += 1) await new Promise((resolve) => setTimeout(resolve, 20));
    assert.equal(withdrawLock, true);
    const lateApprove = call(`/api/v1/admin/catalog-ads/${race.id}/decision`, 'POST', adminHeaders, { decision: 'approve', revision: raceRevision });
    await new Promise((resolve) => setTimeout(resolve, 50));
    releaseWithdraw();
    const [lateApproveResult] = await Promise.all([lateApprove, withdrawLocked]);
    assert.equal(lateApproveResult.status, 409);
    assert.equal((await prisma.catalogAd.findUniqueOrThrow({ where: { id: race.id } })).status, 'withdrawn');
    const republish = await call(`/api/v1/admin/catalog-ads/${race.id}/decision`, 'POST', adminHeaders, { decision: 'approve', revision: raceRevision });
    assert.equal(republish.status, 409);
    assert.equal((await prisma.catalogAd.findUniqueOrThrow({ where: { id: race.id } })).status, 'withdrawn');

    const serviceAd = await (await call('/api/v1/partners-portal/ads', 'POST', celebrityHeaders, {
      targetKind: 'service', targetId: service.id, captionAr: 'خدمة معلنة',
    })).json() as { id: string };
    await call(`/api/v1/partners-portal/ads/${serviceAd.id}/submit-review`, 'POST', celebrityHeaders, {});
    process.env.MIRA_AD_FAIL_DECIDE = '1';
    const failed = await call(`/api/v1/admin/catalog-ads/${serviceAd.id}/decision`, 'POST', adminHeaders, {
      decision: 'approve', revision: (await revisionOf(serviceAd.id)).submittedRevision,
    });
    delete process.env.MIRA_AD_FAIL_DECIDE;
    assert.equal(failed.status, 500);
    assert.equal((await prisma.catalogAd.findUniqueOrThrow({ where: { id: serviceAd.id } })).status, 'in_review');
    assert.equal(await prisma.catalogAdDecision.count({ where: { adId: serviceAd.id } }), 0);
    assert.equal((await call(`/api/v1/admin/catalog-ads/${serviceAd.id}/decision`, 'POST', adminHeaders, {
      decision: 'approve', revision: (await revisionOf(serviceAd.id)).submittedRevision,
    })).status, 201);
    const servicePublic = await (await call(`/api/v1/marketplace/ads/${serviceAd.id}`, 'GET', {})).json() as {
      actions: { openLink: boolean; appointmentRequest: boolean; appointmentOperational: boolean; appointmentConfirmed: boolean };
      target: { priceHalalas: number; kind: string };
      seller: { nameAr: string };
    };
    assert.equal(servicePublic.target.kind, 'service');
    assert.equal(servicePublic.target.priceHalalas, 4500);
    assert.equal(servicePublic.actions.openLink, false);
    assert.equal(servicePublic.actions.appointmentRequest, false);
    assert.equal(servicePublic.actions.appointmentOperational, false);
    assert.equal(servicePublic.actions.appointmentConfirmed, false);
    assert.equal(servicePublic.seller.nameAr, 'العيادة');

    const productPublic = await (await call(`/api/v1/marketplace/ads/${created.id}`, 'GET', {})).json() as {
      captionAr: string; seller: { nameAr: string }; advertiser: { nameAr: string }; publisher: { nameAr: string };
      actions: { openLink: boolean; purchaseCompleted: boolean };
    };
    assert.equal(productPublic.captionAr, 'نسخة أحدث');
    assert.equal(productPublic.seller.nameAr, 'جهة الأصل');
    assert.equal(productPublic.advertiser.nameAr, 'المعلن <script>');
    assert.equal(productPublic.publisher.nameAr, 'المعلن <script>');
    assert.equal(productPublic.actions.openLink, true);
    assert.equal(productPublic.actions.purchaseCompleted, false);

    await prisma.partner.update({ where: { id: celebrity.id }, data: { status: 'suspended' } });
    assert.equal((await call(`/api/v1/marketplace/ads/${created.id}`, 'GET', {})).status, 404);
    const hiddenAdvertiser = await call(`/api/v1/marketplace/ads/${created.id}/link-open`, 'POST', { 'content-type': 'application/json' }, { eventId: 'rc2-hidden-advertiser' });
    assert.equal(hiddenAdvertiser.status, 404);
    assert.equal(await prisma.catalogAdAction.count({ where: { eventId: 'rc2-hidden-advertiser' } }), 0);
    await prisma.partner.update({ where: { id: celebrity.id }, data: { status: 'active' } });

    await prisma.catalogAd.update({ where: { id: created.id }, data: { publisherPartnerId: publisher.id } });
    await prisma.partner.update({ where: { id: publisher.id }, data: { status: 'suspended' } });
    assert.equal((await call(`/api/v1/marketplace/ads/${created.id}`, 'GET', {})).status, 404);
    const hiddenPublisher = await call(`/api/v1/marketplace/ads/${created.id}/link-open`, 'POST', { 'content-type': 'application/json' }, { eventId: 'rc2-hidden-publisher' });
    assert.equal(hiddenPublisher.status, 404);
    assert.equal(await prisma.catalogAdAction.count({ where: { eventId: 'rc2-hidden-publisher' } }), 0);
    await prisma.partner.update({ where: { id: publisher.id }, data: { status: 'active' } });
    await prisma.catalogAd.update({ where: { id: created.id }, data: { publisherPartnerId: celebrity.id } });

    await prisma.partner.update({ where: { id: seller.id }, data: { status: 'suspended' } });
    assert.equal((await call(`/api/v1/marketplace/ads/${created.id}`, 'GET', {})).status, 404);
    await prisma.partner.update({ where: { id: seller.id }, data: { status: 'active' } });
    await prisma.product.update({ where: { id: product.id }, data: { contentStatus: 'withdrawn' } });
    assert.equal((await call(`/api/v1/marketplace/ads/${created.id}`, 'GET', {})).status, 404);
    await prisma.product.update({ where: { id: product.id }, data: { contentStatus: 'published' } });

    await prisma.partner.update({ where: { id: clinic.id }, data: { status: 'suspended' } });
    assert.equal((await call(`/api/v1/marketplace/ads/${serviceAd.id}`, 'GET', {})).status, 404);
    await prisma.partner.update({ where: { id: clinic.id }, data: { status: 'active' } });

    const queue = await (await call('/api/v1/admin/catalog-ads', 'GET', adminHeaders)).json() as { items: Array<{ id: string }> };
    assert.equal(queue.items.some((item) => item.id === created.id), false);
    console.log('ph4 rc2 ad revision, delegation, and eligibility passed on local postgres, not a device or production run');
  } finally {
    delete process.env.MIRA_AD_FAIL_DECIDE;
    await app.close();
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? `${error.name}: ${error.message}` : 'failed');
  process.exit(1);
});
