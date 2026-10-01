import 'reflect-metadata';
import assert from 'node:assert/strict';
import { HttpException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CommerceService, type CommerceActor } from './commerce.service';
import { localInstant, localParts } from './commerce.types';

/**
 * Barrier-ordered concurrency tests on real PostgreSQL (two independent clients).
 * Not sleep-based races: holder locks first, waiter is observed waiting via pg_locks, then release.
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

async function waitForWaitingLock(observer: PrismaClient, timeoutMs = 8000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const rows = await observer.$queryRaw<{ n: bigint }[]>`
      SELECT COUNT(*)::bigint AS n
      FROM pg_locks
      WHERE NOT granted AND locktype IN ('transactionid', 'relation', 'tuple', 'advisory')
    `;
    if (Number(rows[0]?.n ?? 0) > 0) return;
    await new Promise((r) => setTimeout(r, 20));
  }
  throw new Error('timed out waiting for a blocked lock (pg_locks)');
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

    const alice = await mkUser('alice', commerceA);
    const bob = await mkUser('bob', commerceB);

    // -------------------------------------------------------------------------
    // أ. تعديل المنتج يحتفظ بالقفل؛ الطلب ينتظر ثم يرى السعر الجديد → QUOTE_STALE
    // -------------------------------------------------------------------------
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

    const aReady = defer();
    const aRelease = defer();
    step('A: holder begins FOR UPDATE');
    const holder = prismaA.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM products WHERE id = ${prod.id} FOR UPDATE`;
        step('A: holder acquired lock');
        aReady.resolve();
        await aRelease.promise;
        await tx.product.update({ where: { id: prod.id }, data: { priceHalalas: 9000 } });
        step('A: holder committed price=9000');
      },
      { maxWait: 20_000, timeout: 20_000 },
    );

    await aReady.promise;
    step('B: createOrder starts (must wait on product lock)');
    const orderWait = commerceB.createOrder(alice, {
      idempotencyKey: `${run}-lock-order`,
      contactName: 'سارة',
      contactPhone: PHONE,
      addressLine: 'حي الياسمين، شارع الأمير',
      city: 'الرياض',
      confirmationFingerprint: quote.confirmationFingerprint,
    });
    await waitForWaitingLock(prismaB);
    step('B: observed waiting lock in pg_locks');
    aRelease.resolve();
    await holder;
    await failure(orderWait, 409, 'QUOTE_STALE');
    step('A PASS: waiter saw new price via QUOTE_STALE');

    // -------------------------------------------------------------------------
    // ب. تحول لخارجي تحت القفل يمنع COD
    // -------------------------------------------------------------------------
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
    const fReady = defer();
    const fRelease = defer();
    const flipHold = prismaA.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM products WHERE id = ${flip.id} FOR UPDATE`;
        fReady.resolve();
        await fRelease.promise;
        await tx.product.update({ where: { id: flip.id }, data: { purchaseMode: 'external' } });
        step('B: flipped to external under lock');
      },
      { maxWait: 20_000, timeout: 20_000 },
    );
    await fReady.promise;
    const flipOrder = commerceB.createOrder(alice, {
      idempotencyKey: `${run}-flip`,
      contactName: 'سارة',
      contactPhone: PHONE,
      addressLine: 'حي الياسمين، شارع الأمير',
      city: 'الرياض',
      confirmationFingerprint: q2.confirmationFingerprint,
    });
    await waitForWaitingLock(prismaB);
    fRelease.resolve();
    await flipHold;
    await failure(flipOrder, 422, 'EXTERNAL_PRODUCT_NOT_PURCHASABLE');
    step('B PASS: EXTERNAL under protected verify');

    // -------------------------------------------------------------------------
    // د. آخر وحدة تحت محاولتين متزامنتين — فائز واحد
    // -------------------------------------------------------------------------
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

    // -------------------------------------------------------------------------
    // و. خدمتان على آخر سعة مورد مشترك
    // -------------------------------------------------------------------------
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

    // -------------------------------------------------------------------------
    // هـ. تعطيل الحجز أثناء انتظار القفل الاستشاري
    // -------------------------------------------------------------------------
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
    const lockKey = 'commerce-booking-resource:غرفة-تعطيل';
    const dReady = defer();
    const dRelease = defer();
    const disableHold = prismaA.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;
        step('E: advisory lock held');
        dReady.resolve();
        await dRelease.promise;
        await tx.service.update({ where: { id: svc.id }, data: { bookingEnabled: false } });
        step('E: booking disabled');
      },
      { maxWait: 20_000, timeout: 20_000 },
    );
    await dReady.promise;
    const bookAfter = commerceB.createBooking(bob, {
      serviceId: svc.id,
      startsAt: at2,
      resourceId: 'غرفة-تعطيل',
      contactName: 'نورة',
      contactPhone: PHONE,
      idempotencyKey: `${run}-dis-b`,
    });
    await waitForWaitingLock(prismaB);
    dRelease.resolve();
    await disableHold;
    await failure(bookAfter, 422, 'BOOKING_NOT_ENABLED');
    step('E PASS: disable under same advisory protection');

    // Snapshot: completed booking keeps historical price after later service price change.
    const snap = await commerceA.createBooking(alice, {
      serviceId: s1.id,
      startsAt: localInstant(localParts(new Date(Date.now() + 12 * 86_400_000)).dateKey, 600)!.toISOString(),
      resourceId: 'غرفة-مشتركة',
      contactName: 'سارة',
      contactPhone: PHONE,
      idempotencyKey: `${run}-snap`,
    });
    const snapPrice = snap.booking.priceHalalas;
    await prismaA.service.update({ where: { id: s1.id }, data: { priceHalalas: 99999 } });
    const again = await commerceA.getBooking(
      { type: 'customer', id: alice.id, userId: alice.userId },
      snap.booking.id,
    );
    assert.equal(again.priceHalalas, snapPrice);
    step('H PASS: historical booking snapshot retained');

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

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
