import assert from 'node:assert/strict';
import { HttpException } from '@nestjs/common';
import {
  assertAvailabilityConsistent,
  buildDaySlots,
  canCollectPayment,
  canonicalVariantKey,
  checkBookingTransition,
  checkFulfillmentTransition,
  checkSlot,
  computeDeliveryFee,
  consumesStock,
  deliveryForFulfillment,
  fulfillmentForDelivery,
  localInstant,
  localParts,
  makePublicNumber,
  normalizeIdempotencyKey,
  parseAvailability,
  parseContact,
  releasesStock,
  resolveSelection,
  FULFILLMENT_STATUSES,
  FULFILLMENT_TRANSITIONS,
} from './commerce.types';

function code(fn: () => unknown): string | undefined {
  try {
    fn();
  } catch (error) {
    assert.ok(error instanceof HttpException);
    const body = error.getResponse() as { code?: string; messageAr?: string };
    assert.ok(body.messageAr && /[\u0600-\u06FF]/.test(body.messageAr), 'messageAr must be Arabic');
    return body.code;
  }
  return undefined;
}

// --- order transitions --------------------------------------------------------
assert.deepEqual(checkFulfillmentTransition('new', 'accepted', 'partner'), { ok: true });
assert.deepEqual(checkFulfillmentTransition('new', 'cancelled', 'customer'), { ok: true });
assert.deepEqual(checkFulfillmentTransition('new', 'accepted', 'customer'), { ok: false, reason: 'actor_forbidden' });
assert.deepEqual(checkFulfillmentTransition('new', 'delivered', 'admin'), { ok: false, reason: 'not_allowed' });
assert.deepEqual(checkFulfillmentTransition('accepted', 'cancelled', 'customer'), { ok: false, reason: 'actor_forbidden' });
assert.deepEqual(checkFulfillmentTransition('new', 'bogus', 'admin'), { ok: false, reason: 'unknown_status' });
for (const terminal of ['delivered', 'rejected', 'cancelled'] as const) {
  assert.deepEqual(FULFILLMENT_TRANSITIONS[terminal], {}, `${terminal} is terminal`);
}
assert.deepEqual(checkFulfillmentTransition('failed_delivery', 'out_for_delivery', 'partner'), { ok: true });
assert.deepEqual(checkFulfillmentTransition('accepted', 'rejected', 'partner'), { ok: true });
assert.equal(FULFILLMENT_STATUSES.length, 8);

// --- delivery axis ------------------------------------------------------------
assert.equal(deliveryForFulfillment('new'), 'pending');
assert.equal(deliveryForFulfillment('preparing'), 'pending');
assert.equal(deliveryForFulfillment('out_for_delivery'), 'out_for_delivery');
assert.equal(deliveryForFulfillment('delivered'), 'delivered');
assert.equal(deliveryForFulfillment('failed_delivery'), 'failed');
assert.equal(deliveryForFulfillment('rejected'), 'none');
assert.equal(deliveryForFulfillment('cancelled'), 'none');
assert.equal(fulfillmentForDelivery('failed'), 'failed_delivery');
assert.equal(fulfillmentForDelivery('pending'), null);
assert.equal(fulfillmentForDelivery('none'), null);

// --- stock effects ------------------------------------------------------------
assert.equal(releasesStock('rejected'), true);
assert.equal(releasesStock('cancelled'), true);
assert.equal(releasesStock('failed_delivery'), false);
assert.equal(releasesStock('delivered'), false);
assert.equal(consumesStock('delivered'), true);
assert.equal(consumesStock('cancelled'), false);

// --- payment collection is its own axis ---------------------------------------
assert.equal(canCollectPayment('new', 'uncollected'), false);
assert.equal(canCollectPayment('preparing', 'uncollected'), false);
assert.equal(canCollectPayment('out_for_delivery', 'uncollected'), false, 'collection only after delivery');
assert.equal(canCollectPayment('delivered', 'uncollected'), true);
assert.equal(canCollectPayment('delivered', 'collected'), false);
assert.equal(canCollectPayment('cancelled', 'uncollected'), false);

// --- booking transitions ------------------------------------------------------
assert.deepEqual(checkBookingTransition('requested', 'confirmed', 'partner'), { ok: true });
assert.deepEqual(checkBookingTransition('requested', 'confirmed', 'customer'), { ok: false, reason: 'actor_forbidden' });
assert.deepEqual(checkBookingTransition('requested', 'cancelled', 'customer'), { ok: true });
assert.deepEqual(checkBookingTransition('requested', 'completed', 'partner'), { ok: false, reason: 'not_allowed' });
assert.deepEqual(checkBookingTransition('confirmed', 'completed', 'partner'), { ok: true });
assert.deepEqual(checkBookingTransition('completed', 'cancelled', 'admin'), { ok: false, reason: 'not_allowed' });
assert.deepEqual(checkBookingTransition('rejected', 'confirmed', 'admin'), { ok: false, reason: 'not_allowed' });

