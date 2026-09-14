/**
 * FK-8 — Validation + privacy + identity-inference guards.
 */
import type { FashionCulturalContext } from './contract';
import { CulturalContextConfidence } from './models';
import { isFashionAdviceType } from '../contracts/advice-types';
import { validateToneSafety } from '../validation/tone-safety';
import { ENGINEERING_LAW_38 } from './engineering-law-38';
import { isReligiousRulingRequest } from './contract';

export interface Fk8ValidationIssue {
  readonly code: string;
  readonly message: string;
}

export function validateCulturalContext(
  ctx: FashionCulturalContext,
): { ok: boolean; issues: readonly Fk8ValidationIssue[] } {
  const issues: Fk8ValidationIssue[] = [];
  if (ctx.identityInferred !== false) {
    issues.push({
      code: 'identity_inferred',
      message: 'identityInferred must be false (Law #38)',
    });
  }
  if (
    ctx.mayInvokeRegionalKnowledgePath &&
    ctx.confidence !== CulturalContextConfidence.EXPLICIT
  ) {
    issues.push({
      code: 'regional_without_explicit',
      message: 'Regional knowledge path requires EXPLICIT confidence',
    });
  }
  if (!ctx.privacy.noInferredReligionOrEthnicity) {
    issues.push({
      code: 'privacy_violation',
      message: 'Inferred religion/ethnicity persistence forbidden',
    });
  }
  if (
    ctx.confidence === CulturalContextConfidence.WEAK &&
    /saudi|gulf/i.test(ctx.explicitLabel ?? '')
  ) {
    issues.push({
      code: 'weak_saudi_label',
      message: 'WEAK context cannot carry Saudi/Gulf explicit label',
    });
  }
  return { ok: issues.length === 0, issues: Object.freeze(issues) };
}

export function validateFk8AdvicePayload(input: {
  readonly adviceType: string;
  readonly texts: readonly string[];
}): { ok: boolean; issues: readonly Fk8ValidationIssue[] } {
  const issues: Fk8ValidationIssue[] = [];
  if (!isFashionAdviceType(input.adviceType)) {
    issues.push({ code: 'invalid_advice_type', message: input.adviceType });
  }
  for (const t of input.texts) {
    if (isReligiousRulingRequest(t)) {
      issues.push({
        code: 'RELIGIOUS_RULING',
        message: 'Religious rulings out of scope',
      });
    }
    for (const i of validateToneSafety(t)) {
      issues.push({ code: i.code, message: i.message });
    }
    if (/\bsku\b|\$\d+|buy now|gucci/i.test(t)) {
      issues.push({
        code: 'shopping_language',
        message: 'Shopping language prohibited',
      });
    }
  }
  return { ok: issues.length === 0, issues: Object.freeze(issues) };
}

export function law38GovernanceMarker(): string {
  return `LAW_${ENGINEERING_LAW_38.lawId}:${ENGINEERING_LAW_38.schemaVersion}`;
}

export function arabicLocaleIsNotSaudiIdentity(): true {
  return true;
}
