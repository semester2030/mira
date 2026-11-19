/**
 * Shared eligibility basics (HttpException codes match createBooking / visit).
 */
import assert from 'node:assert/strict';
import { HttpException } from '@nestjs/common';
import { assertServiceBookableBasics, servicePlaceModeOf } from './commerce-booking-eligibility';

assert.equal(servicePlaceModeOf({ placeMode: ' home ' }), 'home');
assert.equal(servicePlaceModeOf({ placeMode: null }), null);

try {
  assertServiceBookableBasics({
    nameAr: 'منزلية',
    bookingEnabled: false,
    payMode: 'pay_at_venue',
    priceHalalas: 1000,
    durationMin: 30,
  });
  assert.fail('expected BOOKING_NOT_ENABLED');
} catch (e) {
  assert.ok(e instanceof HttpException);
  assert.equal((e.getResponse() as { code?: string }).code, 'BOOKING_NOT_ENABLED');
}

assert.doesNotThrow(() =>
  assertServiceBookableBasics({
    nameAr: 'مقر',
    bookingEnabled: true,
    payMode: 'pay_at_venue',
    priceHalalas: 15000,
    durationMin: 45,
  }),
);

console.log('OK commerce-booking-eligibility schema');
