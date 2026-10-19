import assert from 'node:assert/strict';
import { playbackContentType, sliceMediaRange } from './catalog-media.http';

const qt = Buffer.alloc(32);
qt.writeUInt32BE(20, 0);
qt.write('ftyp', 4, 'ascii');
qt.write('qt  ', 8, 'ascii');

assert.deepEqual(sliceMediaRange(100, undefined), { status: 200, start: 0, end: 99, total: 100 });
assert.deepEqual(sliceMediaRange(100, 'bytes=0-1'), { status: 206, start: 0, end: 1, total: 100 });
assert.deepEqual(sliceMediaRange(100, 'bytes=90-'), { status: 206, start: 90, end: 99, total: 100 });
assert.deepEqual(sliceMediaRange(100, 'bytes=-10'), { status: 206, start: 90, end: 99, total: 100 });
assert.equal(sliceMediaRange(100, 'bytes=100-120').status, 416);
assert.equal(playbackContentType(qt, 'video/mp4'), 'video/quicktime');

console.log('catalog-media-http ok');
