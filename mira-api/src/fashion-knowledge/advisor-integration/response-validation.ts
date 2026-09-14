/**
 * FK-10 — Response validation against projection / Law #34 fashion claims.
 */
import type { FashionKnowledgeAdvisorProjection } from './projection';
import { FashionAdvisorProjectionKind } from './projection';
import {
  containsBodyJudgmentLanguage,
  containsCulturalStereotypeLanguage,
  containsForbiddenFashionLanguage,
  containsReligiousRulingLanguage,
} from './narration';

export interface FashionAdvisorResponseValidation {
  readonly ok: boolean;
  readonly issues: readonly string[];
}

/**
 * Validate that narrated fashion claim keys exist on the projection fragments,
 * and that answer text does not invent sources / body / religion / blocked content.
 */
export function validateFashionAdvisorNarration(input: {
  readonly projection: FashionKnowledgeAdvisorProjection;
  readonly answerAr: string;
  readonly citedClaimKeys: readonly string[];
}): FashionAdvisorResponseValidation {
  const issues: string[] = [];
  const allowed = new Set(input.projection.fragments.map((f) => f.claimKey));

  for (const key of input.citedClaimKeys) {
    if (!key.startsWith('fashion.knowledge.')) continue;
    if (!allowed.has(key)) {
      issues.push(`FASHION_CLAIM_OUTSIDE_PROJECTION:${key}`);
    }
  }

  if (
    input.projection.kind === FashionAdvisorProjectionKind.UNAVAILABLE ||
    input.projection.kind === FashionAdvisorProjectionKind.OUT_OF_SCOPE
  ) {
    if (
      input.projection.allowedSuggestion &&
      input.answerAr.includes(input.projection.allowedSuggestion)
    ) {
      issues.push('BLOCKED_OR_UNAVAILABLE_SUGGESTION_LEAK');
    }
  }

  if (
    input.projection.kind === FashionAdvisorProjectionKind.CLARIFICATION_ONLY
  ) {
    // Clarification answers must not invent a styling direction.
    if (/يمكنك تجربة|استبدل|بدّلي|بدلي/i.test(input.answerAr)) {
      issues.push('CLARIFICATION_INVENTED_SUGGESTION');
    }
  }

  if (containsForbiddenFashionLanguage(input.answerAr)) {
    issues.push('FORBIDDEN_FASHION_LANGUAGE');
  }
  if (containsBodyJudgmentLanguage(input.answerAr)) {
    issues.push('BODY_JUDGMENT');
  }
  if (containsReligiousRulingLanguage(input.answerAr)) {
    issues.push('RELIGIOUS_RULING');
  }
  if (containsCulturalStereotypeLanguage(input.answerAr)) {
    issues.push('CULTURAL_STEREOTYPE');
  }
  if (/دليل .+ الرسمي|Dior|خبراء الموضة يقولون|قاعدة معتمدة من ميرا/i.test(input.answerAr)) {
    if (input.projection.sourceAuthorityClass !== 'CURATED') {
      issues.push('FABRICATED_SOURCE_ATTRIBUTION');
    }
  }
  if (/SKU|سعر|اشتر[يى]|رابط متجر/i.test(input.answerAr)) {
    issues.push('SHOPPING_CLAIM');
  }
  if (/openai|fashn|provider_id|chain[- ]of[- ]thought|system prompt/i.test(input.answerAr)) {
    issues.push('PROVIDER_LEAKAGE');
  }

  // Alternatives: Advisor must not invent a fourth beyond projection.
  const altMentions = (input.answerAr.match(/خيار آخر/g) ?? []).length;
  if (altMentions > input.projection.alternatives.length) {
    issues.push('INVENTED_ALTERNATIVE');
  }

  return { ok: issues.length === 0, issues };
}

/** Prove blocked suggestion text is absent from projection fragments. */
export function projectionOmitsBlockedSuggestion(
  projection: FashionKnowledgeAdvisorProjection,
  blockedSuggestionText: string,
): boolean {
  if (!blockedSuggestionText.trim()) return true;
  const blob = projection.fragments.map((f) => f.statementAr).join('\n');
  return !blob.includes(blockedSuggestionText);
}
