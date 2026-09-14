/**
 * FK-2 — Structured alternatives (multiple valid paths, not one "correct" answer).
 */
import type { KnowledgeConfidence } from './confidence';
import type { SubjectivityLevel } from './subjectivity';

export const FASHION_ADVICE_CHANGE_ACTIONS = [
  'keep',
  'soften_color',
  'neutralize_color',
  'increase_formality',
  'decrease_formality',
  'add',
  'remove',
  'replace_direction',
  'other',
] as const;

export type FashionAdviceChangeAction =
  (typeof FASHION_ADVICE_CHANGE_ACTIONS)[number];

export const FASHION_ADVICE_PREFERENCE_ALIGNMENTS = [
  'aligned',
  'partial',
  'opposed',
  'unknown',
] as const;

export type FashionAdvicePreferenceAlignment =
  (typeof FASHION_ADVICE_PREFERENCE_ALIGNMENTS)[number];

export interface FashionAdviceChange {
  readonly changeId: string;
  readonly targetRef: string;
  readonly action: FashionAdviceChangeAction;
  readonly toDirection?: string;
  readonly notes?: string;
}

export interface FashionAdviceAlternative {
  readonly alternativeId: string;
  readonly direction: string;
  readonly changes: readonly FashionAdviceChange[];
  readonly expectedStyleEffect: string;
  readonly evidenceRefs: readonly string[];
  readonly ruleRefs: readonly string[];
  readonly confidence: KnowledgeConfidence;
  readonly subjectivity: SubjectivityLevel;
  readonly qualification: string;
  readonly preferenceAlignment: FashionAdvicePreferenceAlignment;
}
