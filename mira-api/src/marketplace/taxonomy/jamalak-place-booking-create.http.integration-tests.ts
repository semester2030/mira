/**
 * Jamalak §3 booking persistence + negatives (in-process Nest + Scripted Firebase).
 * Local DB only.
 */
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { INestApplication, Module, UnauthorizedException } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { PrismaClient } from '@prisma/client';
import { FirebaseIdTokenVerifier, VerifiedFirebaseIdentity } from '../../common/auth/firebase-id-token-verifier';
import { HttpExceptionFilter } from '../../common/filters/http-exception.filter';
import { AdminApiKeyGuard } from '../../common/guards/admin-api-key.guard';
import { FirebaseAuthGuard } from '../../common/guards/firebase-auth.guard';
import { PrismaModule } from '../../prisma/prisma.module';
import { PartnerTokenGuard } from '../../partners-portal/guards/partner-token.guard';
import { CommerceAdminController } from '../commerce.admin.controller';
import { CommerceController } from '../commerce.controller';
import { CommercePartnerController } from '../commerce-partner.controller';
import { CommerceService } from '../commerce.service';

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

const runId = `pbk-${Date.now().toString(36)}-${randomBytes(2).toString('hex')}`;
const tokens = { 'cust-a': `${runId}-cust` };

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
class PlaceBookingModule {}

function nextWeekdayAt(weekday: number, hour: number): Date {
  const d = new Date();
  d.setUTCHours(hour, 0, 0, 0);
  const delta = (weekday - d.getUTCDay() + 7) % 7 || 7;
  d.setUTCDate(d.getUTCDate() + delta);
  return d;
}

