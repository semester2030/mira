import assert from 'node:assert/strict';
import { BadRequestException } from '@nestjs/common';
import { normalizeProductCommerce, publicProductCommerce, publicServiceCommerce } from './commerce-public';

const base = { purchaseMode: 'internal_cod', stockQty: 10, reservedQty: 3, deliveryFeeHalalas: null, optionsJson: null, variantsJson: null };

// Public product output never exposes reservedQty and reports sellable units.
const pub = publicProductCommerce(base);
assert.equal(pub.stockQty, 7);
assert.equal(pub.stockAvailable, true);
assert.equal(pub.deliveryFeeHalalas, null);
assert.equal('reservedQty' in pub, false);
assert.equal(publicProductCommerce({ ...base, stockQty: 3 }).stockAvailable, false);
assert.equal(publicProductCommerce({ ...base, stockQty: null }).stockQty, null);
assert.equal(publicProductCommerce({ ...base, stockQty: null }).stockAvailable, true);
assert.equal(publicProductCommerce({ ...base, purchaseMode: 'weird' }).purchaseMode, 'external');

// Options are passed through only when valid.
const groups = [{ id: 'size', labelAr: 'المقاس', values: [{ id: 's', labelAr: 'S' }] }];
assert.deepEqual(publicProductCommerce({ ...base, optionsJson: groups }).optionsJson, groups);
assert.equal(publicProductCommerce({ ...base, optionsJson: [{ nope: 1 }] }).optionsJson, null);

// Services.
const svc = publicServiceCommerce({ bookingEnabled: true, payMode: 'pay_at_venue', availabilityJson: [{ weekday: 1, startMin: 540, endMin: 600, capacity: 1 }] });
assert.equal(svc.availabilityPresent, true);
assert.equal(publicServiceCommerce({ bookingEnabled: false, payMode: 'pay_at_venue', availabilityJson: null }).availabilityPresent, false);

// Merchant input.
function bad(fn: () => unknown): void {
  assert.throws(fn, BadRequestException);
}
bad(() => normalizeProductCommerce({ purchaseMode: 'cash' }, null, 100));
bad(() => normalizeProductCommerce({ stockQty: -1 }, null, 100));
bad(() => normalizeProductCommerce({ deliveryFeeHalalas: 1.5 }, null, 100));
bad(() => normalizeProductCommerce({ optionsJson: [{ id: '' }] }, null, 100));
bad(() => normalizeProductCommerce({ purchaseMode: 'internal_cod' }, null, 0));
bad(() => normalizeProductCommerce({ stockQty: 2 }, { purchaseMode: 'internal_cod', reservedQty: 3, priceHalalas: 100 }, 100));
// Switching an existing internal product's price to zero is refused.
bad(() => normalizeProductCommerce({}, { purchaseMode: 'internal_cod', reservedQty: 0, priceHalalas: 100 }, 0));

assert.deepEqual(normalizeProductCommerce({ purchaseMode: 'internal_cod', stockQty: null, deliveryFeeHalalas: null }, null, 2500), {
  purchaseMode: 'internal_cod',
  stockQty: null,
  deliveryFeeHalalas: null,
});
assert.equal(normalizeProductCommerce({ optionsJson: [] }, null, 100).optionsJson, null);
assert.deepEqual(normalizeProductCommerce({}, null, 0), {});

console.log('commerce-public schema tests passed');
