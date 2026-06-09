export type SpatialConfidence = 'none' | 'regional' | 'pixel';

export type { FaceHealthMapPayload } from './face_health_map.interface';
import type { FaceHealthMapPayload } from './face_health_map.interface';
import type { WeeklyPlanPayload } from './weekly-plan.interface';

export type ConcernSeverity = 'none' | 'mild' | 'moderate' | 'noticeable';

export interface ConcernNarrative {
  id: string;
  titleAr: string;
  narrativeAr: string;
  severity: ConcernSeverity;
}

export interface RoutineStep {
  id: string;
  nameAr: string;
  nameEn: string;
  stepAr: string;
  period: 'am' | 'pm' | 'both';
}

export interface DailyRoutinePlan {
  morning: RoutineStep[];
  evening: RoutineStep[];
}

export interface FaceMapZone {
  id:
    | 'forehead'
    | 'cheek_left'
    | 'cheek_right'
    | 'nose'
    | 'chin'
    | 'under_eye'
    | 'jawline';
  concerns: string[];
  source: 'perfect_corp';
  bounds?: { x: number; y: number; w: number; h: number };
}

export interface FaceMapPayload {
  enabled: boolean;
  zones: FaceMapZone[];
}

export interface ConcernZoneNarrative {
  id: string;
  zoneLabelAr: string;
  narrativeAr: string;
  concernIds: string[];
}

export interface ConcernZonesSectionPayload {
  enabled: boolean;
  mode: 'narrative_only' | 'spatial_map';
  spatialConfidence: SpatialConfidence;
  titleAr: string;
  disclaimerAr: string;
  zones: ConcernZoneNarrative[];
}

export interface RecommendedProductSummary {
  id: string;
  nameAr: string;
  nameEn: string;
  partnerNameAr: string;
  priceLabel: string;
  externalUrl: string;
  stepAr: string | null;
  matchScore: number;
}

export interface AgeComparisonInsight {
  id: string;
  titleAr: string;
  bodyAr: string;
}

export interface AgeComparisonPayload {
  enabled: boolean;
  userAge?: number;
  skinAge?: number;
  deltaYears?: number;
  headlineAr: string;
  summaryAr: string;
  causesAr: string[];
  opportunitiesAr: string[];
  insights: AgeComparisonInsight[];
  suppressedReason?:
    | 'missing_birth_year'
    | 'minor_user'
    | 'unrealistic_skin_age'
    | 'guest';
}

export interface ChildSafetyPayload {
  isMinor: boolean;
  ageThreshold: number;
  restrictionsApplied: string[];
  messageAr?: string;
}

export type ProgressDirection = 'improved' | 'regressed' | 'stable';

export interface ProgressTimelinePoint {
  analysisId: string;
  createdAt: string;
  overallScore: number;
}

export interface ProgressMetricTrend {
  id: 'moisture' | 'pore' | 'redness' | 'overall';
  labelAr: string;
  previousScore: number;
  currentScore: number;
  deltaPoints: number;
  direction: ProgressDirection;
  messageAr: string;
}

export interface ProgressMilestone {
  id: string;
  titleAr: string;
  descriptionAr: string;
}

export interface ProgressForecastPayload {
  enabled: boolean;
  scanCount: number;
  needsMoreScans: boolean;
  headlineAr: string;
  summaryAr: string;
  timeline: ProgressTimelinePoint[];
  trends: ProgressMetricTrend[];
  milestones: ProgressMilestone[];
  projectedOverallScore30Days?: number;
}

export type ConfidenceLevel = 'high' | 'medium' | 'low';

export interface JourneyPriority {
  rank: number;
  concernId: string;
  labelAr: string;
  currentScore: number;
  expectedGainPoints: number;
  rationaleAr: string;
}

export interface JourneyGoal {
  metricId: 'overall';
  labelAr: string;
  currentValue: number;
  targetValue: number;
  horizonDays: number;
  headlineAr: string;
  summaryAr: string;
}

export interface BeautyJourneyPayload {
  enabled: boolean;
  headlineAr: string;
  summaryAr: string;
  currentOverallScore: number;
  nextGoal: JourneyGoal;
  topOpportunity: JourneyPriority | null;
  priorities: JourneyPriority[];
  planSummaryAr: string;
  followUpAr: string;
}

export interface ConfidenceItem {
  id:
    | 'age_comparison'
    | 'journey_goal'
    | 'progress_forecast'
    | 'recommendations'
    | 'face_map';
  labelAr: string;
  level: ConfidenceLevel;
  reasonAr: string;
}

export interface ConfidenceLayerPayload {
  enabled: boolean;
  headlineAr: string;
  summaryAr: string;
  items: ConfidenceItem[];
}

/** User-facing report — no raw provider metrics. */
export interface MiraBeautyReport {
  version: 1;
  spatialConfidence: SpatialConfidence;
  overallBeautyScore: number;
  headlineAr: string;
  skinTypeAr: string;
  skinTypeEn: string;
  skinAgeEstimate?: number;
  ageComparison: AgeComparisonPayload;
  childSafety: ChildSafetyPayload;
  mainConcerns: ConcernNarrative[];
  dailyRoutine: DailyRoutinePlan;
  summaryAdviceAr: string;
  tipsAr: string[];
  faceMap: FaceMapPayload;
  faceHealthMap: FaceHealthMapPayload;
  concernZonesSection: ConcernZonesSectionPayload;
  concernZonesNarrative: string[];
  recommendedProducts: RecommendedProductSummary[];
  weeklyPlan: WeeklyPlanPayload;
  progressForecast: ProgressForecastPayload;
  beautyJourney: BeautyJourneyPayload;
  confidenceLayer: ConfidenceLayerPayload;
}

/** Server-only audit blob — never returned to Flutter clients. */
export interface StoredProviderAudit {
  rawYouCam?: Record<string, unknown>;
  capturedAt: string;
}

export interface StoredSkinAnalysisPayload {
  version: 2;
  miraReport: MiraBeautyReport;
  /** Optional YouCam raw task JSON for spatial audit (stripped from API). */
  providerAudit?: StoredProviderAudit;
}

export function isStoredSkinAnalysisV2(
  value: unknown,
): value is StoredSkinAnalysisPayload {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as StoredSkinAnalysisPayload).version === 2 &&
    typeof (value as StoredSkinAnalysisPayload).miraReport === 'object'
  );
}
