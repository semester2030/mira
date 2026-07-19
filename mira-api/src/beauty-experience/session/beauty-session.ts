import { BeautyCapabilityId } from '../capability/capability-ids';
import { BeautyRuntimeState } from '../runtime/beauty-runtime-state';
import { BeautyAnalysisSources, emptyAnalysisSources } from './analysis-sources';
import { BEAUTY_SESSION_VERSION } from '../release';
import { newTraceId } from '../../ports/shared/result-meta';

export type BeautySessionState =
  | 'created'
  | 'enriched'
  | 'recommending'
  | 'trying'
  | 'comparing'
  | 'saved'
  | 'shared'
  | 'closed';

/** Server-only attempt — may retain providerId for audit; stripped in public DTO */
export interface BeautyAttempt {
  attemptId: string;
  sessionId: string;
  capabilityId: BeautyCapabilityId;
  lookId: string;
  createdAt: string;
  runtime: BeautyRuntimeState;
  /** Server audit only — never on Flutter wire */
  providerId?: string;
  metrics?: Record<string, number | string | boolean | null>;
  resultRef?: string;
}

export interface BeautyLook {
  lookId: string;
  sessionId: string;
  labelEn?: string;
  labelAr?: string;
  attemptIds: string[];
  createdAt: string;
}

export interface BeautyFavorite {
  favoriteId: string;
  lookId: string;
  sessionId: string;
  createdAt: string;
}

export interface BeautyCollection {
  collectionId: string;
  titleEn: string;
  titleAr: string;
  lookIds: string[];
  createdAt: string;
}

export interface BeautyShareRecord {
  shareId: string;
  sessionId: string;
  lookId?: string;
  createdAt: string;
  revoked: boolean;
}

export interface BeautySession {
  sessionId: string;
  userId?: string;
  version: string;
  state: BeautySessionState;
  createdAt: string;
  updatedAt: string;
  analysisSources: BeautyAnalysisSources;
  attemptIds: string[];
  lookIds: string[];
  favoriteIds: string[];
  collectionIds: string[];
  shareIds: string[];
  runtime: BeautyRuntimeState;
}

export function createBeautySession(userId?: string): BeautySession {
  const now = new Date().toISOString();
  return {
    sessionId: newTraceId('bsess'),
    userId,
    version: BEAUTY_SESSION_VERSION,
    state: 'created',
    createdAt: now,
    updatedAt: now,
    analysisSources: emptyAnalysisSources(),
    attemptIds: [],
    lookIds: [],
    favoriteIds: [],
    collectionIds: [],
    shareIds: [],
    runtime: {
      status: 'NOT_REQUESTED',
      stage: 'idle',
      reasonEn: 'No capability executed yet.',
      reasonAr: 'لم تُنفَّذ أي قدرة بعد.',
      retryable: true,
    },
  };
}
