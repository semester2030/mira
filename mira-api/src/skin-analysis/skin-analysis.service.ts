import {
  BadRequestException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { SkinAnalysisResult } from '../ai/contracts/skin-analysis-result.interface';
import {
  SKIN_ANALYSIS_PROVIDER,
  SkinAnalysisProvider,
} from '../ai/providers/skin-analysis.provider';
import { MiraBeautyReport } from '../intelligence/contracts/mira-beauty-report.interface';
import { IntelligenceService } from '../intelligence/intelligence.service';
import { RateLimitService } from '../common/services/rate-limit.service';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { FaceGateService } from '../ai/face-gate/face-gate.service';
import { PrismaService } from '../prisma/prisma.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { UsersService } from '../users/users.service';
import {
  buildStoredPayload,
  extractLegacySkinFromStored,
  extractMiraReportFromStored,
  SkinAnalysisResponseDto,
} from './dto/skin-analysis-response.dto';

@Injectable()
export class SkinAnalysisService {
  constructor(
    @Inject(SKIN_ANALYSIS_PROVIDER)
    private readonly skinProvider: SkinAnalysisProvider,
    private readonly intelligence: IntelligenceService,
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly rateLimit: RateLimitService,
    private readonly subscriptions: SubscriptionsService,
    private readonly faceGate: FaceGateService,
  ) {}

  async analyze(
    authUser: RequestUser,
    imageBuffer: Buffer,
  ): Promise<SkinAnalysisResponseDto> {
    if (!imageBuffer?.length) {
      throw new BadRequestException('Image file is required');
    }

    const user = await this.usersService.findOrCreateFromFirebase(authUser);
    await this.subscriptions.assertCanAnalyze(authUser, 'skin');
    await this.rateLimit.assertWithinLimit(user.id, 'skin-analysis');

    await this.faceGate.assertAnalyzablePhoto(imageBuffer);

    const prefs = await this.usersService.getPreferences(user.id);
    const { result: skinInternal, rawYouCam } =
      await this.skinProvider.analyze(imageBuffer);
    imageBuffer.fill(0);

    const providerAudit = rawYouCam
      ? { rawYouCam, capturedAt: new Date().toISOString() }
      : undefined;

    const miraReportBase = await this.intelligence.buildBeautyReport(skinInternal, {
      birthYear: prefs?.birthYear ?? null,
      rawYouCam,
    });

    const record = await this.prisma.skinAnalysis.create({
      data: {
        userId: user.id,
        resultJson: buildStoredPayload(
          miraReportBase,
          providerAudit,
        ) as unknown as Prisma.InputJsonValue,
      },
    });

    const miraReport = await this.intelligence.attachProgressForecast(
      user.id,
      miraReportBase,
      record.id,
    );

    await this.prisma.skinAnalysis.update({
      where: { id: record.id },
      data: {
        resultJson: buildStoredPayload(
          miraReport,
          providerAudit,
        ) as unknown as Prisma.InputJsonValue,
      },
    });

    await this.usersService.writeAuditLog({
      userId: user.id,
      action: 'skin_analysis.completed',
      metadata: {
        analysisId: record.id,
        privacyPolicyVersion: '1.0',
        imageRetained: false,
        intelligenceVersion: miraReport.version,
      },
    });

    return SkinAnalysisResponseDto.from(
      record.id,
      record.createdAt,
      miraReport,
      skinInternal,
    );
  }

  async history(authUser: RequestUser, limit = 20) {
    const user = await this.usersService.findOrCreateFromFirebase(authUser);
    const rows = await this.prisma.skinAnalysis.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 50),
    });

    const items = await Promise.all(
      rows.map(async (row) => {
        let miraReport = await this.resolveMiraReport(row.resultJson);
        const prefs = await this.usersService.getPreferences(user.id);
        miraReport = this.intelligence.enrichWithUserContext(miraReport, {
          birthYear: prefs?.birthYear ?? null,
        });
        miraReport = await this.intelligence.attachProgressForecast(
          user.id,
          miraReport,
          row.id,
        );
        return {
          id: row.id,
          createdAt: row.createdAt.toISOString(),
          miraReport,
        };
      }),
    );

    return items;
  }

  private async resolveMiraReport(stored: unknown): Promise<MiraBeautyReport> {
    const existing = extractMiraReportFromStored(stored);
    if (existing) return existing;

    const legacy = extractLegacySkinFromStored(stored);
    if (legacy) {
      return this.intelligence.buildBeautyReport(legacy);
    }

    throw new BadRequestException('تنسيق سجل التحليل غير مدعوم');
  }
}
