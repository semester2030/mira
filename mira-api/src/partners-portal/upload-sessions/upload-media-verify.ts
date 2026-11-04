/**
 * Bounded-memory media verification from a temp file path (streaming; no full Buffer for video).
 */
import { createHash } from 'crypto';
import { createReadStream } from 'fs';
import { open, readFile, stat } from 'fs/promises';
import { IMAGE_MIME, VIDEO_MAX_DURATION_SECONDS, VIDEO_MIME } from '../../marketplace/catalog-content.policy';
import { VIDEO_DURATION_REJECTED } from '../../marketplace/catalog-video-duration';

const SNIFF_HEAD = 64 * 1024;
const HASH_CHUNK = 1024 * 1024;

export type VerifyOk = {
  ok: true;
  sha256: string;
  byteSize: number;
  durationSec: number | null;
  kind: 'image' | 'video';
};

export type VerifyFail = {
  ok: false;
  code: string;
  messageAr: string;
  permanent: boolean;
};

export type VerifyResult = VerifyOk | VerifyFail;

export async function streamSha256(filePath: string): Promise<{ sha256: string; byteSize: number }> {
  const hash = createHash('sha256');
  let byteSize = 0;
  await new Promise<void>((resolve, reject) => {
    const stream = createReadStream(filePath, { highWaterMark: HASH_CHUNK });
    stream.on('data', (chunk: Buffer | string) => {
      const buf = typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
      byteSize += buf.length;
      hash.update(buf);
    });
    stream.on('error', reject);
    stream.on('end', () => resolve());
  });
  return { sha256: hash.digest('hex'), byteSize };
}

async function readHead(filePath: string, max = SNIFF_HEAD): Promise<Buffer> {
  const fh = await open(filePath, 'r');
  try {
    const info = await fh.stat();
    const size = Math.min(max, Number(info.size));
    const buf = Buffer.alloc(size);
    await fh.read(buf, 0, size, 0);
    return buf;
  } finally {
    await fh.close();
  }
}

function sniffHead(mime: string, head: Buffer): boolean {
  if (mime === 'image/png') return head.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (mime === 'image/jpeg') return head.length > 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff;
  if (mime === 'image/webp') {
    return head.length > 12 && head.subarray(0, 4).toString('ascii') === 'RIFF' && head.subarray(8, 12).toString('ascii') === 'WEBP';
  }
  if (mime === 'video/mp4' || mime === 'video/quicktime' || mime === 'video/x-m4v') {
    return head.length >= 8 && head.subarray(4, 8).toString('ascii') === 'ftyp';
  }
  return false;
}

/** Walk ISO-BMFF boxes via random-access reads; require duration + a video track (hdlr vide). */
export async function inspectMp4File(filePath: string): Promise<{
  durationSec: number | null;
  hasVideoTrack: boolean;
  error?: string;
}> {
  const info = await stat(filePath);
  const fileSize = Number(info.size);
  const fh = await open(filePath, 'r');
  const durations: number[] = [];
  let hasVideoTrack = false;

  async function readExact(offset: number, length: number): Promise<Buffer | null> {
    if (offset < 0 || length <= 0 || offset + length > fileSize) return null;
    const buf = Buffer.alloc(length);
    const { bytesRead } = await fh.read(buf, 0, length, offset);
    return bytesRead === length ? buf : null;
  }

  async function walk(start: number, end: number, depth: number): Promise<void> {
    if (depth > 32) return;
    let offset = start;
    while (offset + 8 <= end) {
      const header = await readExact(offset, 16);
      if (!header) return;
      let size = header.readUInt32BE(0);
      const type = header.toString('latin1', 4, 8);
      let headerLen = 8;
      if (size === 1) {
        if (offset + 16 > end) return;
        const high = header.readUInt32BE(8);
        const low = header.readUInt32BE(12);
        size = high * 0x100000000 + low;
        headerLen = 16;
      } else if (size === 0) {
        size = end - offset;
      }
      if (!Number.isFinite(size) || size < headerLen || offset + size > end) return;
      const payload = offset + headerLen;
      const payloadEnd = offset + size;

      if (type === 'moov' || type === 'trak' || type === 'mdia' || type === 'minf' || type === 'stbl') {
        await walk(payload, payloadEnd, depth + 1);
      } else if (type === 'mvhd' || type === 'mdhd') {
        const body = await readExact(payload, Math.min(32, payloadEnd - payload));
        if (body && body.length >= 20) {
          const version = body[0];
          let timescale = 0;
          let duration = 0;
          if (version === 0 && body.length >= 20) {
            timescale = body.readUInt32BE(12);
            duration = body.readUInt32BE(16);
          } else if (version === 1 && body.length >= 32) {
            timescale = body.readUInt32BE(20);
            const high = body.readUInt32BE(24);
            const low = body.readUInt32BE(28);
            duration = high * 0x100000000 + low;
          }
          if (timescale > 0 && duration > 0) durations.push(duration / timescale);
        }
      } else if (type === 'hdlr') {
        const body = await readExact(payload, Math.min(24, payloadEnd - payload));
        if (body && body.length >= 12) {
          const handler = body.toString('latin1', 8, 12);
          if (handler === 'vide') hasVideoTrack = true;
        }
      }
      offset += size;
    }
  }

  try {
    await walk(0, fileSize, 0);
  } finally {
    await fh.close();
  }

  if (durations.length === 0) {
    return { durationSec: null, hasVideoTrack, error: 'تعذر قراءة مدة الفيديو' };
  }
  return { durationSec: Math.max(...durations), hasVideoTrack };
}

