import assert from 'node:assert/strict';
import {
  IDENTITY_KINDS,
  SERVICE_MODES,
  providerKindFromIdentity,
} from './partner-activities.types';

assert.ok(IDENTITY_KINDS.shop);
assert.ok(IDENTITY_KINDS.independent);
assert.ok(SERVICE_MODES.client_home);
assert.ok(SERVICE_MODES.provider_home);
assert.notEqual(SERVICE_MODES.client_home, SERVICE_MODES.provider_home);
assert.equal(Object.prototype.hasOwnProperty.call(IDENTITY_KINDS, 'developer'), false);
assert.equal(providerKindFromIdentity(['independent']), 'independent');
assert.equal(providerKindFromIdentity(['salon']), 'facility');
assert.ok(String(SERVICE_MODES.venue).includes('المقر') || SERVICE_MODES.venue.length > 0);

console.log('partner-activities.schema-tests: ok');
