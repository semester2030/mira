import 'reflect-metadata';
import assert from 'node:assert/strict';
import { BadRequestException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PartnersPortalService } from '../partners-portal/partners-portal.service';
import { parseAvailability } from './commerce.types';

/**
 * RC4-03: createService + unifySharedResources must be atomic on real PostgreSQL.
 */
const run = `cs${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

function capsOf(json: unknown, resourceId: string): number[] {
  return parseAvailability(json)
    .filter((w) => w.resourceId === resourceId)
    .map((w) => w.capacity);
}

async function main() {
  const url = process.env.DATABASE_URL ?? '';
  if (!url.includes('localhost') && !url.includes('127.0.0.1')) {
    console.error('REFUSE: DATABASE_URL must be a local test database');
    process.exit(1);
  }

  const prisma = new PrismaClient();
  const portal = new PartnersPortalService(prisma as unknown as PrismaService, { get: () => 'false' } as never);
  const partnerIds: string[] = [];
  const bookingIds: string[] = [];
  const userIds: string[] = [];

  try {
    const clinic = await prisma.partner.create({
      data: { type: 'clinic', nameAr: 'ذرية', nameEn: `${run}-clinic`, city: 'الرياض', status: 'active' },
    });
    partnerIds.push(clinic.id);
    const other = await prisma.partner.create({
      data: { type: 'clinic', nameAr: 'أخرى', nameEn: `${run}-other`, city: 'الرياض', status: 'active' },
    });
    partnerIds.push(other.id);

    const baseWindows = [0, 1, 2, 3, 4].map((weekday) => ({
      weekday,
      startMin: 540,
      endMin: 1020,
      capacity: 1,
      resourceId: 'غرفة-توحيد',
    }));

    const existingA = await prisma.service.create({
      data: {
        partnerId: clinic.id,
        nameAr: 'قديمة أ',
        nameEn: `${run}-old-a`,
        durationMin: 30,
        priceHalalas: 5000,
        concernTags: [],
        bookingEnabled: true,
        active: true,
        contentStatus: 'published',
        availabilityJson: baseWindows,
      },
    });
    const existingB = await prisma.service.create({
      data: {
        partnerId: clinic.id,
        nameAr: 'قديمة ب',
        nameEn: `${run}-old-b`,
        durationMin: 30,
        priceHalalas: 6000,
        concernTags: [],
        bookingEnabled: true,
        active: true,
        contentStatus: 'published',
        availabilityJson: baseWindows,
      },
    });
    const foreign = await prisma.service.create({
      data: {
        partnerId: other.id,
        nameAr: 'أجنبية',
        nameEn: `${run}-foreign`,
        durationMin: 30,
        priceHalalas: 7000,
        concernTags: [],
        bookingEnabled: true,
        active: true,
        contentStatus: 'published',
        availabilityJson: baseWindows.map((w) => ({ ...w, capacity: 1 })),
      },
    });

    // 1) Invalid category + unify request → no sibling capacity change
    const beforeA = JSON.stringify(await prisma.service.findUniqueOrThrow({ where: { id: existingA.id } }).then((s) => s.availabilityJson));
    const beforeB = JSON.stringify(await prisma.service.findUniqueOrThrow({ where: { id: existingB.id } }).then((s) => s.availabilityJson));
    await assert.rejects(
      () =>
        portal.createService(clinic.id, {
          nameAr: 'فشل تصنيف',
          priceHalalas: 8000,
          category: 'not-a-real-category',
          durationMin: 30,
          unifySharedResources: true,
          availabilityJson: baseWindows.map((w) => ({ ...w, capacity: 2 })),
        } as never),
      (err: unknown) => err instanceof BadRequestException,
    );
    const afterFailA = JSON.stringify(await prisma.service.findUniqueOrThrow({ where: { id: existingA.id } }).then((s) => s.availabilityJson));
    const afterFailB = JSON.stringify(await prisma.service.findUniqueOrThrow({ where: { id: existingB.id } }).then((s) => s.availabilityJson));
    assert.equal(afterFailA, beforeA);
    assert.equal(afterFailB, beforeB);
    console.log('1 PASS: invalid category + unify — no sibling mutation');

    // 2) Injected failure after first unify — full rollback
    process.env.MIRA_TEST_UNIFY_FAIL_AFTER = '1';
    try {
      await assert.rejects(
        () =>
          portal.createService(clinic.id, {
            nameAr: 'حقن فشل',
            priceHalalas: 8000,
            durationMin: 30,
            unifySharedResources: true,
            availabilityJson: baseWindows.map((w) => ({ ...w, capacity: 2 })),
          } as never),
        (err: unknown) => err instanceof BadRequestException,
      );
    } finally {
      delete process.env.MIRA_TEST_UNIFY_FAIL_AFTER;
    }
    const rolledA = capsOf((await prisma.service.findUniqueOrThrow({ where: { id: existingA.id } })).availabilityJson, 'غرفة-توحيد');
    const rolledB = capsOf((await prisma.service.findUniqueOrThrow({ where: { id: existingB.id } })).availabilityJson, 'غرفة-توحيد');
    assert.ok(rolledA.every((c) => c === 1));
    assert.ok(rolledB.every((c) => c === 1));
    const leaked = await prisma.service.findFirst({ where: { partnerId: clinic.id, nameAr: 'حقن فشل' } });
    assert.equal(leaked, null);
    console.log('2 PASS: injected mid-unify failure rolls back');

    // 3) Success — all siblings + new service commit together
    const created = await portal.createService(clinic.id, {
      nameAr: 'جديدة ناجحة',
      priceHalalas: 9000,
      durationMin: 40,
      unifySharedResources: true,
      availabilityJson: baseWindows.map((w) => ({ ...w, capacity: 2 })),
      bookingEnabled: true,
    } as never);
    const okA = capsOf((await prisma.service.findUniqueOrThrow({ where: { id: existingA.id } })).availabilityJson, 'غرفة-توحيد');
    const okB = capsOf((await prisma.service.findUniqueOrThrow({ where: { id: existingB.id } })).availabilityJson, 'غرفة-توحيد');
    const okNew = capsOf((await prisma.service.findUniqueOrThrow({ where: { id: created.id } })).availabilityJson, 'غرفة-توحيد');
    assert.ok(okA.every((c) => c === 2));
    assert.ok(okB.every((c) => c === 2));
    assert.ok(okNew.every((c) => c === 2));
    console.log('3 PASS: atomic success unify + create');

    // 4) Concurrent unify to different capacities — no mixed leftover
    await prisma.service.update({
      where: { id: existingA.id },
      data: { availabilityJson: baseWindows.map((w) => ({ ...w, capacity: 2 })) },
    });
    await prisma.service.update({
      where: { id: existingB.id },
      data: { availabilityJson: baseWindows.map((w) => ({ ...w, capacity: 2 })) },
    });
    const raced = await Promise.allSettled([
      portal.createService(clinic.id, {
        nameAr: 'سباق3',
        priceHalalas: 1000,
        durationMin: 20,
        unifySharedResources: true,
        availabilityJson: baseWindows.map((w) => ({ ...w, capacity: 3 })),
      } as never),
      portal.createService(clinic.id, {
        nameAr: 'سباق4',
        priceHalalas: 1000,
        durationMin: 20,
        unifySharedResources: true,
        availabilityJson: baseWindows.map((w) => ({ ...w, capacity: 4 })),
      } as never),
    ]);
    assert.ok(raced.some((r) => r.status === 'fulfilled'));
    const finalA = capsOf((await prisma.service.findUniqueOrThrow({ where: { id: existingA.id } })).availabilityJson, 'غرفة-توحيد');
    const finalB = capsOf((await prisma.service.findUniqueOrThrow({ where: { id: existingB.id } })).availabilityJson, 'غرفة-توحيد');
    assert.deepEqual(new Set(finalA), new Set(finalB));
    assert.equal(new Set(finalA).size, 1);
    assert.ok([3, 4].includes(finalA[0]!));
    console.log('4 PASS: concurrent unify — no mixed capacities', finalA[0]);

    // 5) Cannot mutate other partner via unify
    const foreignBefore = JSON.stringify((await prisma.service.findUniqueOrThrow({ where: { id: foreign.id } })).availabilityJson);
    await portal.createService(clinic.id, {
      nameAr: 'لا تلمس الأخرى',
      priceHalalas: 1100,
      durationMin: 20,
      unifySharedResources: true,
      availabilityJson: baseWindows.map((w) => ({ ...w, capacity: 5 })),
    } as never);
    const foreignAfter = JSON.stringify((await prisma.service.findUniqueOrThrow({ where: { id: foreign.id } })).availabilityJson);
    assert.equal(foreignAfter, foreignBefore);
    console.log('5 PASS: other partner untouched');

    // 6) Failure does not alter existing bookings
    const user = await prisma.user.create({
      data: { firebaseUid: `${run}-u`, email: `${run}@t.local`, displayName: 'مختبر' },
    });
    userIds.push(user.id);
    const booking = await prisma.commerceBooking.create({
      data: {
        userId: user.id,
        partnerId: clinic.id,
        serviceId: existingA.id,
        serviceNameAr: 'قديمة أ',
        publicNumber: `B-${run}`,
        status: 'confirmed',
        startsAt: new Date(Date.now() + 20 * 86_400_000),
        endsAt: new Date(Date.now() + 20 * 86_400_000 + 3600_000),
        durationMin: 30,
        priceHalalas: 5000,
        contactName: 'سارة',
        contactPhone: '0501234567',
        resourceId: 'غرفة-توحيد',
        idempotencyKey: `${run}-bk`,
        requestFingerprint: `${run}-fp`,
      },
    });
    bookingIds.push(booking.id);
    process.env.MIRA_TEST_UNIFY_FAIL_AFTER = '1';
    try {
      await assert.rejects(() =>
        portal.createService(clinic.id, {
          nameAr: 'فشل حجوزات',
          priceHalalas: 1200,
          durationMin: 20,
          unifySharedResources: true,
          availabilityJson: baseWindows.map((w) => ({ ...w, capacity: 9 })),
        } as never),
      );
    } finally {
      delete process.env.MIRA_TEST_UNIFY_FAIL_AFTER;
    }
    const bookingAgain = await prisma.commerceBooking.findUniqueOrThrow({ where: { id: booking.id } });
    assert.equal(bookingAgain.priceHalalas, 5000);
    assert.equal(bookingAgain.status, 'confirmed');
    assert.equal(bookingAgain.durationMin, 30);
    console.log('6 PASS: booking snapshot unchanged after failed unify');

    console.log('commerce.create-service-atomic schema tests passed');
  } finally {
    delete process.env.MIRA_TEST_UNIFY_FAIL_AFTER;
    await prisma.commerceBooking.deleteMany({ where: { id: { in: bookingIds } } }).catch(() => undefined);
    await prisma.service.deleteMany({ where: { partnerId: { in: partnerIds } } }).catch(() => undefined);
    await prisma.partner.deleteMany({ where: { id: { in: partnerIds } } }).catch(() => undefined);
    await prisma.user.deleteMany({ where: { id: { in: userIds } } }).catch(() => undefined);
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
