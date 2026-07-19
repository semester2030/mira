import { SkinAnalysisResult } from '../../ai/contracts/skin-analysis-result.interface';
import { SkinMetric } from '../../ports/skin/skin-analysis.port';
import { ResultMeta } from '../../ports/shared/result-meta';
import { CaptureQualitySignals } from '../pipeline/beauty-score-engine';
import { explainAllMetrics } from './explanation.engine';
import { mapToCanonicalSkinModel } from './provider-skin.mapper';
import {
  compareProgress,
  providersCompatible,
  snapshotFromModel,
} from './progress.engine';
import type { ProgressSnapshot } from './progress.engine';
import { buildRecommendations } from './recommendation.engine';
import {
  buildSkinIntelligenceReport,
  CAPTURE_VERSION_DEFAULT,
  QUALITY_VERSION_DEFAULT,
} from './report.engine';
import type { SkinIntelligenceReportDto } from './report.engine';
import { buildSkinFindings } from './skin-finding.engine';
import { computeSkinVitalityIndexV2 } from './svi-v2.engine';

export type { ProgressSnapshot } from './progress.engine';
export type { SkinIntelligenceReportDto } from './report.engine';
export { mapToCanonicalSkinModel } from './provider-skin.mapper';
export { computeSkinVitalityIndexV2 } from './svi-v2.engine';
export { buildSkinFindings } from './skin-finding.engine';
export { buildRecommendations } from './recommendation.engine';
export { compareProgress } from './progress.engine';

export interface SkinIntelligencePipelineInput {
  analysisId?: string;
  portMetrics?: SkinMetric[];
  legacy: SkinAnalysisResult;
  meta?: ResultMeta;
  captureQuality?: CaptureQualitySignals;
  captureVersion?: string;
  qualityVersion?: string;
  previousSnapshot?: ProgressSnapshot | null;
  /** When false, progress comparison is blocked. */
  sameCaptureQuality?: boolean;
}

export interface SkinIntelligencePipelineOutput {
  report: SkinIntelligenceReportDto;
  /** Score for legacy overallBeautyScore field */
  sviScore: number;
  sviConfidence: number;
  snapshot: ProgressSnapshot;
}

/**
 * Phase 3 pipeline: Canonical model → Findings → SVI v2 → Explain → Recommend → Progress → Report.
 */
export function runSkinIntelligencePipeline(
  input: SkinIntelligencePipelineInput,
): SkinIntelligencePipelineOutput {
  const analysisId = input.analysisId ?? 'pending';
  const model = mapToCanonicalSkinModel({
    portMetrics: input.portMetrics,
    legacy: input.legacy,
    meta: input.meta,
  });

  const findings = buildSkinFindings(model);

  const captureConfidence =
    input.captureQuality != null
      ? Math.round(
          Math.min(
            100,
            Math.max(
              40,
              (1 - (input.captureQuality.blurAmount ?? 0.2)) * 55 +
                (input.captureQuality.lightingQuality ?? 0.7) * 45 -
                Math.min(20, (input.captureQuality.faceAngleDegrees ?? 0) * 0.4),
            ),
          ),
        )
      : undefined;

  const svi = computeSkinVitalityIndexV2(model, { captureConfidence });
  const explanations = explainAllMetrics(model);
  const recommendations = buildRecommendations({ model, findings });

  const generatedAt = new Date().toISOString();
  const snapshot = snapshotFromModel({
    analysisId,
    model,
    svi,
    generatedAt,
    captureVersion: input.captureVersion ?? CAPTURE_VERSION_DEFAULT,
    qualityVersion: input.qualityVersion ?? QUALITY_VERSION_DEFAULT,
  });

  const previous = input.previousSnapshot ?? null;
  const compatibleProvider =
    previous != null &&
    providersCompatible(previous.provider, model.provider);
  const sameCaptureQuality =
    input.sameCaptureQuality !== false &&
    (previous == null ||
      (previous.captureVersion === snapshot.captureVersion &&
        previous.qualityVersion === snapshot.qualityVersion));

  const progress = compareProgress({
    previous,
    current: snapshot,
    sameCaptureQuality: previous == null ? true : sameCaptureQuality,
    compatibleProvider: previous == null ? true : compatibleProvider,
  });

  const report = buildSkinIntelligenceReport({
    analysisId,
    model,
    findings,
    svi,
    explanations,
    recommendations,
    progress,
    captureVersion: snapshot.captureVersion,
    qualityVersion: snapshot.qualityVersion,
  });

  return {
    report,
    sviScore: svi.score,
    sviConfidence: svi.confidence,
    snapshot,
  };
}
