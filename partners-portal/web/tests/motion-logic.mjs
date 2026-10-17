import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const code = readFileSync(join(root, 'js/motion.js'), 'utf8');
const window = {};
vm.runInNewContext(code, { window });
const motion = window.MiraMotion;

assert.equal(motion.statNumber(null), null);
assert.equal(motion.statNumber(undefined), null);
assert.equal(motion.statNumber(''), null);
assert.equal(motion.statNumber(0), 0);
assert.equal(motion.statNumber('12'), 12);
assert.equal(motion.statNumber('لا'), null);

const waiting = motion.describeMedia({ status: 'جارٍ الرفع', percent: null });
assert.equal(waiting.mode, 'wait');
assert.equal(waiting.percent, null);
assert.equal(waiting.label.includes('%'), false);

const known = motion.describeMedia({ status: 'جارٍ الرفع', percent: 0.4 });
assert.equal(known.mode, 'determinate');
assert.equal(known.label.includes('40%'), true);

const processing = motion.describeMedia({ status: 'جارٍ المعالجة', percent: 1 });
assert.equal(processing.mode, 'wait');
assert.equal(processing.percent, null);
assert.equal(processing.label.includes('%'), false);

const done = motion.describeMedia({ status: 'رُفع', percent: 1 });
assert.equal(done.mode, 'done');

const failed = motion.describeMedia({ status: 'فشل', error: 'رفض الخادم الملف' });
assert.equal(failed.mode, 'fail');
assert.equal(failed.label.includes('رفض الخادم الملف'), true);

console.log('MOTION_LOGIC_PASS');
