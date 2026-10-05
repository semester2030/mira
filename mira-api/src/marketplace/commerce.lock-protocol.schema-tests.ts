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

/** Backend PID for an interactive connection (logged for barrier evidence). */
async function backendPid(prisma: PrismaClient): Promise<number> {
  const rows = await prisma.$queryRaw<Array<{ pid: number }>>`SELECT pg_backend_pid()::int AS pid`;
  return Number(rows[0]?.pid);
}

function armScheduleGate() {
  process.env.MIRA_ALLOW_TEST_SCHEDULE_GATE = '1';
  process.env.MIRA_TEST_SCHEDULE_GATE = 'hold';
}

function releaseScheduleGate() {
  delete process.env.MIRA_TEST_SCHEDULE_GATE;
  delete process.env.MIRA_ALLOW_TEST_SCHEDULE_GATE;
}

/** Prisma client forced to one connection so backendPid matches later interactive tx. */
function singleConnClient(baseUrl: string): PrismaClient {
  const join = baseUrl.includes('?') ? '&' : '?';
  return new PrismaClient({ datasources: { db: { url: `${baseUrl}${join}connection_limit=1` } } });
}

/**
 * Wait until the expected session is blocked on hashtext(lockKey) advisory.
 * Uses lock classid/objid from hashtext — not query-text ILIKE, not "any waiter".
 * expectedWaiterPid is required (RC8-03).
 */
async function waitForAdvisoryWaiter(
  observer: PrismaClient,
  lockKey: string,
  opts: { expectedWaiterPid: number; expectedHolderPid?: number; timeoutMs?: number },
) {
  const timeoutMs = opts.timeoutMs ?? 12_000;
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const holders = await observer.$queryRaw<Array<{ pid: number }>>`
      WITH target AS (SELECT hashtext(${lockKey})::int AS k)
      SELECT a.pid::int AS pid
      FROM pg_locks l
      JOIN pg_stat_activity a ON a.pid = l.pid
      CROSS JOIN target t
      WHERE l.locktype = 'advisory'
        AND l.granted
        AND (l.classid = t.k OR l.objid = t.k)
    `;
    if (opts.expectedHolderPid != null) {
      if (!holders.some((h) => h.pid === opts.expectedHolderPid)) {
        await new Promise((r) => setTimeout(r, 40));
        continue;
      }
    }
    const rows = await observer.$queryRaw<Array<{ pid: number; granted: boolean }>>`
      WITH target AS (SELECT hashtext(${lockKey})::int AS k)
      SELECT a.pid::int AS pid, l.granted
      FROM pg_locks l
      JOIN pg_stat_activity a ON a.pid = l.pid
      CROSS JOIN target t
      WHERE l.locktype = 'advisory'
        AND NOT l.granted
        AND (l.classid = t.k OR l.objid = t.k)
    `;
    const hit = rows.find((r) => r.pid === opts.expectedWaiterPid);
    if (hit) {
      step(
        `advisory wait confirmed key=${lockKey} waiters=${rows.map((r) => r.pid).join(',')} expected=${opts.expectedWaiterPid} holders=${holders.map((h) => h.pid).join(',')}`,
      );
      return rows;
    }
    await new Promise((r) => setTimeout(r, 40));
  }
  throw new Error(
    `timed out waiting for advisory lock key=${lockKey} expectedWaiterPid=${opts.expectedWaiterPid}`,
  );
}

