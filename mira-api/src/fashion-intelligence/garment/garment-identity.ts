import { createHash } from 'crypto';
import {
  FASHION_GARMENT_MAPPING_VERSION,
  garmentSchemaVersion,
} from './canonical-garment';

/**
 * Deterministic Canonical Garment identity (Phase 6C.1).
 *
 * Policy:
 * - garmentId is content-addressed from mapping inputs (no Date.now / Math.random).
 * - Same Vision observation slot + attributes ⇒ same garmentId.
 * - Wardrobe may store garmentId as a stable ref across remaps of the same vision evidence.
 * - Wall-clock timestamps are NOT part of identity; mapping uses fixed epoch for determinism.
 *
 * Formula:
 *   sha256(mappingVersion|schemaVersion|slot|category|type|colors|material|fit|segmentId)
 *   → garm_<24 hex>
 */
export const GARMENT_IDENTITY_POLICY_VERSION = 'garment-identity-v1';

/** Fixed timestamp for deterministic CanonicalGarment bodies from pure mapping. */
export const GARMENT_MAPPING_EPOCH_ISO = '1970-01-01T00:00:00.000Z';

export function deterministicGarmentId(input: {
  slot: string;
  categoryId: string;
  typeId: string;
  colors: string[];
  material?: string;
  fit?: string;
  segmentId?: string;
  mappingVersion?: string;
  schemaVersion?: string;
}): string {
  const payload = [
    input.mappingVersion ?? FASHION_GARMENT_MAPPING_VERSION,
    input.schemaVersion ?? garmentSchemaVersion(),
    GARMENT_IDENTITY_POLICY_VERSION,
    input.slot,
    input.categoryId,
    input.typeId,
    [...input.colors].map((c) => c.toLowerCase()).sort().join(','),
    input.material ?? '',
    input.fit ?? '',
    input.segmentId ?? '',
  ].join('|');
  const hash = createHash('sha256').update(payload, 'utf8').digest('hex').slice(0, 24);
  return `garm_${hash}`;
}

/** Deterministic map-level trace id from document fingerprint (optional). */
export function deterministicMapTraceId(docFingerprint: string): string {
  const hash = createHash('sha256')
    .update(`map|${docFingerprint}`, 'utf8')
    .digest('hex')
    .slice(0, 16);
  return `gmap_${hash}`;
}

export function visionDocumentFingerprint(doc: unknown): string {
  return createHash('sha256')
    .update(stableStringify(doc), 'utf8')
    .digest('hex')
    .slice(0, 32);
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((v) => stableStringify(v)).join(',')}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`;
}
