/**
 * P5-C02: availableOn filter uses real bookable slots (HTTP + service layer).
 */
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { INestApplication, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { PrismaClient } from '@prisma/client';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { FirebaseIdTokenVerifier } from '../common/auth/firebase-id-token-verifier';
import { MarketplaceController } from './marketplace.controller';
import { MarketplaceService } from './marketplace.service';
import { localInstant } from './commerce.types';

const DATE = '2026-11-10'; // Tuesday
const run = `p5a${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const outDir =
  process.env.MIRA_P5_OUT_DIR ||
  join(process.cwd(), '..', 'audit-out', 'p5', 'logs', `p5-avail-${run}`);
mkdirSync(outDir, { recursive: true });

const steps: Array<{ id: string; ok: boolean; detail?: unknown }> = [];
function record(id: string, ok: boolean, detail?: unknown) {
  steps.push({ id, ok, detail });
  console.log(JSON.stringify({ id, ok, detail }));
}

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }), PrismaModule],
  controllers: [MarketplaceController],
  providers: [
    {
      provide: MarketplaceService,
      useFactory: (prisma: PrismaService) => new MarketplaceService(prisma),
      inject: [PrismaService],
    },
    { provide: FirebaseIdTokenVerifier, useValue: { verify: async () => ({ uid: 'x' }) } },
  ],
})
class P5AvailModule {}

async function main() {
  const url = process.env.DATABASE_URL ?? '';
  if (!url.includes('localhost') && !url.includes('127.0.0.1')) {
    console.error('REFUSE: local DB only');
    process.exit(1);
  }
  const startedUtc = new Date().toISOString();
  const app: INestApplication = await NestFactory.create(P5AvailModule, { logger: ['error'] });
  app.setGlobalPrefix('api/v1');
  await app.listen(0);
  const port = (app.getHttpServer().address() as { port: number }).port;
  const base = `http://127.0.0.1:${port}`;
  const prisma = new PrismaClient();
  const partnerIds: string[] = [];
  const serviceIds: string[] = [];
  const bookingIds: string[] = [];
  const userIds: string[] = [];

  const weeklyOpen = [
    { weekday: 2, startMin: 9 * 60, endMin: 12 * 60, capacity: 1, resourceId: 'room-Open' },
  ];
  const weeklyFull = [
    { weekday: 2, startMin: 9 * 60, endMin: 12 * 60, capacity: 1, resourceId: 'room-Full' },
  ];

  try {
    const partner = await prisma.partner.create({
      data: {
        type: 'salon',
        status: 'active',
        nameAr: `صالون ${run}`,
        nameEn: `salon-${run}`,
        city: 'الرياض',
      },
    });
    partnerIds.push(partner.id);

    const mkService = async (opts: {
      name: string;
      bookingEnabled: boolean;
      durationMin: number;
      windows: unknown;
      branchId?: string;
      answers?: Record<string, unknown>;
    }) => {
      const row = await prisma.service.create({
        data: {
          partnerId: partner.id,
          nameAr: opts.name,
          nameEn: opts.name,
          durationMin: opts.durationMin,
          priceHalalas: 20000,
          concernTags: ['care'],
          category: 'care',
          active: true,
          contentStatus: 'published',
          catalogSource: 'catalog',
          bookingEnabled: opts.bookingEnabled,
          availabilityJson: { windows: opts.windows },
          serviceProfileJson: {
            answers: {
              placeMode: 'branch',
              ...(opts.branchId ? { branchId: opts.branchId } : {}),
              ...(opts.answers ?? {}),
            },
          },
        },
      });
      serviceIds.push(row.id);
      return row;
    };

    const open = await mkService({
      name: `مفتوح ${run}`,
      bookingEnabled: true,
      durationMin: 60,
      windows: weeklyOpen,
      branchId: 'branch-open',
    });
    const openAlt = await mkService({
      name: `مفتوح بديل ${run}`,
      bookingEnabled: true,
      durationMin: 60,
      windows: [
        { weekday: 2, startMin: 9 * 60, endMin: 12 * 60, capacity: 1, resourceId: 'room-Open-B' },
      ],
      branchId: 'branch-alt',
    });
    const disabled = await mkService({
      name: `معطّل ${run}`,
      bookingEnabled: false,
      durationMin: 60,
      windows: weeklyOpen,
    });
    const shortWindow = await mkService({
      name: `قصير ${run}`,
      bookingEnabled: true,
      durationMin: 60,
      windows: [{ weekday: 2, startMin: 9 * 60, endMin: 9 * 60 + 30, capacity: 1, resourceId: 'room-Short' }],
    });
    const conflictA = await mkService({
      name: `تعارض أ ${run}`,
      bookingEnabled: true,
      durationMin: 60,
      windows: [{ weekday: 2, startMin: 9 * 60, endMin: 12 * 60, capacity: 1, resourceId: 'room-Conflict' }],
    });
    await mkService({
      name: `تعارض ب ${run}`,
      bookingEnabled: true,
      durationMin: 60,
      windows: [{ weekday: 2, startMin: 9 * 60, endMin: 12 * 60, capacity: 2, resourceId: 'room-Conflict' }],
    });
    const full = await mkService({
      name: `ممتلئ ${run}`,
      bookingEnabled: true,
      durationMin: 60,
      windows: weeklyFull,
      branchId: 'branch-full',
    });

    const user = await prisma.user.create({
      data: { firebaseUid: `uid-${run}` },
    });
    userIds.push(user.id);

    // Fill all slots for `full` on DATE.
    for (const startMin of [9 * 60, 10 * 60, 11 * 60]) {
      const startsAt = localInstant(DATE, startMin)!;
      const endsAt = localInstant(DATE, startMin + 60)!;
      const booking = await prisma.commerceBooking.create({
        data: {
          publicNumber: `MB-${run}-${startMin}`,
          userId: user.id,
          partnerId: partner.id,
          serviceId: full.id,
          serviceNameAr: full.nameAr,
          resourceId: 'room-Full',
          startsAt,
          endsAt,
          durationMin: 60,
          status: 'confirmed',
          contactName: 'اختبار',
          contactPhone: '+966500000000',
          priceHalalas: 20000,
          payMode: 'pay_at_venue',
          idempotencyKey: `idem-${run}-${startMin}`,
        },
      });
      bookingIds.push(booking.id);
    }

    const browse = async (qs: string) => {
      const res = await fetch(`${base}/api/v1/marketplace/catalog?partnerId=${partner.id}&kind=service&${qs}`);
      const body = (await res.json()) as { items: Array<{ id: string }>; totalMatched?: number };
      return { status: res.status, ids: body.items.map((i) => i.id), total: body.totalMatched ?? body.items.length };
    };

    const openHit = await browse(`availableOn=${DATE}`);
    record('P5_AVAIL_OPEN_INCLUDED', openHit.status === 200 && openHit.ids.includes(open.id), openHit);
    record('P5_AVAIL_DISABLED_EXCLUDED', !openHit.ids.includes(disabled.id), openHit);
    record('P5_AVAIL_SHORT_WINDOW_EXCLUDED', !openHit.ids.includes(shortWindow.id), openHit);
    record('P5_AVAIL_CAPACITY_CONFLICT_EXCLUDED', !openHit.ids.includes(conflictA.id), openHit);
    record('P5_AVAIL_FULL_DAY_EXCLUDED', !openHit.ids.includes(full.id), openHit);

    const branchOpen = await browse(`availableOn=${DATE}&branch=branch-open`);
    record('P5_AVAIL_BRANCH_OPEN', branchOpen.ids.includes(open.id) && !branchOpen.ids.includes(full.id), branchOpen);

    const branchFull = await browse(`availableOn=${DATE}&branch=branch-full`);
    record('P5_AVAIL_BRANCH_FULL_EMPTY', !branchFull.ids.includes(full.id) && !branchFull.ids.includes(open.id), branchFull);

    // Two bookable branches on the same day: selecting one must not drop the other from branch facets.
    const branchFacetsRes = await fetch(
      `${base}/api/v1/marketplace/catalog?partnerId=${partner.id}&kind=service&availableOn=${DATE}&branch=branch-open&facets=1`,
    );
    const branchFacetsBody = (await branchFacetsRes.json()) as {
      facets?: { branch?: Array<{ id: string; count: number }> };
      items: Array<{ id: string }>;
    };
    const facetIds = (branchFacetsBody.facets?.branch ?? []).map((b) => b.id);
    record(
      'P5_AVAIL_BRANCH_FACET_KEEPS_ALTERNATES',
      branchFacetsRes.status === 200 &&
        facetIds.includes('branch-open') &&
        facetIds.includes('branch-alt') &&
        !facetIds.includes('branch-full'),
      { facetIds, itemIds: branchFacetsBody.items.map((i) => i.id), openAlt: openAlt.id },
    );
    record(
      'P5_AVAIL_BRANCH_FACET_RESULTS_SCOPED',
      branchFacetsBody.items.length >= 1 && branchFacetsBody.items.every((i) => i.id === open.id),
      { itemIds: branchFacetsBody.items.map((i) => i.id) },
    );

    assert.ok(openHit.ids.includes(open.id));
  } finally {
    await prisma.commerceBooking.deleteMany({ where: { id: { in: bookingIds } } }).catch(() => undefined);
    await prisma.service.deleteMany({ where: { id: { in: serviceIds } } }).catch(() => undefined);
    await prisma.partner.deleteMany({ where: { id: { in: partnerIds } } }).catch(() => undefined);
    await prisma.user.deleteMany({ where: { id: { in: userIds } } }).catch(() => undefined);
    await prisma.$disconnect().catch(() => undefined);
    await app.close().catch(() => undefined);
  }

  const failed = steps.filter((s) => !s.ok);
  const summary = {
    ok: failed.length === 0,
    id: 'P5_CATALOG_AVAILABILITY',
    commit: process.env.MIRA_P5_COMMIT || '',
    runId: process.env.MIRA_P5_RUN_ID || run,
    startedUtc,
    finishedUtc: new Date().toISOString(),
    steps,
    outDir,
  };
  writeFileSync(join(outDir, 'p5-catalog-availability.json'), JSON.stringify(summary, null, 2));
  writeFileSync(join(outDir, 'verdict.txt'), summary.ok ? 'PASS\n' : 'FAIL\n');
  console.log(JSON.stringify({ ok: summary.ok, failed: failed.map((f) => f.id), outDir }));
  process.exit(summary.ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  writeFileSync(join(outDir, 'verdict.txt'), 'FAIL\n');
  process.exit(2);
});
