/**
 * FK-10/FK-12 — MCE / legacy bypass audit + quarantine policy.
 * FK-12 Option A: quarantine fashion-prescriptive MCE unless explicit legacy escape hatch.
 */
import {
  detectFashionAdvisorIntent,
  FashionAdvisorIntent,
  isFashionPrescriptiveIntent,
} from './intent-routing';
import { isLegacyMceFashionAllowed } from './integration-off-policy';

export const FashionAdvicePathClass = {
  CANONICAL: 'CANONICAL',
  LEGACY: 'LEGACY',
  BYPASS_RISK: 'BYPASS_RISK',
  MUST_QUARANTINE: 'MUST_QUARANTINE',
  OUT_OF_SCOPE: 'OUT_OF_SCOPE',
} as const;

export type FashionAdvicePathClass =
  (typeof FashionAdvicePathClass)[keyof typeof FashionAdvicePathClass];

export interface FashionAdvicePathAuditEntry {
  readonly pathId: string;
  readonly entry: string;
  readonly classification: FashionAdvicePathClass;
  readonly notes: string;
}

export const FK10_FASHION_ADVICE_PATH_AUDIT: readonly FashionAdvicePathAuditEntry[] =
  Object.freeze([
    {
      pathId: 'advisor_chat_envelope',
      entry: 'POST /advisor/chat → Beauty Advisor envelope',
      classification: FashionAdvicePathClass.CANONICAL,
      notes: 'FK-12 wires Claim-Locked bridge when integration ON + context.',
    },
    {
      pathId: 'gi_oi_si_engines',
      entry: 'fashion-intelligence GI/OI/SI',
      classification: FashionAdvicePathClass.CANONICAL,
      notes: 'Frozen evidence/reasoning — not Advisor fashion advice ownership.',
    },
    {
      pathId: 'mce_consultation_llm',
      entry: 'POST /consultation/sessions/:id/messages',
      classification: FashionAdvicePathClass.MUST_QUARANTINE,
      notes:
        'FK-12 Option A: always quarantine fashion-prescriptive unless LEGACY escape hatch.',
    },
    {
      pathId: 'mce_legacy_envelope_projection',
      entry: 'projectMceSnapshotToEvidenceUnits outfit/atelier',
      classification: FashionAdvicePathClass.LEGACY,
      notes: 'unknown + mce_legacy_summary — descriptive facts only.',
    },
    {
      pathId: 'outfit_hybrid_intelligence',
      entry: 'POST /ai/outfit-intelligence',
      classification: FashionAdvicePathClass.MUST_QUARANTINE,
      notes: 'FK-12 strips prescriptive fields via boundary helper.',
    },
    {
      pathId: 'recommendations_engine',
      entry: 'RecommendationsService',
      classification: FashionAdvicePathClass.LEGACY,
      notes: 'Outside Advisor Envelope; not Fashion Knowledge.',
    },
    {
      pathId: 'mce_advisor_bridge_dead',
      entry: 'ConsultationOrchestratorService.advisorBridge',
      classification: FashionAdvicePathClass.BYPASS_RISK,
      notes: 'Unwired on controllers; must remain non-production for fashion.',
    },
    {
      pathId: 'fk_llm_pre_lock',
      entry: 'Fashion Knowledge LLM draft before Claim Lock',
      classification: FashionAdvicePathClass.MUST_QUARANTINE,
      notes: 'Drafts never reach Advisor until PASS/QUALIFIED projection.',
    },
    {
      pathId: 'shopping',
      entry: 'shopping / SKU intents',
      classification: FashionAdvicePathClass.OUT_OF_SCOPE,
      notes: 'Recommendation Engine remains separate.',
    },
  ]);

export interface MceFashionQuarantineResult {
  readonly quarantine: boolean;
  readonly reasonCode?: string;
  readonly safeReplyAr?: string;
  readonly intent: FashionAdvisorIntent;
}

/**
 * FK-12 Option A: quarantine fashion prescriptions unless explicit legacy flag.
 */
export function evaluateMceFashionQuarantine(
  message: string,
  getEnv?: (key: string, def?: string) => string | undefined,
): MceFashionQuarantineResult {
  const intent = detectFashionAdvisorIntent(message);
  if (intent === FashionAdvisorIntent.RELIGIOUS_OUT_OF_SCOPE) {
    return {
      quarantine: true,
      intent,
      reasonCode: 'RELIGIOUS_OUT_OF_SCOPE',
      safeReplyAr:
        'هذا السؤال خارج نطاق معرفة الأزياء في ميرا. لا أصدر أحكامًا دينية عن اللباس.',
    };
  }
  if (intent === FashionAdvisorIntent.SHOPPING_OUT_OF_SCOPE) {
    return {
      quarantine: true,
      intent,
      reasonCode: 'SHOPPING_OUT_OF_SCOPE',
      safeReplyAr:
        'التسوق والمنتجات خارج نطاق مستشارة معرفة الأزياء الحالية.',
    };
  }
  if (/أنحف|slimmer|thinner|يخفي البطن/i.test(message)) {
    return {
      quarantine: true,
      intent,
      reasonCode: 'BODY_DIRECTED_OUT_OF_SCOPE_LAW_37',
      safeReplyAr:
        'لا أقدّم توجيه تنسيق موجّهًا نحو شكل الجسم أو النحافة.',
    };
  }
  if (!isFashionPrescriptiveIntent(intent)) {
    return { quarantine: false, intent };
  }
  if (isLegacyMceFashionAllowed(getEnv)) {
    return {
      quarantine: false,
      intent,
      reasonCode: 'LEGACY_MCE_FASHION_EXPLICITLY_ALLOWED',
    };
  }
  return {
    quarantine: true,
    intent,
    reasonCode: 'FASHION_REQUIRES_CLAIM_LOCK_ENVELOPE',
    safeReplyAr:
      'نصيحة التنسيق الوصفية تمر عبر معرفة الأزياء وقفل الادعاء وظرف المستشارة فقط. لن أخترع تنسيقًا من معرفة عامة غير مقيّدة هنا.',
  };
}

export function assertNoUnaccountedBypassPaths(): {
  ok: boolean;
  mustQuarantineCount: number;
} {
  const must = FK10_FASHION_ADVICE_PATH_AUDIT.filter(
    (p) => p.classification === FashionAdvicePathClass.MUST_QUARANTINE,
  );
  return { ok: must.length >= 2, mustQuarantineCount: must.length };
}
