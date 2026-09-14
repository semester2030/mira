import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Optional,
  Inject,
} from '@nestjs/common';
import { RateLimitService } from '../common/services/rate-limit.service';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { UsersService } from '../users/users.service';
import { MceGroundingPipelineService } from '../consultation/services/mce-grounding-pipeline.service';
import { AdvisorChatDto } from './dto/advisor-chat.dto';
import {
  AdvisorChatResponse,
  ADVISOR_DISCLAIMER_AR,
} from './contracts/advisor-response.interface';
import { checkAdvisorGuard } from './engines/advisor-guard';
import { BeautyAdvisorService } from '../beauty-advisor/beauty-advisor.service';
import { projectMceSnapshotToEvidenceUnits } from '../beauty-advisor/evidence/public-evidence-projector';
import {
  projectFaceIntelligenceEvidence,
  type FaceAdvisorFocus,
  type FaceEvidenceProjectionMeta,
} from '../beauty-advisor/evidence/face-intelligence-projector';
import type { AdvisorEvidenceUnit } from '../beauty-advisor/contracts/advisor-evidence-envelope';
import { resolveFashionEvidenceForAdvisorChat } from '../fashion-knowledge/advisor-integration/production-wiring';
import type { FashionKnowledgeLlmPort } from '../fashion-knowledge/llm/provider-port';
import { PrismaService } from '../prisma/prisma.service';
import { extractMiraReportFromStored } from '../skin-analysis/dto/skin-analysis-response.dto';
import { ProductionEntitlementService } from '../production-entitlements/production-entitlement.service';

/** Optional Nest injection token for Mode B provider (tests / configured runtime). */
export const FASHION_KNOWLEDGE_LLM_PORT = 'FASHION_KNOWLEDGE_LLM_PORT';

/**
 * Strip UNTRUSTED client free text before any Face evidence projection (9M).
 * Selection refs remain; prose never becomes canonical evidence.
 */
function sanitizeFaceFocus(
  focus?: FaceAdvisorFocus,
): FaceAdvisorFocus | undefined {
  if (!focus) return undefined;
  const {
    publicFactAr: _publicFactAr,
    reasonAr: _reasonAr,
    ...trusted
  } = focus;
  return trusted;
}

/**
 * Advisor Facade — Phase 7B.1 + FK-12 production Fashion Knowledge wiring.
 * Fashion-prescriptive turns invoke FashionKnowledgeAdvisorBridge before narration.
 * Phase 9M: Face focus free text is never sealed as canonical Face evidence.
 */
@Injectable()
export class AdvisorService {
  constructor(
    private readonly users: UsersService,
    private readonly rateLimit: RateLimitService,
    private readonly beautyAdvisor: BeautyAdvisorService,
    private readonly grounding: MceGroundingPipelineService,
    private readonly prisma: PrismaService,
    private readonly productionEntitlements: ProductionEntitlementService,
    @Optional()
    @Inject(FASHION_KNOWLEDGE_LLM_PORT)
    private readonly fashionLlmPort?: FashionKnowledgeLlmPort,
  ) {}

