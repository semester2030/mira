import { createHash } from 'crypto';
import {
  FASHION_STYLING_DECISION_VERSION,
  FASHION_STYLING_EVALUATION_VERSION,
  FASHION_STYLING_MAPPING_VERSION,
  FASHION_STYLING_REASONING_POLICY_VERSION,
  styleSchemaVersion,
} from './canonical-styling-profile';

export const STYLING_IDENTITY_POLICY_VERSION = 'styling-identity-v1';
export const STYLING_MAPPING_EPOCH_ISO = '1970-01-01T00:00:00.000Z';

export function deterministicStyleProfileId(input: {
  subjectId: string;
  outfitIds: string[];
  garmentIds: string[];
  goalTargets: string[];
}): string {
  const payload = [
    FASHION_STYLING_MAPPING_VERSION,
    styleSchemaVersion(),
    STYLING_IDENTITY_POLICY_VERSION,
    FASHION_STYLING_EVALUATION_VERSION,
    input.subjectId,
    [...input.outfitIds].sort().join(','),
    [...input.garmentIds].sort().join(','),
    [...input.goalTargets].sort().join(','),
  ].join('|');
  const hash = createHash('sha256').update(payload, 'utf8').digest('hex').slice(0, 24);
  return `style_${hash}`;
}

export function deterministicDecisionId(input: {
  claim: string;
  evidenceRefs: string[];
  outcome: string;
}): string {
  const payload = [
    FASHION_STYLING_DECISION_VERSION,
    FASHION_STYLING_REASONING_POLICY_VERSION,
    input.claim,
    input.outcome,
    [...input.evidenceRefs].sort().join(','),
  ].join('|');
  const hash = createHash('sha256').update(payload, 'utf8').digest('hex').slice(0, 20);
  return `sdec_${hash}`;
}

export function deterministicStylingTraceId(styleProfileId: string): string {
  const hash = createHash('sha256')
    .update(`seval|${styleProfileId}`, 'utf8')
    .digest('hex')
    .slice(0, 16);
  return `seval_${hash}`;
}

export function stableEvidenceCitationId(kind: string, ref: string): string {
  const hash = createHash('sha256')
    .update(`sev|${kind}|${ref}`, 'utf8')
    .digest('hex')
    .slice(0, 16);
  return `sev_${hash}`;
}
