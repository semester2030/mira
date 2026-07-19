/**
 * Face Intelligence public exports.
 * Release: 1.0.0 — Production Approved · Frozen.
 * Phase 4A–4E + 4.5 + Operational Hardening.
 * Future changes require docs/governance Change Request.
 */

export {
  FACE_INTELLIGENCE_RELEASE,
  FACE_INTELLIGENCE_RELEASE_STATUS,
  FACE_COMPATIBILITY_VERSION,
  FACE_ARCHITECTURE_LOCK_VERSION,
} from './release';

export {
  FACE_MODEL_VERSION,
  FACE_INTELLIGENCE_VERSION,
  FACE_FOUNDATION_VERSION,
  ALL_FACE_METRIC_IDS,
  CANONICAL_FACE_METRIC_CATALOG,
  buildSkeletonCanonicalFaceModel,
  unavailableFaceMetric,
} from './canonical-face.model';
export type {
  CanonicalFaceMetric,
  CanonicalFaceMetricId,
  CanonicalFaceModel,
} from './canonical-face.model';

export {
  evaluateMeasurementEligibility,
  MEASUREMENT_ELIGIBILITY_VERSION,
} from './measurement-eligibility';
export type {
  MeasurementEligibilityResult,
  PoseSignals,
} from './measurement-eligibility';

export {
  summarizeLandmarkInput,
  emptyLandmarkFrame,
  LANDMARK_FRAME_VERSION,
} from './landmark-frame';
export type { LandmarkFrameSummary, MeshRegionId } from './landmark-frame';

export {
  runFaceFoundationPipeline,
} from './foundation.pipeline';
export type {
  FaceFoundationInput,
  FaceFoundationResult,
} from './foundation.pipeline';

export {
  runFaceGeometryPipeline,
} from './geometry.pipeline';
export type {
  FaceGeometryPipelineInput,
  FaceGeometryPipelineResult,
} from './geometry.pipeline';

export {
  computeFaceGeometry,
  applyGeometryToCanonicalModel,
  FACE_GEOMETRY_VERSION,
  FACE_GEOMETRY_FORMULA_ID,
} from './geometry/face-geometry.engine';
export type { GeometryComputationResult } from './geometry/face-geometry.engine';

export {
  GEOMETRY_ANCHORS_VERSION,
  dist,
  anchorsAreValid,
} from './geometry/geometry-anchors';
export type { GeometryAnchors, NormPoint } from './geometry/geometry-anchors';

export {
  runFaceFeaturesPipeline,
} from './features.pipeline';
export type {
  FaceFeaturesPipelineInput,
  FaceFeaturesPipelineResult,
} from './features.pipeline';

export {
  classifyFaceShape,
  applyFaceShapeToCanonicalModel,
  faceShapeMetricFromClassification,
  FACE_SHAPE_VERSION,
  FACE_SHAPE_FORMULA_ID,
  FACE_SHAPE_IDS,
  FACE_SHAPE_LABELS,
} from './features/face-shape.classifier';
export type {
  FaceShapeId,
  FaceShapeClassification,
} from './features/face-shape.classifier';

export { buildFaceFindings } from './features/face-finding.engine';
export type {
  FaceFinding,
  FaceFindingSeverity,
  FaceFindingCategory,
} from './features/face-finding.engine';

export {
  runFaceRecommendationPipeline,
} from './recommendation.pipeline';
export type {
  FaceRecommendationPipelineInput,
  FaceRecommendationPipelineResult,
} from './recommendation.pipeline';

export {
  buildFaceRecommendations,
  assertFaceRecommendationEvidence,
  FACE_RECOMMENDATION_VERSION,
  FACE_RECOMMENDATION_ENGINE_ID,
} from './recommendation/face-recommendation.engine';
export type {
  FaceRecommendation,
  FaceRecommendationCategory,
} from './recommendation/face-recommendation.engine';

export {
  runFaceReportPipeline,
} from './report.pipeline';
export type {
  FaceReportPipelineInput,
  FaceReportPipelineResult,
} from './report.pipeline';

export { parseFaceIntelInput, parseFaceIntelPackage } from './parse-face-intel-input';
export type { ParsedFaceIntelPackage } from './parse-face-intel-input';

export {
  FACE_INTEL_RUNTIME_NOT_REQUESTED,
  parseFaceIntelRuntime,
  faceIntelRuntimeAvailable,
  faceIntelRuntimeUnavailable,
  faceIntelRuntimeFailed,
  faceIntelRuntimeSkipped,
} from './face-intel-runtime-state';
export type {
  FaceIntelRuntimeStateDto,
  FaceIntelRuntimeStatusWire,
} from './face-intel-runtime-state';

export {
  buildFaceIntelligenceReport,
  FACE_REPORT_VERSION,
} from './report/face-report.engine';
export type {
  FaceIntelligenceReportDto,
  FaceFeatureLayer,
} from './report/face-report.engine';

export {
  assertContractOk,
  auditFaceIntelligencePipeline,
  auditCanonicalFaceModel,
  auditFaceFindings,
  auditFaceRecommendations,
  auditFaceReportContract,
  auditFaceLocalization,
  auditFaceProviderLeakage,
  auditAttractivenessBan,
  FACE_CONTRACT_VERSION,
  FACE_VALIDATION_VERSION,
} from './validation/contract-audit';
export type {
  ContractAuditResult,
  ContractViolation,
} from './validation/contract-audit';

export {
  FACE_ANALYSIS_FIXTURES,
  runFaceFixturePipeline,
  normalizeFaceReportForSnapshot,
} from './validation/fixtures';
export type { FaceAnalysisFixture } from './validation/fixtures';
