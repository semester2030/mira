/**
 * P5-C02 unit: bookable-slot filter uses the same buildDaySlots rules as booking.
 */
import assert from 'node:assert/strict';
import {
  partnerCapBundleForService,
  serviceHasBookableSlotOnDate,
} from './catalog-availability';
import { localInstant } from './commerce.types';

const DATE = '2026-11-10'; // Tuesday
const weekly = [
  { weekday: 2, startMin: 9 * 60, endMin: 12 * 60, capacity: 1, resourceId: 'room-A' },
];

{
  const bundle = partnerCapBundleForService({ windows: weekly }, [{ windows: weekly }]);
  const service = {
    id: 's1',
    partnerId: 'p1',
    bookingEnabled: true,
    durationMin: 60,
    availabilityJson: { windows: weekly },
    branchId: 'b1',
  };
  assert.equal(
    serviceHasBookableSlotOnDate({
      service,
      dateKey: DATE,
      bundle,
      held: [],
      now: localInstant(DATE, 0)!,
    }),
    true,
  );
}

// bookingEnabled=false → not bookable
{
  const bundle = partnerCapBundleForService({ windows: weekly }, [{ windows: weekly }]);
  assert.equal(
    serviceHasBookableSlotOnDate({
      service: {
        id: 's1',
        partnerId: 'p1',
        bookingEnabled: false,
        durationMin: 60,
        availabilityJson: { windows: weekly },
      },
      dateKey: DATE,
      bundle,
      held: [],
      now: localInstant(DATE, 0)!,
    }),
    false,
  );
}

// Full day (held consumes capacity) → not bookable
{
  const bundle = partnerCapBundleForService({ windows: weekly }, [{ windows: weekly }]);
  const start = localInstant(DATE, 9 * 60)!;
  const end = localInstant(DATE, 10 * 60)!;
  assert.equal(
    serviceHasBookableSlotOnDate({
      service: {
        id: 's1',
        partnerId: 'p1',
        bookingEnabled: true,
        durationMin: 60,
        availabilityJson: { windows: weekly },
      },
      dateKey: DATE,
      bundle,
      held: [
        { startsAt: start, endsAt: end, resourceId: 'room-A' },
        // consume every 60-min slot in 9–12
        { startsAt: localInstant(DATE, 10 * 60)!, endsAt: localInstant(DATE, 11 * 60)!, resourceId: 'room-A' },
        { startsAt: localInstant(DATE, 11 * 60)!, endsAt: localInstant(DATE, 12 * 60)!, resourceId: 'room-A' },
      ],
      now: localInstant(DATE, 0)!,
    }),
    false,
  );
}

// Duration 60 cannot fit in 30-min window → not bookable
{
  const short = [{ weekday: 2, startMin: 9 * 60, endMin: 9 * 60 + 30, capacity: 1, resourceId: 'room-A' }];
  const bundle = partnerCapBundleForService({ windows: short }, [{ windows: short }]);
  assert.equal(
    serviceHasBookableSlotOnDate({
      service: {
        id: 's1',
        partnerId: 'p1',
        bookingEnabled: true,
        durationMin: 60,
        availabilityJson: { windows: short },
      },
      dateKey: DATE,
      bundle,
      held: [],
      now: localInstant(DATE, 0)!,
    }),
    false,
  );
}

// Resource capacity conflict strips the resource → not bookable
{
  const a = [{ weekday: 2, startMin: 9 * 60, endMin: 12 * 60, capacity: 1, resourceId: 'room-Conflict' }];
  const b = [{ weekday: 2, startMin: 9 * 60, endMin: 12 * 60, capacity: 2, resourceId: 'room-Conflict' }];
  const bundle = partnerCapBundleForService({ windows: a }, [{ windows: a }, { windows: b }]);
  assert.equal(
    serviceHasBookableSlotOnDate({
      service: {
        id: 's1',
        partnerId: 'p1',
        bookingEnabled: true,
        durationMin: 60,
        availabilityJson: { windows: a },
      },
      dateKey: DATE,
      bundle,
      held: [],
      now: localInstant(DATE, 0)!,
    }),
    false,
  );
}

// Required branch mismatch → not bookable
{
  const bundle = partnerCapBundleForService({ windows: weekly }, [{ windows: weekly }]);
  assert.equal(
    serviceHasBookableSlotOnDate({
      service: {
        id: 's1',
        partnerId: 'p1',
        bookingEnabled: true,
        durationMin: 60,
        availabilityJson: { windows: weekly },
        branchId: 'branch-A',
      },
      dateKey: DATE,
      bundle,
      held: [],
      now: localInstant(DATE, 0)!,
      requiredBranchIds: ['branch-B'],
    }),
    false,
  );
}

console.log('catalog-availability.schema-tests: PASS');
