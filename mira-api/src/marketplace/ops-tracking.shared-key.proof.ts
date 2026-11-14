/**
 * Prove shared ADMIN_API_KEY always attributes as admin-key — never X-Admin-Actor.
 * DATABASE_URL local *test* DB.
 */
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { INestApplication, Module, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { PrismaClient } from '@prisma/client';
import { FirebaseIdTokenVerifier } from '../common/auth/firebase-id-token-verifier';
import { HttpExceptionFilter } from '../common/filters/http-exception.filter';
import { AdminApiKeyGuard } from '../common/guards/admin-api-key.guard';
import { FirebaseAuthGuard } from '../common/guards/firebase-auth.guard';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { CommerceAdminController } from './commerce.admin.controller';
import { CommerceService } from './commerce.service';
import { makePublicNumber } from './commerce.types';

const run = `shkey${Date.now().toString(36)}`;
const MASTER = 'shared-key-proof-master';
const SUPPORT_SECRET = 'supportOnlySecret';
const outDir = resolve(process.cwd(), '../docs/mira-commerce-reference/evidence/ops-tracking');
mkdirSync(outDir, { recursive: true });

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }), PrismaModule],
  controllers: [CommerceAdminController],
  providers: [
    AdminApiKeyGuard,
    CommerceService,
    {
      provide: FirebaseIdTokenVerifier,
      useValue: { verify: async () => ({ uid: 'shkey-cust', email: 'c@t.local', name: 'C' }) },
    },
  ],
})
class SharedKeyModule {}

async function main() {
  const url = process.env.DATABASE_URL ?? '';
  if (!url.includes('127.0.0.1') && !url.includes('localhost')) {
    console.error('REFUSE: local test DB');
    process.exit(1);
  }
  const dbName = new URL(url).pathname.replace(/^\//, '');
  if (!/test/i.test(dbName) || dbName === 'mira_db') {
    console.error('REFUSE: *test* DB');
    process.exit(1);
  }

  process.env.ADMIN_API_KEY = MASTER;
  process.env.MIRA_ADMIN_STAFF = `ops.support:support:${SUPPORT_SECRET}`;
  process.env.AUTH_SKIP = 'false';
  process.env.NODE_ENV = 'development';

  const prisma = new PrismaClient();
  let app: INestApplication | null = null;
  const partnerIds: string[] = [];

  try {
    const mira = await prisma.partner.create({
      data: {
        type: 'developer',
        nameAr: 'ميرا',
        nameEn: `${run}-mira`,
        storeUrl: null,
        canSellProducts: true,
        city: 'الرياض',
        status: 'active',
      },
    });
    partnerIds.push(mira.id);
    const user = await prisma.user.create({
      data: {
        firebaseUid: `shkey-cust-${run}`,
        email: `c-${run}@t.local`,
        displayName: 'عميلة',
        subscription: { create: { plan: 'free', status: 'active' } },
        preference: { create: { locale: 'ar' } },
      },
    });
    const orderPublic = makePublicNumber('MO');
    const order = await prisma.commerceOrder.create({
      data: {
        publicNumber: orderPublic,
        userId: user.id,
        partnerId: mira.id,
        fulfillmentStatus: 'new',
        deliveryStatus: 'pending',
        paymentMethod: 'cod',
        paymentCollectionStatus: 'uncollected',
        subtotalHalalas: 4000,
        deliveryFeeHalalas: 500,
        totalHalalas: 4500,
        contactName: 'عميلة',
        contactPhone: '0501234567',
        addressLine: 'شارع',
        city: 'الرياض',
        items: {
          create: [
            {
              productId: '00000000-0000-0000-0000-000000000001',
              productNameAr: 'منتج مفتاح مشترك',
              variantKey: '',
              unitPriceHalalas: 4000,
              quantity: 1,
              lineTotalHalalas: 4000,
            },
          ],
        },
        events: {
          create: [
            { actorType: 'customer', actorId: user.id, field: 'fulfillment', toStatus: 'new' },
          ],
        },
      },
    });
    void order;

    app = await NestFactory.create(SharedKeyModule, { logger: ['error'] });
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.listen(0, '127.0.0.1');
    const port = (app.getHttpServer().address() as { port: number }).port;
    const api = `http://127.0.0.1:${port}/api/v1`;

    const sharedSession = await (
      await fetch(`${api}/admin/commerce/session`, {
        headers: { 'X-Admin-Key': MASTER, 'X-Admin-Actor': 'ops.sara' },
      })
    ).json();
    assert.equal(sharedSession.actorId, 'admin-key');
    assert.equal(sharedSession.role, 'shared');
    assert.match(sharedSession.labelAr, /مشترك/);

    const cancelText = await (
      await fetch(`${api}/admin/commerce/orders/${orderPublic}/transition`, {
        method: 'POST',
        headers: { 'X-Admin-Key': MASTER, 'X-Admin-Actor': 'ops.sara', 'content-type': 'application/json' },
        body: JSON.stringify({ fulfillmentStatus: 'cancelled', note: 'إلغاء بمفتاح مشترك' }),
      })
    ).text();
    const cancelled = JSON.parse(cancelText);
    const ev = (cancelled.events || []).find((e: { toStatus?: string }) => e.toStatus === 'cancelled');
    assert.equal(ev?.actorId, 'admin-key');
    assert.match(String(ev?.actorDisplayAr || ''), /مشترك/);
    assert.notEqual(ev?.actorId, 'ops.sara');

    const staffSession = await (
      await fetch(`${api}/admin/commerce/session`, { headers: { 'X-Admin-Key': SUPPORT_SECRET } })
    ).json();
    assert.equal(staffSession.actorId, 'ops.support');
    assert.equal(staffSession.role, 'support');

    const report = {
      orderPublic,
      sharedSession,
      cancelActorId: ev?.actorId,
      cancelActorDisplayAr: ev?.actorDisplayAr,
      staffSession,
      verdict: 'PASS',
    };
    writeFileSync(join(outDir, 'SHARED_KEY_ATTRIBUTION.json'), JSON.stringify(report, null, 2));
    writeFileSync(
      join(outDir, 'SHARED_KEY_ATTRIBUTION.md'),
      [
        '# إسناد المفتاح المشترك',
        '',
        `- الجلسة بمفتاح مشترك + X-Admin-Actor=ops.sara → actorId=\`${sharedSession.actorId}\``,
        `- إلغاء ${orderPublic} → actorId=\`${ev?.actorId}\` · ${ev?.actorDisplayAr}`,
        `- سر الدعم → actorId=\`${staffSession.actorId}\` role=\`${staffSession.role}\``,
        '',
        '**الحكم:** المفتاح المشترك يُسجَّل دائمًا كـ«مفتاح الإدارة المشترك». الاسم يظهر فقط بدخول سر الموظف الفردي.',
        '',
      ].join('\n'),
    );
    console.log('SHARED_KEY_ATTRIBUTION PASS', report);
  } finally {
    try {
      if (partnerIds.length) {
        await prisma.commerceOrderEvent.deleteMany({ where: { order: { partnerId: { in: partnerIds } } } }).catch(() => undefined);
        await prisma.commerceOrder.deleteMany({ where: { partnerId: { in: partnerIds } } });
        await prisma.partner.deleteMany({ where: { id: { in: partnerIds } } });
      }
      await prisma.user.deleteMany({ where: { firebaseUid: { startsWith: 'shkey-cust-' } } }).catch(() => undefined);
    } catch (_) {}
    await prisma.$disconnect();
    if (app) await app.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
