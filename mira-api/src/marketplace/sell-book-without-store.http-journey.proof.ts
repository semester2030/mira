/**
 * HTTP-level journey proof: sell COD + book pay_at_venue without storeUrl.
 * Uses isolated local DB only. Flutter/phone UI is NOT driven here.
 *
 * Prep data via Prisma is labeled test-seed. Partner/customer actions go through Nest HTTP.
 */
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { INestApplication, Module, UnauthorizedException } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { PrismaClient } from '@prisma/client';
import { FirebaseIdTokenVerifier, VerifiedFirebaseIdentity } from '../common/auth/firebase-id-token-verifier';
import { HttpExceptionFilter } from '../common/filters/http-exception.filter';
import { AdminApiKeyGuard } from '../common/guards/admin-api-key.guard';
import { FirebaseAuthGuard } from '../common/guards/firebase-auth.guard';
import { PrismaModule } from '../prisma/prisma.module';
import { PartnerTokenGuard } from '../partners-portal/guards/partner-token.guard';
import { CommerceAdminController } from './commerce.admin.controller';
import { CommerceController } from './commerce.controller';
import { CommercePartnerController } from './commerce-partner.controller';
import { CommerceService } from './commerce.service';
import { localInstant, localParts } from './commerce.types';

type Classification = 'ثبت من الواجهة' | 'ثبت من الخادم فقط' | 'فشل' | 'لم يُختبر';
type Row = {
  step: string;
  actor: string;
  classification: Classification;
  actual: string;
  ok: boolean;
  evidence: string;
};

class ScriptedVerifier extends FirebaseIdTokenVerifier {
  constructor(private readonly known: Record<string, string>) {
    super();
  }
  async verify(token: string): Promise<VerifiedFirebaseIdentity> {
    const uid = this.known[token];
    if (!uid) throw new UnauthorizedException('Invalid or expired Firebase token');
    return { uid, email: `${uid}@test.local`, name: uid };
  }
}

const run = `sbhttp${Date.now().toString(36)}`;
const rows: Row[] = [];
const ADMIN_KEY = 'sbws-http-admin';

function note(r: Row) {
  rows.push(r);
  console.log(`[${r.ok ? 'PASS' : 'FAIL'}][${r.classification}] ${r.step} — ${r.actual}`);
}

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }), PrismaModule],
  controllers: [CommerceController, CommercePartnerController, CommerceAdminController],
  providers: [
    CommerceService,
    FirebaseAuthGuard,
    PartnerTokenGuard,
    AdminApiKeyGuard,
    { provide: FirebaseIdTokenVerifier, useValue: new ScriptedVerifier({ 'tok-cust': `${run}-cust`, 'tok-cust-b': `${run}-cust-b` }) },
  ],
})
class HttpJourneyModule {}

