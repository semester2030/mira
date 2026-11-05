/**
 * P4 availability document — pure unit checks (no DB, no network).
 * Run: npx tsx src/marketplace/availability-document.unit.ts
 * This is NOT portal acceptance; see scripts/p4-availability-acceptance.mjs.
 */
import assert from 'node:assert/strict';
import {
  AVAILABILITY_TIMEZONE,
  buildDaySlots,
  checkSlot,
  dayAvailabilityStatus,
  isValidDateKey,
  localInstant,
  localParts,
  normalizeAvailabilityDocument,
  parseAvailability,
  parseAvailabilityExceptions,
  parseClosedDates,
  type AvailabilityWindow,
} from './commerce.types';

const NOW = new Date('2026-11-01T00:00:00.000Z');
const DATE = '2026-11-10'; // Tuesday
const WEEKDAY = localParts(localInstant(DATE, 720)!).weekday;
assert.equal(WEEKDAY, 2);

const weeklyTue = (capacity = 2, resourceId = ''): AvailabilityWindow => ({
  weekday: WEEKDAY, startMin: 540, endMin: 1020, capacity, resourceId,
});
const at = (dateKey: string, minute: number) => localInstant(dateKey, minute)!;

let checks = 0;
const check = (name: string, fn: () => void) => {
  fn();
  checks += 1;
  console.log(`ok - ${name}`);
};

check('legacy array normalizes to v2 with fixed timezone', () => {
  const legacy = [{ weekday: 0, startMin: 540, endMin: 1020, capacity: 2, resourceId: '' }];
  const doc = normalizeAvailabilityDocument(legacy);
  assert.equal(doc.v, 2);
  assert.equal(doc.timezone, AVAILABILITY_TIMEZONE);
  assert.deepEqual(doc.windows, legacy);
  assert.deepEqual(doc.closedDates, []);
  assert.deepEqual(doc.exceptions, []);
  // parseAvailability stays backward compatible for both shapes.
  assert.deepEqual(parseAvailability(legacy), legacy);
  assert.deepEqual(parseAvailability(doc), legacy);
  assert.deepEqual(parseAvailability(null), []);
  assert.deepEqual(parseAvailability('x'), []);
});

check('timezone is fixed to Asia/Riyadh (lenient coerces, strict rejects)', () => {
  assert.equal(AVAILABILITY_TIMEZONE, 'Asia/Riyadh');
  assert.equal(normalizeAvailabilityDocument({ timezone: 'UTC', windows: [] }).timezone, 'Asia/Riyadh');
  assert.equal(normalizeAvailabilityDocument([]).timezone, 'Asia/Riyadh');
  assert.throws(() => normalizeAvailabilityDocument({ timezone: 'UTC', windows: [] }, { strict: true }));
  assert.throws(() => normalizeAvailabilityDocument({ timezone: 'America/New_York', windows: [] }, { strict: true }));
  assert.equal(
    normalizeAvailabilityDocument({ timezone: 'Asia/Riyadh', windows: [] }, { strict: true }).timezone,
    'Asia/Riyadh',
  );
  // A Riyadh midnight is 21:00 UTC of the previous day — local date must follow Riyadh, not UTC.
  assert.equal(localParts(new Date('2026-11-09T21:30:00.000Z')).dateKey, DATE);
});

check('invalid dates are rejected by validators and strict normalize', () => {
  for (const bad of ['2026-02-30', '2026-13-01', '2026-1-1', '10/11/2026', '2026-11-10T00:00:00Z', '', 'bad']) {
    assert.equal(isValidDateKey(bad), false, bad);
    assert.throws(() => parseClosedDates([bad]), bad);
    assert.throws(() => parseAvailabilityExceptions([{ date: bad, kind: 'closed' }]), bad);
    assert.throws(() => normalizeAvailabilityDocument({ windows: [], closedDates: [bad] }, { strict: true }), bad);
  }
  assert.throws(() => parseClosedDates([20261110 as unknown as string]));
  assert.throws(() => parseClosedDates('2026-11-10'));
  assert.throws(() => parseAvailabilityExceptions([{ date: DATE, kind: 'holiday' }]));
  assert.throws(() => parseAvailabilityExceptions([{ date: DATE, kind: 'special', startMin: 600, endMin: 500 }]));
  assert.throws(() => parseAvailabilityExceptions([{ date: DATE, kind: 'special', startMin: 600, endMin: 700, capacity: 0 }]));
  assert.throws(() =>
    parseAvailabilityExceptions([
      { date: DATE, kind: 'special', startMin: 600, endMin: 700 },
      { date: DATE, kind: 'special', startMin: 650, endMin: 800 },
    ]),
  );
  assert.deepEqual(parseClosedDates(['2026-11-12', DATE, DATE]), [DATE, '2026-11-12']);
  assert.deepEqual(parseClosedDates(null), []);
  // Lenient read path drops garbage instead of throwing.
  const lenient = normalizeAvailabilityDocument({ windows: [], closedDates: ['bad', DATE], exceptions: [{ date: 'bad', kind: 'closed' }] });
  assert.deepEqual(lenient.closedDates, [DATE]);
  assert.deepEqual(lenient.exceptions, []);
});

