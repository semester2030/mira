/**
 * Bounded-memory media verification from a temp file path.
 * Images: sharp decode (rejects header-only / truncated).
 * Videos: ffprobe for real streams + duration (rejects synthetic box-only MP4).
 * Never loads full video into a single Buffer / Base64.
 */
import { createHash } from 'crypto';
import { spawn } from 'child_process';
import { createReadStream } from 'fs';
import { open, stat } from 'fs/promises';
import sharp from 'sharp';
import { IMAGE_MIME, VIDEO_MAX_DURATION_SECONDS, VIDEO_MIME } from '../../marketplace/catalog-content.policy';
import { VIDEO_DURATION_REJECTED } from '../../marketplace/catalog-video-duration';

const HASH_CHUNK = 1024 * 1024;
const FFPROBE_TIMEOUT_MS = Math.max(
  5_000,
  Number(process.env.MIRA_UPLOAD_FFPROBE_TIMEOUT_MS || '30000') || 30_000,
);
/** Reject tiny “header-only” images before sharp (PNG signature alone is 8 bytes). */
const MIN_IMAGE_BYTES = 32;
/** Reject box-only MP4 stubs; real clips with a coded frame are larger. */
const MIN_VIDEO_BYTES = 1024;

export type VerifyOk = {
  ok: true;
  sha256: string;
  byteSize: number;
  durationSec: number | null;
  kind: 'image' | 'video';
  codec?: string | null;
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

async function readHead(filePath: string, max = 64): Promise<Buffer> {
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
  if (mime === 'image/png') {
    return head.length >= 8 && head.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  }
  if (mime === 'image/jpeg') return head.length > 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff;
  if (mime === 'image/webp') {
    return head.length > 12 && head.subarray(0, 4).toString('ascii') === 'RIFF' && head.subarray(8, 12).toString('ascii') === 'WEBP';
  }
  if (mime === 'video/mp4' || mime === 'video/quicktime' || mime === 'video/x-m4v') {
    return head.length >= 8 && head.subarray(4, 8).toString('ascii') === 'ftyp';
  }
  return false;
}

type FfprobeOut = {
  format?: { duration?: string; format_name?: string };
  streams?: Array<{
    codec_type?: string;
    codec_name?: string;
    duration?: string;
    width?: number;
    height?: number;
    nb_frames?: string;
  }>;
};

function runFfprobe(filePath: string): Promise<FfprobeOut> {
  return new Promise((resolve, reject) => {
    const args = [
      '-v',
      'error',
      '-print_format',
      'json',
      '-show_format',
      '-show_streams',
      filePath,
    ];
    const child = spawn('ffprobe', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    const chunks: Buffer[] = [];
    const errChunks: Buffer[] = [];
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error('ffprobe-timeout'));
    }, FFPROBE_TIMEOUT_MS);
    child.stdout.on('data', (c) => chunks.push(c));
    child.stderr.on('data', (c) => errChunks.push(c));
    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(`ffprobe-exit-${code}: ${Buffer.concat(errChunks).toString('utf8').slice(0, 200)}`));
        return;
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}') as FfprobeOut);
      } catch (error) {
        reject(error);
      }
    });
  });
}

async function verifyImageDecodable(filePath: string, mime: string): Promise<VerifyFail | null> {
  try {
    const pipeline = sharp(filePath, {
      failOn: 'error',
      sequentialRead: true,
      limitInputPixels: 64 * 1024 * 1024,
    });
    const meta = await pipeline.metadata();
    if (!meta.width || !meta.height || meta.width < 1 || meta.height < 1) {
      return {
        ok: false,
        code: 'content_mismatch',
        messageAr: 'الصورة غير قابلة للقراءة أو بلا أبعاد صالحة',
        permanent: true,
      };
    }
    // Force a decode pass (not just header parse) without keeping a full RGBA buffer longer than needed.
    await pipeline.rotate().raw().toBuffer({ resolveWithObject: false });
    if (mime === 'image/png' && meta.format && meta.format !== 'png') {
      return { ok: false, code: 'content_mismatch', messageAr: 'صيغة الصورة لا تطابق المعلن', permanent: true };
    }
    if (mime === 'image/jpeg' && meta.format && meta.format !== 'jpeg') {
      return { ok: false, code: 'content_mismatch', messageAr: 'صيغة الصورة لا تطابق المعلن', permanent: true };
    }
    if (mime === 'image/webp' && meta.format && meta.format !== 'webp') {
      return { ok: false, code: 'content_mismatch', messageAr: 'صيغة الصورة لا تطابق المعلن', permanent: true };
    }
    return null;
  } catch {
    return {
      ok: false,
      code: 'content_mismatch',
      messageAr: 'محتوى الصورة تالف أو غير مكتمل',
      permanent: true,
    };
  }
}

