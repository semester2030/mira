/**
 * FK-9 — Engineering Law #39 (Fashion Knowledge governance only).
 * Additive. Does not renumber or modify Laws #1–#38.
 */
import { FASHION_KNOWLEDGE_ENGINEERING_LAW_39_VERSION } from '../versioning/release';

export const ENGINEERING_LAW_39 = Object.freeze({
  lawId: 39 as const,
  schemaVersion: FASHION_KNOWLEDGE_ENGINEERING_LAW_39_VERSION,
  title: 'Fashion feedback is not domain truth',
  statement:
    'Fashion feedback is evidence about user preference and system behavior, not evidence that a fashion principle is true.',
  axioms: Object.freeze([
    'LIKE_IS_NOT_TRUE',
    'DISLIKE_IS_NOT_FALSE',
    'SAVE_IS_NOT_AUTHORITATIVE',
    'HIGH_CTR_IS_NOT_DOMAIN_KNOWLEDGE',
    'REPEATED_LLM_OUTPUT_IS_NOT_VALIDATED_RULE',
    'POPULARITY_IS_NOT_DOMAIN_TRUTH',
  ]),
  forbidden: Object.freeze([
    'feedback_to_active_rule',
    'threshold_likes_to_approve',
    'accept_count_to_curated_rule',
    'popular_candidate_to_registry_write',
    'implicit_click_as_strong_preference',
  ]),
  ownership: 'Fashion Knowledge Layer only',
  doesNotModify: 'Engineering Laws #1–#38',
});

export function isLaw39CompatibleWithFrozenLaws(): boolean {
  return true;
}
