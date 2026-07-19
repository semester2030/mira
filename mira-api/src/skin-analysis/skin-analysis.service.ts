import {
  BadRequestException,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { SkinAnalysisResult } from '../ai/contracts/skin-analysis-result.interface';
import { MiraBeautyReport } from '../intelligence/contracts/mira-beauty-report.interface';
import { IntelligenceService } from '../intelligence/intelligence.service';
import {
  assertNoRawYouCamInAudit,
  redactYouCamAudit,
} from '../intelligence/pipeline/youcam-audit-redact';
import { RateLimitService } from '../common/services/rate-limit.service';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { FaceGateService } from '../ai/face-gate/face-gate.service';
import { PrismaService } from '../prisma/prisma.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { UsersService } from '../users/users.service';
import { SkinAnalysisOrchestrator } from '../ports/orchestrators/skin-analysis.orchestrator';
import {
  IMAGE_QUALITY_PORT,
  ImageQualityPort,
} from '../ports/image-quality/image-quality.port';
import { captureSignalsFromImageQuality } from '../ports/image-quality/capture-signals-from-quality';
import {
  buildStoredPayload,
  extractLegacySkinFromStored,
  extractMiraReportFromStored,
  SkinAnalysisResponseDto,
} from './dto/skin-analysis-response.dto';
import {
  FaceReportPipelineInput,
  parseFaceIntelPackage,
} from '../intelligence/face-intelligence';

@Injectable()
export class SkinAnalysisService {
  constructor(
    private readonly skinOrchestrator: SkinAnalysisOrchestrator,
    private readonly intelligence: IntelligenceService,
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly rateLimit: RateLimitService,
    private readonly subscriptions: SubscriptionsService,
    private readonly faceGate: FaceGateService,
    @Inject(IMAGE_QUALITY_PORT)
    private readonly imageQuality: ImageQualityPort,
  ) {}

  async analyze(
    authUser: RequestUser,
    imageBuffer: Buffer,
    /**
     * Phase 4.5 — optional on-device faceIntel (JSON string or object).
     * Parsed once; invalid payloads omitted (never invented).
     */
    faceIntelRaw?: unknown,
  ): Promise<SkinAnalysisResponseDto> {
    if (!imageBuffer?.length) {
      throw new BadRequestException('Image file is required');
    }

    const user = await this.usersService.findOrCreateFromFirebase(authUser);
    await this.subscriptions.assertCanAnalyze(authUser, 'skin');
    await this.rateLimit.assertWithinLimit(user.id, 'skin-analysis');

    // Phase 2: quality gate BEFORE provider — protect Perfect credits.
    const quality = await this.imageQuality.evaluate({
      imageBytes: imageBuffer,
      context: 'skin',
    });
    if (quality.overallAcceptable !== true) {
      const blocked = (quality.meta.limitations ?? [])
        .filter((l) => l.startsWith('blocked:'))
        .map((l) => l.replace('blocked:', ''));
      throw new BadRequestException({
        code: 'image_quality_failure',
        message:
          'جودة الصورة غير كافية للتحليل — أعيدي الالتقاط بإضاءة أوضح ووجه ثابت.',
        messageEn:
          'Image quality is insufficient for analysis — retake with clearer lighting and a steady face.',
        reasons: blocked.length > 0 ? blocked : ['quality_blocked'],
        calculationVersion: quality.meta.calculationVersion,
        traceId: quality.meta.traceId,
      });
    }

    await this.faceGate.assertAnalyzablePhoto(imageBuffer);

    const captureQuality = captureSignalsFromImageQuality(quality);

    const prefs = await this.usersService.getPreferences(user.id);
    const orchestrated = await this.skinOrchestrator.analyze({
      imageBytes: imageBuffer,
    });
    imageBuffer.fill(0);

    const {
      portResult,
      skinInternal,
      isMock,
      providerName,
      rawYouCam,
      traceId,
    } = orchestrated;

    if (isMock === true && process.env.NODE_ENV === 'production') {
      throw new ServiceUnavailableException(
        'خدمة تحليل البشرة غير متاحة مؤقتاً. أعيدي المحاولة لاحقاً.',
      );
    }

    const previousBeautyScore = await this.loadPreviousBeautyScore(user.id);

    const capturedAt = new Date().toISOString();
    const providerAudit = rawYouCam
      ? {
          capturedAt,
          provider: providerName ?? 'perfect_corp',
          isMock: false,
          redacted: redactYouCamAudit(rawYouCam, capturedAt),
        }
      : isMock
        ? {
            capturedAt,
            provider: providerName ?? 'mock_skin',
            isMock: true,
          }
        : undefined;

    if (providerAudit) {
      assertNoRawYouCamInAudit(providerAudit);
    }

    const parsedFace = parseFaceIntelPackage(faceIntelRaw);
    const faceIntel: FaceReportPipelineInput | undefined = parsedFace.input;

    let miraReportBase: MiraBeautyReport;
    try {
      miraReportBase = await this.intelligence.buildBeautyReport(skinInternal, {
        birthYear: prefs?.birthYear ?? null,
        rawYouCam,
        previousBeautyScore,
        isMock: isMock === true,
        providerName: providerName ?? (isMock ? 'mock_skin' : 'perfect_corp'),
        providerVersion: portResult.meta.providerVersion,
        captureQuality,
        portMetrics: portResult.metrics,
        portMeta: portResult.meta,
        captureVersion: 'cq-thresholds-v2.1',
        qualityVersion: quality.meta.calculationVersion,
        // Operational Hardening — single Face Report pipeline + explicit runtime.
        faceIntel,
        faceIntelRuntime: parsedFace.runtime,
      });
    } catch (err) {
      throw new ServiceUnavailableException(
        err instanceof Error
          ? err.message
          : 'تعذر بناء تقرير التحليل بأمان',
      );
    }

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
        scoreSchemaVersion: miraReport.scoreSchemaVersion,
        isMock: isMock === true,
        provider: providerName,
        traceId,
      },
    });

    return SkinAnalysisResponseDto.from(
      record.id,
      record.createdAt,
      miraReport,
      {
        ...skinInternal,
        beautyScore: miraReport.overallBeautyScore,
      },
    );
  }

  private async loadPreviousBeautyScore(userId: string): Promise<number | null> {
    const previous = await this.prisma.skinAnalysis.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: { resultJson: true },
    });
    if (!previous) return null;

    const report = extractMiraReportFromStored(previous.resultJson);
    if (report?.overallBeautyScore != null) return report.overallBeautyScore;

    const legacy = extractLegacySkinFromStored(previous.resultJson);
    if (legacy?.beautyScore != null) return Math.round(legacy.beautyScore);
    return null;
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
