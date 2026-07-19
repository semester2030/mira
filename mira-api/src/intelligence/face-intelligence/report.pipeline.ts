/**
 * Phase 4E — Face Report pipeline.
 *
 * JUSTIFICATION: Builds public FaceIntelligenceReportDto from recommendation stage.
 * No Perfect product UI. Theme/UI binding is Flutter-side only.
 */

import {
  FaceRecommendationPipelineInput,
  runFaceRecommendationPipeline,
} from './recommendation.pipeline';
import {
  buildFaceIntelligenceReport,
  FACE_REPORT_VERSION,
  FaceIntelligenceReportDto,
} from './report/face-report.engine';

export interface FaceReportPipelineInput extends FaceRecommendationPipelineInput {
  captureVersion?: string;
  language?: 'ar' | 'en' | 'ar+en';
}

export interface FaceReportPipelineResult {
  report: FaceIntelligenceReportDto;
  reportVersion: typeof FACE_REPORT_VERSION;
}

export function runFaceReportPipeline(
  input: FaceReportPipelineInput,
): FaceReportPipelineResult {
  const reco = runFaceRecommendationPipeline(input);
  const report = buildFaceIntelligenceReport({
    analysisId: reco.analysisId,
    model: reco.model,
    shape: reco.shape,
    findings: reco.findings,
    recommendations: reco.recommendations,
    captureVersion: input.captureVersion,
    language: input.language,
  });

  return {
    report,
    reportVersion: FACE_REPORT_VERSION,
  };
}