// --- delivery fee: null unknown; differing known fees unknown; no auto-max ----
assert.deepEqual(computeDeliveryFee([1500, 2000]), { feeHalalas: null, known: false });
assert.deepEqual(computeDeliveryFee([1500, 1500]), { feeHalalas: 1500, known: true });
assert.deepEqual(computeDeliveryFee([0, 0]), { feeHalalas: 0, known: true });
assert.deepEqual(computeDeliveryFee([1500, null]), { feeHalalas: null, known: false });
assert.deepEqual(computeDeliveryFee([undefined]), { feeHalalas: null, known: false });
assert.deepEqual(computeDeliveryFee([]), { feeHalalas: null, known: false });

// --- selections / variants ----------------------------------------------------
const options = [{ id: 'size', labelAr: 'المقاس', kind: 'size', values: [{ id: 's', labelAr: 'S' }, { id: 'm', labelAr: 'M' }] }];
const variants = [
  { id: 'v-s', selections: { size: 's' }, priceHalalas: 6000 },
  { id: 'v-m', selections: { size: 'm' }, available: false },
];
assert.deepEqual(
  resolveSelection({ basePriceHalalas: 5000, optionsJson: null, variantsJson: null }),
  { variantKey: '', selections: {}, snapshot: [], unitPriceHalalas: 5000 },
);
assert.equal(code(() => resolveSelection({ basePriceHalalas: 5000, optionsJson: null, variantsJson: null, selections: { size: 's' } })), 'SELECTION_INVALID');
const priced = resolveSelection({ basePriceHalalas: 5000, optionsJson: options, variantsJson: variants, selections: { size: 's' } });
assert.equal(priced.variantKey, 'v-s');
assert.equal(priced.unitPriceHalalas, 6000, 'variant price overrides base');
assert.equal(priced.snapshot[0].valueLabelAr, 'S');
assert.equal(resolveSelection({ basePriceHalalas: 5000, optionsJson: options, variantsJson: variants, variantKey: 'v-s' }).selections.size, 's');
assert.equal(code(() => resolveSelection({ basePriceHalalas: 5000, optionsJson: options, variantsJson: variants })), 'SELECTION_REQUIRED');
assert.equal(code(() => resolveSelection({ basePriceHalalas: 5000, optionsJson: options, variantsJson: variants, selections: { size: 'm' } })), 'VARIANT_UNAVAILABLE');
assert.equal(code(() => resolveSelection({ basePriceHalalas: 5000, optionsJson: options, variantsJson: variants, selections: { size: 'xl' } })), 'SELECTION_INVALID');
assert.equal(code(() => resolveSelection({ basePriceHalalas: 5000, optionsJson: options, variantsJson: variants, variantKey: 'nope' })), 'VARIANT_NOT_FOUND');
assert.equal(code(() => resolveSelection({ basePriceHalalas: 0, optionsJson: null, variantsJson: null })), 'PRICE_UNAVAILABLE');
const noVariantRows = resolveSelection({ basePriceHalalas: 5000, optionsJson: options, variantsJson: null, selections: { size: 'm' } });
assert.equal(noVariantRows.variantKey, canonicalVariantKey({ size: 'm' }));
// Delimiter collision proof: distinct maps must not share a key.
const keyA = canonicalVariantKey({ a: 'x|b=y', b: 'z' });
const keyB = canonicalVariantKey({ a: 'x', b: 'y|b=z' });
assert.notEqual(keyA, keyB);
assert.equal(canonicalVariantKey({ b: '1', a: '2' }), canonicalVariantKey({ a: '2', b: '1' }));

// --- idempotency key + contact ------------------------------------------------
assert.equal(normalizeIdempotencyKey(undefined, ' key-1 '), 'key-1');
assert.equal(normalizeIdempotencyKey('header-key', 'body-key'), 'header-key', 'header wins');
assert.equal(code(() => normalizeIdempotencyKey(undefined, '')), 'IDEMPOTENCY_KEY_REQUIRED');
assert.equal(code(() => normalizeIdempotencyKey('bad key!')), 'IDEMPOTENCY_KEY_INVALID');
assert.deepEqual(parseContact({ contactName: ' سارة ', contactPhone: '+966 50 123 4567' }), { contactName: 'سارة', contactPhone: '+966501234567' });
assert.equal(code(() => parseContact({ contactName: 'س', contactPhone: '0501234567' })), 'CONTACT_NAME_INVALID');
assert.equal(code(() => parseContact({ contactName: 'سارة', contactPhone: 'abc' })), 'CONTACT_PHONE_INVALID');

