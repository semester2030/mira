import {
  Injectable,
  NotFoundException,
  BadRequestException,
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
import type { AdvisorEvidenceUnit } from '../beauty-advisor/contracts/advisor-evidence-envelope';

/**
 * Advisor Facade — Phase 7B.1.
 * All replies go through Beauty Advisor envelope pipeline (incl. safety blocks).
 */
@Injectable()
export class AdvisorService {
  constructor(
    private readonly users: UsersService,
    private readonly rateLimit: RateLimitService,
    private readonly beautyAdvisor: BeautyAdvisorService,
    private readonly grounding: MceGroundingPipelineService,
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

    if (!guard.blocked && dto.analysisId) {
      try {
        const prefs = await this.users.getPreferences(user.id);
        const grounding = await this.grounding.build({
          userId: user.id,
          skinAnalysisId: dto.analysisId,
          locale: 'ar',
          birthYear: prefs?.birthYear ?? null,
          subscriptionPlan: 'free',
        });
        evidenceUnits = projectMceSnapshotToEvidenceUnits(grounding.snapshot);
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
}
