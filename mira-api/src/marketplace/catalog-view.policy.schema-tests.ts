import assert from 'node:assert/strict';
import { refuseQualifiedView } from './catalog-view.policy';

// Warm / incomplete payload → refuse (client must not count).
assert.equal(
  refuseQualifiedView({
    targetKind: 'product',
    targetId: 'p1',
    eventType: 'qualified_view',
  }),
  'invalid',
);

// Valid qualified view payload accepted by policy gate.
assert.equal(
  refuseQualifiedView({
    targetKind: 'product',
    targetId: 'p1',
    eventId: 'qv-device-a-1',
    eventType: 'qualified_view',
    policyVersion: 'approved_v1',
  }),
  null,
);

// Client-supplied total is refused.
assert.equal(
  refuseQualifiedView({
    targetKind: 'product',
    targetId: 'p1',
    eventId: 'qv-1',
    eventType: 'qualified_view',
    count: 9,
  }),
  'client-total',
);

console.log('catalog-view.policy.schema-tests: ok');
