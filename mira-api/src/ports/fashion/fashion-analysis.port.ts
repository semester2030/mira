import { ResultMeta } from '../shared/result-meta';
import { ProviderPortError } from '../shared/provider-error';
import { CanonicalGarment } from '../../fashion-intelligence/garment/canonical-garment';
import { CanonicalFashionRuntime } from '../../fashion-intelligence/runtime/fashion-runtime-state';

export const FASHION_ANALYSIS_PORT = Symbol('FASHION_ANALYSIS_PORT');

export interface FashionAnalysisRequest {
  imageBytes: Buffer;
  occasionId: string;
  mode?: 'quick' | 'smart';
  locale?: string;
  traceId?: string;
  requestId?: string;
  skinSnapshot?: Record<string, unknown> | null;
}

/**
 * @internal Legacy bridge shape — NOT part of the public FashionAnalysisPort contract.
 * Kept for migration / tests only. Do not return on public boundaries.
 */
export interface DetectedGarment {
  id: string;
  category?: string;
  subcategory?: string;
  color?: string;
  pattern?: string;
  /** Inferred only — never claim measured fabric */
  materialEstimate?: string;
  style?: string;
  occasion?: string;
  confidence: number;
  source: ResultMeta['source'];
  limitations?: string[];
}

/**
 * Public FashionAnalysisPort result (Phase 6C.1).
 * CanonicalGarment is the only public garment model.
 * FashionVisionDocument / DetectedGarment are internal — not returned here.
 */
export interface FashionAnalysisPortResult {
  garments: CanonicalGarment[];
  warnings: string[];
  limitations: string[];
  analysisGate: 'proceed' | 'degraded' | 'blocked';
  /** Optional Mira analysis payload (not FashionVisionDocument). */
  analysis: Record<string, unknown> | null;
  meta: ResultMeta;
  processingMs: number;
  userMessageAr?: string;
  /** Explicit mapping/runtime status — failures are never silent. */
  runtime: CanonicalFashionRuntime;
}

export interface FashionAnalysisPort {
  analyze(request: FashionAnalysisRequest): Promise<FashionAnalysisPortResult>;
}

export type FashionProviderError = ProviderPortError;
