import 'reflect-metadata';
import assert from 'node:assert/strict';
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

/** Real HTTP: routing, guards, status codes and the Arabic error body. Local database only. */

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

const run = `cmh${Date.now().toString(36)}`;
const tokens = { 'tok-a': `${run}-a`, 'tok-b': `${run}-b` };

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }), PrismaModule],
  controllers: [CommerceController, CommercePartnerController, CommerceAdminController],
  providers: [
    CommerceService,
    FirebaseAuthGuard,
    PartnerTokenGuard,
    AdminApiKeyGuard,
    { provide: FirebaseIdTokenVerifier, useValue: new ScriptedVerifier(tokens) },
  ],
})
class CommerceHttpTestModule {}

async function baseUrl(app: INestApplication): Promise<string> {
  const address = app.getHttpServer().address();
  const port = typeof address === 'object' && address ? address.port : 0;
  return `http://127.0.0.1:${port}/api/v1`;
}

async function main() {
  const url = process.env.DATABASE_URL ?? '';
  if (!url.includes('localhost') && !url.includes('127.0.0.1')) {
    console.error('REFUSE: DATABASE_URL must be a local test database');
    process.exit(1);
  }
  process.env.ADMIN_API_KEY = 'commerce-http-admin';
  process.env.AUTH_SKIP = 'false';

  const app = await NestFactory.create(CommerceHttpTestModule, { logger: ['error'] });
  app.setGlobalPrefix('api/v1');
  app.useGlobalFilters(new HttpExceptionFilter());
  await app.listen(0);
  const base = await baseUrl(app);
  const prisma = new PrismaClient();
  const partnerIds: string[] = [];

  const call = async (method: string, path: string, opts: { token?: string; partner?: string; admin?: boolean; body?: unknown; headers?: Record<string, string> } = {}) => {
    const headers: Record<string, string> = { 'content-type': 'application/json', ...(opts.headers ?? {}) };
    if (opts.token) headers.authorization = `Bearer ${opts.token}`;
    if (opts.partner) headers.authorization = `Bearer ${opts.partner}`;
    if (opts.admin) headers['x-admin-key'] = 'commerce-http-admin';
    const res = await fetch(`${base}${path}`, { method, headers, body: opts.body === undefined ? undefined : JSON.stringify(opts.body) });
    const json = (await res.json().catch(() => null)) as Record<string, any> | null;
    return { status: res.status, json: json as Record<string, any> };
  };

  try {
    const mk = async (name: string) => {
      const partner = await prisma.partner.create({ data: { type: 'brand', nameAr: `متجر ${name}`, nameEn: `${run}-${name}` } });
      partnerIds.push(partner.id);
      await prisma.partnerUser.create({ data: { partnerId: partner.id, email: `${run}-${name}@test.local`, accessToken: `${run}-pt-${name}` } });
      return partner;
    };
    const pa = await mk('a');
    const pb = await mk('b');
    const prod = await prisma.product.create({
      data: { partnerId: pa.id, nameAr: 'كريم', nameEn: `${run}-cream`, priceHalalas: 7500, externalUrl: 'https://example.test', concernTags: [], skinTypes: [], purchaseMode: 'internal_cod', stockQty: 3, deliveryFeeHalalas: 1000 },
    });
    const ext = await prisma.product.create({
      data: { partnerId: pa.id, nameAr: 'خارجي', nameEn: `${run}-ext`, priceHalalas: 7500, externalUrl: 'https://example.test/x', concernTags: [], skinTypes: [], purchaseMode: 'external' },
    });

    // auth
    assert.equal((await call('GET', '/marketplace/commerce/cart')).status, 401);
    assert.equal((await call('GET', '/marketplace/commerce/cart', { token: 'bad' })).status, 401);
    assert.equal((await call('GET', '/partners/me/commerce/orders')).status, 401);
    assert.equal((await call('GET', '/partners/me/commerce/orders', { token: 'tok-a' })).status, 401, 'customer token is not a partner token');
    assert.equal((await call('GET', '/admin/commerce/orders')).status, 401);
    assert.equal((await call('GET', '/admin/commerce/orders', { partner: `${run}-pt-a` })).status, 401);

    // external product: coded Arabic error with the link preserved
    const rejected = await call('POST', '/marketplace/commerce/cart/items', { token: 'tok-a', body: { productId: ext.id, quantity: 1 } });
    assert.equal(rejected.status, 422, JSON.stringify(rejected.json));
    assert.equal(rejected.json.code, 'EXTERNAL_PRODUCT_NOT_PURCHASABLE');
    assert.match(rejected.json.messageAr, /[\u0600-\u06FF]/);
    assert.equal(rejected.json.message, rejected.json.messageAr);
    assert.equal(rejected.json.details.externalUrl, 'https://example.test/x');

    // partner conflict is a clear 409 and keeps the cart
    const otherPartnerProd = await prisma.product.create({
      data: { partnerId: pb.id, nameAr: 'آخر', nameEn: `${run}-other`, priceHalalas: 1000, externalUrl: 'https://example.test/o', concernTags: [], skinTypes: [], purchaseMode: 'internal_cod' },
    });

    // cart -> quote -> order with header idempotency key
    const empty = await call('POST', '/marketplace/commerce/cart', { token: 'tok-a' });
    assert.equal(empty.status, 201);
    assert.deepEqual(empty.json.items, []);
    const added = await call('POST', '/marketplace/commerce/cart/items', { token: 'tok-a', body: { productId: prod.id, quantity: 2 } });
    assert.equal(added.status, 201, JSON.stringify(added.json));
    assert.equal(added.json.subtotalHalalas, 15000);
    const clash = await call('POST', '/marketplace/commerce/cart/items', { token: 'tok-a', body: { productId: otherPartnerProd.id, quantity: 1 } });
    assert.equal(clash.status, 409);
    assert.equal(clash.json.code, 'CART_PARTNER_CONFLICT');
    assert.equal(clash.json.details.currentPartnerId, pa.id);
    const quote = await call('POST', '/marketplace/commerce/checkout/quote', { token: 'tok-a' });
    assert.equal(quote.status, 201);
    assert.equal(quote.json.totalHalalas, 16000);
    assert.ok(quote.json.confirmationFingerprint);
    const patched = await call('PATCH', `/marketplace/commerce/cart/items/${added.json.items[0].id}`, { token: 'tok-a', body: { quantity: 1 } });
    assert.equal(patched.status, 200);
    assert.equal(patched.json.items[0].quantity, 1);
    const quoteAfterPatch = await call('POST', '/marketplace/commerce/checkout/quote', { token: 'tok-a' });
    assert.equal(quoteAfterPatch.status, 201);
    assert.ok(quoteAfterPatch.json.confirmationFingerprint);
    assert.notEqual(quoteAfterPatch.json.confirmationFingerprint, quote.json.confirmationFingerprint);

    const noKey = await call('POST', '/marketplace/commerce/orders', {
      token: 'tok-a',
      body: {
        contactName: 'سارة',
        contactPhone: '0501234567',
        addressLine: 'الرياض حي النخيل',
        city: 'الرياض',
        confirmationFingerprint: quoteAfterPatch.json.confirmationFingerprint,
      },
    });
    assert.equal(noKey.status, 400);
    assert.equal(noKey.json.code, 'IDEMPOTENCY_KEY_REQUIRED');

    const stale = await call('POST', '/marketplace/commerce/orders', {
      token: 'tok-a',
      body: {
        contactName: 'سارة',
        contactPhone: '0501234567',
        addressLine: 'الرياض حي النخيل',
        city: 'الرياض',
        confirmationFingerprint: quote.json.confirmationFingerprint,
      },
      headers: { 'idempotency-key': `${run}-stale` },
    });
    assert.equal(stale.status, 409, JSON.stringify(stale.json));
    assert.equal(stale.json.code, 'QUOTE_STALE');

    const body = {
      contactName: 'سارة',
      contactPhone: '0501234567',
      addressLine: 'الرياض حي النخيل',
      city: 'الرياض',
      confirmationFingerprint: quoteAfterPatch.json.confirmationFingerprint,
    };
    const key = { 'idempotency-key': `${run}-k1` };
    const [o1, o2] = await Promise.all([
      call('POST', '/marketplace/commerce/orders', { token: 'tok-a', body, headers: key }),
      call('POST', '/marketplace/commerce/orders', { token: 'tok-a', body, headers: key }),
    ]);
    assert.equal(o1.status, 201, JSON.stringify(o1.json));
    assert.equal(o2.status, 201, JSON.stringify(o2.json));
    assert.equal(o1.json.order.id, o2.json.order.id);
    assert.equal([o1, o2].filter((o) => o.json.idempotentReplay === false).length, 1);
    assert.equal((await prisma.product.findUniqueOrThrow({ where: { id: prod.id } })).reservedQty, 1);
    const orderId = o1.json.order.id as string;

    // customer isolation
    assert.equal((await call('GET', `/marketplace/commerce/orders/${orderId}`, { token: 'tok-b' })).status, 404);
    assert.equal((await call('GET', `/marketplace/commerce/orders/${orderId}`, { token: 'tok-a' })).status, 200);
    assert.equal((await call('GET', '/marketplace/commerce/orders', { token: 'tok-b' })).json.items.length, 0);

    // partner routes
    const pTok = `${run}-pt-a`;
    const bTok = `${run}-pt-b`;
    assert.equal((await call('GET', '/partners/me/commerce/orders', { partner: pTok })).json.items.length, 1);
    assert.equal((await call('GET', '/partners/me/commerce/orders', { partner: bTok })).json.items.length, 0);
    assert.equal((await call('GET', `/partners/me/commerce/orders/${orderId}`, { partner: bTok })).status, 404);
    const forbidden = await call('POST', `/partners/me/commerce/orders/${orderId}/transition`, { partner: bTok, body: { fulfillmentStatus: 'accepted' } });
    assert.equal(forbidden.status, 404);
    assert.equal(forbidden.json.code, 'ORDER_NOT_FOUND');
    const bad = await call('POST', `/partners/me/commerce/orders/${orderId}/transition`, { partner: pTok, body: { fulfillmentStatus: 'delivered' } });
    assert.equal(bad.status, 409);
    assert.equal(bad.json.code, 'TRANSITION_NOT_ALLOWED');
    const ok = await call('POST', `/partners/me/commerce/orders/${orderId}/transition`, { partner: pTok, body: { fulfillmentStatus: 'accepted' } });
    assert.equal(ok.status, 201);
    assert.equal(ok.json.fulfillmentStatus, 'accepted');
    const cancel = await call('POST', `/marketplace/commerce/orders/${orderId}/cancel`, { token: 'tok-a', body: {} });
    assert.equal(cancel.status, 403);
    assert.equal(cancel.json.code, 'TRANSITION_FORBIDDEN');

    // admin routes (both mounts), reason required
    const adminList = await call('GET', '/admin/commerce/orders', { admin: true });
    assert.equal(adminList.status, 200);
    assert.ok(adminList.json.items.some((o: { id: string }) => o.id === orderId));
    assert.equal((await call('GET', `/marketplace/commerce/admin/orders/${orderId}`, { admin: true })).status, 200);
    const noReason = await call('POST', `/admin/commerce/orders/${orderId}/transition`, { admin: true, body: { fulfillmentStatus: 'cancelled' } });
    assert.equal(noReason.status, 400);
    assert.equal(noReason.json.code, 'REASON_REQUIRED');
    const adminCancel = await call('POST', `/admin/commerce/orders/${orderId}/transition`, { admin: true, body: { fulfillmentStatus: 'cancelled', note: 'اختبار' } });
    assert.equal(adminCancel.status, 201, JSON.stringify(adminCancel.json));
    assert.equal((await prisma.product.findUniqueOrThrow({ where: { id: prod.id } })).reservedQty, 0);
    const filtered = await call('GET', `/admin/commerce/orders?status=cancelled&partnerId=${pa.id}&q=${o1.json.order.publicNumber}`, { admin: true });
    assert.equal(filtered.json.items.length, 1);
    assert.equal((await call('GET', `/admin/commerce/orders?partnerId=${pb.id}`, { admin: true })).json.items.length, 0);

    // bookings routes exist behind guards
    assert.equal((await call('POST', '/marketplace/commerce/bookings', { body: {} })).status, 401);
    const badBooking = await call('POST', '/marketplace/commerce/bookings', { token: 'tok-a', body: {} });
    assert.equal(badBooking.status, 400);
    assert.equal(badBooking.json.code, 'IDEMPOTENCY_KEY_REQUIRED');
    assert.equal((await call('GET', '/partners/me/commerce/bookings', { partner: pTok })).status, 200);
    assert.equal((await call('GET', '/admin/commerce/bookings', { admin: true })).status, 200);
    const badDate = await call('GET', '/marketplace/commerce/services/x/availability?date=oops');
    assert.equal(badDate.status, 400);
    assert.equal(badDate.json.code, 'DATE_INVALID');

    console.log('commerce HTTP integration tests passed');
  } finally {
    await prisma.user.deleteMany({ where: { firebaseUid: { in: Object.values(tokens) } } });
    await prisma.partner.deleteMany({ where: { id: { in: partnerIds } } });
    await prisma.$disconnect();
    await app.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