async function verifyVideoWithFfprobe(filePath: string): Promise<
  | { ok: true; durationSec: number; codec: string }
  | VerifyFail
> {
  let probe: FfprobeOut;
  try {
    probe = await runFfprobe(filePath);
  } catch (error) {
    const msg = String((error as Error)?.message || error);
    if (msg.includes('ENOENT') || msg.includes('ffprobe')) {
      // Prefer fail closed when probe binary missing in production-like verify path.
      return {
        ok: false,
        code: 'content_mismatch',
        messageAr: 'تعذر فحص الفيديو: أداة التحقق غير متاحة',
        permanent: true,
      };
    }
    return {
      ok: false,
      code: 'content_mismatch',
      messageAr: 'ملف الفيديو تالف أو غير صالح',
      permanent: true,
    };
  }

  const videoStreams = (probe.streams || []).filter((s) => s.codec_type === 'video');
  if (!videoStreams.length) {
    return {
      ok: false,
      code: 'content_mismatch',
      messageAr: 'الملف لا يحتوي مسار فيديو صالحًا',
      permanent: true,
    };
  }
  const vs = videoStreams[0];
  const codec = String(vs.codec_name || '').toLowerCase();
  const allowed = new Set(['h264', 'hevc', 'h265', 'mpeg4', 'vp9', 'av1']);
  if (!codec || !allowed.has(codec)) {
    return {
      ok: false,
      code: 'content_mismatch',
      messageAr: 'ترميز الفيديو غير مدعوم',
      permanent: true,
    };
  }
  if (!vs.width || !vs.height || vs.width < 2 || vs.height < 2) {
    return {
      ok: false,
      code: 'content_mismatch',
      messageAr: 'أبعاد الفيديو غير صالحة',
      permanent: true,
    };
  }

  let durationSec =
    Number(probe.format?.duration) ||
    Number(vs.duration) ||
    NaN;
  if (!Number.isFinite(durationSec) || durationSec <= 0) {
    return {
      ok: false,
      code: 'duration_invalid',
      messageAr: 'تعذر قراءة مدة الفيديو',
      permanent: true,
    };
  }
  if (durationSec > VIDEO_MAX_DURATION_SECONDS) {
    return {
      ok: false,
      code: 'duration_invalid',
      messageAr: VIDEO_DURATION_REJECTED,
      permanent: true,
    };
  }
  return { ok: true, durationSec, codec };
}

/**
 * Verify object at temp path. Videos never loaded as one Buffer.
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

  if (image && fileSize < MIN_IMAGE_BYTES) {
    return {
      ok: false,
      code: 'content_mismatch',
      messageAr: 'ملف الصورة أصغر من أن يكون محتوى صالحًا',
      permanent: true,
    };
  }
  if (video && fileSize < MIN_VIDEO_BYTES) {
    return {
      ok: false,
      code: 'content_mismatch',
      messageAr: 'ملف الفيديو أصغر من أن يكون محتوى صالحًا',
      permanent: true,
    };
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
    const imageFail = await verifyImageDecodable(opts.filePath, mime);
    if (imageFail) return imageFail;
    return { ok: true, sha256, byteSize, durationSec: null, kind: 'image' };
  }

  const probed = await verifyVideoWithFfprobe(opts.filePath);
  if (!('durationSec' in probed) || !probed.ok) return probed;

  return {
    ok: true,
    sha256,
    byteSize,
    durationSec: probed.durationSec,
    kind: 'video',
    codec: probed.codec,
  };
}
