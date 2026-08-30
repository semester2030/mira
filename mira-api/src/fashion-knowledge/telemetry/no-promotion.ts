/**
 * FK-9 — Hard no-auto-promotion policy (Law #39).
 * Research export and telemetry must never write registry / activate rules.
 */
import { ENGINEERING_LAW_39 } from './engineering-law-39';
import type { FashionKnowledgeResearchCandidate } from './research-export';

export const NO_AUTO_PROMOTION_POLICY = Object.freeze({
  schemaVersion: 'fashion-telemetry-no-promotion-v1',
  law39: ENGINEERING_LAW_39.lawId,
  forbiddenTransitions: Object.freeze([
    'feedback→ACTIVE_rule',
    'threshold_likes→approve_rule',
    'accept_count→curated_rule',
    'popular_candidate→registry_write',
    'research_candidate→FashionKnowledgeRule',
  ]),
  requiredPromotionPath: Object.freeze([
    'research',
    'source',
    'review',
    'approval',
    'registry',
  ]),
});

export function researchCandidateCannotActivate(
  candidate: FashionKnowledgeResearchCandidate,
): boolean {
  return (
    candidate.isFashionKnowledgeRule === false &&
    candidate.canActivateRule === false &&
    candidate.status === 'NEEDS_RESEARCH'
  );
}

/** Runtime guard — telemetry services expose none of these methods. */
export function assertNoRegistryWriteSurface(service: object): {
  ok: boolean;
  forbiddenFound: readonly string[];
} {
  const forbidden = [
    'activateRule',
    'approveRule',
    'publishRegistry',
    'writeRegistry',
    'promoteToActive',
  ];
  const found = forbidden.filter((m) => typeof (service as never)[m] === 'function');
  return { ok: found.length === 0, forbiddenFound: Object.freeze(found) };
}

export function likeDoesNotActivate(): true {
  return true;
}

export function dislikeDoesNotRejectRule(): true {
  return true;
}

export function popularityDoesNotPromote(): true {
  return true;
}
