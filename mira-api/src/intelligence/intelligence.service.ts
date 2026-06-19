import { Injectable } from '@nestjs/common';
import { SkinAnalysisResult } from '../ai/contracts/skin-analysis-result.interface';
import { MarketplaceService } from '../marketplace/marketplace.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  MiraBeautyReport,
  ProgressForecastPayload,
} from './contracts/mira-beauty-report.interface';
import { buildAgeComparison } from './pipeline/age-intelligence';
import {
  applyChildSafetyGuard,
  filterConcernsForSafety,
  toChildSafetyPayload,
} from './pipeline/child-safety-guard';
import { mapFaceZones } from './pipeline/face-zone-mapper';
import {
  buildConcernNarratives,
  buildHeadlineAr,
  buildTipsAr,
} from './pipeline/narrative-engine';
import {
  buildProgressForecast,
  ProgressHistoryEntry,
} from './pipeline/progress-engine';
import { buildTreatmentPlan } from './pipeline/treatment-plan-engine';
import { buildWeeklyPlan } from './pipeline/weekly-plan-engine';
import { buildBeautyJourney } from './pipeline/beauty-journey-engine';
import { buildConfidenceLayer } from './pipeline/confidence-layer';
import { computeBeautyScore } from './pipeline/beauty-score-engine';
import {
  extractLegacySkinFromStored,
  extractMiraReportFromStored,
} from '../skin-analysis/dto/skin-analysis-response.dto';

@Injectable()
export class IntelligenceService {
  constructor(
    private readonly marketplace: MarketplaceService,
    private readonly prisma: PrismaService,
  ) {}

  async buildBeautyReport(
    skin: SkinAnalysisResult,
    options?: {
      city?: string;
      birthYear?: number | null;
      rawYouCam?: unknown;
      previousBeautyScore?: number | null;
    },
  ): Promise<MiraBeautyReport> {
    const safety = applyChildSafetyGuard({
      birthYear: options?.birthYear,
      skinAge: skin.skinAge,
    });

    const mainConcerns = filterConcernsForSafety(
      buildConcernNarratives(skin),
      safety,
    );
    const dailyRoutine = buildTreatmentPlan(skin);
    const weeklyPlan = buildWeeklyPlan(skin, dailyRoutine);
    const zone = mapFaceZones(skin, options?.rawYouCam);

    const match = await this.marketplace.match({
      skinTypeAr: skin.skinTypeAr,
      hydration: skin.hydration,
      oiliness: skin.oiliness,
      concernScores: skin.concernScores,
      city: options?.city ?? 'الرياض',
      undertoneEn: skin.undertoneEn,
      userAge: safety.sanitizedSkinAge ?? undefined,
    });

    const tipsAr = buildTipsAr(skin);
    const ageComparison = buildAgeComparison({
      birthYear: options?.birthYear,
      skinAge: skin.skinAge,
      safety,
      concernIds: mainConcerns.map((c) => c.id),
    });

    const beautyScore = computeBeautyScore(skin, {
      previousScore: options?.previousBeautyScore,
    });

    const base: MiraBeautyReport = {
      version: 1,
      spatialConfidence: zone.spatialConfidence,
      overallBeautyScore: beautyScore.finalScore,
      headlineAr: buildHeadlineAr(skin),
      skinTypeAr: skin.skinTypeAr,
      skinTypeEn: skin.skinTypeEn,
      skinAgeEstimate: safety.sanitizedSkinAge,
      ageComparison,
      childSafety: toChildSafetyPayload(safety),
      mainConcerns,
      dailyRoutine,
      summaryAdviceAr: tipsAr[0] ?? mainConcerns[0]?.narrativeAr ?? '',
      tipsAr,
      faceMap: zone.faceMap,
      faceHealthMap: zone.faceHealthMap,
      concernZonesSection: zone.concernZonesSection,
      concernZonesNarrative: zone.concernZonesNarrative,
      recommendedProducts: match.products.slice(0, 6).map((p) => ({
        id: p.id,
        nameAr: p.nameAr,
        nameEn: p.nameEn,
        partnerNameAr: p.partnerNameAr,
        priceLabel: p.priceLabel,
        externalUrl: p.externalUrl,
        stepAr: p.stepAr,
        matchScore: p.matchScore,
      })),
      weeklyPlan,
      progressForecast: buildProgressForecast([]),
    } as MiraBeautyReport;

    return this.enrichReportLayers(base);
  }

  private enrichReportLayers(report: MiraBeautyReport): MiraBeautyReport {
    const beautyJourney = buildBeautyJourney(report);
    const withJourney = { ...report, beautyJourney };
    return {
      ...withJourney,
      confidenceLayer: buildConfidenceLayer(withJourney),
    };
  }

  async attachProgressForecast(
    userId: string,
    report: MiraBeautyReport,
    currentAnalysisId?: string,
  ): Promise<MiraBeautyReport> {
    const history = await this.loadProgressHistory(userId);
    const entries: ProgressHistoryEntry[] = [
      ...history.filter((e) => e.id !== currentAnalysisId),
      {
        id: currentAnalysisId ?? 'current',
        createdAt: new Date(),
        miraReport: report,
      },
    ];
    return this.enrichReportLayers({
      ...report,
      progressForecast: buildProgressForecast(entries),
    });
  }

  async getProgress(userId: string): Promise<ProgressForecastPayload> {
    const history = await this.loadProgressHistory(userId);
    return buildProgressForecast(history);
  }

  /** Re-apply age/safety when reading stored reports with current birth year. */
  enrichWithUserContext(
    report: MiraBeautyReport,
    options?: { birthYear?: number | null; skinAge?: number },
  ): MiraBeautyReport {
    const safety = applyChildSafetyGuard({
      birthYear: options?.birthYear,
      skinAge: options?.skinAge ?? report.skinAgeEstimate,
    });

    const mainConcerns = filterConcernsForSafety(
      report.mainConcerns,
      safety,
    );

    const ageComparison = buildAgeComparison({
      birthYear: options?.birthYear,
      skinAge: options?.skinAge ?? report.skinAgeEstimate,
      safety,
      concernIds: mainConcerns.map((c) => c.id),
    });

    return this.enrichReportLayers({
      ...report,
      skinAgeEstimate: safety.sanitizedSkinAge,
      mainConcerns,
      ageComparison,
      childSafety: toChildSafetyPayload(safety),
      progressForecast:
        report.progressForecast ?? buildProgressForecast([]),
    });
  }

  private async loadProgressHistory(
    userId: string,
  ): Promise<ProgressHistoryEntry[]> {
    const rows = await this.prisma.skinAnalysis.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      take: 20,
    });

    const entries: ProgressHistoryEntry[] = [];

    for (const row of rows) {
      let report = extractMiraReportFromStored(row.resultJson);
      if (!report) {
        const legacy = extractLegacySkinFromStored(row.resultJson);
        if (legacy) {
          report = await this.buildBeautyReport(legacy);
        }
      }
      if (!report) continue;
      entries.push({
        id: row.id,
        createdAt: row.createdAt,
        miraReport: report,
      });
    }

    return entries;
  }
}