check('empty document is unconfigured, never available', () => {
  for (const empty of [null, undefined, [], { v: 2, timezone: 'Asia/Riyadh', windows: [], closedDates: [], exceptions: [] }]) {
    assert.equal(dayAvailabilityStatus(DATE, empty), 'unconfigured');
    assert.equal(dayAvailabilityStatus(DATE, empty, { heldCount: 99 }), 'unconfigured');
  }
  assert.equal(dayAvailabilityStatus('not-a-date', [weeklyTue()]), 'unconfigured');
  const slot = checkSlot(at(DATE, 600), 30, normalizeAvailabilityDocument(null), NOW);
  assert.equal(slot.ok, false);
  assert.equal(!slot.ok && slot.code, 'AVAILABILITY_NOT_CONFIGURED');
  assert.deepEqual(buildDaySlots(DATE, 30, [], [], NOW, normalizeAvailabilityDocument(null)), []);
});

check('weekly windows drive status; other weekdays are unavailable', () => {
  const doc = { v: 2, timezone: 'Asia/Riyadh', windows: [weeklyTue()], closedDates: [], exceptions: [] };
  assert.equal(dayAvailabilityStatus(DATE, doc), 'available');
  assert.equal(dayAvailabilityStatus('2026-11-11', doc), 'unavailable'); // Wednesday
  // heldCount omitted → never full; present and >= capacity → full.
  assert.equal(dayAvailabilityStatus(DATE, doc), 'available');
  assert.equal(dayAvailabilityStatus(DATE, doc, { heldCount: 1 }), 'available');
  assert.equal(dayAvailabilityStatus(DATE, doc, { heldCount: 2 }), 'full');
});

check('closed date rejects the slot (and listing)', () => {
  const doc = normalizeAvailabilityDocument({ windows: [weeklyTue()], closedDates: [DATE], exceptions: [] });
  assert.equal(dayAvailabilityStatus(DATE, doc), 'unavailable');
  const slot = checkSlot(at(DATE, 600), 30, doc.windows, NOW, '', doc);
  assert.equal(slot.ok, false);
  assert.equal(!slot.ok && slot.code, 'SLOT_DATE_CLOSED');
  assert.deepEqual(buildDaySlots(DATE, 30, doc.windows, [], NOW, doc), []);
  // Same weekday a week later is still bookable.
  const next = checkSlot(at('2026-11-17', 600), 30, doc.windows, NOW, '', doc);
  assert.equal(next.ok, true);
  // Without the calendar the legacy behaviour is unchanged.
  assert.equal(checkSlot(at(DATE, 600), 30, doc.windows, NOW).ok, true);
});

check('closed exception rejects the slot; resource-scoped closure only hits that resource', () => {
  const doc = normalizeAvailabilityDocument({
    windows: [weeklyTue(1, 'room-a'), weeklyTue(1, 'room-b')],
    exceptions: [{ date: DATE, kind: 'closed', startMin: 1, endMin: 2 }],
  });
  assert.deepEqual(doc.exceptions, [{ date: DATE, kind: 'closed' }]);
  assert.equal(dayAvailabilityStatus(DATE, doc), 'unavailable');
  assert.equal(checkSlot(at(DATE, 600), 30, doc, NOW, 'room-a').ok, false);

  const scoped = normalizeAvailabilityDocument({
    windows: [weeklyTue(1, 'room-a'), weeklyTue(1, 'room-b')],
    exceptions: [{ date: DATE, kind: 'closed', resourceId: 'room-a' }],
  });
  assert.equal(dayAvailabilityStatus(DATE, scoped), 'available');
  assert.equal(checkSlot(at(DATE, 600), 30, scoped, NOW, 'room-a').ok, false);
  assert.equal(checkSlot(at(DATE, 600), 30, scoped, NOW, 'room-b').ok, true);
});

