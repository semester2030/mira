/**
 * FK-12 — Production wiring: Advisor turn → Fashion Knowledge bridge → envelope units.
 */
import type { AdvisorEvidenceUnit } from '../../beauty-advisor/contracts/advisor-evidence-envelope';
import { projectFashionKnowledgeToEvidenceUnits } from '../../beauty-advisor/evidence/fashion-knowledge-projector';
import type { FashionKnowledgeLlmPort } from '../llm/provider-port';
import type { FashionKnowledgeRegistry } from '../registry/contracts';
import type { FashionKnowledgeTelemetryService } from '../telemetry/service';
import {
  detectFashionAdvisorIntent,
  FashionAdvisorIntent,
  isFashionPrescriptiveIntent,
  isReligiousOutOfScope,
} from './intent-routing';
import { isFashionKnowledgeAdvisorIntegrationEnabled } from './feature-flag';
import {
  assembleFashionAdvisorContext,
  type FashionAdvisorPublicContext,
} from './context-assembler';
import {
  runFashionKnowledgeAdvisorBridge,
  type FashionAdvisorBridgeResult,
} from './bridge';
import { projectNoKnowledge, projectOutOfScope } from './eligibility';
import { narrateFromFashionProjection } from './envelope-narration';
import {
  containsBodyJudgmentLanguage,
  containsForbiddenFashionLanguage,
  containsReligiousRulingLanguage,
} from './narration';
import { validateFashionAdvisorNarration } from './response-validation';
import { FashionAdvisorProjectionKind } from './projection';
import { PublicClaimStrength } from '../contracts/claim-strength';
import { FASHION_ADVISOR_PROJECTION_VERSION, FASHION_KNOWLEDGE_RELEASE } from '../versioning/release';
import { FashionAdvisorSourceMode } from './projection';

export interface FashionAdvisorProductionResolveInput {
  readonly message: string;
  readonly userId: string;
  readonly fashion?: FashionAdvisorPublicContext;
  readonly clockNowIso?: string;
  readonly provider?: FashionKnowledgeLlmPort;
  readonly registry?: FashionKnowledgeRegistry;
  readonly telemetryService?: FashionKnowledgeTelemetryService;
  readonly getEnv?: (key: string, def?: string) => string | undefined;
  readonly integrationEnabled?: boolean;
  readonly llmEnabled?: boolean;
}

export interface FashionAdvisorProductionResolveResult {
  readonly invokedBridge: boolean;
  readonly fashionPrescriptive: boolean;
  readonly evidenceUnits: AdvisorEvidenceUnit[];
  readonly bridgeResult?: FashionAdvisorBridgeResult;
  readonly integrationEnabled: boolean;
  readonly law34FashionOk: boolean;
  readonly answerPreviewAr?: string;
  readonly reasonCode: string;
  readonly envelopeIdHint?: string;
  readonly projectionId?: string;
  readonly candidateId?: string;
  readonly claimLockDecision?: string;
}

function clarificationUnits(
  userId: string,
  clock: string,
  statementAr: string,
  needs: readonly string[],
): AdvisorEvidenceUnit[] {
  const projection = {
    projectionId: `fkp_clarify_${userId}`,
    schemaVersion: FASHION_ADVISOR_PROJECTION_VERSION,
    kind: FashionAdvisorProjectionKind.CLARIFICATION_ONLY,
    allowedClaimStrength: PublicClaimStrength.UNAVAILABLE,
    alternatives: [],
    evidenceRefs: [],
    ruleRefs: [],
    sourceMode: FashionAdvisorSourceMode.NO_KNOWLEDGE,
    sourceAuthorityClass: 'NONE' as const,
    qualificationCodes: [],
    limitations: ['INSUFFICIENT_CONTEXT'],
    clarificationNeeds: [...needs],
    fragments: [
      {
        claimKey: 'fashion.knowledge.clarification.context',
        statementAr,
        confidence: 'medium' as const,
        capabilityId: 'fashion_knowledge' as const,
        sourceRef: `adv_ctx_${userId}`,
        provenance: 'fashion_knowledge_claim_locked' as const,
        subsystemHint: 'unknown' as const,
      },
    ],
    narrationHints: ['ASK_CLARIFICATION_ONLY', 'NO_GUESS'],
    releaseVersion: FASHION_KNOWLEDGE_RELEASE,
    claimLockDecision: 'NEED_CLARIFICATION',
    traceId: `adv_ctx_${userId}`,
    createdAt: clock,
  };
  return projectFashionKnowledgeToEvidenceUnits(projection);
}