/**
 * Verify object at temp path. Images may load fully if ≤ image max (caller enforces size).
 * Videos are never loaded as a single Buffer.
 */
export async function verifyMediaFile(opts: {
  filePath: string;
  mime: string;
  declaredByteSize: number;
  declaredChecksum?: string | null;
  imageMaxBytes: number;
}): Promise<VerifyResult> {
  const info = await stat(opts.filePath);
  const fileSize = Number(info.size);
  if (fileSize !== opts.declaredByteSize) {
    return {
      ok: false,
      code: 'size_mismatch',
      messageAr: 'حجم الملف المخزّن لا يطابق الحجم المعلن',
      permanent: true,
    };
  }

  const mime = opts.mime;
  const image = IMAGE_MIME.has(mime);
  const video = VIDEO_MIME.has(mime);
  if (!image && !video) {
    return { ok: false, code: 'content_mismatch', messageAr: 'نوع الملف غير مقبول', permanent: true };
  }

  const head = await readHead(opts.filePath);
  if (!sniffHead(mime, head)) {
    return {
      ok: false,
      code: 'content_mismatch',
      messageAr: 'محتوى الملف لا يطابق نوعه المعلن',
      permanent: true,
    };
  }

  const { sha256, byteSize } = await streamSha256(opts.filePath);
  if (byteSize !== opts.declaredByteSize) {
    return {
      ok: false,
      code: 'size_mismatch',
      messageAr: 'حجم الملف بعد القراءة لا يطابق الحجم المعلن',
      permanent: true,
    };
  }
  if (opts.declaredChecksum) {
    if (sha256.toLowerCase() !== String(opts.declaredChecksum).trim().toLowerCase()) {
      return {
        ok: false,
        code: 'content_mismatch',
        messageAr: 'بصمة الملف لا تطابق المعلن عند بدء الجلسة',
        permanent: true,
      };
    }
  }

  if (image) {
    if (fileSize > opts.imageMaxBytes) {
      return {
        ok: false,
        code: 'size_mismatch',
        messageAr: 'حجم الصورة يتجاوز الحد المسموح',
        permanent: true,
      };
    }
    // Optional deep sniff for tiny images — still stream-hash only; head already validated.
    return { ok: true, sha256, byteSize, durationSec: null, kind: 'image' };
  }

  // Video: require real video track + duration ≤ 300s — not header-only ftyp.
  const mp4 = await inspectMp4File(opts.filePath);
  if (mp4.error || mp4.durationSec == null) {
    return {
      ok: false,
      code: 'duration_invalid',
      messageAr: mp4.error || 'تعذر قراءة مدة الفيديو',
      permanent: true,
    };
  }
  if (!mp4.hasVideoTrack) {
    return {
      ok: false,
      code: 'content_mismatch',
      messageAr: 'الملف لا يحتوي مسار فيديو صالحًا',
      permanent: true,
    };
  }
  if (mp4.durationSec > VIDEO_MAX_DURATION_SECONDS) {
    return {
      ok: false,
      code: 'duration_invalid',
      messageAr: VIDEO_DURATION_REJECTED,
      permanent: true,
    };
  }

  return {
    ok: true,
    sha256,
    byteSize,
    durationSec: mp4.durationSec,
    kind: 'video',
  };
}

/** Test helper: load small image fully only when under budget (not used for video). */
export async function readSmallImageIfNeeded(filePath: string, maxBytes: number): Promise<Buffer | null> {
  const info = await stat(filePath);
  if (Number(info.size) > maxBytes) return null;
  return readFile(filePath);
}
