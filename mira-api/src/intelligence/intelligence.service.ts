import { Injectable } from '@nestjs/common';
import { SkinAnalysisResult } from '../ai/contracts/skin-analysis-result.interface';
import { MarketplaceService } from '../marketplace/marketplace.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  MiraBeautyReport,
  ProgressForecastPayload,
} from './contracts/mira-beauty-report.interface';
import {
  buildSkinVitalityProvenance,
  DISCLAIMER_AR,
  DISCLAIMER_EN,
  SCORE_SCHEMA_VERSION,
  SKIN_VITALITY_LABEL_AR,
  SKIN_VITALITY_LABEL_EN,
  SKIN_VITALITY_SUPPORTING_AR,
  assertDisplayableInProduction,
} from './contracts/result-provenance';
import { isProductionEnv } from '../config/production-integrity';
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
import { CaptureQualitySignals } from './pipeline/beauty-score-engine';
import {
  extractLegacySkinFromStored,
  extractMiraReportFromStored,
} from '../skin-analysis/dto/skin-analysis-response.dto';
import { SkinMetric } from '../ports/skin/skin-analysis.port';
import { buildResultMeta, ResultMeta } from '../ports/shared/result-meta';
import {
  ProgressSnapshot,
  runSkinIntelligencePipeline,
} from './skin-intelligence';
import {
  FaceReportPipelineInput,
  runFaceReportPipeline,
} from './face-intelligence';
import {
  FACE_INTEL_RUNTIME_NOT_REQUESTED,
  FaceIntelRuntimeStateDto,
  faceIntelRuntimeUnavailable,
} from './face-intelligence/face-intel-runtime-state';

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
      isMock?: boolean;
      providerName?: string;
      providerVersion?: string;
      captureQuality?: CaptureQualitySignals;
      /** Phase 3 — port metrics (never raw provider JSON). */
      portMetrics?: SkinMetric[];
      portMeta?: ResultMeta;
      analysisId?: string;
      previousProgressSnapshot?: ProgressSnapshot | null;
      captureVersion?: string;
      qualityVersion?: string;
      sameCaptureQuality?: boolean;
      /**
       * Phase 4E/4.5 — on-device face intel inputs (anchors/pose).
       * Operational Hardening — runtime is always explicit when provided.
       */
      faceIntel?: FaceReportPipelineInput;
      faceIntelRuntime?: FaceIntelRuntimeStateDto;
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

    const production = isProductionEnv(process.env.NODE_ENV);
    const isMock = options?.isMock === true;
    const provider =
      options?.providerName ?? (isMock ? 'mock_skin' : 'perfect_corp');

    const portMeta: ResultMeta =
      options?.portMeta ??
      buildResultMeta({
        source: isMock ? 'mock' : 'provider_measured',
        provider,
        providerVersion: options?.providerVersion,
        confidence: 70,
        isMock,
        isProduction: production,
        calculationVersion: 'svi-v2',
        limitations: ['Built without port meta — metrics from legacy skin only'],
      });

    const intel = runSkinIntelligencePipeline({
      analysisId: options?.analysisId ?? 'pending',
      portMetrics: options?.portMetrics,
      legacy: skin,
      meta: portMeta,
      captureQuality: options?.captureQuality,
      captureVersion: options?.captureVersion,
      qualityVersion: options?.qualityVersion,
      previousSnapshot: options?.previousProgressSnapshot,
      sameCaptureQuality: options?.sameCaptureQuality,
    });

    const provenance = buildSkinVitalityProvenance({
      isMock,
      provider,
      providerVersion: options?.providerVersion ?? options?.portMeta?.providerVersion,
      confidence: intel.sviConfidence,
      isProduction: production,
      limitations: [
        'Skin Vitality Index v2 — locally calculated from available metrics only (dynamic denominator).',
        'Not objective attractiveness, medical health, or clinical diagnosis.',
        ...intel.report.limitations.slice(0, 3),
      ],
    });
    assertDisplayableInProduction(provenance, production);

    const summaryFromIntel =
      intel.report.executiveSummaryAr ||
      tipsAr[0] ||
      mainConcerns[0]?.narrativeAr ||
      '';

    // Operational Hardening — Face Report pipeline executes at most once.
    let faceIntelligence: MiraBeautyReport['faceIntelligence'];
    let faceIntelligenceRuntime: FaceIntelRuntimeStateDto =
      options?.faceIntelRuntime ?? FACE_INTEL_RUNTIME_NOT_REQUESTED;

    if (options?.faceIntel) {
      const faceOut = runFaceReportPipeline({
        ...options.faceIntel,
        analysisId:
          options.faceIntel.analysisId ??
          options.analysisId ??
          'pending',
        captureVersion:
          options.faceIntel.captureVersion ?? options.captureVersion,
      });
      faceIntelligence = faceOut.report;
      if (
        (!options.faceIntelRuntime ||
          options.faceIntelRuntime.status === 'AVAILABLE') &&
        !faceOut.report.measurementEligible
      ) {
        faceIntelligenceRuntime = faceIntelRuntimeUnavailable(
          faceOut.report.eligibilityReasonCodes[0] ??
            'measurement_ineligible',
          'eligibility',
          30,
        );
      } else if (!options.faceIntelRuntime) {
        faceIntelligenceRuntime = {
          status: 'AVAILABLE',
          reason: 'face_intel_inputs_ready',
          stage: 'intelligence',
          confidence: 80,
          userVisibleAr: 'تم تجهيز قراءة الملامح.',
          userVisibleEn: 'Face feature reading is ready.',
        };
      } else {
        faceIntelligenceRuntime = options.faceIntelRuntime;
      }
    }

    const base: MiraBeautyReport = {
      version: 1,
      scoreSchemaVersion: SCORE_SCHEMA_VERSION,
      spatialConfidence: zone.spatialConfidence,
      overallBeautyScore: intel.sviScore,
      displayScoreLabelAr: SKIN_VITALITY_LABEL_AR,
      displayScoreLabelEn: SKIN_VITALITY_LABEL_EN,
      scoreSupportingAr: SKIN_VITALITY_SUPPORTING_AR,
      disclaimerAr: DISCLAIMER_AR,
      disclaimerEn: DISCLAIMER_EN,
      provenance,
      headlineAr: buildHeadlineAr(skin),
      skinTypeAr: skin.skinTypeAr,
      skinTypeEn: skin.skinTypeEn,
      skinAgeEstimate: safety.sanitizedSkinAge,
      ageComparison,
      childSafety: toChildSafetyPayload(safety),
      mainConcerns,
      dailyRoutine,
      summaryAdviceAr: summaryFromIntel,
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
      skinIntelligence: intel.report,
      faceIntelligence,
      faceIntelligenceRuntime,
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
