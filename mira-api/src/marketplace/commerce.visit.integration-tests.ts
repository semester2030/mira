/**
 * RC4: atomic consecutive visit on real local Postgres.
 * Idempotent replay, all-or-nothing rollback, concurrent last-slot race.
 */
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { HttpException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CommerceService } from './commerce.service';
import { localInstant, localParts } from './commerce.types';

const run = `vis${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const PHONE = '0501234567';

async function failure(promise: Promise<unknown>, status: number, code: string) {
  try {
    await promise;
  } catch (error) {
    assert.ok(error instanceof HttpException, String(error));
    const body = error.getResponse() as Record<string, unknown>;
    assert.equal(error.getStatus(), status, JSON.stringify(body));
    assert.equal(body.code, code, JSON.stringify(body));
    return body;
  }
  assert.fail(`expected ${code}`);
}

/** dateKey for a Riyadh weekday (0=Sun … 6=Sat), several days ahead. */
function nextWeekday(targetWeekday: number, minDaysAhead = 5): string {
  for (let i = minDaysAhead; i < minDaysAhead + 14; i += 1) {
    const key = localParts(new Date(Date.now() + i * 86_400_000)).dateKey;
    if (localParts(localInstant(key, 12 * 60)!).weekday === targetWeekday) return key;
  }
  throw new Error(`no weekday ${targetWeekday}`);
}

async function main() {
  const url = process.env.DATABASE_URL ?? '';
  if (!url.includes('localhost') && !url.includes('127.0.0.1')) {
    console.error('REFUSE: DATABASE_URL must be a local test database');
    process.exit(1);
  }

  const prisma = new PrismaClient();
  const commerce = new CommerceService(prisma as unknown as PrismaService);
  const partnerIds: string[] = [];
  const userIds: string[] = [];
  const visitIds: string[] = [];
  const bookingIds: string[] = [];

  try {
    const actor = await commerce.customerActor({
      firebaseUid: `${run}-cust`,
      email: `${run}@test.local`,
      name: 'عميلة اختبار',
    });
    userIds.push(actor.userId);

    const partner = await prisma.partner.create({
      data: {
        type: 'salon',
        nameAr: 'مركز عناية BC اختبار',
        nameEn: `${run}-bc`,
        city: 'الرياض',
        status: 'active',
      },
    });
    partnerIds.push(partner.id);

    const branch = await prisma.partnerBranch.create({
      data: {
        partnerId: partner.id,
        nameAr: 'فرع العليا',
        cityId: 'riyadh',
        cityNameAr: 'الرياض',
        lat: 24.7136,
        lng: 46.6753,
        active: true,
      },
    });

    // Sunday=0 … Saturday=6 (Asia/Riyadh), Tue–Thu windows with capacity 1.
    const windows = [2, 3, 4].map((weekday) => ({
      weekday,
      startMin: 9 * 60,
      endMin: 18 * 60,
      capacity: 1,
      resourceId: 'غرفة-1',
    }));
    const cleanse = await prisma.service.create({
      data: {
        partnerId: partner.id,
        branchId: branch.id,
        nameAr: 'تنظيف تجميلي سطحي',
        nameEn: `${run}-s042`,
        durationMin: 45,
        priceHalalas: 15000,
        concernTags: [],
        bookingEnabled: true,
        active: true,
        contentStatus: 'published',
        catalogSource: 'catalog',
        payMode: 'pay_at_venue',
        placeMode: 'branch',
        availabilityJson: windows,
      },
    });
    const hydrate = await prisma.service.create({
      data: {
        partnerId: partner.id,
        branchId: branch.id,
        nameAr: 'ترطيب',
        nameEn: `${run}-s043`,
        durationMin: 30,
        priceHalalas: 12000,
        concernTags: [],
        bookingEnabled: true,
        active: true,
        contentStatus: 'published',
        catalogSource: 'catalog',
        payMode: 'pay_at_venue',
        placeMode: 'branch',
        availabilityJson: windows,
      },
    });

    const DATE = nextWeekday(2); // Tuesday
    const listA = await commerce.serviceAvailability(cleanse.id, DATE);
    const listB = await commerce.serviceAvailability(hydrate.id, DATE);
    let slotA: (typeof listA.slots)[number] | undefined;
    let slotB: (typeof listB.slots)[number] | undefined;
    for (const a of listA.slots.filter((s) => s.available)) {
      const expectedPeer = new Date(new Date(a.endsAt).getTime());
      const b = listB.slots.find(
        (s) =>
          s.available &&
          s.resourceId === a.resourceId &&
          Math.abs(new Date(s.startsAt).getTime() - expectedPeer.getTime()) <= 60_000,
      );
      if (b) {
        slotA = a;
        slotB = b;
        break;
      }
    }
    assert.ok(slotA && slotB, `no consecutive pair on ${DATE} (A=${listA.slots.length} B=${listB.slots.length})`);
    const startA = new Date(slotA.startsAt);
    const startB = new Date(slotB.startsAt);
    const resourceId = slotA.resourceId || 'غرفة-1';
    const body = {
      idempotencyKey: `${run}-visit-1`,
      branchId: branch.id,
      contactName: 'نورة',
      contactPhone: PHONE,
      items: [
        { serviceId: cleanse.id, startsAt: startA.toISOString(), resourceId },
        { serviceId: hydrate.id, startsAt: startB.toISOString(), resourceId },
      ],
    };

    const beforeVisits = await prisma.commerceVisit.count({ where: { partnerId: partner.id } });
    const beforeBookings = await prisma.commerceBooking.count({ where: { partnerId: partner.id } });

    const created = await commerce.createConsecutiveVisit(actor, body);
    assert.equal(created.idempotentReplay, false);
    assert.equal(created.visit.status, 'requested');
    assert.match(created.visit.statusLabelAr, /بانتظار رد المركز/);
    assert.equal(created.visit.bookings.length, 2);
    assert.equal(created.visit.bookings[0].status, 'requested');
    assert.equal(created.visit.bookings[1].status, 'requested');
    assert.equal(created.visit.branchId, branch.id);
    visitIds.push(created.visit.id);
    bookingIds.push(...created.visit.bookings.map((b: { id: string }) => b.id));

    const afterCreateVisits = await prisma.commerceVisit.count({ where: { partnerId: partner.id } });
    const afterCreateBookings = await prisma.commerceBooking.count({ where: { partnerId: partner.id } });
    assert.equal(afterCreateVisits - beforeVisits, 1);
    assert.equal(afterCreateBookings - beforeBookings, 2);

    // Idempotent replay — same key + fingerprint → same visit ids, no new rows.
    const replay = await commerce.createConsecutiveVisit(actor, body);
    assert.equal(replay.idempotentReplay, true);
    assert.equal(replay.visit.id, created.visit.id);
    assert.deepEqual(
      replay.visit.bookings.map((b: { id: string }) => b.id).sort(),
      created.visit.bookings.map((b: { id: string }) => b.id).sort(),
    );
    const afterReplayVisits = await prisma.commerceVisit.count({ where: { partnerId: partner.id } });
    const afterReplayBookings = await prisma.commerceBooking.count({ where: { partnerId: partner.id } });
    assert.equal(afterReplayVisits, afterCreateVisits);
    assert.equal(afterReplayBookings, afterCreateBookings);

    // Lost-response recovery by key (account-scoped).
    const byKey = await commerce.getCustomerVisitByKey(actor, body.idempotencyKey);
    assert.equal(byKey.visit.id, created.visit.id);

    // Concurrent same-key taps — both recover the same visit, never SLOT_FULL for this request.
    const sameKey = await Promise.all([
      commerce.createConsecutiveVisit(actor, body),
      commerce.createConsecutiveVisit(actor, body),
    ]);
    assert.equal(sameKey[0].visit.id, created.visit.id);
    assert.equal(sameKey[1].visit.id, created.visit.id);
    assert.equal(await prisma.commerceVisit.count({ where: { partnerId: partner.id } }), afterReplayVisits);

    // Fingerprint change with same key → conflict (do not reuse key for changed items).
    await failure(
      commerce.createConsecutiveVisit(actor, {
        ...body,
        items: [
          { serviceId: cleanse.id, startsAt: new Date(startA.getTime() + 3600_000).toISOString(), resourceId },
          {
            serviceId: hydrate.id,
            startsAt: new Date(startB.getTime() + 3600_000).toISOString(),
            resourceId,
          },
        ],
      }),
      409,
      'IDEMPOTENCY_CONFLICT',
    );

    // Second service unavailable mid-request (booking disabled) → zero new rows.
    await prisma.service.update({ where: { id: hydrate.id }, data: { bookingEnabled: false } });
    const disabledKey = `${run}-visit-disabled`;
    const beforeFail = {
      visits: await prisma.commerceVisit.count({ where: { partnerId: partner.id } }),
      bookings: await prisma.commerceBooking.count({ where: { partnerId: partner.id } }),
    };
    // Same times/fingerprint shape but hydrate booking disabled → reject before writes.
    await failure(
      commerce.createConsecutiveVisit(actor, {
        ...body,
        idempotencyKey: disabledKey,
      }),
      422,
      'BOOKING_NOT_ENABLED',
    );
    assert.equal(await prisma.commerceVisit.count({ where: { partnerId: partner.id } }), beforeFail.visits);
    assert.equal(await prisma.commerceBooking.count({ where: { partnerId: partner.id } }), beforeFail.bookings);
    await prisma.service.update({ where: { id: hydrate.id }, data: { bookingEnabled: true } });

    // Mid-TX failure after first booking row (test hook only) → zero persisted visit/bookings/events.
    // Use a different weekday so capacity is free (before the race consumes Tuesday slots).
    const MID_DATE = nextWeekday(3); // Wednesday
    const midListA = await commerce.serviceAvailability(cleanse.id, MID_DATE);
    const midListB = await commerce.serviceAvailability(hydrate.id, MID_DATE);
    let midA: (typeof midListA.slots)[number] | undefined;
    let midBSlot: (typeof midListB.slots)[number] | undefined;
    for (const a of midListA.slots.filter((s) => s.available)) {
      const b = midListB.slots.find(
        (s) =>
          s.available &&
          s.resourceId === a.resourceId &&
          Math.abs(new Date(s.startsAt).getTime() - new Date(a.endsAt).getTime()) <= 60_000,
      );
      if (b) {
        midA = a;
        midBSlot = b;
        break;
      }
    }
    assert.ok(midA && midBSlot, `mid-TX consecutive pair on ${MID_DATE}`);
    const beforeMid = {
      visits: await prisma.commerceVisit.count({ where: { partnerId: partner.id } }),
      bookings: await prisma.commerceBooking.count({ where: { partnerId: partner.id } }),
      events: await prisma.commerceBookingEvent.count({
        where: { booking: { partnerId: partner.id } },
      }),
    };
    process.env.NODE_ENV = 'test';
    process.env.MIRA_TEST_VISIT_FAIL_AFTER_ITEM = '1';
    try {
      await assert.rejects(
        () =>
          commerce.createConsecutiveVisit(actor, {
            idempotencyKey: `${run}-mid-tx`,
            branchId: branch.id,
            contactName: 'نورة',
            contactPhone: PHONE,
            items: [
              { serviceId: cleanse.id, startsAt: midA.startsAt, resourceId: midA.resourceId || resourceId },
              {
                serviceId: hydrate.id,
                startsAt: midBSlot.startsAt,
                resourceId: midBSlot.resourceId || resourceId,
              },
            ],
          }),
        (e: { code?: string; message?: string }) =>
          e?.code === 'MIRA_TEST_VISIT_FAIL_AFTER_ITEM' || /MIRA_TEST_VISIT_FAIL_AFTER_ITEM/.test(String(e?.message)),
      );
    } finally {
      delete process.env.MIRA_TEST_VISIT_FAIL_AFTER_ITEM;
    }
    assert.equal(await prisma.commerceVisit.count({ where: { partnerId: partner.id } }), beforeMid.visits);
    assert.equal(await prisma.commerceBooking.count({ where: { partnerId: partner.id } }), beforeMid.bookings);
    assert.equal(
      await prisma.commerceBookingEvent.count({ where: { booking: { partnerId: partner.id } } }),
      beforeMid.events,
    );
    const midTxOk = true;

    // Concurrent last-slot: capacity 1 on shared resource — exactly one visit wins.
    // Later consecutive pair on the same day for the capacity race.
    let raceA: (typeof listA.slots)[number] | undefined;
    let raceB: (typeof listB.slots)[number] | undefined;
    for (const a of listA.slots.filter((s) => s.available && new Date(s.startsAt).getTime() >= startA.getTime() + 3 * 3600_000)) {
      const expectedPeer = new Date(a.endsAt);
      const b = listB.slots.find(
        (s) =>
          s.available &&
          s.resourceId === a.resourceId &&
          Math.abs(new Date(s.startsAt).getTime() - expectedPeer.getTime()) <= 60_000,
      );
      if (b) {
        raceA = a;
        raceB = b;
        break;
      }
    }
    assert.ok(raceA && raceB, 'expected a later consecutive race pair');
    const raceStart = new Date(raceA.startsAt);
    const raceEndPeer = new Date(raceB.startsAt);
    const actorB = await commerce.customerActor({
      firebaseUid: `${run}-cust-b`,
      email: `${run}-b@test.local`,
      name: 'عميلة ب',
    });
    userIds.push(actorB.userId);
    const raceBody = (uidSuffix: string) => ({
      idempotencyKey: `${run}-race-${uidSuffix}`,
      branchId: branch.id,
      contactName: 'سباق',
      contactPhone: PHONE,
      items: [
        { serviceId: cleanse.id, startsAt: raceStart.toISOString(), resourceId },
        { serviceId: hydrate.id, startsAt: raceEndPeer.toISOString(), resourceId },
      ],
    });
    // afterReplay captured *before* the two-customer race (RC5 acceptance).
    const beforeRaceVisits = afterReplayVisits;
    const results = await Promise.allSettled([
      commerce.createConsecutiveVisit(actor, raceBody('a')),
      commerce.createConsecutiveVisit(actorB, raceBody('b')),
    ]);
    const ok = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');
    assert.equal(ok.length, 1, `expected exactly one winner, got ${JSON.stringify(results)}`);
    assert.equal(rejected.length, 1);
    const afterRaceVisits = await prisma.commerceVisit.count({ where: { partnerId: partner.id } });
    assert.equal(afterRaceVisits - beforeRaceVisits, 1);
    for (const r of ok) {
      if (r.status === 'fulfilled') {
        visitIds.push(r.value.visit.id);
        bookingIds.push(...r.value.visit.bookings.map((b: { id: string }) => b.id));
      }
    }

    // Home-only service must reject consecutive visit (same as createBooking placeMode=branch).
    const homeOnly = await prisma.service.create({
      data: {
        partnerId: partner.id,
        nameAr: 'زيارة منزلية فقط',
        nameEn: `${run}-home`,
        durationMin: 30,
        priceHalalas: 9000,
        concernTags: [],
        bookingEnabled: true,
        active: true,
        contentStatus: 'published',
        catalogSource: 'catalog',
        payMode: 'pay_at_venue',
        placeMode: 'home',
        availabilityJson: windows,
      },
    });
    const beforeHome = {
      visits: await prisma.commerceVisit.count({ where: { partnerId: partner.id } }),
      bookings: await prisma.commerceBooking.count({ where: { partnerId: partner.id } }),
    };
    await failure(
      commerce.createConsecutiveVisit(actor, {
        idempotencyKey: `${run}-home-reject`,
        branchId: branch.id,
        contactName: 'نورة',
        contactPhone: PHONE,
        items: [
          { serviceId: homeOnly.id, startsAt: startA.toISOString(), resourceId },
          { serviceId: hydrate.id, startsAt: startB.toISOString(), resourceId },
        ],
      }),
      422,
      'PLACE_NOT_ALLOWED',
    );
    assert.equal(await prisma.commerceVisit.count({ where: { partnerId: partner.id } }), beforeHome.visits);
    assert.equal(await prisma.commerceBooking.count({ where: { partnerId: partner.id } }), beforeHome.bookings);

    const fetched = await commerce.getCustomerVisit(actor, created.visit.id);
    assert.equal(fetched.visit.publicNumber, created.visit.publicNumber);
    assert.equal(fetched.visit.bookings.length, 2);

    console.log(
      JSON.stringify({
        ok: true,
        visitId: created.visit.id,
        bookingIds: created.visit.bookings.map((b: { id: string }) => b.id),
        beforeVisits,
        afterCreateVisits,
        afterReplayVisits,
        beforeRaceVisits,
        afterRaceVisits,
        raceWinner: 1,
        midTxRollback: midTxOk,
        homeOnlyRejected: true,
      }),
    );
  } finally {
    if (bookingIds.length) {
      await prisma.commerceBookingEvent.deleteMany({ where: { bookingId: { in: bookingIds } } });
      await prisma.commerceBooking.deleteMany({ where: { id: { in: bookingIds } } });
    }
    if (visitIds.length) await prisma.commerceVisit.deleteMany({ where: { id: { in: visitIds } } });
    // Also delete any race leftovers by partner
    const leftoverVisits = await prisma.commerceVisit.findMany({ where: { partnerId: { in: partnerIds } }, select: { id: true } });
    const leftoverIds = leftoverVisits.map((v) => v.id);
    if (leftoverIds.length) {
      const lbs = await prisma.commerceBooking.findMany({ where: { visitId: { in: leftoverIds } }, select: { id: true } });
      const lbIds = lbs.map((b) => b.id);
      if (lbIds.length) {
        await prisma.commerceBookingEvent.deleteMany({ where: { bookingId: { in: lbIds } } });
        await prisma.commerceBooking.deleteMany({ where: { id: { in: lbIds } } });
      }
      await prisma.commerceVisit.deleteMany({ where: { id: { in: leftoverIds } } });
    }
    await prisma.service.deleteMany({ where: { partnerId: { in: partnerIds } } });
    await prisma.partnerBranch.deleteMany({ where: { partnerId: { in: partnerIds } } });
    await prisma.partner.deleteMany({ where: { id: { in: partnerIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  }
}

main().catch(async (e) => {
  console.error(e);
  process.exit(1);
});
