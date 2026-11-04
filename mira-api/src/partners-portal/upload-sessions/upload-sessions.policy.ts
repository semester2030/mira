import { IMAGE_MIME, VIDEO_MIME, VIDEO_MAX_DURATION_SECONDS } from '../../marketplace/catalog-content.policy';

/** Fixed part size for P2.1 (except last part). */
export const UPLOAD_PART_SIZE_BYTES = 16 * 1024 * 1024;
/** Browser concurrent part uploads. */
export const UPLOAD_PART_CONCURRENCY = 2;
/** Per-part client retry budget. */
export const UPLOAD_PART_MAX_RETRIES = 3;
/** Presigned / direct-part URL lifetime. */
export const UPLOAD_PART_URL_TTL_SECONDS = 15 * 60;
/** Incomplete session cleanup window (contract proposed 24h — adopted). */
export const UPLOAD_SESSION_TTL_HOURS = 24;
/** Image limit for UploadSession path (specs/07-MEDIA.md). */
export const UPLOAD_IMAGE_MAX_BYTES = 20 * 1024 * 1024;
/** Default large-object guard for video (configurable via env). Cap near Prisma Int max. */
export const UPLOAD_VIDEO_MAX_BYTES_DEFAULT = 2 * 1024 * 1024 * 1024 - 1;
/** Concurrent finalize workers process-wide. */
export const UPLOAD_FINALIZE_CONCURRENCY = Math.max(
  1,
  Number(process.env.MIRA_UPLOAD_FINALIZE_CONCURRENCY || '2') || 2,
);
/** Max finalize attempts before permanent failure for retryable errors. */
export const UPLOAD_FINALIZE_MAX_ATTEMPTS = Math.max(
  1,
  Number(process.env.MIRA_UPLOAD_FINALIZE_MAX_ATTEMPTS || '5') || 5,
);
/** Lease duration for finalize ownership. */
export const UPLOAD_FINALIZE_LEASE_MS = Math.max(
  30_000,
  Number(process.env.MIRA_UPLOAD_FINALIZE_LEASE_MS || String(5 * 60 * 1000)) || 5 * 60 * 1000,
);

export { IMAGE_MIME, VIDEO_MIME, VIDEO_MAX_DURATION_SECONDS };

export const UPLOAD_SESSION_STATUSES = [
  'created',
  'uploading',
  'uploaded',
  'verifying',
  'ready',
  'failed',
  'aborted',
] as const;

export type UploadSessionStatus = (typeof UPLOAD_SESSION_STATUSES)[number];

export function uploadSessionEnabled(): boolean {
  const raw = (process.env.MIRA_PARTNER_UPLOAD_SESSION ?? '').trim().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on';
}

/** Memory direct-parts path: never in production. */
export function uploadDirectPartsAllowed(): boolean {
  const production = (process.env.NODE_ENV ?? '').toLowerCase() === 'production';
  if (production) return false;
  const store = (process.env.MIRA_MEDIA_STORE ?? '').trim().toLowerCase();
  if (store === 's3') return false;
  const force = (process.env.MIRA_UPLOAD_ALLOW_DIRECT_PARTS ?? '').trim().toLowerCase();
  if (force === '0' || force === 'false' || force === 'no') return false;
  return true;
}

export function uploadVideoMaxBytes(): number {
  const raw = (process.env.MIRA_UPLOAD_VIDEO_MAX_BYTES ?? '').trim();
  const intMax = 2147483647; // Prisma Int / Postgres INTEGER
  if (/^[1-9]\d*$/.test(raw)) {
    const n = Number(raw);
    if (n >= UPLOAD_IMAGE_MAX_BYTES && n <= intMax) return n;
  }
  return Math.min(UPLOAD_VIDEO_MAX_BYTES_DEFAULT, intMax);
}

export function computeTotalParts(byteSize: number, partSize = UPLOAD_PART_SIZE_BYTES): number {
  if (byteSize <= 0) return 0;
  return Math.ceil(byteSize / partSize);
}

export function expectedPartSize(byteSize: number, partNumber: number, partSize = UPLOAD_PART_SIZE_BYTES): number {
  const total = computeTotalParts(byteSize, partSize);
  if (partNumber < 1 || partNumber > total) return 0;
  if (partNumber < total) return partSize;
  return byteSize - partSize * (total - 1);
}

/** Controllable clock for cleanup tests. */
let clockNow: (() => number) | null = null;

export function setUploadClock(nowFn: (() => number) | null) {
  clockNow = nowFn;
}

export function uploadNowMs(): number {
  return clockNow ? clockNow() : Date.now();
}
