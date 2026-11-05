/**
 * P4 slot calendar + resource consistency (list ≡ book).
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

    const DATE = nextWeekday(2); // Tuesday
    const WED = nextWeekday(3);
    assert.notEqual(DATE, WED);

    const mkPublished = (name: string, availabilityJson: unknown, durationMin = 60) =>
      prisma.service.create({
        data: {
          partnerId: partner.id,
          nameAr: name,
          nameEn: `${run}-${name}`,
          durationMin,
          priceHalalas: 15000,
          concernTags: [],
          bookingEnabled: true,
          active: true,
          contentStatus: 'published',
          catalogSource: 'catalog',
          availabilityJson: availabilityJson as object,
        },
      });

    const book = (
      user: Customer,
      serviceId: string,
      startsAt: string,
      key: string,
      resourceId?: string,
    ) =>
      commerce.createBooking(user, {
        serviceId,
        startsAt,
        contactName: 'سارة',
        contactPhone: PHONE,
        idempotencyKey: key,
        ...(resourceId != null ? { resourceId } : {}),
      });

    // ---- 1) Weekly resource: list ≡ book ----
    const weeklySvc = await mkPublished(`أسبوعي ${run}`, {
      v: 2,
      timezone: 'Asia/Riyadh',
      windows: [{ weekday: 2, startMin: 540, endMin: 720, capacity: 1, resourceId: 'room-W' }],
      closedDates: [],
      exceptions: [],
    });
    const wList = await commerce.serviceAvailability(weeklySvc.id, DATE);
    const wSlot = wList.slots.find((s) => s.available && s.resourceId === 'room-W' && localParts(new Date(s.startsAt)).minuteOfDay === 540);
    record('P4_R1_WEEKLY_LIST', Boolean(wSlot), { slots: wList.slots.length });
    const wBook = await book(alice, weeklySvc.id, wSlot!.startsAt, `${run}-w1`, 'room-W');
    record('P4_R1_WEEKLY_BOOK', wBook.booking.status === 'requested', { status: wBook.booking.status });

    // ---- 2) Special-only resource (no weekly) — the reviewed defect ----
    const specialOnly = await mkPublished(`خاص فقط ${run}`, {
      v: 2,
      timezone: 'Asia/Riyadh',
      windows: [],
      closedDates: [],
      exceptions: [
        {
          date: DATE,
          kind: 'special',
          startMin: 540,
          endMin: 720,
          capacity: 1,
          resourceId: 'room-A',
        },
      ],
    });
    const soList = await commerce.serviceAvailability(specialOnly.id, DATE);
    const soAvail = soList.slots.filter((s) => s.available && s.resourceId === 'room-A');
    record('P4_R2_SPECIAL_ONLY_LIST', soAvail.length === 3, {
      count: soAvail.length,
      starts: soAvail.map((s) => localParts(new Date(s.startsAt)).minuteOfDay),
    });
    // Pre-fix proof path: booking must succeed (was RESOURCE_NOT_AVAILABLE).
    let soBookOk = false;
    let soBookCode: string | null = null;
    try {
      const soBook = await book(alice, specialOnly.id, soAvail[0]!.startsAt, `${run}-so1`, 'room-A');
      soBookOk = soBook.booking.status === 'requested';
    } catch (e) {
      soBookCode =
        e instanceof HttpException
          ? String((e.getResponse() as { code?: string }).code || e.getStatus())
          : String(e);
    }
    record('P4_R2_SPECIAL_ONLY_BOOK', soBookOk, { soBookCode });

    // ---- 3) Capacity: list full + next book BOOKING_SLOT_FULL ----
    const afterCap = await commerce.serviceAvailability(specialOnly.id, DATE);
    const takenStart = soAvail[0]!.startsAt;
    const afterSlot = afterCap.slots.find((s) => s.startsAt === takenStart);
    record('P4_R3_LIST_FULL', Boolean(afterSlot && afterSlot.remaining === 0 && !afterSlot.available), {
      remaining: afterSlot?.remaining,
      available: afterSlot?.available,
    });
    await failure(book(bob, specialOnly.id, takenStart, `${run}-so2`, 'room-A'), 409, 'BOOKING_SLOT_FULL');
    record('P4_R3_BOOK_FULL', true, { code: 'BOOKING_SLOT_FULL' });

    // ---- 4) Special on day without weekly (Wednesday; weekly only Tuesday elsewhere) ----
    const mix = await mkPublished(`خليط ${run}`, {
      v: 2,
      timezone: 'Asia/Riyadh',
      windows: [{ weekday: 2, startMin: 540, endMin: 720, capacity: 1, resourceId: 'room-W2' }],
      closedDates: [],
      exceptions: [{ date: WED, kind: 'special', startMin: 600, endMin: 660, capacity: 1, resourceId: 'room-S' }],
    });
    const wedList = await commerce.serviceAvailability(mix.id, WED);
    const wedSlot = wedList.slots.find((s) => s.available && s.resourceId === 'room-S');
    record('P4_R4_SPECIAL_NO_WEEKDAY_LIST', Boolean(wedSlot), { slots: wedList.slots.length });
    const wedBook = await book(bob, mix.id, wedSlot!.startsAt, `${run}-wed`, 'room-S');
    record('P4_R4_SPECIAL_NO_WEEKDAY_BOOK', wedBook.booking.status === 'requested', {
      status: wedBook.booking.status,
    });

    // ---- 5) Full-day close ----
    await prisma.service.update({
      where: { id: mix.id },
      data: {
        availabilityJson: {
          v: 2,
          timezone: 'Asia/Riyadh',
          windows: [{ weekday: 2, startMin: 540, endMin: 720, capacity: 1, resourceId: 'room-W2' }],
          closedDates: [DATE],
          exceptions: [],
        },
      },
    });
    const closedList = await commerce.serviceAvailability(mix.id, DATE);
    record('P4_R5_CLOSED_LIST', closedList.slots.length === 0, { n: closedList.slots.length });
    await failure(
      book(alice, mix.id, localInstant(DATE, 540)!.toISOString(), `${run}-closed`, 'room-W2'),
      422,
      'SLOT_DATE_CLOSED',
    );
    record('P4_R5_CLOSED_BOOK', true, { code: 'SLOT_DATE_CLOSED' });

    // ---- 6) Resource-scoped close: room-A closed, room-B open ----
    const dual = await mkPublished(`موردان ${run}`, {
      v: 2,
      timezone: 'Asia/Riyadh',
      windows: [
        { weekday: 2, startMin: 540, endMin: 720, capacity: 1, resourceId: 'room-A2' },
        { weekday: 2, startMin: 540, endMin: 720, capacity: 1, resourceId: 'room-B2' },
      ],
      closedDates: [],
      exceptions: [{ date: DATE, kind: 'closed', resourceId: 'room-A2' }],
    });
    const dualList = await commerce.serviceAvailability(dual.id, DATE);
    const aOpen = dualList.slots.some((s) => s.available && s.resourceId === 'room-A2');
    const bOpen = dualList.slots.some((s) => s.available && s.resourceId === 'room-B2');
    record('P4_R6_SCOPED_CLOSE', !aOpen && bOpen, { aOpen, bOpen });
    await failure(
      book(alice, dual.id, localInstant(DATE, 540)!.toISOString(), `${run}-a2`, 'room-A2'),
      422,
      'SLOT_DATE_CLOSED',
    );
    const bBook = await book(alice, dual.id, localInstant(DATE, 540)!.toISOString(), `${run}-b2`, 'room-B2');
    record('P4_R6_OTHER_RESOURCE_OK', bBook.booking.status === 'requested', { status: bBook.booking.status });

    // ---- 7) Remove close → weekly returns ----
    await prisma.service.update({
      where: { id: mix.id },
      data: {
        availabilityJson: {
          v: 2,
          timezone: 'Asia/Riyadh',
          windows: [{ weekday: 2, startMin: 540, endMin: 720, capacity: 1, resourceId: 'room-W2' }],
          closedDates: [],
          exceptions: [],
        },
      },
    });
    const restored = await commerce.serviceAvailability(mix.id, DATE);
    record('P4_R7_UNCLOSE', restored.slots.some((s) => s.available && s.resourceId === 'room-W2'), {
      available: restored.slots.filter((s) => s.available).length,
    });

    // ---- 8) Special replaces weekly hours (no weekly-only times) ----
    await prisma.service.update({
      where: { id: mix.id },
      data: {
        availabilityJson: {
          v: 2,
          timezone: 'Asia/Riyadh',
          windows: [{ weekday: 2, startMin: 540, endMin: 720, capacity: 1, resourceId: 'room-W2' }],
          closedDates: [],
          exceptions: [
            { date: DATE, kind: 'special', startMin: 600, endMin: 720, capacity: 1, resourceId: 'room-W2' },
          ],
        },
      },
    });
    const override = await commerce.serviceAvailability(mix.id, DATE);
    const mins = override.slots.filter((s) => s.available).map((s) => localParts(new Date(s.startsAt)).minuteOfDay);
    record('P4_R8_SPECIAL_OVERRIDE', mins.includes(600) && !mins.includes(540), { mins });
    await failure(
      book(bob, mix.id, localInstant(DATE, 540)!.toISOString(), `${run}-excl`, 'room-W2'),
      422,
      'SLOT_OUTSIDE_AVAILABILITY',
    );
    record('P4_R8_WEEKLY_HOUR_REJECTED', true, { code: 'SLOT_OUTSIDE_AVAILABILITY' });

    // ---- 9) Existing holds on same resource count toward capacity ----
    // room-A special-only already has one booking at first slot; remaining free slots still open.
    const soAgain = await commerce.serviceAvailability(specialOnly.id, DATE);
    const free = soAgain.slots.find((s) => s.available && s.resourceId === 'room-A');
    record('P4_R9_OTHER_SLOT_STILL_OPEN', Boolean(free), {
      free: free && localParts(new Date(free.startsAt)).minuteOfDay,
    });

    // ---- 10) Resource not open on another date ----
    const otherDay = nextWeekday(4); // Thursday — specialOnly has no windows/specials
    const otherList = await commerce.serviceAvailability(specialOnly.id, otherDay);
    record('P4_R10_OTHER_DATE_EMPTY', otherList.slots.length === 0, { n: otherList.slots.length, otherDay });
    await failure(
      book(bob, specialOnly.id, localInstant(otherDay, 540)!.toISOString(), `${run}-other`, 'room-A'),
      422,
      'AVAILABILITY_NOT_CONFIGURED',
    );
    record('P4_R10_OTHER_DATE_REJECT', true, { code: 'AVAILABILITY_NOT_CONFIGURED' });

    // Absence ≠ available
    const bare2 = await prisma.service.create({
      data: {
        partnerId: partner.id,
        nameAr: `بلا ${run}`,
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
    const bareSlots = await commerce.serviceAvailability(bare2.id, DATE);
    record('P4_UNCONFIGURED_EMPTY', bareSlots.slots.length === 0, { n: bareSlots.slots.length });
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
