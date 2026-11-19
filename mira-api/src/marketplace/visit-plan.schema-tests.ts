import assert from 'node:assert/strict';
import {
  consecutiveStartsAlign,
  encodeVisitPlanNote,
  extractVisitPlanFromNotes,
  parseVisitPlan,
} from './visit-plan';

const plan = parseVisitPlan({
  mode: 'consecutive',
  groupId: 'g1',
  sequence: 2,
  peerServiceIds: ['a', 'b'],
  branchId: 'br1',
  expectedStartsAt: '2026-11-20T14:45:00.000Z',
});
assert.ok(plan);
assert.equal(plan!.mode, 'consecutive');
assert.equal(plan!.sequence, 2);

const notes = encodeVisitPlanNote(plan!, 'ملاحظة');
assert.match(notes, /mira_visit_plan/);
assert.match(notes, /ملاحظة/);
const round = extractVisitPlanFromNotes(notes);
assert.equal(round?.groupId, 'g1');
assert.equal(round?.sequence, 2);

const end = new Date('2026-11-20T14:45:00.000Z');
const start = new Date('2026-11-20T14:45:30.000Z');
assert.equal(consecutiveStartsAlign(end, start), true);
assert.equal(consecutiveStartsAlign(end, new Date('2026-11-20T15:00:00.000Z')), false);

assert.equal(parseVisitPlan({ mode: 'nope' }), null);
console.log('OK visit-plan schema');
