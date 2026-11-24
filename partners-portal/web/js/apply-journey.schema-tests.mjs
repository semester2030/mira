/**
 * Static checks for apply journey: no FileReader, account→offers→matrix order helpers.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const journey = readFileSync(join(dir, 'apply-journey.js'), 'utf8');
const html = readFileSync(join(dir, '../apply.html'), 'utf8');

assert.ok(!/new\s+FileReader\s*\(/.test(journey), 'apply-journey must not use FileReader');
assert.ok(html.includes('data-testid="account-type-grid"'));
assert.ok(html.includes('data-testid="offers-grid"'));
assert.ok(html.includes('apply-journey.js'));
assert.ok(html.includes('ما نوع حسابك؟'));
assert.ok(journey.includes("advertiseForOthers"));
assert.ok(journey.includes('activitiesCatalog'));
assert.ok(journey.includes('placeholderDataUrl'));

console.log('apply-journey.schema-tests: PASS');
