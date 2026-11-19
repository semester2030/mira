/**
 * Consecutive visit request parsing + fingerprint stability (RC4).
 */
import assert from 'node:assert/strict';
import { parseVisitItems, visitRequestFingerprint } from './commerce-visit';

const items = parseVisitItems([
  { serviceId: 's1', startsAt: '2026-11-19T14:00:00.000Z', resourceId: 'r1' },
  { serviceId: 's2', startsAt: '2026-11-19T14:45:00.000Z' },
]);
assert.equal(items.length, 2);
assert.equal(items[0].resourceId, 'r1');
assert.equal(items[1].resourceId, '');

assert.throws(() => parseVisitItems([{ serviceId: 's1', startsAt: '2026-11-19T14:00:00.000Z' }]), /VISIT/);
assert.throws(
  () =>
    parseVisitItems([
      { serviceId: 's1', startsAt: '2026-11-19T14:00:00.000Z' },
      { serviceId: 's2', startsAt: '2026-11-19T14:45:00.000Z' },
      { serviceId: 's3', startsAt: '2026-11-19T15:15:00.000Z' },
    ]),
  (e: { code?: string }) => e?.code === 'VISIT_ITEMS_EXACTLY_TWO',
);

const fp1 = visitRequestFingerprint({
  mode: 'consecutive',
  branchId: 'b1',
  contactName: 'نورة',
  contactPhone: '+966500000001',
  notes: null,
  items: [
    { serviceId: 's1', startsAt: '2026-11-19T14:00:00.000Z', resourceId: 'r1' },
    { serviceId: 's2', startsAt: '2026-11-19T14:45:00.000Z', resourceId: '' },
  ],
});
const fp2 = visitRequestFingerprint({
  mode: 'consecutive',
  branchId: 'b1',
  contactName: 'نورة',
  contactPhone: '+966500000001',
  notes: null,
  items: [
    { serviceId: 's1', startsAt: '2026-11-19T14:00:00.000Z', resourceId: 'r1' },
    { serviceId: 's2', startsAt: '2026-11-19T14:45:00.000Z', resourceId: '' },
  ],
});
const fpChanged = visitRequestFingerprint({
  mode: 'consecutive',
  branchId: 'b1',
  contactName: 'نورة',
  contactPhone: '+966500000001',
  notes: null,
  items: [
    { serviceId: 's1', startsAt: '2026-11-19T15:00:00.000Z', resourceId: 'r1' },
    { serviceId: 's2', startsAt: '2026-11-19T15:45:00.000Z', resourceId: '' },
  ],
});
assert.equal(fp1, fp2);
assert.notEqual(fp1, fpChanged);

console.log('OK commerce-visit schema');
