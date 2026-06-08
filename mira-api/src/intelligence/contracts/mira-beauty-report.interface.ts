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
}

export interface StoredSkinAnalysisPayload {
  version: 2;
  miraReport: MiraBeautyReport;
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
