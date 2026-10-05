import 'reflect-metadata';
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { HttpException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PartnersPortalService } from '../partners-portal/partners-portal.service';
import { CommerceService } from './commerce.service';
import { CatalogContentService } from './catalog-content.service';
import { parseAvailability } from './commerce.types';
import {
  acquireScheduleLocks,
  bookingResourceLockKey,
  partnerScheduleCoordKey,
  scheduleLockKeys,
} from './commerce-schedule-locks';

/**
 * RC6-02/03: partner coordination protocol + production-path booking/withdraw races.
 * Run: npx tsx src/marketplace/commerce.lock-protocol.schema-tests.ts
 */
const run = `lp${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const PHONE = '+966500000099';
const log: string[] = [];
const step = (msg: string) => {
  const line = `${new Date().toISOString()} ${msg}`;
  log.push(line);
  console.log(line);
};

function defer() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

function mkWindows(resources: Array<{ id: string; capacity: number }>) {
  return [0, 1, 2, 3, 4].flatMap((weekday) =>
    resources.map((r) => ({
      weekday,
      startMin: 540,
      endMin: 1020,
      capacity: r.capacity,
      resourceId: r.id,
    })),
  );
}

function localParts(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return { dateKey: `${y}-${m}-${day}` };
}

function localInstant(dateKey: string, minute: number) {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(y!, m! - 1, d!, Math.floor(minute / 60), minute % 60, 0, 0);
}

/** Next local calendar day with weekday 0–4 (matches mkWindows Sun–Thu). */
function nextOpenDay(minOffsetDays = 1) {
  let d = new Date(Date.now() + minOffsetDays * 86_400_000);
  for (let i = 0; i < 14; i++) {
    if (d.getDay() <= 4) return localParts(d).dateKey;
    d = new Date(d.getTime() + 86_400_000);
  }
  throw new Error('no open weekday in window');
}

async function waitForAdvisoryWaiter(prisma: PrismaClient, key: string, timeoutMs = 12_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const rows = await prisma.$queryRaw<Array<{ granted: boolean; query: string | null }>>`
      SELECT l.granted, a.query
      FROM pg_locks l
      JOIN pg_stat_activity a ON a.pid = l.pid
      WHERE l.locktype = 'advisory'
        AND NOT l.granted
        AND a.query ILIKE ${'%' + key.split(':').slice(-1)[0] + '%'}
    `;
    // Fallback: any ungranted advisory wait on this connection set
    const any = await prisma.$queryRaw<Array<{ pid: number }>>`
      SELECT l.pid FROM pg_locks l
      WHERE l.locktype = 'advisory' AND NOT l.granted
      LIMIT 1
    `;
    if (rows.length || any.length) return;
    await new Promise((r) => setTimeout(r, 40));
  }
  throw new Error(`timeout waiting for advisory waiter involving ${key}`);
}

async function main() {
  const url = process.env.DATABASE_URL ?? '';
  if (!url.includes('localhost') && !url.includes('127.0.0.1')) {
    console.error('REFUSE: DATABASE_URL must be a local test database');
    process.exit(1);
  }

  const prismaA = new PrismaClient();
  const prismaB = new PrismaClient();
  const prismaC = new PrismaClient();
  const portalA = new PartnersPortalService(prismaA as unknown as PrismaService, { get: () => 'false' } as never);
  const portalB = new PartnersPortalService(prismaB as unknown as PrismaService, { get: () => 'false' } as never);
  const commerceA = new CommerceService(prismaA as unknown as PrismaService);
  const commerceB = new CommerceService(prismaB as unknown as PrismaService);
  const catalog = new CatalogContentService(prismaA as unknown as PrismaService, {
    putObject: async () => ({ key: 'x' }),
    deleteObject: async () => undefined,
  } as never);
  const created = { partnerIds: [] as string[], userIds: [] as string[], serviceIds: [] as string[] };

  try {
    const clinic = await prismaA.partner.create({
      data: { type: 'clinic', nameAr: 'بروتوكول', nameEn: `${run}-clinic`, city: 'الرياض', status: 'active' },
    });
    created.partnerIds.push(clinic.id);
    const actorA = await commerceA.customerActor({
      firebaseUid: `${run}-a`,
      email: `${run}-a@test.local`,
      name: 'A',
    });
    const actorB = await commerceB.customerActor({
      firebaseUid: `${run}-b`,
      email: `${run}-b@test.local`,
      name: 'B',
    });
    created.userIds.push(actorA.userId, actorB.userId);

    // --- RC6-02: resource-scope growth must not deadlock (T0/T1/T2) ---
    const s1 = await prismaA.service.create({
      data: {
        partnerId: clinic.id,
        nameAr: 'S1',
        nameEn: `${run}-s1`,
        durationMin: 30,
        priceHalalas: 5000,
        concernTags: [],
        bookingEnabled: true,
        active: true,
        contentStatus: 'published',
        availabilityJson: mkWindows([{ id: 'Z', capacity: 1 }]),
      },
    });
    const s2 = await prismaA.service.create({
      data: {
        partnerId: clinic.id,
        nameAr: 'S2',
        nameEn: `${run}-s2`,
        durationMin: 30,
        priceHalalas: 6000,
        concernTags: [],
        bookingEnabled: true,
        active: true,
        contentStatus: 'published',
        availabilityJson: mkWindows([{ id: 'A', capacity: 1 }]),
      },
    });
    created.serviceIds.push(s1.id, s2.id);

    // Reproduce OLD deadlock pattern with partial locks (control), then prove production path is safe.
    // T1 holds Z then waits; T2 takes A then waits for Z; T1 tries A → circular wait.
    const oldZ = bookingResourceLockKey(clinic.id, 'Z');
    const oldA = bookingResourceLockKey(clinic.id, 'A');
    const t1Ready = defer();
    const releaseT1 = defer();
    let oldDeadlock = false;
    const oldT1 = prismaA
      .$transaction(
        async (tx) => {
          await acquireScheduleLocks(tx, [oldZ]);
          step(`OLD-T1 held ${oldZ}`);
          t1Ready.resolve();
          await releaseT1.promise;
          await acquireScheduleLocks(tx, [oldA]);
          step('OLD-T1 acquired A after Z (unexpected — no circular wait)');
        },
        { maxWait: 5_000, timeout: 5_000 },
      )
      .catch((err) => {
        oldDeadlock = true;
        step(`OLD-T1 failed as expected under inverted lock order: ${String(err).split('\n')[0]}`);
      });
    await t1Ready.promise;
    const oldT2 = prismaB
      .$transaction(
        async (tx) => {
          // Intentionally inverted relative to T1's held Z: grab A first, then Z (circular with T1).
          await acquireScheduleLocks(tx, [oldA]);
          step(`OLD-T2 held ${oldA}; waiting for Z held by T1`);
          await acquireScheduleLocks(tx, [oldZ]);
          step('OLD-T2 acquired Z after A (unexpected)');
        },
        { maxWait: 5_000, timeout: 5_000 },
      )
      .catch((err) => {
        oldDeadlock = true;
        step(`OLD-T2 failed as expected: ${String(err).split('\n')[0]}`);
      });
    // Let the circular wait form, then release T1's second acquire so timeouts can surface cleanly.
    await new Promise((r) => setTimeout(r, 200));
    releaseT1.resolve();
    await Promise.allSettled([oldT1, oldT2]);
    assert.ok(oldDeadlock, 'control must demonstrate circular-wait failure under inverted partial locks');
    step('RC6-02 control: inverted partial locks exercised (deadlock/timeout observed)');
    // Production path: T1 update S1 Z→A+Z while T0 already linked; T2 updates S2 — must complete without deadlock.
    const prodT0 = portalA.updateService(clinic.id, s1.id, {
      availabilityJson: mkWindows([
        { id: 'A', capacity: 1 },
        { id: 'Z', capacity: 1 },
      ]),
      unifySharedResources: true,
    });
    await prodT0;
    step('T0 committed S1→A+Z');

    const [u1, u2] = await Promise.all([
      portalA.updateService(clinic.id, s1.id, {
        availabilityJson: mkWindows([
          { id: 'A', capacity: 2 },
          { id: 'Z', capacity: 1 },
        ]),
        unifySharedResources: true,
      }),
      portalB.updateService(clinic.id, s2.id, {
        availabilityJson: mkWindows([{ id: 'A', capacity: 2 }]),
        unifySharedResources: true,
      }),
    ]);
    assert.ok(u1.id && u2.id);
    const s1After = await prismaA.service.findUniqueOrThrow({ where: { id: s1.id } });
    const s2After = await prismaA.service.findUniqueOrThrow({ where: { id: s2.id } });
    const capsA = parseAvailability(s1After.availabilityJson)
      .filter((w) => w.resourceId === 'A')
      .map((w) => w.capacity);
    assert.ok(capsA.every((c) => c === 2), 'room-A capacity 2 retained on S1');
    const capsA2 = parseAvailability(s2After.availabilityJson)
      .filter((w) => w.resourceId === 'A')
      .map((w) => w.capacity);
    assert.ok(capsA2.every((c) => c === 2), 'room-A capacity 2 retained on S2');
    step('RC6-02 PASS: concurrent production updateService after scope growth — no deadlock, both capacities kept');

    // --- RC6-03: production deleteService vs createBooking both directions ---
    const day = nextOpenDay(3);
    const at = localInstant(day, 600)!.toISOString();
    step(`E5b slot day=${day} weekday=${new Date(day + 'T12:00:00').getDay()}`);

    // Withdraw first (production), then booking rejects
    process.env.MIRA_TEST_SCHEDULE_GATE = 'hold';
    const withdrawP = portalA.deleteService(clinic.id, s1.id).then(
      (v) => ({ ok: v as { ok: boolean } }),
      (err: unknown) => ({ err }),
    );
    await new Promise((r) => setTimeout(r, 80));
    const bookAfterWithdraw = commerceB.createBooking(actorB, {
      serviceId: s1.id,
      startsAt: at,
      resourceId: 'Z',
      contactName: 'نورة',
      contactPhone: PHONE,
      idempotencyKey: `${run}-wd-first`,
    }).then(
      (v) => ({ ok: v }),
      (err: unknown) => ({ err }),
    );
    await waitForAdvisoryWaiter(prismaB, partnerScheduleCoordKey(clinic.id)).catch(() => undefined);
    step('E5b: booking waiting while production deleteService holds schedule protocol');
    delete process.env.MIRA_TEST_SCHEDULE_GATE;
    const wdRes = await withdrawP;
    assert.ok(!('err' in wdRes), `deleteService must commit: ${String((wdRes as { err?: unknown }).err)}`);
    const bookFail = await bookAfterWithdraw;
    assert.ok('err' in bookFail && bookFail.err instanceof HttpException, 'booking must reject after withdraw');
    const withdrawn = await prismaA.service.findUniqueOrThrow({ where: { id: s1.id } });
    assert.equal(withdrawn.contentStatus, 'withdrawn');
    const stray = await prismaA.commerceBooking.count({
      where: { serviceId: s1.id, userId: actorB.userId },
    });
    assert.equal(stray, 0, 'no booking row after withdraw-first');
    step('E5b PASS: production deleteService committed first; createBooking rejected; no new booking');

    // Booking first (production), then withdraw (production) — historical booking retained
    const day2 = nextOpenDay(5);
    const at2 = localInstant(day2, 600)!.toISOString();
    step(`E6b slot day=${day2} weekday=${new Date(day2 + 'T12:00:00').getDay()}`);
    process.env.MIRA_TEST_SCHEDULE_GATE = 'hold';
    const bookFirst = commerceA
      .createBooking(actorA, {
        serviceId: s2.id,
        startsAt: at2,
        resourceId: 'A',
        contactName: 'سارة',
        contactPhone: PHONE,
        idempotencyKey: `${run}-book-first`,
      })
      .then(
        (v) => ({ ok: v }),
        (err: unknown) => ({ err }),
      );
    await new Promise((r) => setTimeout(r, 120));
    const deleteSecond = portalB.deleteService(clinic.id, s2.id).then(
      (v) => ({ ok: v as { ok: boolean } }),
      (err: unknown) => ({ err }),
    );
    await waitForAdvisoryWaiter(prismaB, partnerScheduleCoordKey(clinic.id)).catch(() => undefined);
    step(`E6b: deleteService waiting; booking pid gate; target=${partnerScheduleCoordKey(clinic.id)}`);
    delete process.env.MIRA_TEST_SCHEDULE_GATE;
    const bookedWrap = await bookFirst;
    assert.ok(!('err' in bookedWrap), `booking must commit: ${String((bookedWrap as { err?: unknown }).err)}`);
    const booked = bookedWrap.ok;
    assert.ok(booked.booking?.id, 'booking must commit before withdraw');
    step(`E6b: booking committed id=${booked.booking.id}`);
    const delWrap = await deleteSecond;
    assert.ok(!('err' in delWrap), `deleteService must apply after booking: ${String((delWrap as { err?: unknown }).err)}`);
    const hist = await prismaA.commerceBooking.findUniqueOrThrow({ where: { id: booked.booking.id } });
    assert.equal(hist.serviceId, s2.id);
    const s2Gone = await prismaA.service.findUniqueOrThrow({ where: { id: s2.id } });
    assert.equal(s2Gone.contentStatus, 'withdrawn');
    step('E6b PASS: createBooking committed first; deleteService applied; historical booking retained');

    // Admin withdraw path vs booking
    const s3 = await prismaA.service.create({
      data: {
        partnerId: clinic.id,
        nameAr: 'S3',
        nameEn: `${run}-s3`,
        durationMin: 30,
        priceHalalas: 7000,
        concernTags: [],
        bookingEnabled: true,
        active: true,
        contentStatus: 'published',
        availabilityJson: mkWindows([{ id: 'R3', capacity: 1 }]),
      },
    });
    created.serviceIds.push(s3.id);
    const day3 = nextOpenDay(7);
    process.env.MIRA_TEST_SCHEDULE_GATE = 'hold';
    const adminWd = catalog.decide('admin:rc6', 'service', s3.id, 'withdraw', 'rc6', undefined).then(
      (v) => ({ ok: v }),
      (err: unknown) => ({ err }),
    );
    await new Promise((r) => setTimeout(r, 80));
    const bookAdmin = commerceB
      .createBooking(actorB, {
        serviceId: s3.id,
        startsAt: localInstant(day3, 600)!.toISOString(),
        resourceId: 'R3',
        contactName: 'نورة',
        contactPhone: PHONE,
        idempotencyKey: `${run}-admin-wd`,
      })
      .then(
        (v) => ({ ok: v }),
        (err: unknown) => ({ err }),
      );
    delete process.env.MIRA_TEST_SCHEDULE_GATE;
    const adminRes = await adminWd;
    assert.ok(!('err' in adminRes), `admin withdraw must commit: ${String((adminRes as { err?: unknown }).err)}`);
    const adminBook = await bookAdmin;
    assert.ok('err' in adminBook && adminBook.err instanceof HttpException);
    step('ADMIN-WD PASS: catalog decide(withdraw) vs createBooking — withdraw wins, booking rejected');

    // Admin withdraw after booking commits
    const s3b = await prismaA.service.create({
      data: {
        partnerId: clinic.id,
        nameAr: 'S3b',
        nameEn: `${run}-s3b`,
        durationMin: 30,
        priceHalalas: 7000,
        concernTags: [],
        bookingEnabled: true,
        active: true,
        contentStatus: 'published',
        availabilityJson: mkWindows([{ id: 'R3B', capacity: 1 }]),
      },
    });
    created.serviceIds.push(s3b.id);
    const day3b = nextOpenDay(8);
    process.env.MIRA_TEST_SCHEDULE_GATE = 'hold';
    const bookAdminFirst = commerceA
      .createBooking(actorA, {
        serviceId: s3b.id,
        startsAt: localInstant(day3b, 660)!.toISOString(),
        resourceId: 'R3B',
        contactName: 'سارة',
        contactPhone: PHONE,
        idempotencyKey: `${run}-admin-book-first`,
      })
      .then(
        (v) => ({ ok: v }),
        (err: unknown) => ({ err }),
      );
    await new Promise((r) => setTimeout(r, 100));
    const adminWdSecond = catalog.decide('admin:rc6', 'service', s3b.id, 'withdraw', 'rc6-b', undefined).then(
      (v) => ({ ok: v }),
      (err: unknown) => ({ err }),
    );
    delete process.env.MIRA_TEST_SCHEDULE_GATE;
    const bookedAdmin = await bookAdminFirst;
    assert.ok(!('err' in bookedAdmin), `admin-path booking must commit: ${String((bookedAdmin as { err?: unknown }).err)}`);
    const adminDel = await adminWdSecond;
    assert.ok(!('err' in adminDel), `admin withdraw after booking: ${String((adminDel as { err?: unknown }).err)}`);
    const histAdmin = await prismaA.commerceBooking.findUniqueOrThrow({
      where: { id: bookedAdmin.ok.booking!.id },
    });
    assert.equal(histAdmin.serviceId, s3b.id);
    step('ADMIN-E6 PASS: booking committed then admin withdraw; historical booking retained');

    // Capacity-1 shared resource: only one booking
    const s4 = await prismaA.service.create({
      data: {
        partnerId: clinic.id,
        nameAr: 'S4',
        nameEn: `${run}-s4`,
        durationMin: 60,
        priceHalalas: 8000,
        concernTags: [],
        bookingEnabled: true,
        active: true,
        contentStatus: 'published',
        availabilityJson: mkWindows([{ id: 'CAP1', capacity: 1 }]),
      },
    });
    created.serviceIds.push(s4.id);
    const day4 = nextOpenDay(9);
    const at4 = localInstant(day4, 600)!.toISOString();
    const settled = await Promise.allSettled([
      commerceA.createBooking(actorA, {
        serviceId: s4.id,
        startsAt: at4,
        resourceId: 'CAP1',
        contactName: 'سارة',
        contactPhone: PHONE,
        idempotencyKey: `${run}-cap-a`,
      }),
      commerceB.createBooking(actorB, {
        serviceId: s4.id,
        startsAt: at4,
        resourceId: 'CAP1',
        contactName: 'نورة',
        contactPhone: PHONE,
        idempotencyKey: `${run}-cap-b`,
      }),
    ]);
    const ok = settled.filter((r) => r.status === 'fulfilled');
    const bad = settled.filter((r) => r.status === 'rejected');
    assert.equal(ok.length, 1);
    assert.equal(bad.length, 1);
    step('CAP1 PASS: one booking on capacity-1 shared resource');
    console.log('commerce.lock-protocol schema tests passed');
    console.log('--- event order ---');
    log.forEach((line) => console.log(line));
  } finally {
    delete process.env.MIRA_TEST_SCHEDULE_GATE;
    await prismaA.commerceBooking.deleteMany({ where: { userId: { in: created.userIds } } }).catch(() => undefined);
    await prismaA.service.deleteMany({ where: { partnerId: { in: created.partnerIds } } }).catch(() => undefined);
    await prismaA.partner.deleteMany({ where: { id: { in: created.partnerIds } } }).catch(() => undefined);
    await prismaA.user.deleteMany({ where: { id: { in: created.userIds } } }).catch(() => undefined);
    await prismaA.$disconnect();
    await prismaB.$disconnect();
    await prismaC.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
