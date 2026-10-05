import 'reflect-metadata';
import assert from 'node:assert/strict';
import { HttpException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PartnersPortalService } from '../partners-portal/partners-portal.service';
import { acquireScheduleLocks, bookingResourceLockKey, scheduleLockKeys } from './commerce-schedule-locks';
import { CommerceService, type CommerceActor } from './commerce.service';
import { localInstant, localParts } from './commerce.types';

/**
 * Barrier-ordered concurrency tests on real PostgreSQL (two independent clients).
 * Merchant schedule edits use PartnersPortalService.updateService (production path).
 */

type Customer = CommerceActor & { type: 'customer' };
const run = `cc${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const PHONE = '0501234567';
const log: string[] = [];

function step(msg: string) {
  log.push(`${new Date().toISOString()} ${msg}`);
  console.log('[concurrency]', msg);
}

function defer<T = void>() {
  let resolve!: (v: T | PromiseLike<T>) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** Wait until a session is blocked on the target advisory key (not any random waiter). */
async function waitForAdvisoryWaiter(observer: PrismaClient, lockKey: string, timeoutMs = 10_000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const rows = await observer.$queryRaw<{ n: bigint }[]>`
      WITH target AS (SELECT hashtext(${lockKey})::int AS k)
      SELECT COUNT(*)::bigint AS n
      FROM pg_locks l
      CROSS JOIN target t
      WHERE NOT l.granted
        AND l.locktype = 'advisory'
        AND (l.classid = t.k OR l.objid = t.k)
    `;
    if (Number(rows[0]?.n ?? 0) > 0) return;
    await new Promise((r) => setTimeout(r, 25));
  }
  throw new Error(`timed out waiting for advisory lock key=${lockKey}`);
}

/**
 * Wait until a backend is blocked by holderPid while that holder still owns a
 * products relation lock. Postgres row-lock waiters appear on transactionid,
 * not as ungranted tuple locks on products — so match blocker PID + products hold.
 */
async function waitForProductRowWaiter(
  observer: PrismaClient,
  holderPid: number,
  timeoutMs = 8000,
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const holdsProduct = await observer.$queryRaw<{ n: bigint }[]>`
      SELECT COUNT(*)::bigint AS n
      FROM pg_locks l
      JOIN pg_class c ON c.oid = l.relation
      WHERE l.pid = ${holderPid}
        AND l.granted
        AND c.relname = 'products'
    `;
    if (Number(holdsProduct[0]?.n ?? 0) === 0) {
      await new Promise((r) => setTimeout(r, 25));
      continue;
    }
    const rows = await observer.$queryRaw<{ waiter_pid: number; locktype: string }[]>`
      SELECT blocked.pid::int AS waiter_pid, blocked.locktype::text AS locktype
      FROM pg_locks blocked
      JOIN pg_locks blocking
        ON blocking.locktype = blocked.locktype
       AND blocking.database IS NOT DISTINCT FROM blocked.database
       AND blocking.relation IS NOT DISTINCT FROM blocked.relation
       AND blocking.page IS NOT DISTINCT FROM blocked.page
       AND blocking.tuple IS NOT DISTINCT FROM blocked.tuple
       AND blocking.virtualxid IS NOT DISTINCT FROM blocked.virtualxid
       AND blocking.transactionid IS NOT DISTINCT FROM blocked.transactionid
       AND blocking.classid IS NOT DISTINCT FROM blocked.classid
       AND blocking.objid IS NOT DISTINCT FROM blocked.objid
       AND blocking.objsubid IS NOT DISTINCT FROM blocked.objsubid
       AND blocking.pid IS DISTINCT FROM blocked.pid
      WHERE NOT blocked.granted
        AND blocking.granted
        AND blocking.pid = ${holderPid}
      LIMIT 5
    `;
    if (rows.length > 0) {
      step(
        `product-row contention holder_pid=${holderPid} waiters=${rows
          .map((r) => `${r.waiter_pid}/${r.locktype}`)
          .join(',')}`,
      );
      return;
    }
    await new Promise((r) => setTimeout(r, 25));
  }
  throw new Error(`timed out waiting for blocked lock behind holder_pid=${holderPid} on products`);
}

async function settleFailure(
  settled: Promise<{ status: 'fulfilled' | 'rejected'; reason?: unknown; value?: unknown }>,
  status: number,
  code: string,
) {
  const outcome = await settled;
  if (outcome.status !== 'rejected') assert.fail(`expected ${code}`);
  const error = outcome.reason;
  assert.ok(error instanceof HttpException);
  const body = error.getResponse() as Record<string, unknown>;
  assert.equal(error.getStatus(), status);
  assert.equal(body.code, code);
  return body;
}

function trackPromise(promise: Promise<unknown>) {
  return promise.then(
    (value) => ({ status: 'fulfilled' as const, value }),
    (reason) => ({ status: 'rejected' as const, reason }),
  );
}

async function failure(promise: Promise<unknown>, status: number, code: string) {
  try {
    await promise;
  } catch (error) {
    assert.ok(error instanceof HttpException);
    const body = error.getResponse() as Record<string, unknown>;
    assert.equal(error.getStatus(), status);
    assert.equal(body.code, code);
    return body;
  }
  assert.fail(`expected ${code}`);
}

async function main() {
  const url = process.env.DATABASE_URL ?? '';
  if (!url.includes('localhost') && !url.includes('127.0.0.1')) {
    console.error('REFUSE: DATABASE_URL must be a local test database');
    process.exit(1);
  }

  const prismaA = new PrismaClient();
  const prismaB = new PrismaClient();
  const commerceA = new CommerceService(prismaA as unknown as PrismaService);
  const commerceB = new CommerceService(prismaB as unknown as PrismaService);
  const portalA = new PartnersPortalService(prismaA as unknown as PrismaService, { get: () => 'false' } as never);
  const portalB = new PartnersPortalService(prismaB as unknown as PrismaService, { get: () => 'false' } as never);
  const created = { userIds: [] as string[], partnerIds: [] as string[] };

  try {
    const mkUser = async (name: string, svc: CommerceService): Promise<Customer> => {
      const actor = await svc.customerActor({ firebaseUid: `${run}-${name}`, email: `${name}@cc.local`, name });
      created.userIds.push(actor.userId);
      return actor;
    };
    const partner = await prismaA.partner.create({
      data: { type: 'brand', nameAr: 'تزامن', nameEn: `${run}-brand`, city: 'الرياض', status: 'active' },
    });
    created.partnerIds.push(partner.id);
    const clinic = await prismaA.partner.create({
      data: { type: 'clinic', nameAr: 'عيادة تزامن', nameEn: `${run}-clinic`, city: 'الرياض', status: 'active' },
    });
    created.partnerIds.push(clinic.id);
    const clinic2 = await prismaA.partner.create({
      data: { type: 'clinic', nameAr: 'عيادة مستقلة', nameEn: `${run}-clinic2`, city: 'الرياض', status: 'active' },
    });
    created.partnerIds.push(clinic2.id);

    const alice = await mkUser('alice', commerceA);
    const bob = await mkUser('bob', commerceB);

    step('A: seed product + cart');
    const prod = await prismaA.product.create({
      data: {
        partnerId: partner.id,
        nameAr: 'منتج قفل',
        nameEn: `${run}-lock`,
        priceHalalas: 5000,
        externalUrl: '',
        concernTags: [],
        skinTypes: [],
        purchaseMode: 'internal_cod',
        deliveryFeeHalalas: 1000,
        stockQty: 5,
        active: true,
        contentStatus: 'published',
      },
    });
    await commerceA.addCartItem(alice, { productId: prod.id, quantity: 1 });
    const quote = await commerceA.quote(alice);
    assert.equal(quote.totalHalalas, 6000);

    const aReady = defer<number>();
    const aRelease = defer();
    step('A: holder begins FOR UPDATE');
    const holder = prismaA.$transaction(
      async (tx) => {
        const pidRows = await tx.$queryRaw<{ pid: number }[]>`SELECT pg_backend_pid()::int AS pid`;
        const holderPid = pidRows[0]!.pid;
        await tx.$queryRaw`SELECT id FROM products WHERE id = ${prod.id} FOR UPDATE`;
        step(`A: holder acquired lock pid=${holderPid}`);
        aReady.resolve(holderPid);
        await aRelease.promise;
        await tx.product.update({ where: { id: prod.id }, data: { priceHalalas: 9000 } });
        step('A: holder committed price=9000');
      },
      { maxWait: 20_000, timeout: 20_000 },
    );

    const holderPid = await aReady.promise;
    step('B: createOrder starts (must wait on product lock)');
    const orderWait = trackPromise(
      commerceB.createOrder(alice, {
        idempotencyKey: `${run}-lock-order`,
        contactName: 'سارة',
        contactPhone: PHONE,
        addressLine: 'حي الياسمين، شارع الأمير',
        city: 'الرياض',
        confirmationFingerprint: quote.confirmationFingerprint,
      }),
    );
    try {
      await waitForProductRowWaiter(prismaB, holderPid);
      step('B: observed waiting lock behind products holder');
    } finally {
      aRelease.resolve();
    }
    await holder;
    await settleFailure(orderWait, 409, 'QUOTE_STALE');
    step('A PASS: waiter saw new price via QUOTE_STALE');

    await commerceA.clearCart(alice);
    const flip = await prismaA.product.create({
      data: {
        partnerId: partner.id,
        nameAr: 'قلب خارجي',
        nameEn: `${run}-ext`,
        priceHalalas: 4000,
        externalUrl: 'https://example.test',
        concernTags: [],
        skinTypes: [],
        purchaseMode: 'internal_cod',
        deliveryFeeHalalas: 500,
        stockQty: 3,
        active: true,
        contentStatus: 'published',
      },
    });
    await commerceA.addCartItem(alice, { productId: flip.id, quantity: 1 });
    const q2 = await commerceA.quote(alice);
    const fReady = defer<number>();
    const fRelease = defer();
    const flipHold = prismaA.$transaction(
      async (tx) => {
        const pidRows = await tx.$queryRaw<{ pid: number }[]>`SELECT pg_backend_pid()::int AS pid`;
        const flipPid = pidRows[0]!.pid;
        await tx.$queryRaw`SELECT id FROM products WHERE id = ${flip.id} FOR UPDATE`;
        fReady.resolve(flipPid);
        await fRelease.promise;
        await tx.product.update({ where: { id: flip.id }, data: { purchaseMode: 'external' } });
        step(`B: flipped to external under lock pid=${flipPid}`);
      },
      { maxWait: 20_000, timeout: 20_000 },
    );
    const flipPid = await fReady.promise;
    const flipOrder = trackPromise(
      commerceB.createOrder(alice, {
        idempotencyKey: `${run}-flip`,
        contactName: 'سارة',
        contactPhone: PHONE,
        addressLine: 'حي الياسمين، شارع الأمير',
        city: 'الرياض',
        confirmationFingerprint: q2.confirmationFingerprint,
      }),
    );
    try {
      await waitForProductRowWaiter(prismaB, flipPid);
    } finally {
      fRelease.resolve();
    }
    await flipHold;
    await settleFailure(flipOrder, 422, 'EXTERNAL_PRODUCT_NOT_PURCHASABLE');
    step('B PASS: EXTERNAL under protected verify');

    await commerceA.clearCart(alice);
    const last = await prismaA.product.create({
      data: {
        partnerId: partner.id,
        nameAr: 'آخر وحدة',
        nameEn: `${run}-last`,
        priceHalalas: 3000,
        externalUrl: '',
        concernTags: [],
        skinTypes: [],
        purchaseMode: 'internal_cod',
        deliveryFeeHalalas: 0,
        stockQty: 1,
        active: true,
        contentStatus: 'published',
      },
    });
    await commerceA.addCartItem(alice, { productId: last.id, quantity: 1 });
    await commerceB.addCartItem(bob, { productId: last.id, quantity: 1 });
    const qa = await commerceA.quote(alice);
    const qb = await commerceB.quote(bob);
    const race = await Promise.allSettled([
      commerceA.createOrder(alice, {
        idempotencyKey: `${run}-last-a`,
        contactName: 'سارة',
        contactPhone: PHONE,
        addressLine: 'حي الياسمين، شارع الأمير',
        city: 'الرياض',
        confirmationFingerprint: qa.confirmationFingerprint,
      }),
      commerceB.createOrder(bob, {
        idempotencyKey: `${run}-last-b`,
        contactName: 'نورة',
        contactPhone: PHONE,
        addressLine: 'حي الياسمين، شارع الأمير',
        city: 'الرياض',
        confirmationFingerprint: qb.confirmationFingerprint,
      }),
    ]);
    assert.equal(race.filter((r) => r.status === 'fulfilled').length, 1);
    assert.equal(race.filter((r) => r.status === 'rejected').length, 1);
    step('D PASS: single winner on last unit');

    const windows = [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
      weekday,
      startMin: 600,
      endMin: 720,
      capacity: 1,
      resourceId: 'غرفة-مشتركة',
    }));
    const s1 = await prismaA.service.create({
      data: {
        partnerId: clinic.id,
        nameAr: 'خدمة1',
        nameEn: `${run}-s1`,
        durationMin: 60,
        priceHalalas: 10000,
        concernTags: [],
        bookingEnabled: true,
        active: true,
        contentStatus: 'published',
        availabilityJson: windows,
      },
    });
    const s2 = await prismaA.service.create({
      data: {
        partnerId: clinic.id,
        nameAr: 'خدمة2',
        nameEn: `${run}-s2`,
        durationMin: 60,
        priceHalalas: 11000,
        concernTags: [],
        bookingEnabled: true,
        active: true,
        contentStatus: 'published',
        availabilityJson: windows,
      },
    });
    const day = localParts(new Date(Date.now() + 10 * 86_400_000)).dateKey;
    const at = localInstant(day, 600)!.toISOString();
    const bookRace = await Promise.allSettled([
      commerceA.createBooking(alice, {
        serviceId: s1.id,
        startsAt: at,
        resourceId: 'غرفة-مشتركة',
        contactName: 'سارة',
        contactPhone: PHONE,
        idempotencyKey: `${run}-bk-a`,
      }),
      commerceB.createBooking(bob, {
        serviceId: s2.id,
        startsAt: at,
        resourceId: 'غرفة-مشتركة',
        contactName: 'نورة',
        contactPhone: PHONE,
        idempotencyKey: `${run}-bk-b`,
      }),
    ]);
    assert.equal(bookRace.filter((r) => r.status === 'fulfilled').length, 1);
    step('F PASS: one booking on shared Arabic resource capacity');

    const svc = await prismaA.service.create({
      data: {
        partnerId: clinic.id,
        nameAr: 'تعطيل',
        nameEn: `${run}-dis`,
        durationMin: 60,
        priceHalalas: 9000,
        concernTags: [],
        bookingEnabled: true,
        active: true,
        contentStatus: 'published',
        availabilityJson: windows.map((w) => ({ ...w, resourceId: 'غرفة-تعطيل' })),
      },
    });
    const day2 = localParts(new Date(Date.now() + 11 * 86_400_000)).dateKey;
    const at2 = localInstant(day2, 600)!.toISOString();
    const lockKeys = scheduleLockKeys({
      partnerId: clinic.id,
      serviceIds: [svc.id],
      resourceIds: ['غرفة-تعطيل'],
    });
    const targetKey = bookingResourceLockKey(clinic.id, 'غرفة-تعطيل');

    // E1: merchant-equivalent schedule locks held; booking waits; disable under same tx; booking rejects
    const eReady = defer();
    const eRelease = defer();
    const disableHold = prismaA.$transaction(
      async (tx) => {
        await acquireScheduleLocks(tx, lockKeys);
        step(`E1: schedule locks held ${lockKeys.join(' | ')}`);
        eReady.resolve();
        await eRelease.promise;
        await tx.service.update({ where: { id: svc.id }, data: { bookingEnabled: false } });
        step('E1: bookingEnabled=false under held schedule locks');
      },
      { maxWait: 25_000, timeout: 25_000 },
    );
    await eReady.promise;
    const bookAfter = commerceB.createBooking(bob, {
      serviceId: svc.id,
      startsAt: at2,
      resourceId: 'غرفة-تعطيل',
      contactName: 'نورة',
      contactPhone: PHONE,
      idempotencyKey: `${run}-dis-b`,
    });
    await waitForAdvisoryWaiter(prismaB, targetKey);
    step('E1: createBooking waiting on partner-scoped resource advisory');
    eRelease.resolve();
    await disableHold;
    await failure(bookAfter, 422, 'BOOKING_NOT_ENABLED');
    step('E1 PASS: booking waited then rejected after disable under shared keys');

    // E2: prove production updateService waits on the same resource advisory
    await prismaA.service.update({ where: { id: svc.id }, data: { bookingEnabled: true } });
    const e2Ready = defer();
    const e2Release = defer();
    const holdForMerchant = prismaA.$transaction(
      async (tx) => {
        await acquireScheduleLocks(tx, lockKeys);
        step('E2: locks held before updateService');
        e2Ready.resolve();
        await e2Release.promise;
      },
      { maxWait: 25_000, timeout: 25_000 },
    );
    await e2Ready.promise;
    const merchantWait = portalB.updateService(clinic.id, svc.id, {
      availabilityJson: windows.map((w) => ({ ...w, resourceId: 'غرفة-تعطيل', capacity: 2 })),
    });
    await waitForAdvisoryWaiter(prismaB, targetKey);
    step('E2: production updateService waiting on same resource advisory');
    e2Release.resolve();
    await holdForMerchant;
    await merchantWait;
    const afterCap = await prismaA.service.findUniqueOrThrow({ where: { id: svc.id } });
    const caps = (afterCap.availabilityJson as Array<{ capacity: number }>).map((w) => w.capacity);
    assert.ok(caps.every((c) => c === 2));
    step('E2 PASS: updateService shared schedule lock protocol');

    // E3: booking holds first; capacity/schedule update waits; both finish consistently
    const day3 = localParts(new Date(Date.now() + 12 * 86_400_000)).dateKey;
    const at3 = localInstant(day3, 600)!.toISOString();
    const e3Ready = defer();
    const e3Release = defer();
    const bookingSide = prismaA.$transaction(
      async (tx) => {
        await acquireScheduleLocks(tx, lockKeys);
        step('E3: booking-side locks held');
        e3Ready.resolve();
        await e3Release.promise;
      },
      { maxWait: 25_000, timeout: 25_000 },
    );
    await e3Ready.promise;
    const capacityWait = portalB.updateService(clinic.id, svc.id, {
      availabilityJson: windows.map((w) => ({ ...w, resourceId: 'غرفة-تعطيل', capacity: 3 })),
      durationMin: 45,
    });
    await waitForAdvisoryWaiter(prismaB, targetKey);
    step('E3: capacity/duration update waiting');
    e3Release.resolve();
    await bookingSide;
    await capacityWait;
    const afterDur = await prismaA.service.findUniqueOrThrow({ where: { id: svc.id } });
    assert.equal(afterDur.durationMin, 45);
    step('E3 PASS: schedule/capacity update synchronized with booking locks');

    // E4: production concurrent updateService(disable) vs createBooking
    await prismaA.service.update({
      where: { id: svc.id },
      data: { bookingEnabled: true, durationMin: 60 },
    });
    const day4 = localParts(new Date(Date.now() + 13 * 86_400_000)).dateKey;
    const at4 = localInstant(day4, 630)!.toISOString();
    const settled = await Promise.allSettled([
      portalA.updateService(clinic.id, svc.id, { bookingEnabled: false }),
      commerceB.createBooking(bob, {
        serviceId: svc.id,
        startsAt: at4,
        resourceId: 'غرفة-تعطيل',
        contactName: 'نورة',
        contactPhone: PHONE,
        idempotencyKey: `${run}-dis-prod`,
      }),
    ]);
    assert.equal(settled[0]!.status, 'fulfilled');
    const row = await prismaA.service.findUniqueOrThrow({ where: { id: svc.id } });
    assert.equal(row.bookingEnabled, false);
    if (settled[1]!.status === 'rejected') {
      const err = (settled[1] as PromiseRejectedResult).reason;
      assert.ok(err instanceof HttpException);
      assert.equal(err.getStatus(), 422);
      step('E4 PASS: production updateService won; booking rejected');
    } else {
      step('E4 PASS: booking completed before disable; service now disabled (consistent)');
    }

    // E5: deleteService (withdraw) first under shared protocol — later booking rejects
    await prismaA.service.update({
      where: { id: svc.id },
      data: { bookingEnabled: true, active: true, contentStatus: 'published' },
    });
    const dayW = localParts(new Date(Date.now() + 13.5 * 86_400_000)).dateKey;
    const atW = localInstant(dayW, 600)!.toISOString();
    const wReady = defer();
    const wRelease = defer();
    const withdrawHold = prismaA.$transaction(
      async (tx) => {
        await acquireScheduleLocks(tx, lockKeys);
        step('E5: withdraw-equivalent locks held');
        wReady.resolve();
        await wRelease.promise;
        await tx.service.update({
          where: { id: svc.id },
          data: { active: false, contentStatus: 'withdrawn' },
        });
        step('E5: withdrawn under held locks');
      },
      { maxWait: 25_000, timeout: 25_000 },
    );
    await wReady.promise;
    const bookWithdraw = commerceB.createBooking(bob, {
      serviceId: svc.id,
      startsAt: atW,
      resourceId: 'غرفة-تعطيل',
      contactName: 'نورة',
      contactPhone: PHONE,
      idempotencyKey: `${run}-wd-b`,
    });
    await waitForAdvisoryWaiter(prismaB, targetKey);
    step('E5: createBooking waiting during withdraw barrier');
    wRelease.resolve();
    await withdrawHold;
    await failure(bookWithdraw, 404, 'SERVICE_NOT_FOUND');
    step('E5 PASS: withdraw committed first; booking rejected');

    // E6: booking holds first; production deleteService waits then applies
    const svc2 = await prismaA.service.create({
      data: {
        partnerId: clinic.id,
        nameAr: 'سحب2',
        nameEn: `${run}-wd2`,
        durationMin: 60,
        priceHalalas: 9000,
        concernTags: [],
        bookingEnabled: true,
        active: true,
        contentStatus: 'published',
        availabilityJson: windows.map((w) => ({ ...w, resourceId: 'غرفة-سحب' })),
      },
    });
    const wdKeys = scheduleLockKeys({
      partnerId: clinic.id,
      serviceIds: [svc2.id],
      resourceIds: ['غرفة-سحب'],
    });
    const wdTarget = bookingResourceLockKey(clinic.id, 'غرفة-سحب');
    const w2Ready = defer();
    const w2Release = defer();
    const bookHold = prismaA.$transaction(
      async (tx) => {
        await acquireScheduleLocks(tx, wdKeys);
        step('E6: booking-side locks held before deleteService');
        w2Ready.resolve();
        await w2Release.promise;
      },
      { maxWait: 25_000, timeout: 25_000 },
    );
    await w2Ready.promise;
    const deleteWait = portalB.deleteService(clinic.id, svc2.id);
    await waitForAdvisoryWaiter(prismaB, wdTarget);
    step('E6: production deleteService waiting');
    w2Release.resolve();
    await bookHold;
    await deleteWait;
    const gone = await prismaA.service.findUniqueOrThrow({ where: { id: svc2.id } });
    assert.equal(gone.contentStatus, 'withdrawn');
    assert.equal(gone.active, false);
    step('E6 PASS: deleteService shared schedule lock protocol');

    // Snapshot price: portal price edit must not rewrite historical booking
    const snap = await commerceA.createBooking(alice, {
      serviceId: s1.id,
      startsAt: localInstant(localParts(new Date(Date.now() + 14 * 86_400_000)).dateKey, 600)!.toISOString(),
      resourceId: 'غرفة-مشتركة',
      contactName: 'سارة',
      contactPhone: PHONE,
      idempotencyKey: `${run}-snap`,
    });
    const snapPrice = snap.booking.priceHalalas;
    await portalA.updateService(clinic.id, s1.id, { priceHalalas: 99999 });
    const again = await commerceA.getBooking(
      { type: 'customer', id: alice.id, userId: alice.userId },
      snap.booking.id,
    );
    assert.equal(again.priceHalalas, snapPrice);
    step('H PASS: historical booking snapshot retained after portal price edit');

    // Independent partners same resource name — both succeed (no name-only shared lock)
    const otherSvc = await prismaA.service.create({
      data: {
        partnerId: clinic2.id,
        nameAr: 'خدمة جهة أخرى',
        nameEn: `${run}-other`,
        durationMin: 60,
        priceHalalas: 8000,
        concernTags: [],
        bookingEnabled: true,
        active: true,
        contentStatus: 'published',
        availabilityJson: windows.map((w) => ({ ...w, resourceId: 'غرفة-مشتركة' })),
      },
    });
    const day5 = localParts(new Date(Date.now() + 15 * 86_400_000)).dateKey;
    const at5 = localInstant(day5, 600)!.toISOString();
    const [isoA, isoB] = await Promise.all([
      commerceA.createBooking(alice, {
        serviceId: s2.id,
        startsAt: at5,
        resourceId: 'غرفة-مشتركة',
        contactName: 'سارة',
        contactPhone: PHONE,
        idempotencyKey: `${run}-iso-a`,
      }),
      commerceB.createBooking(bob, {
        serviceId: otherSvc.id,
        startsAt: at5,
        resourceId: 'غرفة-مشتركة',
        contactName: 'نورة',
        contactPhone: PHONE,
        idempotencyKey: `${run}-iso-b`,
      }),
    ]);
    assert.ok(isoA.booking.id);
    assert.ok(isoB.booking.id);
    assert.notEqual(isoA.booking.id, isoB.booking.id);
    step('I PASS: two partners same resource name book independently');

    // Unused at3 kept for slot uniqueness documentation
    void at3;

    console.log('commerce.concurrency schema tests passed');
    console.log('--- event order ---');
    log.forEach((line) => console.log(line));
  } finally {
    await prismaA.commerceBooking.deleteMany({ where: { userId: { in: created.userIds } } }).catch(() => undefined);
    await prismaA.commerceOrderItem.deleteMany({ where: { order: { userId: { in: created.userIds } } } }).catch(() => undefined);
    await prismaA.commerceOrder.deleteMany({ where: { userId: { in: created.userIds } } }).catch(() => undefined);
    await prismaA.commerceCartItem.deleteMany({ where: { cart: { userId: { in: created.userIds } } } }).catch(() => undefined);
    await prismaA.commerceCart.deleteMany({ where: { userId: { in: created.userIds } } }).catch(() => undefined);
    await prismaA.product.deleteMany({ where: { partnerId: { in: created.partnerIds } } }).catch(() => undefined);
    await prismaA.service.deleteMany({ where: { partnerId: { in: created.partnerIds } } }).catch(() => undefined);
    await prismaA.partner.deleteMany({ where: { id: { in: created.partnerIds } } }).catch(() => undefined);
    await prismaA.user.deleteMany({ where: { id: { in: created.userIds } } }).catch(() => undefined);
    await prismaA.$disconnect();
    await prismaB.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