  async chat(
    authUser: RequestUser,
    dto: AdvisorChatDto,
  ): Promise<AdvisorChatResponse> {
    const user = await this.users.findOrCreateFromFirebase(authUser);
    await this.rateLimit.assertWithinLimit(user.id, 'advisor-chat');

    const sessionId = `adv_${user.id}`;
    const guard = checkAdvisorGuard(dto.message);
    let evidenceUnits: AdvisorEvidenceUnit[] = [];
    const faceFocusRaw = dto.face as FaceAdvisorFocus | undefined;
    const faceFocus = sanitizeFaceFocus(faceFocusRaw);
    const faceTurn = !!faceFocus?.contextType;
    let faceProjectionMeta: FaceEvidenceProjectionMeta | undefined;

    if (!guard.blocked && dto.analysisId) {
      try {
        if (faceTurn) {
          // Face contextual turns: Face evidence only (no unrelated skin dump).
          const loaded = await this.loadFaceEvidence(
            user.id,
            dto.analysisId,
            faceFocus,
            faceFocusRaw,
          );
          evidenceUnits = loaded.units;
          faceProjectionMeta = loaded.meta;
        } else {
          const prefs = await this.users.getPreferences(user.id);
          const grounding = await this.grounding.build({
            userId: user.id,
            skinAnalysisId: dto.analysisId,
            locale: 'ar',
            birthYear: prefs?.birthYear ?? null,
            subscriptionPlan: 'free',
          });
          evidenceUnits = projectMceSnapshotToEvidenceUnits(grounding.snapshot);

          // Additive: also attach Face units when present on the stored report.
          const loaded = await this.loadFaceEvidence(
            user.id,
            dto.analysisId,
            undefined,
            undefined,
          );
          if (loaded.units.length > 0) {
            evidenceUnits = [...evidenceUnits, ...loaded.units];
            faceProjectionMeta = loaded.meta;
          }
        }
      } catch (err) {
        if (
          err instanceof NotFoundException ||
          err instanceof BadRequestException
        ) {
          evidenceUnits = [];
        } else {
          throw err;
        }
      }
    }

    // Missing stored Face report / unauthorized analysisId → empty evidence.
    // Never fabricate face_intelligence units from client publicFactAr (9M).
    if (!guard.blocked && faceTurn && evidenceUnits.length === 0) {
      evidenceUnits = [];
      faceProjectionMeta = {
        reconcileCode: 'face_context_no_authoritative_evidence',
        clientTextIgnored: !!(
          faceFocusRaw?.publicFactAr?.trim() || faceFocusRaw?.reasonAr?.trim()
        ),
      };
    }

    let fashionResolve: Awaited<
      ReturnType<typeof resolveFashionEvidenceForAdvisorChat>
    > | null = null;

    if (!guard.blocked && !faceTurn) {
      const entitlement = this.productionEntitlements.resolveForFirebaseUid(
        authUser.firebaseUid,
      );
      // PROD-FINAL-1: Fashion Mode B / advisor integration for this turn requires
      // server-authoritative owner entitlement. Non-allowlisted → fail closed.
      fashionResolve = await resolveFashionEvidenceForAdvisorChat({
        message: dto.message,
        userId: user.id,
        fashion: dto.fashion,
        provider: entitlement.fashionAdvisorModeB
          ? this.fashionLlmPort
          : undefined,
        integrationEnabled: entitlement.fashionAdvisorModeB
          ? undefined
          : false,
      });
      if (fashionResolve.evidenceUnits.length > 0) {
        // Replace any prior fashion.knowledge units; keep non-fashion evidence.
        evidenceUnits = [
          ...evidenceUnits.filter(
            (u) => !u.claimKey.startsWith('fashion.knowledge.'),
          ),
          ...fashionResolve.evidenceUnits,
        ];
      }
    }

    const turn = this.beautyAdvisor.turn({
      sessionId,
      message: dto.message,
      evidenceUnits,
      forceBlocked: guard.blocked,
      persistSession: true,
    });

    await this.users.writeAuditLog({
      userId: user.id,
      action: 'advisor.beauty_advisor_turn',
      metadata: {
        analysisId: dto.analysisId,
        intent: turn.intent,
        envelopeId: turn.envelope.envelopeId,
        reasonCode: turn.runtime.reasonCode,
        law34: turn.validation.law34Ok,
        expiryOk: turn.validation.expiryOk,
        turnIndex: turn.conversationState.turnIndex,
        traceId: turn.runtime.traceId,
        fashionBridgeInvoked: fashionResolve?.invokedBridge ?? false,
        fashionReasonCode: fashionResolve?.reasonCode,
        fashionProjectionId: fashionResolve?.projectionId,
        fashionCandidateId: fashionResolve?.candidateId,
        fashionClaimLock: fashionResolve?.claimLockDecision,
        fashionLaw34Ok: fashionResolve?.law34FashionOk,
        faceContextType: faceFocus?.contextType,
        faceEvidenceCount: evidenceUnits.filter(
          (u) => u.subsystemId === 'face_intelligence',
        ).length,
        // 9M — reconciliation trace (no report body / image / mesh).
        faceReconcileCode: faceProjectionMeta?.reconcileCode,
        faceResolvedEvidenceId: faceProjectionMeta?.resolvedEvidenceId,
        faceClientTextIgnored: faceProjectionMeta?.clientTextIgnored ?? false,
      },
    });

    const answer =
      guard.blocked && guard.safeReply
        ? `${guard.safeReply}\n\n${turn.response.disclaimerAr}`
        : `${turn.response.answerAr}\n\n${turn.response.disclaimerAr}`;

    return {
      answer,
      suggestedQuestions: turn.response.suggestedQuestionsAr,
      confidence: turn.response.confidence,
      intent: turn.intent,
      blocked: turn.response.blocked || guard.blocked,
      disclaimerAr: turn.response.disclaimerAr ?? ADVISOR_DISCLAIMER_AR,
    };
  }

  /**
   * Load Face evidence for the authenticated owner only.
   * Ownership: skinAnalysis.id + userId. Nested face.analysisId is not an
   * alternate load key (prevents cross-analysis enumeration via face payload).
   */
  private async loadFaceEvidence(
    userId: string,
    analysisId: string,
    focus?: FaceAdvisorFocus,
    rawFocus?: FaceAdvisorFocus,
  ): Promise<{
    units: AdvisorEvidenceUnit[];
    meta?: FaceEvidenceProjectionMeta;
  }> {
    const row = await this.prisma.skinAnalysis.findFirst({
      where: { id: analysisId, userId },
    });
    if (!row) {
      return {
        units: [],
        meta: {
          reconcileCode: 'face_context_no_authoritative_evidence',
          clientTextIgnored: !!(
            rawFocus?.publicFactAr?.trim() || rawFocus?.reasonAr?.trim()
          ),
        },
      };
    }
    const report = extractMiraReportFromStored(row.resultJson);
    const face = report?.faceIntelligence;
    if (!face) {
      return {
        units: [],
        meta: {
          reconcileCode: 'face_context_no_authoritative_evidence',
          clientTextIgnored: !!(
            rawFocus?.publicFactAr?.trim() || rawFocus?.reasonAr?.trim()
          ),
        },
      };
    }

    // Optional nested analysisId mismatch → drop selection focus (fail closed).
    let effectiveFocus = sanitizeFaceFocus(focus ?? rawFocus);
    if (
      effectiveFocus &&
      rawFocus?.analysisId &&
      face.analysisId &&
      rawFocus.analysisId !== face.analysisId &&
      rawFocus.analysisId !== analysisId
    ) {
      effectiveFocus = {
        contextType: 'generalFaceResult',
        evidenceStale: effectiveFocus.evidenceStale,
        confidenceQualifier: effectiveFocus.confidenceQualifier,
      };
    }

    const projected = projectFaceIntelligenceEvidence(face, effectiveFocus);
    return { units: projected.units, meta: projected.meta };
  }
}
