import { VIDEO_MAX_DURATION_SECONDS } from './catalog-content.policy';

export const VIDEO_DURATION_REJECTED = 'مدة الفيديو يجب ألا تتجاوز 5 دقائق';

/** Reads mvhd/mdhd from an ISO BMFF file. Returns null when the duration is not in the container. */
export function isoBmffDurationSeconds(bytes: Buffer): number | null {
  const found: number[] = [];
  walk(bytes, 0, bytes.length, found);
  if (found.length === 0) return null;
  return Math.max(...found);
}

export function videoDurationRejection(bytes: Buffer): string | null {
  const seconds = isoBmffDurationSeconds(bytes);
  if (seconds == null) return 'تعذر قراءة مدة الفيديو';
  if (seconds > VIDEO_MAX_DURATION_SECONDS) return VIDEO_DURATION_REJECTED;
  return null;
}

function walk(bytes: Buffer, start: number, end: number, found: number[]): void {
  let offset = start;
  while (offset + 8 <= end) {
    let size = bytes.readUInt32BE(offset);
    const type = bytes.toString('latin1', offset + 4, offset + 8);
    let header = 8;
    if (size === 1) {
      if (offset + 16 > end) return;
      const high = bytes.readUInt32BE(offset + 8);
      const low = bytes.readUInt32BE(offset + 12);
      size = high * 0x100000000 + low;
      header = 16;
    } else if (size === 0) {
      size = end - offset;
    }
    if (!Number.isFinite(size) || size < header || offset + size > end) return;
    const payload = offset + header;
    const payloadEnd = offset + size;
    if (type === 'moov' || type === 'trak' || type === 'mdia') {
      walk(bytes, payload, payloadEnd, found);
    } else if (type === 'mvhd' || type === 'mdhd') {
      const seconds = readMediaHeader(bytes, payload, payloadEnd);
      if (seconds != null && seconds > 0) found.push(seconds);
    }
    offset += size;
  }
}

function readMediaHeader(bytes: Buffer, payload: number, end: number): number | null {
  if (payload >= end) return null;
  const version = bytes[payload];
  if (version === 0) {
    if (payload + 20 > end) return null;
    return seconds(bytes.readUInt32BE(payload + 12), bytes.readUInt32BE(payload + 16));
  }
  if (version === 1) {
    if (payload + 32 > end) return null;
    const high = bytes.readUInt32BE(payload + 24);
    const low = bytes.readUInt32BE(payload + 28);
    return seconds(bytes.readUInt32BE(payload + 20), high * 0x100000000 + low);
  }
  return null;
}

function seconds(timescale: number, duration: number): number | null {
  if (!timescale) return null;
  return duration / timescale;
}
