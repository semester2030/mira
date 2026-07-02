import { Injectable } from '@nestjs/common';
import { RateLimitService } from '../common/services/rate-limit.service';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { UsersService } from '../users/users.service';
import { ConsultationOrchestratorService } from '../consultation/services/consultation-orchestrator.service';
import { AdvisorChatDto } from './dto/advisor-chat.dto';
import { AdvisorChatResponse } from './contracts/advisor-response.interface';
import { checkAdvisorGuard, guardDisclaimer } from './engines/advisor-guard';

@Injectable()
export class AdvisorService {
  constructor(
    private readonly users: UsersService,
    private readonly rateLimit: RateLimitService,
    private readonly consultation: ConsultationOrchestratorService,
  ) {}

  async chat(
    authUser: RequestUser,
    dto: AdvisorChatDto,
  ): Promise<AdvisorChatResponse> {
    const guard = checkAdvisorGuard(dto.message);
    if (guard.blocked && guard.safeReply) {
      return {
        answer: `${guard.safeReply}\n\n${guardDisclaimer()}`,
        suggestedQuestions: [
          'هل أحتاج سيروم؟',
          'كيف أحافظ على النتائج؟',
          'ما أفضل منتج من ميرا لي؟',
        ],
        confidence: 'high',
        intent: 'blocked',
        blocked: true,
      };
    }

    const user = await this.users.findOrCreateFromFirebase(authUser);
    await this.rateLimit.assertWithinLimit(user.id, 'advisor-chat');

    return this.consultation.advisorBridge(authUser, dto.message, dto.analysisId);
  }
}
