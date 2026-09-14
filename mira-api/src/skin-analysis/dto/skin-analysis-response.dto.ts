import { SkinAnalysisResult } from '../../ai/contracts/skin-analysis-result.interface';
import {
  isStoredSkinAnalysisV2,
  MiraBeautyReport,
  StoredSkinAnalysisPayload,
} from '../../intelligence/contracts/mira-beauty-report.interface';

export class SkinAnalysisResponseDto {
  id!: string;
  createdAt!: string;
  /** User-facing Mira Intelligence report — no raw provider metrics. */
  miraReport!: MiraBeautyReport;
  /** @deprecated Internal legacy shape — omit in new clients. */
  skin?: SkinAnalysisResult;
  /**
   * Session-only Perfect HD masks for Face Explorer.
   * Never stored in History / resultJson.
   */
  ephemeralMasks?: Array<{
    concernType: string;
    region?: string;
    rawScore?: number;
    uiScore?: number;
    outputMaskName?: string;
    scoreOnly: boolean;
    width?: number;
    height?: number;
    alignedWithSource?: boolean | null;
    contentType?: string;
    maskBase64?: string;
  }>;

  static from(
    id: string,
    createdAt: Date,
    miraReport: MiraBeautyReport,
    skinInternal?: SkinAnalysisResult,
    ephemeralMasks?: SkinAnalysisResponseDto['ephemeralMasks'],
  ): SkinAnalysisResponseDto {
    return {
      id,
      createdAt: createdAt.toISOString(),
      miraReport,
      skin: skinInternal,
      ...(ephemeralMasks?.length ? { ephemeralMasks } : {}),
    };
  }
}

export function buildStoredPayload(
  miraReport: MiraBeautyReport,
  providerAudit?: StoredSkinAnalysisPayload['providerAudit'],
): StoredSkinAnalysisPayload {
  return {
    version: 2,
    miraReport,
    ...(providerAudit ? { providerAudit } : {}),
  };
}

export function extractMiraReportFromStored(
  stored: unknown,
): MiraBeautyReport | null {
  if (isStoredSkinAnalysisV2(stored)) {
    return stored.miraReport;
  }
  return null;
}

export function extractLegacySkinFromStored(
  stored: unknown,
): SkinAnalysisResult | null {
  if (isStoredSkinAnalysisV2(stored)) {
    return null;
  }
  if (typeof stored === 'object' && stored !== null && 'beautyScore' in stored) {
    return stored as SkinAnalysisResult;
  }
  return null;
}
