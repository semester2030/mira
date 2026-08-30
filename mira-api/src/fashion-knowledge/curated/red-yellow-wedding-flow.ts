/**
 * FK-5 — Red + yellow + wedding principle flow (no pair ban).
 */
import {
  DEMO_HUE_RED,
  DEMO_HUE_YELLOW,
  observeColorRelationship,
  ContrastCategory,
  type ColorRelationshipObservation,
} from './color-math';
import { LEGACY_CLASH_PAIR_POLICY } from './legacy-clash-pairs';
import { FashionOccasionId } from './occasion-model';
import { FashionDressCodeId } from './dress-code-model';
import { FK5_COLOR_REVIEW_CANDIDATES } from './review-candidates-color';
import { FK5_OCCASION_REVIEW_CANDIDATES } from './review-candidates-occasion';

export interface RedYellowWeddingPrincipleFlow {
  readonly observation: ColorRelationshipObservation;
  readonly occasion: typeof FashionOccasionId.WEDDING;
  readonly dressCode: typeof FashionDressCodeId.UNKNOWN | string;
  readonly legacyClashWouldFire: boolean;
  readonly specialCasePairBanExists: boolean;
  readonly matchedCandidateIds: readonly string[];
  readonly adviceDirections: readonly string[];
  readonly productionCuratedAuthority: 'NONE' | 'ACTIVE_RULES';
  readonly notes: string;
}

/**
 * Derive advice directions from principles + review candidates.
 * Does NOT hardcode “red and yellow cannot be worn together”.
 */
export function evaluateRedYellowWeddingFlow(input?: {
  readonly dressCode?: string;
  readonly styleGoal?: string;
}): RedYellowWeddingPrincipleFlow {
  const observation = observeColorRelationship(DEMO_HUE_RED, DEMO_HUE_YELLOW);
  const dressCode = input?.dressCode ?? FashionDressCodeId.UNKNOWN;
  const styleGoal = (input?.styleGoal ?? '').toLowerCase();

  const matchedCandidateIds = [
    ...FK5_COLOR_REVIEW_CANDIDATES,
    ...FK5_OCCASION_REVIEW_CANDIDATES,
  ]
    .filter((c) => {
      const id = c.candidateId;
      if (id === 'FK5_RC_COLOR_HIGH_SAT_DOMINANCE') return true;
      if (id === 'FK5_RC_COLOR_SATURATION_BALANCE') return true;
      if (id === 'FK5_RC_COLOR_NEUTRAL_SUPPORT') return true;
      if (id === 'FK5_RC_OCC_WEDDING_GENERIC') return true;
      if (id === 'FK5_RC_OCC_MISSING_DRESS_CODE' && dressCode === FashionDressCodeId.UNKNOWN)
        return true;
      if (id === 'FK5_RC_OCC_COLOR_INTENSITY_FORMAL') return true;
      return false;
    })
    .map((c) => c.candidateId);

  const adviceDirections: string[] = [];
  if (observation.contrastCategory === ContrastCategory.HIGH) {
    adviceDirections.push('observe_strong_visual_contrast');
  }
  if (observation.bothHighSaturation) {
    adviceDirections.push('reduce_competing_dominance');
    adviceDirections.push('use_neutral_supporting_elements');
    adviceDirections.push('preserve_bold_look');
  }
  if (dressCode === FashionDressCodeId.UNKNOWN) {
    adviceDirections.push('clarify_dress_code');
  }
  if (['bold', 'statement', 'experimental'].includes(styleGoal)) {
    adviceDirections.push('preference_qualified_preserve');
  }

  return Object.freeze({
    observation,
    occasion: FashionOccasionId.WEDDING,
    dressCode,
    legacyClashWouldFire: false,
    specialCasePairBanExists: false,
    matchedCandidateIds: Object.freeze(matchedCandidateIds),
    adviceDirections: Object.freeze([...new Set(adviceDirections)].sort()),
    productionCuratedAuthority: 'NONE',
    notes: [
      'Principle flow only — production ACTIVE curated set remains empty until Tier A/B + human approval.',
      LEGACY_CLASH_PAIR_POLICY.notes,
      'No hardcoded hue-pair ban for red with yellow.',
    ].join(' '),
  });
}
