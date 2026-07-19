import { SkinAnalysisResult } from './skin-analysis-result.interface';

/** Internal provider output — raw YouCam never leaves the server in API responses. */
export interface SkinAnalysisProviderResult {
  result: SkinAnalysisResult;
  /** Full YouCam task `data` object when available (in-memory spatial parsing only). */
  rawYouCam?: Record<string, unknown>;
  /** Phase 0 — true when result is fabricated (tests/dev/demo only). */
  isMock?: boolean;
  providerName?: string;
}