export async function resolveFashionEvidenceForAdvisorChat(
  input: FashionAdvisorProductionResolveInput,
): Promise<FashionAdvisorProductionResolveResult> {
  const getEnv = input.getEnv ?? ((k, d) => process.env[k] ?? d);
  const clock = input.clockNowIso ?? new Date().toISOString();
  const intent = detectFashionAdvisorIntent(input.message);
  const fashionPrescriptive = isFashionPrescriptiveIntent(intent);
  const integrationEnabled =
    input.integrationEnabled ??
    isFashionKnowledgeAdvisorIntegrationEnabled(getEnv);

  if (
    isReligiousOutOfScope(intent) ||
    intent === FashionAdvisorIntent.SHOPPING_OUT_OF_SCOPE
  ) {
    const projection = projectOutOfScope({
      clockNowIso: clock,
      traceId: `adv_oos_${input.userId}`,
      reason:
        intent === FashionAdvisorIntent.SHOPPING_OUT_OF_SCOPE
          ? 'SHOPPING_OUT_OF_SCOPE'
          : 'RELIGIOUS_OUT_OF_SCOPE',
    });
    const units = projectFashionKnowledgeToEvidenceUnits(projection);
    const narrated = narrateFromFashionProjection(projection);
    return {
      invokedBridge: false,
      fashionPrescriptive: true,
      evidenceUnits: units,
      integrationEnabled,
      law34FashionOk: narrated.validation.ok,
      answerPreviewAr: narrated.answerAr,
      reasonCode: projection.outOfScopeReason ?? 'OUT_OF_SCOPE',
      projectionId: projection.projectionId,
    };
  }

  if (
    /أنحف|أطول|يخفي البطن|slimmer|thinner|pear body|apple body|hourglass/i.test(
      input.message,
    )
  ) {
    const units = clarificationUnits(
      input.userId,
      clock,
      'لا أقدّم توجيه تنسيق موجّهًا نحو شكل الجسم أو النحافة. يمكنني المساعدة في تناسق القطع مع بعضها عند توفر سياق الإطلالة.',
      ['BODY_DIRECTED_OUT_OF_SCOPE'],
    );
    return {
      invokedBridge: false,
      fashionPrescriptive: true,
      evidenceUnits: units,
      integrationEnabled,
      law34FashionOk: true,
      answerPreviewAr: units[0]?.statementAr,
      reasonCode: 'BODY_DIRECTED_OUT_OF_SCOPE_LAW_37',
    };
  }

  if (!fashionPrescriptive) {
    return {
      invokedBridge: false,
      fashionPrescriptive: false,
      evidenceUnits: [],
      integrationEnabled,
      law34FashionOk: true,
      reasonCode: 'NON_FASHION',
    };
  }

  // OPTION A — integration OFF: quarantine prescriptions.
  if (!integrationEnabled) {
    const projection = projectNoKnowledge({
      clockNowIso: clock,
      traceId: `adv_off_${input.userId}`,
      reason: 'INTEGRATION_OFF_PRESCRIPTIVE_QUARANTINED',
    });
    const units = projectFashionKnowledgeToEvidenceUnits(projection);
    return {
      invokedBridge: false,
      fashionPrescriptive: true,
      evidenceUnits: units,
      integrationEnabled: false,
      law34FashionOk: true,
      answerPreviewAr: units[0]?.statementAr,
      reasonCode: 'INTEGRATION_OFF_PRESCRIPTIVE_QUARANTINED',
      projectionId: projection.projectionId,
    };
  }

  const assembled = assembleFashionAdvisorContext({
    userMessage: input.message,
    userId: input.userId,
    fashion: input.fashion,
    clockNowIso: clock,
  });

  if (!assembled.sufficientForModeB || !assembled.request) {
    const units = clarificationUnits(
      input.userId,
      clock,
      assembled.missing.includes('garment_facts')
        ? 'لأن معلومات الإطلالة غير مكتملة، أحتاج وصف القطع أو ربط تحليل إطلالة قبل اقتراح تنسيق.'
        : `لأن المعلومات المتاحة لا تكفي، أحتاج منكِ: ${assembled.missing.join(' · ')}`,
      assembled.missing,
    );
    return {
      invokedBridge: false,
      fashionPrescriptive: true,
      evidenceUnits: units,
      integrationEnabled: true,
      law34FashionOk: true,
      answerPreviewAr: units[0]?.statementAr,
      reasonCode: 'INSUFFICIENT_FASHION_CONTEXT',
    };
  }

  const bridgeResult = await runFashionKnowledgeAdvisorBridge({
    context: {
      sessionRef: `adv_${input.userId}`,
      userMessage: input.message,
      request: assembled.request,
      registry: input.registry,
      evidenceStale: assembled.evidenceStale,
      culturalContextPresent: assembled.culturalContextPresent,
    },
    provider: input.provider,
    enabled: true,
    llmEnabled: input.llmEnabled,
    telemetryService: input.telemetryService,
    getEnv,
  });

  const units = projectFashionKnowledgeToEvidenceUnits(bridgeResult.projection);
  const narrated = narrateFromFashionProjection(bridgeResult.projection);
  const safetyOk =
    !containsBodyJudgmentLanguage(narrated.answerAr) &&
    !containsReligiousRulingLanguage(narrated.answerAr) &&
    !containsForbiddenFashionLanguage(narrated.answerAr);
  const semanticCheck = validateFashionAdvisorNarration({
    projection: bridgeResult.projection,
    answerAr: narrated.answerAr,
    citedClaimKeys: narrated.citedClaimKeys,
  });
  const law34FashionOk = narrated.validation.ok && safetyOk && semanticCheck.ok;

  if (!law34FashionOk) {
    const safe = projectNoKnowledge({
      clockNowIso: clock,
      traceId: bridgeResult.projection.traceId,
      reason: 'FASHION_NARRATION_VALIDATION_FAILED',
    });
    return {
      invokedBridge: true,
      fashionPrescriptive: true,
      evidenceUnits: projectFashionKnowledgeToEvidenceUnits(safe),
      bridgeResult,
      integrationEnabled: true,
      law34FashionOk: false,
      answerPreviewAr: safe.fragments[0]?.statementAr,
      reasonCode: 'FASHION_NARRATION_VALIDATION_FAILED',
      projectionId: bridgeResult.projection.projectionId,
      candidateId: bridgeResult.candidate?.candidateId,
      claimLockDecision: bridgeResult.claimLockResult?.decision,
    };
  }

  return {
    invokedBridge: true,
    fashionPrescriptive: true,
    evidenceUnits: units,
    bridgeResult,
    integrationEnabled: true,
    law34FashionOk: true,
    answerPreviewAr: narrated.answerAr,
    reasonCode:
      bridgeResult.claimLockResult?.decision ??
      bridgeResult.projection.unavailableReason ??
      bridgeResult.modeUsed,
    projectionId: bridgeResult.projection.projectionId,
    candidateId: bridgeResult.candidate?.candidateId,
    claimLockDecision: bridgeResult.claimLockResult?.decision,
  };
}
