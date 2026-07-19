import { createHash } from 'crypto';
import {
  FASHION_OUTFIT_EVALUATION_VERSION,
  FASHION_OUTFIT_MAPPING_VERSION,
  outfitSchemaVersion,
} from './canonical-outfit';

export const OUTFIT_IDENTITY_POLICY_VERSION = 'outfit-identity-v1';
export const OUTFIT_MAPPING_EPOCH_ISO = '1970-01-01T00:00:00.000Z';

/**
 * Deterministic outfit identity — content-addressed from ordered garmentIds + context keys.
 * No Date.now / Math.random.
 */
export function deterministicOutfitId(input: {
  garmentIds: string[];
  occasionId?: string;
  climate?: string;
  season?: string;
  modestyPolicy?: string;
}): string {
  const payload = [
    FASHION_OUTFIT_MAPPING_VERSION,
    outfitSchemaVersion(),
    OUTFIT_IDENTITY_POLICY_VERSION,
    FASHION_OUTFIT_EVALUATION_VERSION,
    [...input.garmentIds].sort().join(','),
    input.occasionId ?? '',
    input.climate ?? '',
    input.season ?? '',
    input.modestyPolicy ?? '',
  ].join('|');
  const hash = createHash('sha256').update(payload, 'utf8').digest('hex').slice(0, 24);
  return `outf_${hash}`;
}

export function deterministicEvalTraceId(outfitId: string): string {
  const hash = createHash('sha256')
    .update(`oeval|${outfitId}`, 'utf8')
    .digest('hex')
    .slice(0, 16);
  return `oeval_${hash}`;
}
