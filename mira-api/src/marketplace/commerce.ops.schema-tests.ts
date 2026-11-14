/**
 * Pure ops helpers — no DB.
 * Run: npx tsx src/marketplace/commerce.ops.schema-tests.ts
 */
import assert from 'node:assert/strict';
import {
  actorDisplayAr,
  bookingOpsHint,
  isPublicBookingRef,
  isPublicOrderRef,
  orderOpsHint,
} from './commerce.ops';

assert.equal(isPublicOrderRef('MO-261114-ABC123'), true);
assert.equal(isPublicOrderRef('uuid-here'), false);
assert.equal(isPublicBookingRef('MB-261114-XYZ789'), true);

const newHint = orderOpsHint('new', 'uncollected', 'customer');
assert.match(newHint.nextActionAr, /قبول|بانتظار/);
assert.equal(newHint.responsibleRole, 'partner');

const deliveredUncollected = orderOpsHint('delivered', 'uncollected', 'partner');
assert.match(deliveredUncollected.nextActionAr, /نقد|تحصيل/);
assert.notEqual(deliveredUncollected.nextActionAr.includes('مكتمل'), true);

const collected = orderOpsHint('delivered', 'collected', 'admin');
assert.equal(collected.responsibleRole, 'none');

const bookingRequested = bookingOpsHint('requested', 'customer');
assert.match(bookingRequested.nextActionAr, /موافقة|بانتظار/);
assert.equal(bookingOpsHint('completed', 'partner').responsibleRole, 'none');

assert.match(actorDisplayAr('admin', 'admin-key'), /مشترك|مفتاح/);
assert.match(actorDisplayAr('admin', 'ops.sara'), /ops\.sara/);
assert.equal(actorDisplayAr('customer', 'u1'), 'العميلة');

console.log('commerce.ops.schema-tests PASS');
