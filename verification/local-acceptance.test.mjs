import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluateDesktopGeometry, evaluateFullServiceLayout, compareAvailabilitySnapshot }
  from '../mira-api/src/marketplace/taxonomy/elegance-e2c-acceptance-evaluators.ts';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const geom = JSON.parse(fs.readFileSync(path.join(root, 'verification/fixtures/geom-match.json'))).geomMatch;
test('geometry accepts the previously accepted measured layout', () => {
  assert.equal(evaluateDesktopGeometry(geom).ok, true);
});
for (const key of ['previewTop', 'basicsTop', 'previewWidth', 'fieldsLeft', 'viewportWidth']) {
  for (const value of [undefined, null, NaN, -1]) {
    test(`geometry rejects ${key}=${String(value)}`, () => {
      assert.equal(evaluateDesktopGeometry({ ...geom, [key]: value }).ok, false);
    });
  }
}
test('geometry rejects a distant preview and expanded weekly editor', () => {
  assert.equal(evaluateDesktopGeometry({ ...geom, previewTop: 100000 }).ok, false);
  assert.equal(evaluateDesktopGeometry({ ...geom, weeklyEditOpen: true }).ok, false);
});

const expected = {
  availability: {
    v: 2, timezone: 'Asia/Riyadh',
    windows: [
      { weekday: 0, startMin: 600, endMin: 840, capacity: 2, resourceId: 'room-a' },
      { weekday: 3, startMin: 900, endMin: 1020, capacity: 3, resourceId: 'room-b' },
    ],
    closedDates: ['2026-12-01', '2026-12-02'],
    exceptions: [
      { date: '2026-12-03', kind: 'closed', resourceId: 'room-a' },
      { date: '2026-12-04', kind: 'special', startMin: 660, endMin: 780, capacity: 1, resourceId: 'room-b' },
    ],
  },
  placeMode: 'branch', branchId: 'owned-branch',
};
test('full comparison tolerates row reordering without losing values', () => {
  const reordered = structuredClone(expected);
  for (const key of ['windows', 'exceptions', 'closedDates']) reordered.availability[key].reverse();
  assert.equal(compareAvailabilitySnapshot(expected, reordered).ok, true);
});
const mutations = {
  missingDay: x => x.availability.closedDates.pop(),
  missingException: x => x.availability.exceptions.pop(),
  wrongExceptionDate: x => { x.availability.exceptions[1].date = '2099-01-01'; },
  wrongExceptionCapacity: x => { x.availability.exceptions[1].capacity = 9; },
  missingNeighborWindow: x => x.availability.windows.pop(),
  wrongWindowTime: x => { x.availability.windows[1].startMin = 901; },
  wrongResource: x => { x.availability.windows[1].resourceId = 'room-c'; },
  wrongTimezone: x => { x.availability.timezone = 'UTC'; },
  wrongBranch: x => { x.branchId = 'other'; },
  wrongPlace: x => { x.placeMode = 'home'; },
  duplicateWindow: x => x.availability.windows.push(x.availability.windows[0]),
  missingDocument: x => { delete x.availability; },
  missingClosedDates: x => { delete x.availability.closedDates; },
  invalidCapacity: x => { x.availability.windows[0].capacity = 0; },
};
for (const [name, mutate] of Object.entries(mutations)) {
  test(`full comparison rejects ${name}`, () => {
    const changed = structuredClone(expected); mutate(changed);
    assert.equal(compareAvailabilitySnapshot(expected, changed).ok, false);
  });
}
test('comparator handles exceptions-only and explicit clearing (not persistence proof)', () => {
  const only = structuredClone(expected); only.availability.windows = [];
  assert.equal(compareAvailabilitySnapshot(only, only).ok, true);
  const cleared = structuredClone(only);
  cleared.availability.exceptions = []; cleared.availability.closedDates = [];
  assert.equal(compareAvailabilitySnapshot(only, cleared).ok, false);
  assert.equal(compareAvailabilitySnapshot(cleared, cleared).ok, true);
  assert.equal(compareAvailabilitySnapshot(cleared, {}).ok, false);
});
test('whole-form order rejects sections above compose or outside the advanced fold', () => {
  const baseline = {
    formRoles: ['compose', 'advanced', 'preview-publish', 'editor-actions'],
    advancedRoles: ['detail-media', 'details', 'commerce'], advancedOpen: false,
  };
  assert.equal(evaluateFullServiceLayout(baseline).ok, true);
  assert.equal(evaluateFullServiceLayout({ ...baseline, formRoles: ['detail-media', ...baseline.formRoles] }).ok, false);
  assert.equal(evaluateFullServiceLayout({ ...baseline, advancedRoles: ['details'] }).ok, false);
  assert.equal(evaluateFullServiceLayout({ ...baseline, advancedOpen: true }).ok, false);
});

