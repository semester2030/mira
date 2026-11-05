/**
 * P4 slot calendar acceptance — real CommerceService + local DB.
 * Covers closed dates, specials, capacity parity (list vs create), restore, Asia/Riyadh.
 * Run: npx tsx src/marketplace/p4-slots-calendar.integration-tests.ts
 */
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { HttpException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CommerceActor, CommerceService } from './commerce.service';
import { localInstant, localParts } from './commerce.types';

type Customer = CommerceActor & { type: 'customer' };
const run = `p4s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const PHONE = '0501234567';
const outDir =
  process.env.MIRA_P4_OUT_DIR ||
  join(process.cwd(), '..', 'audit-out', 'p2-p31-p4', 'logs', `p4-slots-${run}`);
mkdirSync(outDir, { recursive: true });

const steps: Array<{ id: string; ok: boolean; detail?: unknown }> = [];
function record(id: string, ok: boolean, detail?: unknown) {
  steps.push({ id, ok, detail });
  console.log(JSON.stringify({ id, ok, detail }));
}

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

async function main() {
  const url = process.env.DATABASE_URL ?? '';
  if (!url.includes('localhost') && !url.includes('127.0.0.1')) {
    console.error('REFUSE: DATABASE_URL must be local');
    process.exit(1);
  }
  const prisma = new PrismaClient();
  const commerce = new CommerceService(prisma as unknown as PrismaService);
  const startedUtc = new Date().toISOString();
  const partnerIds: string[] = [];
  const userIds: string[] = [];

  try {
    const partner = await prisma.partner.create({
      data: { type: 'salon', status: 'active', nameAr: `صالون P4 ${run}`, nameEn: `p4-${run}`, city: 'الرياض' },
    });
    partnerIds.push(partner.id);
    const alice = await commerce.customerActor({
      firebaseUid: `${run}-alice`,
      email: `alice-${run}@t.local`,
      name: 'Alice',
    });
    userIds.push(alice.userId);
    const bob = await commerce.customerActor({
      firebaseUid: `${run}-bob`,
      email: `bob-${run}@t.local`,
      name: 'Bob',
    });
    userIds.push(bob.userId);

    // Pick a Tuesday ≥ 5 days ahead (Asia/Riyadh) so lead time + horizon hold.
    let target = new Date(Date.now() + 5 * 86_400_000);
    for (let i = 0; i < 14; i += 1) {
      const key = localParts(new Date(target.getTime() + i * 86_400_000)).dateKey;
      const noon = localInstant(key, 12 * 60)!;
      if (localParts(noon).weekday === 2) {
        target = noon;
        break;
      }
    }
    const DATE = localParts(target).dateKey;
    const weekday = localParts(localInstant(DATE, 12 * 60)!).weekday;
    assert.equal(weekday, 2, 'fixture day must be Tuesday');

    const weekly = [
      { weekday: 2, startMin: 540, endMin: 720, capacity: 1, resourceId: '' }, // 09:00–12:00
    ];

    const service = await prisma.service.create({
      data: {
        partnerId: partner.id,
        nameAr: `خدمة تقويم ${run}`,
        nameEn: `cal-${run}`,
        durationMin: 60,
        priceHalalas: 15000,
        concernTags: [],
        bookingEnabled: true,
        active: true,
        contentStatus: 'published',
        catalogSource: 'catalog',
        availabilityJson: {
          v: 2,
          timezone: 'Asia/Riyadh',
          windows: weekly,
          closedDates: [],
          exceptions: [],
        },
      },
    });

    // 1) Weekly open → close by date: no bookable slots; direct book refused.
    const openSlots = await commerce.serviceAvailability(service.id, DATE);
    const openAvail = openSlots.slots.filter((s) => s.available);
    record('P4_SLOT_WEEKLY_OPEN', openAvail.length > 0, { count: openAvail.length, date: DATE });

    await prisma.service.update({
      where: { id: service.id },
      data: {
        availabilityJson: {
          v: 2,
          timezone: 'Asia/Riyadh',
          windows: weekly,
          closedDates: [DATE],
          exceptions: [],
        },
      },
    });
    const closedSlots = await commerce.serviceAvailability(service.id, DATE);
    record('P4_SLOT_CLOSED_LIST_EMPTY', closedSlots.slots.length === 0, {
      slots: closedSlots.slots.length,
    });
    await failure(
      commerce.createBooking(alice, {
        serviceId: service.id,
        startsAt: localInstant(DATE, 540)!.toISOString(),
        contactName: 'سارة',
        contactPhone: PHONE,
        idempotencyKey: `${run}-closed`,
      }),
      422,
      'SLOT_DATE_CLOSED',
    );
    record('P4_SLOT_CLOSED_BOOK_REJECTED', true, { code: 'SLOT_DATE_CLOSED' });

    // 5 partial: remove closure → weekly returns
    await prisma.service.update({
      where: { id: service.id },
      data: {
        availabilityJson: {
          v: 2,
          timezone: 'Asia/Riyadh',
          windows: weekly,
          closedDates: [],
          exceptions: [],
        },
      },
    });
    const restored = await commerce.serviceAvailability(service.id, DATE);
    record('P4_SLOT_RESTORE_AFTER_UNCLOSE', restored.slots.some((s) => s.available), {
      available: restored.slots.filter((s) => s.available).length,
    });

    // 2) Special overrides weekly hours
    await prisma.service.update({
      where: { id: service.id },
      data: {
        availabilityJson: {
          v: 2,
          timezone: 'Asia/Riyadh',
          windows: weekly,
          closedDates: [],
          exceptions: [{ date: DATE, kind: 'special', startMin: 600, endMin: 720, capacity: 1, resourceId: '' }],
        },
      },
    });
    const special = await commerce.serviceAvailability(service.id, DATE);
    const starts = special.slots.filter((s) => s.available).map((s) => s.startsAt);
    const has600 = starts.some((iso) => localParts(new Date(iso)).minuteOfDay === 600);
    const has540 = starts.some((iso) => localParts(new Date(iso)).minuteOfDay === 540);
    record('P4_SLOT_SPECIAL_HOURS', has600 && !has540, { starts: starts.map((s) => localParts(new Date(s)).minuteOfDay) });
    await failure(
      commerce.createBooking(alice, {
        serviceId: service.id,
        startsAt: localInstant(DATE, 540)!.toISOString(),
        contactName: 'سارة',
        contactPhone: PHONE,
        idempotencyKey: `${run}-excl`,
      }),
      422,
      'SLOT_OUTSIDE_AVAILABILITY',
    );
    record('P4_SLOT_SPECIAL_EXCLUDED_REJECTED', true, { code: 'SLOT_OUTSIDE_AVAILABILITY' });

    // 3) Special on a day with no weekly window (Wednesday)
    let wedKey = DATE;
    for (let i = 1; i < 10; i += 1) {
      const k = localParts(new Date(localInstant(DATE, 0)!.getTime() + i * 86_400_000)).dateKey;
      if (localParts(localInstant(k, 12 * 60)!).weekday === 3) {
        wedKey = k;
        break;
      }
    }
    await prisma.service.update({
      where: { id: service.id },
      data: {
        availabilityJson: {
          v: 2,
          timezone: 'Asia/Riyadh',
          windows: weekly, // Tuesday only
          closedDates: [],
          exceptions: [{ date: wedKey, kind: 'special', startMin: 600, endMin: 660, capacity: 1 }],
        },
      },
    });
    const wedSlots = await commerce.serviceAvailability(service.id, wedKey);
    const wedOk = wedSlots.slots.some((s) => s.available && localParts(new Date(s.startsAt)).minuteOfDay === 600);
    record('P4_SLOT_SPECIAL_NO_WEEKLY', wedOk, { wedKey, slots: wedSlots.slots.length });
    const wedBook = await commerce.createBooking(alice, {
      serviceId: service.id,
      startsAt: localInstant(wedKey, 600)!.toISOString(),
      contactName: 'سارة',
      contactPhone: PHONE,
      idempotencyKey: `${run}-wed`,
    });
    record('P4_SLOT_SPECIAL_NO_WEEKLY_BOOK', wedBook.booking.status === 'requested', {
      status: wedBook.booking.status,
    });

    // 4) Capacity: list remaining matches create rejection
    await prisma.service.update({
      where: { id: service.id },
      data: {
        availabilityJson: {
          v: 2,
          timezone: 'Asia/Riyadh',
          windows: weekly,
          closedDates: [],
          exceptions: [],
        },
      },
    });
    // Use a fresh future Tuesday slot minute that is free (660 if 540 used? weekly 540–720 → 540,600,660)
    const capMinute = 660;
    const beforeCap = await commerce.serviceAvailability(service.id, DATE);
    const beforeSlot = beforeCap.slots.find((s) => localParts(new Date(s.startsAt)).minuteOfDay === capMinute);
    record('P4_SLOT_CAP_BEFORE', Boolean(beforeSlot?.available && beforeSlot.remaining === 1), {
      remaining: beforeSlot?.remaining,
    });
    await commerce.createBooking(alice, {
      serviceId: service.id,
      startsAt: localInstant(DATE, capMinute)!.toISOString(),
      contactName: 'سارة',
      contactPhone: PHONE,
      idempotencyKey: `${run}-cap1`,
    });
    const afterCap = await commerce.serviceAvailability(service.id, DATE);
    const afterSlot = afterCap.slots.find((s) => localParts(new Date(s.startsAt)).minuteOfDay === capMinute);
    record('P4_SLOT_CAP_LIST_FULL', Boolean(afterSlot && afterSlot.remaining === 0 && !afterSlot.available), {
      remaining: afterSlot?.remaining,
      available: afterSlot?.available,
    });
    await failure(
      commerce.createBooking(bob, {
        serviceId: service.id,
        startsAt: localInstant(DATE, capMinute)!.toISOString(),
        contactName: 'نورة',
        contactPhone: PHONE,
        idempotencyKey: `${run}-cap2`,
      }),
      409,
      'BOOKING_SLOT_FULL',
    );
    record('P4_SLOT_CAP_BOOK_MATCHES_LIST', true, { code: 'BOOKING_SLOT_FULL' });

    // 6) Timezone: DATE keys and slot instants are Asia/Riyadh (UTC+3)
    const sample = afterCap.slots[0];
    if (sample) {
      const parts = localParts(new Date(sample.startsAt));
      record('P4_SLOT_TZ_RIYADH', parts.dateKey === DATE && afterCap.timezone === 'Asia/Riyadh', {
        dateKey: parts.dateKey,
        timezone: afterCap.timezone,
        minuteOfDay: parts.minuteOfDay,
      });
    } else {
      record('P4_SLOT_TZ_RIYADH', false, { reason: 'no slots' });
    }

    // Absence of availability ≠ available
    const bare = await prisma.service.create({
      data: {
        partnerId: partner.id,
        nameAr: `بلا جدول ${run}`,
        nameEn: `bare-${run}`,
        durationMin: 30,
        priceHalalas: 5000,
        concernTags: [],
        bookingEnabled: true,
        active: true,
        contentStatus: 'published',
        catalogSource: 'catalog',
      },
    });
    const bareSlots = await commerce.serviceAvailability(bare.id, DATE);
    record('P4_SLOT_UNCONFIGURED_EMPTY', bareSlots.slots.length === 0, { slots: bareSlots.slots.length });
    await failure(
      commerce.createBooking(bob, {
        serviceId: bare.id,
        startsAt: localInstant(DATE, 600)!.toISOString(),
        contactName: 'نورة',
        contactPhone: PHONE,
        idempotencyKey: `${run}-bare`,
      }),
      422,
      'AVAILABILITY_NOT_CONFIGURED',
    );
    record('P4_SLOT_UNCONFIGURED_REJECT', true, { code: 'AVAILABILITY_NOT_CONFIGURED' });
  } finally {
    await prisma.commerceBooking.deleteMany({ where: { userId: { in: userIds } } }).catch(() => undefined);
    await prisma.service.deleteMany({ where: { partnerId: { in: partnerIds } } }).catch(() => undefined);
    await prisma.user.deleteMany({ where: { id: { in: userIds } } }).catch(() => undefined);
    await prisma.partner.deleteMany({ where: { id: { in: partnerIds } } }).catch(() => undefined);
    await prisma.$disconnect().catch(() => undefined);
  }

  const failed = steps.filter((s) => !s.ok);
  const summary = {
    ok: failed.length === 0,
    id: 'P4_SLOTS_CALENDAR',
    commit: process.env.MIRA_P21_COMMIT || '',
    runId: process.env.MIRA_P21_RUN_ID || run,
    startedUtc,
    finishedUtc: new Date().toISOString(),
    steps,
    outDir,
  };
  writeFileSync(join(outDir, 'p4-slots-calendar.json'), JSON.stringify(summary, null, 2));
  writeFileSync(join(outDir, 'verdict.txt'), summary.ok ? 'PASS\n' : 'FAIL\n');
  console.log(JSON.stringify({ ok: summary.ok, failed: failed.map((f) => f.id), outDir }));
  process.exit(summary.ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  writeFileSync(join(outDir, 'verdict.txt'), 'FAIL\n');
  process.exit(2);
});
