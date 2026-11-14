/**
 * Run: npx tsx src/common/admin-staff.schema-tests.ts
 */
import assert from 'node:assert/strict';
import { loadAdminStaff, resolveAdminSession } from './admin-staff';

const staff = loadAdminStaff({
  MIRA_ADMIN_STAFF: 'ops.support:support:readSecret,ops.sara:supervisor:writeSecret',
} as NodeJS.ProcessEnv);
assert.equal(staff.length, 2);

const support = resolveAdminSession({
  key: 'readSecret',
  masterKey: 'master',
  staff,
});
assert.equal(support?.actorId, 'ops.support');
assert.equal(support?.role, 'support');
assert.equal(support?.canMutate, false);
assert.equal(support?.source, 'staff-secret');

const supervisor = resolveAdminSession({
  key: 'writeSecret',
  actorHeader: 'someone.else',
  masterKey: 'master',
  staff,
});
assert.equal(supervisor?.actorId, 'ops.sara');
assert.equal(supervisor?.canMutate, true);
// Staff secret wins over spoofed X-Admin-Actor
assert.notEqual(supervisor?.actorId, 'someone.else');

const shared = resolveAdminSession({
  key: 'master',
  actorHeader: 'ops.label',
  masterKey: 'master',
  staff,
});
assert.equal(shared?.role, 'shared');
assert.equal(shared?.actorId, 'admin-key');
assert.equal(shared?.canMutate, true);
assert.notEqual(shared?.actorId, 'ops.label');

assert.equal(
  resolveAdminSession({ key: 'nope', masterKey: 'master', staff }),
  null,
);

console.log('admin-staff.schema-tests PASS');