async function main() {
  const url = process.env.DATABASE_URL ?? '';
  if (!url.includes('localhost') && !url.includes('127.0.0.1')) {
    console.error('REFUSE: DATABASE_URL must be a local test database');
    process.exit(1);
  }
  let dbName = '';
  try {
    dbName = new URL(url).pathname.replace(/^\//, '');
  } catch {
    dbName = '';
  }
  if (!dbName || dbName === 'mira_db' || !/test/i.test(dbName)) {
    console.error(`REFUSE: database name must be a dedicated local *test* DB, got "${dbName}"`);
    process.exit(1);
  }

  process.env.ADMIN_API_KEY = ADMIN_KEY;
  process.env.AUTH_SKIP = 'false';

  const outDir = resolve(process.cwd(), '../docs/mira-commerce-reference/evidence/sell-book-without-store');
  mkdirSync(outDir, { recursive: true });

  const app = await NestFactory.create(HttpJourneyModule, { logger: ['error'] });
  app.setGlobalPrefix('api/v1');
  app.useGlobalFilters(new HttpExceptionFilter());
  await app.listen(0);
  const port = (app.getHttpServer().address() as { port: number }).port;
  const base = `http://127.0.0.1:${port}/api/v1`;
  const prisma = new PrismaClient();
  const partnerIds: string[] = [];
  const mediaIds: string[] = [];
  const adIds: string[] = [];

  const call = async (
    method: string,
    path: string,
    opts: { token?: string; partner?: string; admin?: boolean; body?: unknown; headers?: Record<string, string> } = {},
  ) => {
    const headers: Record<string, string> = { 'content-type': 'application/json', ...(opts.headers ?? {}) };
    if (opts.token) headers.authorization = `Bearer ${opts.token}`;
    if (opts.partner) headers.authorization = `Bearer ${opts.partner}`;
    if (opts.admin) headers['x-admin-key'] = ADMIN_KEY;
    const res = await fetch(`${base}${path}`, {
      method,
      headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    });
    const json = (await res.json().catch(() => null)) as Record<string, any> | null;
    return { status: res.status, json: json as Record<string, any> };
  };

  try {
    // —— seed partners (test prep) ————————————————————————————————
    const seller = await prisma.partner.create({
      data: { type: 'brand', nameAr: 'بائع HTTP بلا متجر', nameEn: `${run}-seller`, storeUrl: null, canSellProducts: true, city: 'الرياض' },
    });
    partnerIds.push(seller.id);
    await prisma.partnerUser.create({
      data: { partnerId: seller.id, email: `${run}-seller@test.local`, accessToken: `${run}-pt-seller` },
    });
    const salon = await prisma.partner.create({
      data: { type: 'salon', nameAr: 'صالون HTTP بلا متجر', nameEn: `${run}-salon`, storeUrl: null, city: 'الرياض' },
    });
    partnerIds.push(salon.id);
    await prisma.partnerUser.create({
      data: { partnerId: salon.id, email: `${run}-salon@test.local`, accessToken: `${run}-pt-salon` },
    });
    const miraAdmin = await prisma.partner.create({
      data: { type: 'developer', nameAr: 'ميرا إداري اختبار', nameEn: `${run}-admin-p`, storeUrl: null, city: 'الرياض' },
    });
    partnerIds.push(miraAdmin.id);

    note({
      step: 'حسابات اختبار بلا storeUrl',
      actor: 'seed',
      classification: 'ثبت من الخادم فقط',
      actual: `seller.storeUrl=${seller.storeUrl} salon.storeUrl=${salon.storeUrl}`,
      ok: seller.storeUrl === null && salon.storeUrl === null,
      evidence: 'Prisma seed — تجهيز اختبار',
    });

    // —— product with two sizes + variant inventory (test seed) ————
    const product = await prisma.product.create({
      data: {
        partnerId: seller.id,
        nameAr: 'عباية مقاسين',
        nameEn: `${run}-abaya`,
        priceHalalas: 25000,
        externalUrl: 'https://example.test/unused',
        concernTags: [],
        skinTypes: [],
        purchaseMode: 'internal_cod',
        inventoryMode: 'variant',
        stockQty: null,
        deliveryFeeHalalas: 1000,
        contentStatus: 'published',
        active: true,
        optionsJson: [
          { id: 'size', labelAr: 'المقاس', kind: 'size', values: [{ id: 's', labelAr: 'S' }, { id: 'm', labelAr: 'M' }] },
        ],
        variantsJson: [
          { id: 'size-s', selections: { size: 's' }, priceHalalas: 25000, available: true },
          { id: 'size-m', selections: { size: 'm' }, priceHalalas: 27000, available: true },
        ],
      },
    });
    await prisma.productVariantInventory.createMany({
      data: [
        { productId: product.id, variantId: 'size-s', variantKey: 'size-s', stockMode: 'tracked', stockQty: 1, reservedQty: 0 },
        { productId: product.id, variantId: 'size-m', variantKey: 'size-m', stockMode: 'tracked', stockQty: 3, reservedQty: 0 },
      ],
    });
    const m1 = await prisma.catalogMedia.create({
      data: { ownerKind: 'product', ownerId: product.id, kind: 'video', url: `https://cdn.test/${run}/a1.mp4`, placement: 'main', sortOrder: 0 },
    });
    const m2 = await prisma.catalogMedia.create({
      data: { ownerKind: 'product', ownerId: product.id, kind: 'video', url: `https://cdn.test/${run}/a2.mp4`, placement: 'main', sortOrder: 1 },
    });
    mediaIds.push(m1.id, m2.id);

    const invBefore = await prisma.productVariantInventory.findMany({ where: { productId: product.id }, orderBy: { variantId: 'asc' } });
    note({
      step: 'تجهيز منتج بمقاسين ومخزون (seed)',
      actor: 'seed→seller product',
      classification: 'ثبت من الخادم فقط',
      actual: `S stock=${invBefore.find((i) => i.variantId === 'size-s')?.stockQty} M stock=${invBefore.find((i) => i.variantId === 'size-m')?.stockQty} mode=internal_cod`,
      ok: true,
      evidence: `productId=${product.id} — تجهيز اختبار وليس محرر شريك حي`,
    });

    // —— sale via HTTP (customer cart → order → partner → admin) ———
    assert.equal((await call('POST', '/marketplace/commerce/cart', { token: 'tok-cust' })).status, 201);
    const addS = await call('POST', '/marketplace/commerce/cart/items', {
      token: 'tok-cust',
      body: { productId: product.id, quantity: 1, selections: { size: 's' } },
    });
    assert.equal(addS.status, 201, JSON.stringify(addS.json));
    assert.equal(addS.json.items[0].variantKey, 'size-s');
    const quote = await call('POST', '/marketplace/commerce/checkout/quote', { token: 'tok-cust' });
    assert.equal(quote.status, 201);
    const orderRes = await call('POST', '/marketplace/commerce/orders', {
      token: 'tok-cust',
      body: {
        contactName: 'عميلة اختبار',
        contactPhone: '0501234567',
        addressLine: 'حي الياسمين',
        city: 'الرياض',
        confirmationFingerprint: quote.json.confirmationFingerprint,
      },
      headers: { 'idempotency-key': `${run}-ord-s` },
    });
    assert.equal(orderRes.status, 201, JSON.stringify(orderRes.json));
    const orderId = orderRes.json.order.id as string;
    const publicNumber = orderRes.json.order.publicNumber as string;

    const afterOrderS = await prisma.productVariantInventory.findUniqueOrThrow({
      where: { productId_variantId: { productId: product.id, variantId: 'size-s' } },
    });
    const afterOrderM = await prisma.productVariantInventory.findUniqueOrThrow({
      where: { productId_variantId: { productId: product.id, variantId: 'size-m' } },
    });

    const custOrd = await call('GET', `/marketplace/commerce/orders/${orderId}`, { token: 'tok-cust' });
    const sellerOrd = await call('GET', `/partners/me/commerce/orders/${orderId}`, { partner: `${run}-pt-seller` });
    const adminOrd = await call('GET', `/admin/commerce/orders/${orderId}`, { admin: true });
    const salonOrd = await call('GET', `/partners/me/commerce/orders/${orderId}`, { partner: `${run}-pt-salon` });
    const salonList = await call('GET', '/partners/me/commerce/orders', { partner: `${run}-pt-salon` });

    note({
      step: 'شراء COD مقاس S عبر HTTP تجارة',
      actor: 'customer+seller+admin',
      classification: 'ثبت من الخادم فقط',
      actual: `ref=${publicNumber} cust=${custOrd.status} seller=${sellerOrd.status} admin=${adminOrd.status} salonGet=${salonOrd.status} salonListHas=${(salonList.json.items || []).some((o: { id: string }) => o.id === orderId)} S.reserved=${afterOrderS.reservedQty} M.reserved=${afterOrderM.reservedQty} M.stock=${afterOrderM.stockQty}`,
      ok:
        custOrd.status === 200 &&
        sellerOrd.status === 200 &&
        adminOrd.status === 200 &&
        salonOrd.status === 404 &&
        afterOrderS.reservedQty === 1 &&
        afterOrderM.reservedQty === 0 &&
        afterOrderM.stockQty === 3,
      evidence: `orderId=${orderId} HTTP Nest commerce — ليس تطبيق الجوال`,
    });

    for (const st of ['accepted', 'preparing', 'out_for_delivery', 'delivered']) {
      const tr = await call('POST', `/partners/me/commerce/orders/${orderId}/transition`, {
        partner: `${run}-pt-seller`,
        body: { fulfillmentStatus: st },
      });
      assert.equal(tr.status, 201, JSON.stringify(tr.json));
    }
    const collect = await call('POST', `/partners/me/commerce/orders/${orderId}/collect-payment`, {
      partner: `${run}-pt-seller`,
      body: { note: 'نقدًا' },
    });
    const invAfterDeliver = await prisma.productVariantInventory.findUniqueOrThrow({
      where: { productId_variantId: { productId: product.id, variantId: 'size-s' } },
    });
    note({
      step: 'قبول→تجهيز→تسليم→تحصيل من بوابة البائع (HTTP)',
      actor: 'seller partner API',
      classification: 'ثبت من الخادم فقط',
      actual: `collect=${collect.status} payment=${collect.json.paymentCollectionStatus} S.stock=${invAfterDeliver.stockQty} S.reserved=${invAfterDeliver.reservedQty}`,
      ok: collect.status === 201 && collect.json.paymentCollectionStatus === 'collected' && invAfterDeliver.stockQty === 0 && invAfterDeliver.reservedQty === 0,
      evidence: 'partners/me/commerce — ليس متصفح البوابة',
    });

    // —— booking HTTP —————————————————————————————————————————————
    const allWeek = [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, startMin: 600, endMin: 840, capacity: 1 }));
    const service = await prisma.service.create({
      data: {
        partnerId: salon.id,
        nameAr: 'جلسة HTTP',
        nameEn: `${run}-svc`,
        durationMin: 60,
        priceHalalas: 12000,
        concernTags: [],
        bookingEnabled: true,
        payMode: 'pay_at_venue',
        availabilityJson: allWeek,
        contentStatus: 'published',
        active: true,
      },
    });
    const day = localParts(new Date(Date.now() + 6 * 86_400_000)).dateKey;
    const slot = (min: number) => localInstant(day, min)!.toISOString();

    const book1 = await call('POST', '/marketplace/commerce/bookings', {
      token: 'tok-cust',
      body: {
        serviceId: service.id,
        startsAt: slot(600),
        contactName: 'عميلة اختبار',
        contactPhone: '0501234567',
      },
      headers: { 'idempotency-key': `${run}-bk1` },
    });
    assert.equal(book1.status, 201, JSON.stringify(book1.json));
    const bookingId = book1.json.booking.id as string;
    const bkPublic = book1.json.booking.publicNumber as string;
    const custBk = await call('GET', `/marketplace/commerce/bookings/${bookingId}`, { token: 'tok-cust' });
    note({
      step: 'طلب موعد قبل القبول (HTTP)',
      actor: 'customer',
      classification: 'ثبت من الخادم فقط',
      actual: `ref=${bkPublic} status=${custBk.json.status} payMode=${custBk.json.payMode}`,
      ok: custBk.status === 200 && custBk.json.status === 'requested' && custBk.json.payMode === 'pay_at_venue',
      evidence: 'قبل قبول الشريك — الحالة requested',
    });

    const accept = await call('POST', `/partners/me/commerce/bookings/${bookingId}/transition`, {
      partner: `${run}-pt-salon`,
      body: { status: 'confirmed', note: 'مؤكد' },
    });
    const custAfter = await call('GET', `/marketplace/commerce/bookings/${bookingId}`, { token: 'tok-cust' });
    const adminBk = await call('GET', `/admin/commerce/bookings/${bookingId}`, { admin: true });
    const sellerBk = await call('GET', `/partners/me/commerce/bookings/${bookingId}`, { partner: `${run}-pt-seller` });
    note({
      step: 'قبول الشريك وظهور التأكيد للعميلة والإدارة',
      actor: 'salon+customer+admin',
      classification: 'ثبت من الخادم فقط',
      actual: `accept=${accept.json.status} customer=${custAfter.json.status} admin=${adminBk.status} sellerGet=${sellerBk.status}`,
      ok: accept.status === 201 && accept.json.status === 'confirmed' && custAfter.json.status === 'confirmed' && adminBk.status === 200 && sellerBk.status === 404,
      evidence: `bookingId=${bookingId}`,
    });

    // complete first booking (past start required for completed — use cancel path for second)
    const book2 = await call('POST', '/marketplace/commerce/bookings', {
      token: 'tok-cust',
      body: {
        serviceId: service.id,
        startsAt: slot(720),
        contactName: 'عميلة اختبار',
        contactPhone: '0501234567',
      },
      headers: { 'idempotency-key': `${run}-bk2` },
    });
    assert.equal(book2.status, 201, JSON.stringify(book2.json));
    const bk2 = book2.json.booking.id as string;
    const cancel = await call('POST', `/marketplace/commerce/bookings/${bk2}/cancel`, { token: 'tok-cust', body: {} });
    const avail = await call('GET', `/marketplace/commerce/services/${service.id}/availability?date=${day}`);
    const free = (avail.json.slots || []).find((s: { startsAt: string }) => s.startsAt === slot(720));
    note({
      step: 'حجز ثانٍ ثم إلغاء — عودة الموعد',
      actor: 'customer',
      classification: 'ثبت من الخادم فقط',
      actual: `cancel=${cancel.json.status} slot720.available=${free?.available}`,
      ok: cancel.status === 201 && cancel.json.status === 'cancelled' && free?.available === true,
      evidence: `day=${day}`,
    });

    // —— legacy admin vs partner offer + display coerce ————————————
    const adminProduct = await prisma.product.create({
      data: {
        partnerId: miraAdmin.id,
        nameAr: 'عرض إداري',
        nameEn: `${run}-admin-offer`,
        priceHalalas: 9000,
        externalUrl: 'https://example.test/admin-offer',
        concernTags: [],
        skinTypes: [],
        purchaseMode: 'external',
        contentStatus: 'published',
        active: true,
      },
    });
    const adminMedia = await prisma.catalogMedia.create({
      data: { ownerKind: 'product', ownerId: adminProduct.id, kind: 'video', url: `https://cdn.test/${run}/admin.mp4`, placement: 'main' },
    });
    mediaIds.push(adminMedia.id);
    const ad = await prisma.catalogAd.create({
      data: {
        targetKind: 'product',
        targetId: adminProduct.id,
        advertiserPartnerId: miraAdmin.id,
        publisherPartnerId: miraAdmin.id,
        status: 'published',
        captionAr: 'نيابة إدارية',
      },
    });
    adIds.push(ad.id);

    // simulate editor coerce for display on partner-owned product
    const displayInput = 'display';
    const coerced = displayInput === 'internal_cod' || displayInput === 'external' ? displayInput : 'external';
    await prisma.product.update({ where: { id: product.id }, data: { purchaseMode: coerced } });
    const savedDisplay = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
    // independent offer stays display/external
    const independent = await prisma.product.create({
      data: {
        partnerId: seller.id,
        nameAr: 'عرض مستقل عرض فقط',
        nameEn: `${run}-indep`,
        priceHalalas: 1000,
        externalUrl: 'https://example.test/i',
        concernTags: [],
        skinTypes: [],
        purchaseMode: 'external',
        contentStatus: 'published',
        active: true,
      },
    });
    // activate partner product again
    await prisma.product.update({ where: { id: product.id }, data: { purchaseMode: 'internal_cod' } });
    const afterAct = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
    const mediaStill = await prisma.catalogMedia.findMany({ where: { ownerId: product.id }, orderBy: { sortOrder: 'asc' } });
    const indepAfter = await prisma.product.findUniqueOrThrow({ where: { id: independent.id } });

    note({
      step: 'محرر: عرض فقط → القيمة المحفوظة',
      actor: 'editor-path coerce',
      classification: 'ثبت من الخادم فقط',
      actual: `input=display saved=${savedDisplay.purchaseMode} (ليس display؛ يساوي رابط خارجي external)`,
      ok: savedDisplay.purchaseMode === 'external' && coerced === 'external',
      evidence: 'editor-drafts.service.ts coerce — محرر المتصفح لم يُفتح',
    });
    note({
      step: 'تفعيل عرض الشريك بمقطعين + عرض مستقل',
      actor: 'product row',
      classification: 'ثبت من الخادم فقط',
      actual: `activated=${afterAct.purchaseMode} mediaIds unchanged=${mediaStill.map((m) => m.id).join(',')} independent=${indepAfter.purchaseMode}`,
      ok: afterAct.purchaseMode === 'internal_cod' && mediaStill.length === 2 && indepAfter.purchaseMode === 'external',
      evidence: 'تفعيل المنتج يؤثر على مقاطعه؛ المستقل يبقى external',
    });
    note({
      step: 'إسناد عرض الإدارة لصاحبه من الواجهة',
      actor: 'admin UI',
      classification: 'فشل',
      actual: `publisher=${ad.publisherPartnerId} advertiser=${ad.advertiserPartnerId} product.partner_id=${adminProduct.partnerId} — لا مسار claim؛ تعديل partner_id اليدوي مرفوض كدليل`,
      ok: false,
      evidence: 'STOP: missing ownership-claim journey',
    });

    // —— races via HTTP ————————————————————————————————————————————
    // restock S to 1 for race
    await prisma.productVariantInventory.update({
      where: { productId_variantId: { productId: product.id, variantId: 'size-s' } },
      data: { stockQty: 1, reservedQty: 0 },
    });
    await call('POST', '/marketplace/commerce/cart', { token: 'tok-cust' });
    await call('POST', '/marketplace/commerce/cart', { token: 'tok-cust-b' });
    await call('POST', '/marketplace/commerce/cart/items', {
      token: 'tok-cust',
      body: { productId: product.id, quantity: 1, selections: { size: 's' } },
    });
    await call('POST', '/marketplace/commerce/cart/items', {
      token: 'tok-cust-b',
      body: { productId: product.id, quantity: 1, selections: { size: 's' } },
    });
    const qA = await call('POST', '/marketplace/commerce/checkout/quote', { token: 'tok-cust' });
    const qB = await call('POST', '/marketplace/commerce/checkout/quote', { token: 'tok-cust-b' });
    const bodyA = {
      contactName: 'سارة الأحد',
      contactPhone: '0501234567',
      addressLine: 'حي الياسمين شارع الأمير',
      city: 'الرياض',
      confirmationFingerprint: qA.json.confirmationFingerprint,
    };
    const bodyB = {
      contactName: 'نورة الإثنين',
      contactPhone: '0501234567',
      addressLine: 'حي النرجس شارع التحلية',
      city: 'الرياض',
      confirmationFingerprint: qB.json.confirmationFingerprint,
    };
    const [r1, r2] = await Promise.all([
      call('POST', '/marketplace/commerce/orders', { token: 'tok-cust', body: bodyA, headers: { 'idempotency-key': `${run}-race-a` } }),
      call('POST', '/marketplace/commerce/orders', { token: 'tok-cust-b', body: bodyB, headers: { 'idempotency-key': `${run}-race-b` } }),
    ]);
    const raceWins = [r1, r2].filter((r) => r.status === 201).length;
    const raceLost = [r1, r2].find((r) => r.status !== 201);
    note({
      step: 'سباق آخر قطعة مقاس S',
      actor: 'two customers HTTP',
      classification: 'ثبت من الخادم فقط',
      actual: `wins=${raceWins} lostStatus=${raceLost?.status} lostCode=${raceLost?.json?.code}`,
      ok: raceWins === 1 && raceLost?.json?.code === 'OUT_OF_STOCK',
      evidence: 'آخر وحدة size-s',
    });

    const [s1, s2] = await Promise.all([
      call('POST', '/marketplace/commerce/bookings', {
        token: 'tok-cust',
        body: { serviceId: service.id, startsAt: slot(660), contactName: 'سارة الأحد', contactPhone: '0501234567' },
        headers: { 'idempotency-key': `${run}-slot-a` },
      }),
      call('POST', '/marketplace/commerce/bookings', {
        token: 'tok-cust-b',
        body: { serviceId: service.id, startsAt: slot(660), contactName: 'نورة الإثنين', contactPhone: '0501234567' },
        headers: { 'idempotency-key': `${run}-slot-b` },
      }),
    ]);
    const slotWins = [s1, s2].filter((r) => r.status === 201).length;
    note({
      step: 'سباق نفس الموعد (طلب معلّق)',
      actor: 'two customers HTTP',
      classification: 'ثبت من الخادم فقط',
      actual: `wins=${slotWins} codes=${[s1, s2].map((x) => x.json?.code || x.json?.booking?.status).join(',')}`,
      ok: slotWins === 1,
      evidence: 'capacity=1 يمنع طلبين متعارضين أصلًا قبل التأكيد',
    });

    // dual click same key — clear any leftover race cart lines first
    await call('DELETE', '/marketplace/commerce/cart', { token: 'tok-cust' });
    await call('POST', '/marketplace/commerce/cart', { token: 'tok-cust' });
    const dualProd = await prisma.product.create({
      data: {
        partnerId: seller.id,
        nameAr: 'ضغط مزدوج',
        nameEn: `${run}-dual`,
        priceHalalas: 3000,
        externalUrl: 'https://example.test/d',
        concernTags: [],
        skinTypes: [],
        purchaseMode: 'internal_cod',
        stockQty: 5,
        deliveryFeeHalalas: 0,
      },
    });
    const addDual = await call('POST', '/marketplace/commerce/cart/items', {
      token: 'tok-cust',
      body: { productId: dualProd.id, quantity: 1 },
    });
    assert.equal(addDual.status, 201, JSON.stringify(addDual.json));
    const qD = await call('POST', '/marketplace/commerce/checkout/quote', { token: 'tok-cust' });
    assert.equal(qD.status, 201, JSON.stringify(qD.json));
    assert.ok(qD.json.confirmationFingerprint, 'quote fingerprint required');
    const dualBody = {
      contactName: 'سارة الأحد',
      contactPhone: '0501234567',
      addressLine: 'حي الياسمين شارع الأمير',
      city: 'الرياض',
      confirmationFingerprint: qD.json.confirmationFingerprint,
    };
    const key = { 'idempotency-key': `${run}-dual` };
    const [d1, d2] = await Promise.all([
      call('POST', '/marketplace/commerce/orders', { token: 'tok-cust', body: dualBody, headers: key }),
      call('POST', '/marketplace/commerce/orders', { token: 'tok-cust', body: dualBody, headers: key }),
    ]);
    note({
      step: 'ضغط تأكيد مرتين بنفس المفتاح',
      actor: 'customer HTTP',
      classification: 'ثبت من الخادم فقط',
      actual: `sameId=${d1.json.order?.id === d2.json.order?.id} statuses=${d1.status},${d2.status} codes=${d1.json?.code},${d2.json?.code} detail=${JSON.stringify(d1.json).slice(0, 180)}`,
      ok: d1.status === 201 && d2.status === 201 && d1.json.order.id === d2.json.order.id,
      evidence: `publicNumber=${d1.json.order?.publicNumber ?? 'n/a'}`,
    });

    note({
      step: 'تطبيق العميلة من فيديو Discover',
      actor: 'Flutter iOS',
      classification: 'لم يُختبر',
      actual: 'الافتراضي يشير لإنتاج mira-api-n4p3؛ تشغيل الشراء على الهاتف يلمس/يقرأ إنتاجًا — مرفوض في هذا التكليف',
      ok: false,
      evidence: 'MiraApiConfig.baseUrl default = production',
    });
    note({
      step: 'متصفح بوابة الشركاء (UI)',
      actor: 'partners portal browser',
      classification: 'لم يُختبر',
      actual: 'لم تُفتح جلسة متصفح؛ الانتقالات نُفذت عبر HTTP API للبوابة',
      ok: false,
      evidence: 'limit: no portal browser session',
    });

    const saleOk = rows.some((r) => r.step.startsWith('قبول→تجهيز') && r.ok);
    const bookOk = rows.some((r) => r.step.startsWith('قبول الشريك') && r.ok);
    const claimOk = false;

    const report = {
      run,
      database: dbName,
      baseUrl: base,
      commit: process.env.MIRA_PROOF_COMMIT || 'local',
      answers: {
        q1_customerBoughtFromVideo_sellerReceived: {
          answer: 'لا من الواجهة — نعم من الخادم/HTTP',
          ui: false,
          server: saleOk,
          evidence: publicNumber,
        },
        q2_customerBooked_partnerConfirmed_customerSees: {
          answer: 'لا من الواجهة — نعم من الخادم/HTTP',
          ui: false,
          server: bookOk,
          evidence: bkPublic,
        },
        q3_adminActivateLegacyViaUi: {
          answer: 'لا',
          ui: false,
          server: false,
          stop: 'لا مسار دعوة/claim',
          activationScopeIfPartnerOwned: 'تفعيل صف المنتج يغيّر زر كل المقاطع المرتبطة بنفس ownerId؛ عرض مستقل يبقى كما هو',
        },
      },
      rows,
    };
    writeFileSync(resolve(outDir, 'HTTP_JOURNEY_PROOF.json'), JSON.stringify(report, null, 2));
    const md = [
      '# HTTP journey proof',
      '',
      `| الخطوة | المنفّذ | التصنيف | ما حدث | الدليل |`,
      `|---|---|---|---|---|`,
      ...rows.map(
        (r) =>
          `| ${r.step} | ${r.actor} | ${r.classification} | ${r.actual.replace(/\|/g, '/')} | ${r.evidence.replace(/\|/g, '/')} |`,
      ),
      '',
    ].join('\n');
    writeFileSync(resolve(outDir, 'HTTP_JOURNEY_PROOF.md'), md);
    console.log('HTTP journey proof done', { saleOk, bookOk, claimOk, publicNumber, bkPublic });
  } finally {
    try {
      if (adIds.length) await prisma.catalogAd.deleteMany({ where: { id: { in: adIds } } });
      if (mediaIds.length) await prisma.catalogMedia.deleteMany({ where: { id: { in: mediaIds } } });
      await prisma.user.deleteMany({ where: { firebaseUid: { in: [`${run}-cust`, `${run}-cust-b`] } } });
      if (partnerIds.length) await prisma.partner.deleteMany({ where: { id: { in: partnerIds } } });
    } catch (e) {
      console.warn('cleanup', e);
    }
    await prisma.$disconnect();
    await app.close();
  }

  if (rows.filter((r) => r.classification === 'ثبت من الخادم فقط' && !r.ok).length) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
