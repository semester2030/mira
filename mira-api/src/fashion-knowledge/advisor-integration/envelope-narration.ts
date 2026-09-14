/**
 * FK-10 — Assemble envelope-ready narration from projection (Law #34 helper).
 * Pure — no beauty-advisor import. Tests seal via beauty-advisor projector.
 */
import type { FashionKnowledgeAdvisorProjection } from './projection';
import { FashionAdvisorProjectionKind } from './projection';
import { validateFashionAdvisorNarration } from './response-validation';

export interface FashionAdvisorGroundedDraft {
  readonly answerAr: string;
  readonly citedClaimKeys: readonly string[];
  readonly citationHandles: readonly string[];
  readonly followUpsAr: readonly string[];
  readonly blocked: boolean;
  readonly validation: ReturnType<typeof validateFashionAdvisorNarration>;
}

/**
 * Build Advisor-safe answer text strictly from projection fragments.
 * Does not invent fashion advice beyond the projection.
 */
export function narrateFromFashionProjection(
  projection: FashionKnowledgeAdvisorProjection,
  opts?: { readonly whyFollowUp?: boolean },
): FashionAdvisorGroundedDraft {
  const keys = projection.fragments.map((f) => f.claimKey);
  const citations = projection.fragments.map((f) => f.sourceRef);

  if (projection.kind === FashionAdvisorProjectionKind.CLARIFICATION_ONLY) {
    const answerAr =
      projection.fragments.find((f) => f.claimKey.includes('clarification'))
        ?.statementAr ??
      'أحتاج توضيحًا إضافيًا قبل اقتراح تنسيق.';
    const draft: FashionAdvisorGroundedDraft = {
      answerAr,
      citedClaimKeys: keys,
      citationHandles: citations,
      followUpsAr: projection.clarificationNeeds.map((n) => String(n)),
      blocked: false,
      validation: { ok: true, issues: [] },
    };
    return {
      ...draft,
      validation: validateFashionAdvisorNarration({
        projection,
        answerAr: draft.answerAr,
        citedClaimKeys: draft.citedClaimKeys,
      }),
    };
  }

  if (
    projection.kind === FashionAdvisorProjectionKind.UNAVAILABLE ||
    projection.kind === FashionAdvisorProjectionKind.OUT_OF_SCOPE
  ) {
    const answerAr =
      projection.fragments[0]?.statementAr ??
      'لا تتوفر نصيحة أزياء مؤهلة.';
    const draft = {
      answerAr,
      citedClaimKeys: keys,
      citationHandles: citations,
      followUpsAr: [] as string[],
      blocked: false,
      validation: { ok: true, issues: [] as string[] },
    };
    return {
      ...draft,
      validation: validateFashionAdvisorNarration({
        projection,
        answerAr: draft.answerAr,
        citedClaimKeys: draft.citedClaimKeys,
      }),
    };
  }

  const parts: string[] = [];
  for (const f of projection.fragments) {
    if (opts?.whyFollowUp && f.claimKey.includes('rationale')) {
      parts.unshift(f.statementAr);
      continue;
    }
    parts.push(f.statementAr);
  }
  const answerAr = parts.join('\n');
  const draft = {
    answerAr,
    citedClaimKeys: keys,
    citationHandles: citations,
    followUpsAr: ['ليش؟', 'أبغى خيارًا أكثر هدوءًا', 'أبغى خيارًا أكثر جرأة'],
    blocked: false,
    validation: { ok: true, issues: [] as string[] },
  };
  return {
    ...draft,
    validation: validateFashionAdvisorNarration({
      projection,
      answerAr: draft.answerAr,
      citedClaimKeys: draft.citedClaimKeys,
    }),
  };
}

/** Prompt injection cannot bypass Claim Lock / projection boundary. */
export function resistsPromptInjection(
  userMessage: string,
  projection: FashionKnowledgeAdvisorProjection,
): boolean {
  const injection =
    /تجاهل[يى]? القواعد|رأيك الشخصي|ignore (the )?rules|personal opinion/i.test(
      userMessage,
    );
  if (!injection) return true;
  // Still must only narrate projection — injection does not expand fragments.
  const narrated = narrateFromFashionProjection(projection);
  return narrated.validation.ok && narrated.citedClaimKeys.every((k) =>
    projection.fragments.some((f) => f.claimKey === k),
  );
}
