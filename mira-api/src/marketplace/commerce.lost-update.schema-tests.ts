import 'reflect-metadata';
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PartnersPortalService } from '../partners-portal/partners-portal.service';
import { parseAvailability } from './commerce.types';

/**
 * RC5-02: concurrent unify on overlapping multi-resource services must not wipe sibling capacities.
 */
const run = `lu${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

function cap(json: unknown, resourceId: string): number[] {
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

  const prismaA = new PrismaClient();
  const prismaB = new PrismaClient();
  const portalA = new PartnersPortalService(prismaA as unknown as PrismaService, { get: () => 'false' } as never);
  const portalB = new PartnersPortalService(prismaB as unknown as PrismaService, { get: () => 'false' } as never);
  const partnerIds: string[] = [];

  try {
    const clinic = await prismaA.partner.create({
      data: { type: 'clinic', nameAr: 'فقد تحديث', nameEn: `${run}-clinic`, city: 'الرياض', status: 'active' },
    });
    partnerIds.push(clinic.id);

    const mkWindows = (resources: Array<{ id: string; capacity: number }>) =>
      [0, 1, 2, 3, 4].flatMap((weekday) =>
        resources.map((r) => ({
          weekday,
          startMin: 540,
          endMin: 1020,
          capacity: r.capacity,
          resourceId: r.id,
        })),
      );

    const serviceA = await prismaA.service.create({
      data: {
        partnerId: clinic.id,
        nameAr: 'A',
        nameEn: `${run}-a`,
        durationMin: 30,
        priceHalalas: 5000,
        concernTags: [],
        bookingEnabled: true,
        active: true,
        contentStatus: 'published',
        availabilityJson: mkWindows([{ id: 'room-A', capacity: 1 }]),
      },
    });
    const serviceB = await prismaA.service.create({
      data: {
        partnerId: clinic.id,
        nameAr: 'B',
        nameEn: `${run}-b`,
        durationMin: 30,
        priceHalalas: 6000,
        concernTags: [],
        bookingEnabled: true,
        active: true,
        contentStatus: 'published',
        availabilityJson: mkWindows([{ id: 'room-B', capacity: 1 }]),
      },
    });
    const serviceC = await prismaA.service.create({
      data: {
        partnerId: clinic.id,
        nameAr: 'C',
        nameEn: `${run}-c`,
        durationMin: 30,
        priceHalalas: 7000,
        concernTags: [],
        bookingEnabled: true,
        active: true,
        contentStatus: 'published',
        availabilityJson: mkWindows([
          { id: 'room-A', capacity: 1 },
          { id: 'room-B', capacity: 1 },
        ]),
      },
    });

    const raced = await Promise.allSettled([
      portalA.updateService(clinic.id, serviceA.id, {
        unifySharedResources: true,
        availabilityJson: mkWindows([{ id: 'room-A', capacity: 2 }]),
      } as never),
      portalB.updateService(clinic.id, serviceB.id, {
        unifySharedResources: true,
        availabilityJson: mkWindows([{ id: 'room-B', capacity: 3 }]),
      } as never),
    ]);
    assert.equal(raced.filter((r) => r.status === 'fulfilled').length, 2, 'both updates must succeed');

    const a = await prismaA.service.findUniqueOrThrow({ where: { id: serviceA.id } });
    const b = await prismaA.service.findUniqueOrThrow({ where: { id: serviceB.id } });
    const c = await prismaA.service.findUniqueOrThrow({ where: { id: serviceC.id } });
    assert.ok(cap(a.availabilityJson, 'room-A').every((x) => x === 2), 'A keeps room-A=2');
    assert.ok(cap(b.availabilityJson, 'room-B').every((x) => x === 3), 'B keeps room-B=3');
    assert.ok(cap(c.availabilityJson, 'room-A').every((x) => x === 2), 'C keeps room-A=2');
    assert.ok(cap(c.availabilityJson, 'room-B').every((x) => x === 3), 'C keeps room-B=3');
    console.log('RC5-02 lost-update scenario PASS');
  } finally {
    await prismaA.service.deleteMany({ where: { partnerId: { in: partnerIds } } }).catch(() => undefined);
    await prismaA.partner.deleteMany({ where: { id: { in: partnerIds } } }).catch(() => undefined);
    await prismaA.$disconnect();
    await prismaB.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
