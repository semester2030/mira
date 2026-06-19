import {
  BadRequestException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { parseOccasion } from '../ai/contracts/mira-occasion';
import { OutfitAnalysisResult } from '../ai/contracts/outfit-analysis-result.interface';
import {
  OUTFIT_ANALYSIS_PROVIDER,
  OutfitAnalysisProvider,
} from '../ai/providers/outfit-analysis.provider';
import { OutfitQualityGateService } from '../ai/outfit-gate/outfit-quality-gate.service';
import { MiraStyleReport } from '../intelligence/contracts/mira-style-report.interface';
import {
  buildMiraStyleReport,
  scoreOutfitAnalysis,
} from '../intelligence/pipeline/ingest-outfit';
import { RateLimitService } from '../common/services/rate-limit.service';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { PrismaService } from '../prisma/prisma.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { UsersService } from '../users/users.service';
import { OutfitAnalysisResponseDto } from './dto/outfit-analysis-response.dto';

@Injectable()
export class OutfitAnalysisService {
  constructor(
    @Inject(OUTFIT_ANALYSIS_PROVIDER)
    private readonly outfitProvider: OutfitAnalysisProvider,
    private readonly outfitQualityGate: OutfitQualityGateService,
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly rateLimit: RateLimitService,
    private readonly subscriptions: SubscriptionsService,
  ) {}

  async analyze(
    authUser: RequestUser,
    imageBuffer: Buffer,
    occasionId: string,
  ): Promise<OutfitAnalysisResponseDto> {
    if (!imageBuffer?.length) {
      throw new BadRequestException('Image file is required');
    }

    const occasion = parseOccasion(occasionId);
    if (!occasion) {
      throw new BadRequestException(
        'Invalid occasion. Use: wedding, work, casual, university, evening, eid, interview',
      );
    }

    const user = await this.usersService.findOrCreateFromFirebase(authUser);
    await this.subscriptions.assertCanAnalyze(authUser, 'outfit');
    await this.rateLimit.assertWithinLimit(user.id, 'outfit-analysis');

    const captureQuality = await this.outfitQualityGate.assertAnalyzableOutfit(
      imageBuffer,
    );

    const rawOutfit = await this.outfitProvider.analyze(imageBuffer, occasion);
    imageBuffer.fill(0);

    const previousScore = await this.loadPreviousOutfitScore(user.id);
    const { scored, scoreResult } = scoreOutfitAnalysis(rawOutfit, {
      captureQuality,
      previousScore,
    });

    const miraStyleReport = buildMiraStyleReport(scored, scoreResult);

    const record = await this.prisma.outfitAnalysis.create({
      data: {
        userId: user.id,
        occasionId: occasion,
        resultJson: {
          outfit: scored,
          miraStyleReport,
        } as unknown as Prisma.InputJsonValue,
      },
    });

    await this.usersService.writeAuditLog({
      userId: user.id,
      action: 'outfit_analysis.completed',
      metadata: {
        analysisId: record.id,
        occasion,
        outfitScore: scoreResult.finalScore,
        privacyPolicyVersion: '1.0',
        imageRetained: false,
      },
    });

    return OutfitAnalysisResponseDto.from(
      record.id,
      record.createdAt,
      scored,
      miraStyleReport,
    );
  }

  async history(authUser: RequestUser, limit = 20) {
    const user = await this.usersService.findOrCreateFromFirebase(authUser);
    const rows = await this.prisma.outfitAnalysis.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 50),
    });

    return rows.map((row) => {
      const stored = row.resultJson as Record<string, unknown>;
      const outfit = (stored.outfit ?? stored) as OutfitAnalysisResult;
      const miraStyleReport = stored.miraStyleReport as MiraStyleReport | undefined;
      return {
        id: row.id,
        createdAt: row.createdAt.toISOString(),
        occasionId: row.occasionId,
        outfit,
        miraStyleReport,
      };
    });
  }

  private async loadPreviousOutfitScore(userId: string): Promise<number | null> {
    const previous = await this.prisma.outfitAnalysis.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: { resultJson: true },
    });
    if (!previous) return null;

    const stored = previous.resultJson as Record<string, unknown>;
    const report = stored.miraStyleReport as MiraStyleReport | undefined;
    if (report?.outfitScore != null) return report.outfitScore;

    const outfit = (stored.outfit ?? stored) as OutfitAnalysisResult;
    return outfit?.compatibilityScore != null
      ? Math.round(outfit.compatibilityScore)
      : null;
  }
}
