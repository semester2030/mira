import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import {
  extractLegacySkinFromStored,
  extractMiraReportFromStored,
} from '../../skin-analysis/dto/skin-analysis-response.dto';
import { IntelligenceService } from '../../intelligence/intelligence.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  MceContextSnapshotV1,
  MceFactEntry,
} from '../contracts/mce-context-snapshot.v1';
import { parseOutfitContextFromStored } from '../parsers/mce-outfit-context.parser';
import { MceFactExtractorService } from './mce-fact-extractor.service';

export interface GroundingInput {
  userId: string;
  skinAnalysisId?: string;
  outfitAnalysisId?: string;
  recolorAttemptId?: string;
  locale: string;
  birthYear?: number | null;
  subscriptionPlan: string;
  statedGoalAr?: string;
  occasionId?: string;
}

export interface GroundingResult {
  snapshot: MceContextSnapshotV1;
  factRegistry: MceFactEntry[];
  contentHash: string;
  skinAnalysisId?: string;
  outfitAnalysisId?: string;
  recolorAttemptId?: string;
}

@Injectable()
export class MceGroundingPipelineService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly intelligence: IntelligenceService,
    private readonly factExtractor: MceFactExtractorService,
  ) {}

  async build(input: GroundingInput): Promise<GroundingResult> {
    if (!input.skinAnalysisId && !input.outfitAnalysisId && !input.recolorAttemptId) {
      throw new BadRequestException('يجب ربط تحليل بشرة أو إطلالة أو تلوين على الأقل');
    }

    let snapshot = this.factExtractor.emptySnapshotShell({
      locale: input.locale,
      subscriptionPlan: input.subscriptionPlan,
      birthYear: input.birthYear,
      statedGoalAr: input.statedGoalAr,
      occasionId: input.occasionId,
    });

    if (input.skinAnalysisId) {
      const row = await this.prisma.skinAnalysis.findFirst({
        where: { id: input.skinAnalysisId, userId: input.userId },
      });
      if (!row) throw new NotFoundException('تحليل البشرة غير موجود');

      let report = extractMiraReportFromStored(row.resultJson);
      if (!report) {
        const legacy = extractLegacySkinFromStored(row.resultJson);
        if (legacy) {
          report = await this.intelligence.buildBeautyReport(legacy, {
            birthYear: input.birthYear ?? null,
          });
        }
      }
      if (!report) {
        throw new BadRequestException('تنسيق تحليل البشرة غير مدعوم لـ MCE');
      }

      report = this.intelligence.enrichWithUserContext(report, {
        birthYear: input.birthYear ?? null,
      });
      report = await this.intelligence.attachProgressForecast(
        input.userId,
        report,
        row.id,
      );

      snapshot.skin = this.factExtractor.buildSkinSummary(row.id, report);
      snapshot.user.isMinor = report.childSafety.isMinor;
    }

    if (input.outfitAnalysisId) {
      const row = await this.prisma.outfitAnalysis.findFirst({
        where: { id: input.outfitAnalysisId, userId: input.userId },
      });
      if (!row) throw new NotFoundException('تحليل الإطلالة غير موجود');

      const parsed = parseOutfitContextFromStored(row.id, row.occasionId, row.resultJson);
      if (!parsed) {
        throw new BadRequestException('تنسيق تحليل الإطلالة غير مدعوم لـ MCE');
      }

      snapshot.outfit = this.factExtractor.buildOutfitSummary(parsed);
      if (!snapshot.occasionId) {
        snapshot.occasionId = parsed.occasionId;
      }
    }

    if (input.recolorAttemptId) {
      const row = await this.prisma.atelierRecolorAttempt.findFirst({
        where: { id: input.recolorAttemptId, userId: input.userId },
      });
      if (!row) throw new NotFoundException('تجربة التلوين غير موجودة');

      snapshot.atelier = this.factExtractor.buildAtelierSummary({
        recolorAttemptId: row.id,
        garmentLabelAr: row.garmentLabelAr,
        targetColorAr: row.targetColorAr,
        regionRole: row.regionRole ?? undefined,
        qelGate: row.qelGate === 'accept' ? 'accept' : 'rejected',
        qelScores:
          row.qelScoresJson && typeof row.qelScoresJson === 'object'
            ? (row.qelScoresJson as Record<string, number>)
            : undefined,
        rejectReasonAr: row.rejectReasonAr ?? undefined,
        recolorScope: 'color_only',
      });
    }

    const factRegistry = this.factExtractor.buildFactRegistry(snapshot);
    const contentHash = createHash('sha256')
      .update(JSON.stringify(snapshot))
      .digest('hex')
      .slice(0, 32);

    return {
      snapshot,
      factRegistry,
      contentHash,
      skinAnalysisId: input.skinAnalysisId,
      outfitAnalysisId: input.outfitAnalysisId,
      recolorAttemptId: input.recolorAttemptId,
    };
  }
}
