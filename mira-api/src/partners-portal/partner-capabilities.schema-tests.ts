import assert from 'node:assert/strict';
import { partnerCanCreateKind } from './partner-capabilities';

assert.equal(partnerCanCreateKind('developer', 'product'), true);
assert.equal(partnerCanCreateKind('developer', 'service'), true);
assert.equal(partnerCanCreateKind('brand', 'product'), true);
assert.equal(partnerCanCreateKind('brand', 'service'), false);
assert.equal(partnerCanCreateKind('salon', 'product'), false);
assert.equal(partnerCanCreateKind('salon', 'service'), true);
assert.equal(partnerCanCreateKind('clinic', 'product'), false);
assert.equal(partnerCanCreateKind('clinic', 'service'), true);
assert.equal(partnerCanCreateKind('event_planner', 'service'), true);
assert.equal(partnerCanCreateKind('event_planner', 'product'), false);
assert.equal(partnerCanCreateKind('event_planner', 'product', { canSellProducts: true }), true);
assert.equal(partnerCanCreateKind('event_planner', 'product', { canSellProducts: false }), false);
assert.equal(partnerCanCreateKind('customer', 'product'), false);
assert.equal(partnerCanCreateKind('', 'product'), false);
assert.equal(partnerCanCreateKind(null, 'service'), false);

console.log(JSON.stringify({ ok: true, id: 'PARTNER_CAPABILITIES_MATRIX' }));
