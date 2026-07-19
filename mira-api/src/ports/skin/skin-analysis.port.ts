import { ResultMeta } from '../shared/result-meta';
import { ProviderPortError } from '../shared/provider-error';

export const SKIN_ANALYSIS_PORT = Symbol('SKIN_ANALYSIS_PORT');

export interface SkinAnalysisRequest {
  imageBytes: Buffer;
  traceId?: string;
  requestId?: string;
  locale?: string;
}

/** Normalized metric — never invent values; use available=false. */
export interface SkinMetric {
  id: string;
  /** 0–100 when available */
  value?: number;
  available: boolean;
  source: ResultMeta['source'];
  confidence?: number;
  limitations?: string[];
}

export interface SkinAnalysisPortResult {
  metrics: SkinMetric[];
  skinTypeAr?: string;
  skinTypeEn?: string;
  undertoneAr?: string;
  undertoneEn?: string;
  /** Legacy internal shape for intelligence pipeline — not raw YouCam */
  legacyInternal: Record<string, unknown>;
  meta: ResultMeta;
  /**
   * In-memory only for spatial mapping — must never be persisted raw.
   * Adapters may attach; orchestrator redacts before storage.
   */
  _ephemeralRawYouCam?: Record<string, unknown>;
}

export interface SkinAnalysisPort {
  analyze(request: SkinAnalysisRequest): Promise<SkinAnalysisPortResult>;
}

export type SkinAnalysisPortError = ProviderPortError;