check('special exception overrides weekly windows for that date only', () => {
  const doc = normalizeAvailabilityDocument({
    windows: [weeklyTue(3)], // 09:00-17:00 cap 3
    exceptions: [{ date: DATE, kind: 'special', startMin: 600, endMin: 720, capacity: 1 }], // 10:00-12:00 cap 1
  });
  assert.equal(dayAvailabilityStatus(DATE, doc), 'available');
  assert.equal(checkSlot(at(DATE, 540), 30, doc, NOW).ok, false, 'weekly-only time is overridden');
  assert.equal(checkSlot(at(DATE, 900), 30, doc, NOW).ok, false);
  const inside = checkSlot(at(DATE, 600), 60, doc, NOW);
  assert.equal(inside.ok, true);
  assert.equal(inside.ok && inside.capacity, 1);
  // Day capacity from the special window (1) → full at 1 held.
  assert.equal(dayAvailabilityStatus(DATE, doc, { heldCount: 1 }), 'full');
  // Another Tuesday keeps the weekly hours.
  assert.equal(checkSlot(at('2026-11-17', 540), 30, doc, NOW).ok, true);
  const slots = buildDaySlots(DATE, 60, doc.windows, [], NOW, doc);
  assert.deepEqual(slots.map((s) => s.capacity), [1, 1]);
  assert.equal(slots.length, 2);
});

check('special on a day with no weekly window opens that day; capacity defaults conservatively', () => {
  const doc = normalizeAvailabilityDocument({
    windows: [],
    exceptions: [{ date: DATE, kind: 'special', startMin: 600, endMin: 660 }],
  });
  assert.equal(dayAvailabilityStatus(DATE, doc), 'available');
  // Capacity unknown → never reported full even with a huge heldCount.
  assert.equal(dayAvailabilityStatus(DATE, doc, { heldCount: 50 }), 'available');
  assert.equal(dayAvailabilityStatus('2026-11-17', doc), 'unconfigured');
  assert.equal(checkSlot(at(DATE, 600), 60, doc, NOW).ok, true);
});

check('strict normalize rejects malformed windows; persisted shape is v2', () => {
  assert.throws(() => normalizeAvailabilityDocument([{ weekday: 9, startMin: 1, endMin: 2, capacity: 1 }], { strict: true }));
  assert.throws(() => normalizeAvailabilityDocument({ windows: 'x' }, { strict: true }));
  assert.throws(() => normalizeAvailabilityDocument('x', { strict: true }));
  const doc = normalizeAvailabilityDocument([weeklyTue()], { strict: true });
  assert.deepEqual(Object.keys(doc).sort(), ['closedDates', 'exceptions', 'timezone', 'v', 'windows']);
  // Round trip: a stored v2 document still yields the same weekly windows.
  assert.deepEqual(parseAvailability(JSON.parse(JSON.stringify(doc))), [weeklyTue()]);
});

check('strict rejects wrong closedDates/exceptions types and overlapping specials', () => {
  assert.throws(() => normalizeAvailabilityDocument({ windows: [], closedDates: 'x' }, { strict: true }));
  assert.throws(() => normalizeAvailabilityDocument({ windows: [], exceptions: {} }, { strict: true }));
  assert.throws(() =>
    normalizeAvailabilityDocument(
      {
        windows: [weeklyTue()],
        exceptions: [
          { date: DATE, kind: 'special', startMin: 600, endMin: 700, capacity: 1, resourceId: 'r' },
          { date: DATE, kind: 'special', startMin: 650, endMin: 800, capacity: 1, resourceId: 'r' },
        ],
      },
      { strict: true },
    ),
  );
  assert.throws(() =>
    normalizeAvailabilityDocument(
      {
        windows: [weeklyTue()],
        closedDates: [DATE],
        exceptions: [{ date: DATE, kind: 'special', startMin: 600, endMin: 700, capacity: 1 }],
      },
      { strict: true },
    ),
  );
});

console.log(JSON.stringify({ ok: true, id: 'AVAILABILITY_DOCUMENT_UNIT', checks }));
