/**
 * FK-5 — Deduplication check for review candidates.
 */
import type { FashionKnowledgeReviewCandidate } from './review-candidate';
import { FK5_COLOR_REVIEW_CANDIDATES } from './review-candidates-color';
import { FK5_OCCASION_REVIEW_CANDIDATES } from './review-candidates-occasion';

export function findDuplicateCandidateIds(
  candidates: readonly FashionKnowledgeReviewCandidate[] = [
    ...FK5_COLOR_REVIEW_CANDIDATES,
    ...FK5_OCCASION_REVIEW_CANDIDATES,
  ],
): readonly string[] {
  const seen = new Set<string>();
  const dupes: string[] = [];
  for (const c of candidates) {
    if (seen.has(c.candidateId) || seen.has(c.rule.ruleId)) {
      dupes.push(c.candidateId);
    }
    seen.add(c.candidateId);
    seen.add(c.rule.ruleId);
  }
  return Object.freeze(dupes);
}

/** Semantic fingerprint: domain + primary suggestion text. */
export function findSemanticOverlaps(
  candidates: readonly FashionKnowledgeReviewCandidate[] = [
    ...FK5_COLOR_REVIEW_CANDIDATES,
    ...FK5_OCCASION_REVIEW_CANDIDATES,
  ],
): readonly string[] {
  const map = new Map<string, string>();
  const overlaps: string[] = [];
  for (const c of candidates) {
    const key = `${c.rule.domain}::${c.rule.recommendationPattern.structuredSuggestion
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim()}`;
    const prior = map.get(key);
    if (prior) overlaps.push(`${prior}~~${c.candidateId}`);
    else map.set(key, c.candidateId);
  }
  return Object.freeze(overlaps);
}