// --- public numbers -----------------------------------------------------------
assert.match(makePublicNumber('MO', new Date('2026-10-01T00:00:00Z')), /^MO-261001-[A-Z2-9]{6}$/);
assert.notEqual(makePublicNumber('MB'), makePublicNumber('MB'));

// --- availability & slots (Asia/Riyadh, UTC+3) --------------------------------
const windows = parseAvailability([
  { weekday: 4, startMin: 600, endMin: 840, capacity: 2 }, // Thursday 10:00-14:00
  { weekday: 9, startMin: 0, endMin: 60, capacity: 1 }, // invalid weekday dropped
  { weekday: 1, startMin: 700, endMin: 600, capacity: 1 }, // inverted dropped
]);
assert.equal(windows.length, 1);
const now = new Date('2026-09-30T08:00:00Z');
const thu = localInstant('2026-10-01', 600)!; // 10:00 local == 07:00Z
assert.equal(thu.toISOString(), '2026-10-01T07:00:00.000Z');
assert.deepEqual(localParts(thu), { weekday: 4, minuteOfDay: 600, dateKey: '2026-10-01' });
assert.equal(localInstant('2026-02-30', 0), null);
assert.equal(checkSlot(thu, 60, windows, now).ok, true);
assert.equal((checkSlot(localInstant('2026-10-01', 780)!, 60, windows, now) as { ok: boolean }).ok, true, '13:00-14:00 fits');
assert.equal((checkSlot(localInstant('2026-10-01', 810)!, 60, windows, now) as { code?: string }).code, 'SLOT_OUTSIDE_AVAILABILITY', 'ends after window');
assert.equal((checkSlot(localInstant('2026-10-01', 615)!, 60, windows, now) as { code?: string }).code, 'SLOT_MISALIGNED');
assert.equal((checkSlot(localInstant('2026-10-02', 600)!, 60, windows, now) as { code?: string }).code, 'SLOT_OUTSIDE_AVAILABILITY', 'Friday not open');
assert.equal((checkSlot(thu, 60, windows, new Date('2026-10-01T06:50:00Z')) as { code?: string }).code, 'SLOT_IN_PAST');
assert.equal((checkSlot(thu, 60, [], now) as { code?: string }).code, 'AVAILABILITY_NOT_CONFIGURED');
assert.equal((checkSlot(thu, 60, windows, new Date('2026-01-01T00:00:00Z')) as { code?: string }).code, 'SLOT_TOO_FAR');

const slots = buildDaySlots('2026-10-01', 60, windows, [{ startsAt: thu, endsAt: new Date(thu.getTime() + 3_600_000) }], now);
assert.equal(slots.length, 4);
assert.equal(slots[0].remaining, 1);
assert.equal(slots[0].available, true);
assert.equal(slots[1].remaining, 2);
assert.equal(buildDaySlots('2026-10-02', 60, windows, [], now).length, 0);

// Overlapping same-resource windows: rejected on save; listing never double-lists.
assert.equal(
  code(() =>
    assertAvailabilityConsistent(
      parseAvailability([
        { weekday: 0, startMin: 600, endMin: 660, capacity: 1 },
        { weekday: 0, startMin: 600, endMin: 660, capacity: 2 },
      ]),
    ),
  ),
  'AVAILABILITY_OVERLAP',
);
const legacyOverlap = parseAvailability([
  { weekday: 0, startMin: 600, endMin: 660, capacity: 1 },
  { weekday: 0, startMin: 600, endMin: 660, capacity: 2 },
]);
const sun = localInstant('2026-10-04', 600)!; // Sunday
const nowSun = new Date('2026-10-01T08:00:00Z');
const heldHalf = [{ startsAt: sun, endsAt: new Date(sun.getTime() + 30 * 60_000) }];
const sunSlots = buildDaySlots('2026-10-04', 60, legacyOverlap, heldHalf, nowSun);
const atTen = sunSlots.filter((s) => s.startsAt === sun.toISOString());
assert.equal(atTen.length, 1, 'one identity for 10:00');
assert.equal(atTen[0].capacity, 1, 'MIN capacity, never sum');
assert.equal(atTen[0].remaining, 0);
assert.equal(atTen[0].available, false);
const okSlot = checkSlot(sun, 60, legacyOverlap, nowSun);
assert.equal(okSlot.ok, true);
if (okSlot.ok) assert.equal(okSlot.capacity, 1);
// Distinct resources may overlap.
assertAvailabilityConsistent(
  parseAvailability([
    { weekday: 0, startMin: 600, endMin: 660, capacity: 1, resourceId: 'room-a' },
    { weekday: 0, startMin: 600, endMin: 660, capacity: 2, resourceId: 'room-b' },
  ]),
);

console.log('commerce.types schema tests passed');
