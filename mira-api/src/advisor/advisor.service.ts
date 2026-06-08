import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { RateLimitService } from '../common/services/rate-limit.service';
import { RequestUser } from '../common/interfaces/request-user.interface';
import {
  extractLegacySkinFromStored,
  extractMiraReportFromStored,
} from '../skin-analysis/dto/skin-analysis-response.dto';
import { IntelligenceService } from '../intelligence/intelligence.service';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { AdvisorChatDto } from './dto/advisor-chat.dto';
import { AdvisorChatResponse } from './contracts/advisor-response.interface';
import { buildAdvisorContext } from './engines/advisor-context-builder';
import { buildAdvisorAnswer } from './engines/advisor-answer-engine';
import { checkAdvisorGuard, guardDisclaimer } from './engines/advisor-guard';

@Injectable()
export class AdvisorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly intelligence: IntelligenceService,
    private readonly rateLimit: RateLimitService,
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

    const user = await this.usersService.findOrCreateFromFirebase(authUser);
    await this.rateLimit.assertWithinLimit(user.id, 'advisor-chat');

    const prefs = await this.usersService.getPreferences(user.id);
    const row = await this.loadAnalysisRow(user.id, dto.analysisId);
    let report = extractMiraReportFromStored(row.resultJson);

    if (!report) {
      const legacy = extractLegacySkinFromStored(row.resultJson);
      if (legacy) {
        report = await this.intelligence.buildBeautyReport(legacy, {
          birthYear: prefs?.birthYear ?? null,
        });
      }
    }

    if (!report) {
      throw new BadRequestException('تنسيق التحليل غير مدعوم للمستشار');
    }

    report = this.intelligence.enrichWithUserContext(report, {
      birthYear: prefs?.birthYear ?? null,
    });
    report = await this.intelligence.attachProgressForecast(
      user.id,
      report,
      row.id,
    );

    const ctx = buildAdvisorContext(row.id, report, {
      birthYear: prefs?.birthYear ?? null,
    });

    const response = buildAdvisorAnswer(ctx, dto.message);

    await this.usersService.writeAuditLog({
      userId: user.id,
      action: 'advisor.chat',
      metadata: {
        analysisId: row.id,
        intent: response.intent,
        confidence: response.confidence,
      },
    });

    return response;
  }

  private async loadAnalysisRow(userId: string, analysisId?: string) {
    if (analysisId) {
      const row = await this.prisma.skinAnalysis.findFirst({
        where: { id: analysisId, userId },
      });
      if (!row) {
        throw new NotFoundException('Analysis not found');
      }
      return row;
    }

    const latest = await this.prisma.skinAnalysis.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    if (!latest) {
      throw new BadRequestException('أجري تحليل بشرة أولاً لاستخدام مستشار ميرا');
    }

    return latest;
  }
}
