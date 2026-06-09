import { SkinAnalysisResult } from './skin-analysis-result.interface';

/** Internal provider output — raw YouCam never leaves the server in API responses. */
export interface SkinAnalysisProviderResult {
  result: SkinAnalysisResult;
  /** Full YouCam task `data` object when available (audit + spatial parsing). */
  rawYouCam?: Record<string, unknown>;
}
