/**
 * Ask Mira chip journey: occasion → wedding → guest → dress photo.
 */
import assert from 'node:assert/strict';
import { decideIntent, extractSignals, type SessionDiscoveryContext } from './intent';

function turn(msg: string, session: SessionDiscoveryContext | null) {
  const signals = extractSignals(msg, { session });
  const intent = decideIntent(signals, session);
  return intent;
}

let session: SessionDiscoveryContext | null = null;

let g = turn('عندي مناسبة', session);
assert.equal(g.kind, 'clarify');
assert.ok(g.blockers.includes('ambiguous_occasion'));
assert.deepEqual(g.choiceChipsAr.slice(0, 1), ['زفاف']);
assert.equal(g.askAr, null);
session = g.sessionPatch;

g = turn('زفاف', session);
assert.equal(g.kind, 'clarify');
assert.ok(g.blockers.includes('ambiguous_wedding'));
assert.ok(g.replyAr.includes('دورك'));
assert.ok(!g.replyAr.includes('\n'));
assert.deepEqual(g.choiceChipsAr, ['أنا العروس', 'أنا ضيفة', 'أرتّب الحفل لشخص آخر']);
assert.equal(g.askAr, null);
session = g.sessionPatch;
assert.equal(session?.occasion, 'wedding');

g = turn('أنا ضيفة', session);
assert.equal(g.kind, 'clarify');
assert.ok(g.blockers.includes('guest_need_goal'));
assert.deepEqual(g.choiceChipsAr, ['أختار فستان', 'أنسّق فستان عندي', 'أبي مكياج وشعر']);
session = g.sessionPatch;
assert.equal(session?.weddingRole, 'guest');

g = turn('أنسّق فستان عندي', session);
assert.equal(g.kind, 'clarify');
assert.ok(g.blockers.includes('guest_coord_dress'));
assert.ok(g.choiceChipsAr.includes('أرسل صورة الفستان'));
session = g.sessionPatch;

g = turn('أبي مكياج وشعر', {
  occasion: 'wedding',
  weddingRole: 'guest',
  guestLookStep: 'need_goal',
});
assert.equal(g.kind, 'clarify');
assert.ok(g.blockers.includes('guest_makeup_place'));
assert.deepEqual(g.choiceChipsAr, ['في الصالون', 'في البيت', 'في القاعة']);

console.log('OK ask-mira chips journey');
