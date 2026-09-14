/**
 * FK-7 — Validation (fail closed) + Law #37 body-language checks.
 */
import type { FashionFormGarmentFact } from './fact-projection';
import { FabricEvidenceState, SilhouetteVocabulary } from './models';
import { isFashionAdviceType } from '../contracts/advice-types';
import { validateToneSafety } from '../validation/tone-safety';
import { ENGINEERING_LAW_37 } from './engineering-law-37';

export interface Fk7ValidationIssue {
  readonly code: string;
  readonly message: string;
}

export function validateFormGarmentFact(
  fact: FashionFormGarmentFact,
): { ok: boolean; issues: readonly Fk7ValidationIssue[] } {
  const issues: Fk7ValidationIssue[] = [];
  if (!fact.garmentId) {
    issues.push({ code: 'missing_id', message: 'garmentId required' });
  }
  if (
    fact.materialEvidence === FabricEvidenceState.ESTIMATED &&
    fact.confidence === 'HIGH'
  ) {
    issues.push({
      code: 'estimated_high_certainty',
      message: 'Estimated material cannot support high-certainty claims',
    });
  }
  return { ok: issues.length === 0, issues: Object.freeze(issues) };
}

export function validateFk7NoShoppingLanguage(text: string): boolean {
  return !/\bsku\b|\bin stock\b|\$\d+|buy now|brand recommendation|gucci|louis vuitton/i.test(
    text,
  );
}

export function validateNoBodyJudgment(text: string): boolean {
  return (
    validateToneSafety(text).filter(
      (i) =>
        i.code === 'BODY_SHAMING' ||
        i.code === 'BODY_SHAPE_JUDGMENT' ||
        i.code === 'ATTRACTIVENESS',
    ).length === 0
  );
}

export function validateFk7AdvicePayload(input: {
  readonly adviceType: string;
  readonly texts: readonly string[];
}): { ok: boolean; issues: readonly Fk7ValidationIssue[] } {
  const issues: Fk7ValidationIssue[] = [];
  if (!isFashionAdviceType(input.adviceType)) {
    issues.push({ code: 'invalid_advice_type', message: input.adviceType });
  }
  for (const t of input.texts) {
    for (const i of validateToneSafety(t)) {
      issues.push({ code: i.code, message: i.message });
    }
    if (!validateFk7NoShoppingLanguage(t)) {
      issues.push({
        code: 'shopping_language',
        message: 'SKU/brand/price language prohibited',
      });
    }
  }
  return { ok: issues.length === 0, issues: Object.freeze(issues) };
}

export function assertLaw37NeutralLanguage(text: string): boolean {
  // Preferred garment-relationship language may pass; body judgment must fail
  return validateNoBodyJudgment(text);
}

export function law37GovernanceMarker(): string {
  return `LAW_${ENGINEERING_LAW_37.lawId}:${ENGINEERING_LAW_37.schemaVersion}`;
}

export function silhouetteUnknownOk(fact: FashionFormGarmentFact): boolean {
  return fact.silhouette === SilhouetteVocabulary.UNKNOWN;
}