async function waitForGrantedHolder(
  observer: PrismaClient,
  lockKey: string,
  opts?: { timeoutMs?: number },
): Promise<number> {
  const timeoutMs = opts?.timeoutMs ?? 12_000;
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const rows = await observer.$queryRaw<Array<{ pid: number }>>`
      WITH target AS (SELECT hashtext(${lockKey})::int AS k)
      SELECT a.pid::int AS pid
      FROM pg_locks l
      JOIN pg_stat_activity a ON a.pid = l.pid
      CROSS JOIN target t
      WHERE l.locktype = 'advisory'
        AND l.granted
        AND (l.classid = t.k OR l.objid = t.k)
      LIMIT 1
    `;
    if (rows[0]?.pid != null) {
      step(`advisory holder confirmed key=${lockKey} holder_pid=${rows[0].pid}`);
      return rows[0].pid;
    }
    await new Promise((r) => setTimeout(r, 40));
  }
  throw new Error(`timed out waiting for granted advisory holder key=${lockKey}`);
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
    const dbUrl = process.env.DATABASE_URL!;

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
        const msg = String(err);
        const isDeadlock = /deadlock detected/i.test(msg);
        const isTxTimeout = /Transaction already closed|timed out|timeout/i.test(msg);
        assert.ok(
          isDeadlock || isTxTimeout,
          `control must fail with deadlock or tx timeout, got: ${msg.split('\n')[0]}`,
        );
        step(
          `OLD-T1 failed as expected (${isDeadlock ? 'deadlock' : 'timeout'}): ${msg.split('\n')[0]}`,
        );
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
        const msg = String(err);
        const isDeadlock = /deadlock detected/i.test(msg);
        const isTxTimeout = /Transaction already closed|timed out|timeout|P2028/i.test(msg);
        assert.ok(
          isDeadlock || isTxTimeout,
          `control must fail with deadlock or tx timeout, got: ${msg.split('\n')[0]}`,
        );
        step(`OLD-T2 failed as expected (${isDeadlock ? 'deadlock' : 'timeout'}): ${msg.split('\n')[0]}`);
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

    // RC8-03: while T-hold expands capacity under schedule protocol, T-wait must wait on coord then re-read.
    const coordKey = partnerScheduleCoordKey(clinic.id);
    const prismaHold = singleConnClient(dbUrl);
    const prismaWait = singleConnClient(dbUrl);
    const portalHold = new PartnersPortalService(prismaHold as unknown as PrismaService, {
      get: () => 'false',
    } as never);
    const portalWait = new PartnersPortalService(prismaWait as unknown as PrismaService, {
      get: () => 'false',
    } as never);
    try {
      const holdPid = await backendPid(prismaHold);
      const waitPid = await backendPid(prismaWait);
      step(`RC8 scope-growth hold_pid=${holdPid} wait_pid=${waitPid}`);
      armScheduleGate();
      const holdP = portalHold.updateService(clinic.id, s1.id, {
        availabilityJson: mkWindows([
          { id: 'A', capacity: 2 },
          { id: 'Z', capacity: 1 },
        ]),
        unifySharedResources: true,
      });
      const holderSeen = await waitForGrantedHolder(prismaC, coordKey);
      assert.equal(holderSeen, holdPid, 'holder must be the single-conn updateService');
      const waitP = portalWait.updateService(clinic.id, s2.id, {
        availabilityJson: mkWindows([{ id: 'A', capacity: 2 }]),
        unifySharedResources: true,
      });
      await waitForAdvisoryWaiter(prismaC, coordKey, {
        expectedWaiterPid: waitPid,
        expectedHolderPid: holdPid,
      });
      step('RC8: waiter blocked on partner schedule coord during scope edit');
      releaseScheduleGate();
      const [u1, u2] = await Promise.all([holdP, waitP]);
      assert.ok(u1.id && u2.id);
    } finally {
      releaseScheduleGate();
      await prismaHold.$disconnect();
      await prismaWait.$disconnect();
    }
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
    step('RC6-02/RC8-03 PASS: concurrent production updateService after scope growth — waiter PID proven, capacities kept');

    // --- RC6-03: production deleteService vs createBooking both directions ---
    const day = nextOpenDay(3);
    const at = localInstant(day, 600)!.toISOString();
    step(`E5b slot day=${day} weekday=${new Date(day + 'T12:00:00').getDay()}`);

    // Withdraw first (production), then booking rejects — prove expected waiter PID
    const pidObserver = await backendPid(prismaC);
    step(`E5b observer pid=${pidObserver}`);
    const prismaBookE5 = singleConnClient(dbUrl);
    const commerceBookE5 = new CommerceService(prismaBookE5 as unknown as PrismaService);
    let wdRes: { ok: { ok: boolean } } | { err: unknown };
    let bookFail: { ok: unknown } | { err: unknown };
    try {
      const bookPidE5 = await backendPid(prismaBookE5);
      armScheduleGate();
      const withdrawP = portalA.deleteService(clinic.id, s1.id).then(
        (v) => ({ ok: v as { ok: boolean } }),
        (err: unknown) => ({ err }),
      );
      const holderE5 = await waitForGrantedHolder(prismaC, partnerScheduleCoordKey(clinic.id));
      const bookAfterWithdraw = commerceBookE5
        .createBooking(actorB, {
          serviceId: s1.id,
          startsAt: at,
          resourceId: 'Z',
          contactName: 'نورة',
          contactPhone: PHONE,
          idempotencyKey: `${run}-wd-first`,
        })
        .then(
          (v) => ({ ok: v }),
          (err: unknown) => ({ err }),
        );
      await waitForAdvisoryWaiter(prismaC, partnerScheduleCoordKey(clinic.id), {
        expectedWaiterPid: bookPidE5,
        expectedHolderPid: holderE5,
      });
      step('E5b: booking waiting while production deleteService holds schedule protocol');
      releaseScheduleGate();
      wdRes = await withdrawP;
      bookFail = await bookAfterWithdraw;
    } finally {
      releaseScheduleGate();
      await prismaBookE5.$disconnect();
    }
    assert.ok(!('err' in wdRes), `deleteService must commit: ${String((wdRes as { err?: unknown }).err)}`);
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
    const prismaBookE6 = singleConnClient(dbUrl);
    const prismaDelE6 = singleConnClient(dbUrl);
    const commerceBookE6 = new CommerceService(prismaBookE6 as unknown as PrismaService);
    const portalDelE6 = new PartnersPortalService(prismaDelE6 as unknown as PrismaService, {
      get: () => 'false',
    } as never);
    let bookedWrap: { ok: any } | { err: unknown };
    let delWrap: { ok: { ok: boolean } } | { err: unknown };
    try {
      const bookPidE6 = await backendPid(prismaBookE6);
      const delPidE6 = await backendPid(prismaDelE6);
      armScheduleGate();
      const bookFirst = commerceBookE6
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
      const holderE6 = await waitForGrantedHolder(prismaC, partnerScheduleCoordKey(clinic.id));
      assert.equal(holderE6, bookPidE6, 'booking must hold schedule coord');
      const deleteSecond = portalDelE6.deleteService(clinic.id, s2.id).then(
        (v) => ({ ok: v as { ok: boolean } }),
        (err: unknown) => ({ err }),
      );
      await waitForAdvisoryWaiter(prismaC, partnerScheduleCoordKey(clinic.id), {
        expectedWaiterPid: delPidE6,
        expectedHolderPid: bookPidE6,
      });
      step(`E6b: deleteService waiting; booking holds gate; target=${partnerScheduleCoordKey(clinic.id)}`);
      releaseScheduleGate();
      bookedWrap = await bookFirst;
      delWrap = await deleteSecond;
    } finally {
      releaseScheduleGate();
      await prismaBookE6.$disconnect();
      await prismaDelE6.$disconnect();
    }
    assert.ok(!('err' in bookedWrap), `booking must commit: ${String((bookedWrap as { err?: unknown }).err)}`);
    const booked = bookedWrap.ok;
    assert.ok(booked.booking?.id, 'booking must commit before withdraw');
    step(`E6b: booking committed id=${booked.booking.id}`);
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
    const prismaBookAd = singleConnClient(dbUrl);
    const commerceBookAd = new CommerceService(prismaBookAd as unknown as PrismaService);
    let adminRes: { ok: unknown } | { err: unknown };
    let adminBook: { ok: unknown } | { err: unknown };
    try {
      const bookPidAd = await backendPid(prismaBookAd);
      armScheduleGate();
      const adminWd = catalog.decide('admin:rc6', 'service', s3.id, 'withdraw', 'rc6', undefined).then(
        (v) => ({ ok: v }),
        (err: unknown) => ({ err }),
      );
      const holderAd = await waitForGrantedHolder(prismaC, partnerScheduleCoordKey(clinic.id));
      const bookAdmin = commerceBookAd
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
      await waitForAdvisoryWaiter(prismaC, partnerScheduleCoordKey(clinic.id), {
        expectedWaiterPid: bookPidAd,
        expectedHolderPid: holderAd,
      });
      step('ADMIN-WD: booking waiting on partner schedule coord while admin withdraw holds gate');
      releaseScheduleGate();
      adminRes = await adminWd;
      adminBook = await bookAdmin;
    } finally {
      releaseScheduleGate();
      await prismaBookAd.$disconnect();
    }
    assert.ok(!('err' in adminRes), `admin withdraw must commit: ${String((adminRes as { err?: unknown }).err)}`);
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
    armScheduleGate();
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
    releaseScheduleGate();
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
    releaseScheduleGate();
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
