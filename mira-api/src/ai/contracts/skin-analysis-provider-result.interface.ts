import { SkinAnalysisResult } from './skin-analysis-result.interface';
import { EphemeralHdMaskPayload } from '../services/materialize-hd-masks';

/** Internal provider output — raw YouCam never leaves the server in API responses. */
export interface SkinAnalysisProviderResult {
  result: SkinAnalysisResult;
  /** Full YouCam task `data` object when available (in-memory spatial parsing only). */
  rawYouCam?: Record<string, unknown>;
  /** Phase 0 — true when result is fabricated (tests/dev/demo only). */
  isMock?: boolean;
  providerName?: string;
  /**
   * Session-only Perfect HD masks for Face Explorer.
   * Must NOT be written to History / resultJson.
   */
  ephemeralMasks?: EphemeralHdMaskPayload[];
  sourceWidth?: number;
  sourceHeight?: number;
}
