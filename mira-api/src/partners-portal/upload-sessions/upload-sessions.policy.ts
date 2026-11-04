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
/** Default large-object guard for video (configurable via env). */
export const UPLOAD_VIDEO_MAX_BYTES_DEFAULT = 2 * 1024 * 1024 * 1024;

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

export function uploadVideoMaxBytes(): number {
  const raw = (process.env.MIRA_UPLOAD_VIDEO_MAX_BYTES ?? '').trim();
  if (/^[1-9]\d*$/.test(raw)) {
    const n = Number(raw);
    if (n >= UPLOAD_IMAGE_MAX_BYTES && n <= 8 * 1024 * 1024 * 1024) return n;
  }
  return UPLOAD_VIDEO_MAX_BYTES_DEFAULT;
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
