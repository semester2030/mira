import { CanonicalFashionRuntime } from '../runtime/fashion-runtime-state';

export type FashionSessionState =
  | 'created'
  | 'enriched'
  | 'analyzing'
  | 'styling'
  | 'recommending'
  | 'saved'
  | 'shared'
  | 'closed';

export type FashionSessionSource =
  | 'camera'
  | 'upload'
  | 'wardrobe'
  | 'import'
  | 'system';

export type FashionAnalysisGate = 'proceed' | 'degraded' | 'blocked';

export interface FashionSessionTrust {
  level: import('../runtime/fashion-runtime-state').FashionTrustLevel;
  analysisGate?: FashionAnalysisGate;
  reasons: string[];
}

export interface FashionSessionAnalysisSources {
  skinReportId?: string;
  faceReportId?: string;
  /** Context only — never owns Skin/Face engines */
  extra?: Record<string, string>;
}

export interface FashionHistoryEvent {
  eventId: string;
  type: string;
  at: string;
  refs: string[];
  runtimeStatus?: string;
}

export interface FashionProgressSkeleton {
  goals: Array<{ goalId: string; labelEn: string; labelAr: string; done: boolean }>;
  completionRatio?: number;
  milestones: string[];
}

/** Server-only attempt — providerId stripped on public DTO */
export interface FashionAttempt {
  attemptId: string;
  sessionId: string;
  capabilityId: string;
  lookId?: string;
  runtime: CanonicalFashionRuntime;
  resultRefs: string[];
  /** SERVER ONLY */
  providerId?: string;
  createdAt: string;
}

/** Canonical Fashion Session — Phase 6A.5 §8 · implemented in 6B */
export interface CanonicalFashionSession {
  sessionId: string;
  userId?: string;
  version: string;
  state: FashionSessionState;
  source: FashionSessionSource;
  trust: FashionSessionTrust;
  analysisSources: FashionSessionAnalysisSources;
  garmentIds: string[];
  outfitIds: string[];
  wardrobeId?: string;
  lookIds: string[];
  favoriteIds: string[];
  collectionIds: string[];
  styleIds: string[];
  recommendationIds: string[];
  attemptIds: string[];
  history: FashionHistoryEvent[];
  progress: FashionProgressSkeleton;
  runtime: CanonicalFashionRuntime;
  createdAt: string;
  updatedAt: string;
  closedAt?: string;
}
