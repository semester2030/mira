import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { VIDEO_MAX_BYTES, VIDEO_MAX_DURATION_SECONDS } from './catalog-content.policy';
import { VIDEO_DURATION_REJECTED, isoBmffDurationSeconds, videoDurationRejection } from './catalog-video-duration';

function box(type: string, payload: Buffer): Buffer {
  const header = Buffer.alloc(8);
  header.writeUInt32BE(8 + payload.length, 0);
  header.write(type, 4, 'latin1');
  return Buffer.concat([header, payload]);
}

function mvhd(timescale: number, duration: number): Buffer {
  const payload = Buffer.alloc(20);
  payload.writeUInt32BE(timescale, 12);
  payload.writeUInt32BE(duration, 16);
  return box('mvhd', payload);
}

function mp4(seconds: number): Buffer {
  const ftyp = box('ftyp', Buffer.from('isom'));
  const movie = box('moov', mvhd(1000, seconds * 1000));
  return Buffer.concat([ftyp, movie]);
}

const exact = isoBmffDurationSeconds(mp4(VIDEO_MAX_DURATION_SECONDS));
assert.equal(exact, 300);
assert.equal(videoDurationRejection(mp4(300)), null);
assert.equal(videoDurationRejection(mp4(301)), VIDEO_DURATION_REJECTED);
assert.equal(videoDurationRejection(Buffer.concat([box('ftyp', Buffer.from('isom')), box('moov', Buffer.from('no-header'))])), 'تعذر قراءة مدة الفيديو');
assert.equal(VIDEO_MAX_BYTES, 70 * 1024 * 1024);
assert.equal(VIDEO_MAX_BYTES > 20 * 1024 * 1024, true);

async function main(): Promise<void> {
  const sample = await readFile(join(process.cwd(), 'src/marketplace/fixtures/ph3-rc3-sample.mp4'));
  const sampleSeconds = isoBmffDurationSeconds(sample);
  assert.ok(sampleSeconds != null && sampleSeconds <= VIDEO_MAX_DURATION_SECONDS, `sample duration ${sampleSeconds}`);
  console.log('catalog-video-duration ok', sampleSeconds);
}

void main();

