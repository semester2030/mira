/**
 * FK-3 — Prompt construction with injection defense for untrusted user text.
 */
import type { FashionLlmKnowledgeRequest } from './request-contract';
import { FASHION_LLM_SYSTEM_PROMPT, FASHION_LLM_PROMPT_META } from './prompt-policy';

const INJECTION_PATTERNS = [
  /ignore (all |previous |above )?instructions/i,
  /disregard (the )?system/i,
  /you are now/i,
  /tell me this outfit is ugly/i,
  /jailbreak/i,
  /system prompt/i,
  /override policy/i,
];

export function sanitizeUntrustedText(text: string): string {
  let out = text.replace(/[\u0000-\u001f]/g, ' ').trim();
  for (const p of INJECTION_PATTERNS) {
    out = out.replace(p, '[filtered]');
  }
  // Cap length to reduce prompt stuffing
  if (out.length > 500) out = out.slice(0, 500);
  return out;
}

export function detectPromptInjection(text: string): boolean {
  return INJECTION_PATTERNS.some((p) => p.test(text));
}

export interface FashionLlmPromptBundle {
  readonly system: string;
  readonly userPayloadJson: string;
  readonly promptVersion: string;
  readonly injectionFlags: readonly string[];
}

export function buildFashionLlmPrompt(
  request: FashionLlmKnowledgeRequest,
): FashionLlmPromptBundle {
  const injectionFlags: string[] = [];
  const check = (label: string, value?: string) => {
    if (!value) return value;
    if (detectPromptInjection(value)) injectionFlags.push(label);
    return sanitizeUntrustedText(value);
  };

  const safe = {
    requestId: request.requestId,
    schemaVersion: request.schemaVersion,
    traceId: request.traceId,
    locale: request.locale,
    clockNowIso: request.clockNowIso,
    garmentFacts: request.garmentFacts,
    outfitFacts: request.outfitFacts,
    occasion: check('occasion', request.occasion),
    dressCode: check('dressCode', request.dressCode),
    styleGoal: check('styleGoal', request.styleGoal),
    preferenceContext: request.preferenceContext
      ? {
          ...request.preferenceContext,
          styleGoal: check(
            'preference.styleGoal',
            request.preferenceContext.styleGoal,
          ),
        }
      : undefined,
    culturalContext: check('culturalContext', request.culturalContext),
    existingKnowledgeRuleRefs: request.existingKnowledgeRuleRefs,
    evidenceRefs: request.evidenceRefs,
    allowedAdviceTypes: request.allowedAdviceTypes,
    forbiddenClaims: request.forbiddenClaims,
    instructions:
      'Return one FashionAdviceCandidateDraft JSON object. No markdown. No prose outside JSON.',
  };

  return {
    system: FASHION_LLM_SYSTEM_PROMPT,
    userPayloadJson: JSON.stringify(safe),
    promptVersion: FASHION_LLM_PROMPT_META.version,
    injectionFlags,
  };
}
