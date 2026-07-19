import { ResultMeta } from '../shared/result-meta';

export const IMAGE_QUALITY_PORT = Symbol('IMAGE_QUALITY_PORT');

export interface ImageQualityRequest {
  imageBytes: Buffer;
  context: 'skin' | 'fashion' | 'generic';
  traceId?: string;
}

export interface ImageQualitySignal {
  id: string;
  /** Measured value when available */
  value?: number;
  available: boolean;
  /** Never invent neutral fakes — use unavailable */
  status: 'measured' | 'unavailable';
  unit?: string;
  limitations?: string[];
}

export interface ImageQualityResult {
  signals: ImageQualitySignal[];
  overallAcceptable: boolean | null;
  meta: ResultMeta;
}

export interface ImageQualityPort {
  evaluate(request: ImageQualityRequest): Promise<ImageQualityResult>;
}