async function main() {
  const url = process.env.DATABASE_URL ?? '';
  if (!url.includes('localhost') && !url.includes('127.0.0.1')) {
    console.error('REFUSE: local DATABASE_URL required');
    process.exit(1);
  }
  process.env.ADMIN_API_KEY = 'place-booking-admin';
  process.env.AUTH_SKIP = 'false';

  const app: INestApplication = await NestFactory.create(PlaceBookingModule, { logger: ['error'] });
  app.setGlobalPrefix('api/v1');
  app.useGlobalFilters(new HttpExceptionFilter());
  await app.listen(0);
  const port = (app.getHttpServer().address() as { port: number }).port;
  const base = `http://127.0.0.1:${port}/api/v1`;
  const prisma = new PrismaClient();
  const partnerIds: string[] = [];

  const call = async (method: string, path: string, body?: unknown) => {
    const res = await fetch(`${base}${path}`, {
      method,
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer cust-a',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    let json: Record<string, unknown> | null = null;
    try {
      json = text ? (JSON.parse(text) as Record<string, unknown>) : null;
    } catch {
      json = { raw: text };
    }
    return { status: res.status, json, text };
  };

  try {
    const salon = await prisma.partner.create({
      data: {
        type: 'salon',
        status: 'active',
        nameAr: `صالون حجز ${runId}`,
        nameEn: `book-${runId}`,
        city: 'الرياض',
        activitiesMeta: { providerKind: 'facility', bookingActivated: true, publicContactVisible: false },
      },
    });
    partnerIds.push(salon.id);
    const foreign = await prisma.partner.create({
      data: {
        type: 'salon',
        status: 'active',
        nameAr: `أجنبي ${runId}`,
        nameEn: `foreign-${runId}`,
        city: 'جدة',
      },
    });
    partnerIds.push(foreign.id);

    const branch = await prisma.partnerBranch.create({
      data: {
        partnerId: salon.id,
        nameAr: 'فرع الرياض',
        cityId: 'sa-riyadh',
        cityNameAr: 'الرياض',
        addressAr: 'العليا',
        lat: 24.71,
        lng: 46.67,
        active: true,
      },
    });
    const siblingBranch = await prisma.partnerBranch.create({
      data: {
        partnerId: salon.id,
        nameAr: 'فرع النخيل',
        cityId: 'sa-riyadh',
        cityNameAr: 'الرياض',
        addressAr: 'النخيل',
        lat: 24.75,
        lng: 46.65,
        active: true,
      },
    });
    const foreignBranch = await prisma.partnerBranch.create({
      data: {
        partnerId: foreign.id,
        nameAr: 'فرع جدة أجنبي',
        cityId: 'sa-jeddah',
        cityNameAr: 'جدة',
        lat: 21.48,
        lng: 39.19,
        active: true,
      },
    });

    const windows = [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
      weekday,
      startMin: 8 * 60,
      endMin: 20 * 60,
      capacity: 1,
      resourceId: 'staff-a',
    }));

    const makeup = await prisma.service.create({
      data: {
        partnerId: salon.id,
        nameAr: `مكياج زيارة ${runId}`,
        nameEn: `makeup-${runId}`,
        durationMin: 60,
        priceHalalas: 30000,
        category: 'beauty.makeup.bridal',
        placeMode: 'either',
        branchId: branch.id,
        coverageJson: { cityIds: ['sa-jeddah', 'sa-riyadh'], travelFeeSar: 50 },
        availabilityJson: windows,
        active: true,
        contentStatus: 'published',
        catalogSource: 'catalog',
        bookingEnabled: true,
        payMode: 'pay_at_venue',
      },
    });
    const color = await prisma.service.create({
      data: {
        partnerId: salon.id,
        nameAr: `صبغة مقر ${runId}`,
        nameEn: `color-${runId}`,
        durationMin: 90,
        priceHalalas: 40000,
        category: 'beauty.hair.color',
        placeMode: 'branch',
        branchId: branch.id,
        availabilityJson: windows,
        active: true,
        contentStatus: 'published',
        catalogSource: 'catalog',
        bookingEnabled: true,
        payMode: 'pay_at_venue',
      },
    });

    const t1 = nextWeekdayAt(1, 10); // Monday 10:00 UTC
    const t2 = nextWeekdayAt(1, 12); // Monday 12:00 UTC

    const missingPlace = await call('POST', '/marketplace/commerce/bookings', {
      serviceId: makeup.id,
      startsAt: nextWeekdayAt(4, 10).toISOString(),
      resourceId: 'staff-a',
      contactName: 'عميلة',
      contactPhone: '0501112233',
      idempotencyKey: `${runId}-no-place`,
    });
    assert.ok(missingPlace.status >= 400, missingPlace.text);
    assert.ok(
      String((missingPlace.json as { code?: string })?.code || missingPlace.text).includes('PLACE_REQUIRED'),
      missingPlace.text,
    );

    const wrongServiceBranch = await call('POST', '/marketplace/commerce/bookings', {
      serviceId: color.id,
      startsAt: nextWeekdayAt(4, 12).toISOString(),
      placeMode: 'branch',
      branchId: siblingBranch.id,
      resourceId: 'staff-a',
      contactName: 'عميلة',
      contactPhone: '0501112233',
      idempotencyKey: `${runId}-wrong-branch`,
    });
    assert.ok(wrongServiceBranch.status >= 400, wrongServiceBranch.text);
    assert.ok(
      String((wrongServiceBranch.json as { code?: string })?.code || wrongServiceBranch.text).includes(
        'BRANCH_NOT_FOR_SERVICE',
      ),
      wrongServiceBranch.text,
    );

    const branchBook = await call('POST', '/marketplace/commerce/bookings', {
      serviceId: makeup.id,
      startsAt: t1.toISOString(),
      placeMode: 'branch',
      branchId: branch.id,
      resourceId: 'staff-a',
      contactName: 'عميلة',
      contactPhone: '0501112233',
      idempotencyKey: `${runId}-branch`,
    });
    assert.equal(branchBook.status, 201, branchBook.text);
    const bb = (branchBook.json as { booking?: Record<string, unknown> }).booking || branchBook.json!;
    assert.equal(bb.placeMode, 'branch');
    assert.equal(bb.branchId, branch.id);
    assert.ok(String(bb.branchLabel || '').includes('فرع الرياض'));
    assert.equal(bb.visitCityId ?? null, null);

    const homeBook = await call('POST', '/marketplace/commerce/bookings', {
      serviceId: makeup.id,
      startsAt: t2.toISOString(),
      placeMode: 'home',
      visitCityId: 'sa-jeddah',
      visitAddress: 'حي الزهراء، جدة',
      travelFeeHalalas: 5000,
      resourceId: 'staff-a',
      contactName: 'عميلة',
      contactPhone: '0501112233',
      idempotencyKey: `${runId}-home`,
    });
    assert.equal(homeBook.status, 201, homeBook.text);
    const hb = (homeBook.json as { booking?: Record<string, unknown> }).booking || homeBook.json!;
    assert.equal(hb.placeMode, 'home');
    assert.equal(hb.branchId ?? null, null);
    assert.equal(hb.visitCityId, 'sa-jeddah');
    assert.ok(String(hb.visitAddress || '').includes('الزهراء'));
    assert.ok(String(hb.branchLabel || '').includes('زيارة'));
    assert.ok(!String(hb.branchLabel || '').endsWith('الرياض') || String(hb.branchLabel || '').includes('زيارة'));

    const foreignReject = await call('POST', '/marketplace/commerce/bookings', {
      serviceId: makeup.id,
      startsAt: nextWeekdayAt(2, 10).toISOString(),
      placeMode: 'branch',
      branchId: foreignBranch.id,
      resourceId: 'staff-a',
      contactName: 'عميلة',
      contactPhone: '0501112233',
      idempotencyKey: `${runId}-foreign`,
    });
    assert.ok(foreignReject.status >= 400, foreignReject.text);
    assert.ok(String((foreignReject.json as { code?: string })?.code || foreignReject.text).includes('BRANCH_NOT_OWNED'));

    const outCov = await call('POST', '/marketplace/commerce/bookings', {
      serviceId: makeup.id,
      startsAt: nextWeekdayAt(2, 12).toISOString(),
      placeMode: 'home',
      visitCityId: 'sa-dammam',
      visitAddress: 'الدمام',
      resourceId: 'staff-a',
      contactName: 'عميلة',
      contactPhone: '0501112233',
      idempotencyKey: `${runId}-cov`,
    });
    assert.ok(outCov.status >= 400, outCov.text);
    assert.ok(String((outCov.json as { code?: string })?.code || outCov.text).includes('PLACE_OUT_OF_COVERAGE'));

    const colorHome = await call('POST', '/marketplace/commerce/bookings', {
      serviceId: color.id,
      startsAt: nextWeekdayAt(3, 10).toISOString(),
      placeMode: 'home',
      visitCityId: 'sa-jeddah',
      visitAddress: 'جدة',
      resourceId: 'staff-a',
      contactName: 'عميلة',
      contactPhone: '0501112233',
      idempotencyKey: `${runId}-color-home`,
    });
    assert.ok(colorHome.status >= 400, colorHome.text);
    assert.ok(String((colorHome.json as { code?: string })?.code || colorHome.text).includes('PLACE_NOT_ALLOWED'));

    // Overlap: staff booked at branch (t1) then same staff for home visit at the same instant.
    const overlapHome = await call('POST', '/marketplace/commerce/bookings', {
      serviceId: makeup.id,
      startsAt: t1.toISOString(),
      placeMode: 'home',
      visitCityId: 'sa-jeddah',
      visitAddress: 'حي الشاطئ، جدة',
      travelFeeHalalas: 5000,
      resourceId: 'staff-a',
      contactName: 'عميلة',
      contactPhone: '0501112233',
      idempotencyKey: `${runId}-overlap-home`,
    });
    assert.ok(
      overlapHome.status >= 400,
      `branch→home overlap expected fail got ${overlapHome.status} ${overlapHome.text}`,
    );
    assert.ok(
      String((overlapHome.json as { code?: string })?.code || overlapHome.text).includes('BOOKING_SLOT_FULL') ||
        String((overlapHome.json as { code?: string })?.code || overlapHome.text).includes('BOOKING_USER_OVERLAP'),
      overlapHome.text,
    );

    console.log(
      JSON.stringify(
        {
          runId,
          verdict: 'PASS',
          branchBookingId: bb.id,
          homeBookingId: hb.id,
          branchId: branch.id,
          visitCityId: hb.visitCityId,
          travelFeeHalalas: hb.travelFeeHalalas ?? null,
        },
        null,
        2,
      ),
    );
  } finally {
    await prisma.commerceBooking.deleteMany({ where: { partnerId: { in: partnerIds } } }).catch(() => undefined);
    await prisma.service.deleteMany({ where: { partnerId: { in: partnerIds } } }).catch(() => undefined);
    await prisma.partnerBranch.deleteMany({ where: { partnerId: { in: partnerIds } } }).catch(() => undefined);
    await prisma.partner.deleteMany({ where: { id: { in: partnerIds } } }).catch(() => undefined);
    await prisma.$disconnect();
    await app.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
