/**
 * Shared Perfect HD mask materialization — ONE download owner for acceptance + production Skin.
 * Session-only bytes; never persist signed URLs or mask images to History.
 */
import sharp from 'sharp';
import { PerfectHdMaskArtifact, PerfectHdMaskMaterialized } from '../contracts/perfect-hd-mask.types';

export type EphemeralHdMaskPayload = {
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
};

export async function materializeHdMaskArtifacts(
  artifacts: PerfectHdMaskArtifact[],
  sourceWidth: number,
  sourceHeight: number,
): Promise<{
  materialized: PerfectHdMaskMaterialized[];
  ephemeralMasks: EphemeralHdMaskPayload[];
}> {
  const materialized: PerfectHdMaskMaterialized[] = [];

  for (const art of artifacts) {
    const row: PerfectHdMaskMaterialized = {
      ...art,
      downloadOk: false,
    };
    const url = art.maskUrls[0];
    if (!url) {
      row.alignmentNotes = art.scoreOnly
        ? 'SCORE_ONLY_FOR_THIS_OUTPUT'
        : 'mask URL missing';
      materialized.push(row);
      continue;
    }
    try {
      const res = await fetch(url);
      if (!res.ok) {
        row.downloadError = `HTTP ${res.status}`;
        materialized.push(row);
        continue;
      }
      const buf = Buffer.from(await res.arrayBuffer());
      const contentType =
        res.headers.get('content-type') ?? 'application/octet-stream';
      const m = await sharp(buf, { failOn: 'none' }).metadata();
      row.bytes = buf;
      row.contentType = contentType;
      row.width = m.width;
      row.height = m.height;
      row.formatOk =
        m.format === 'png' ||
        m.format === 'jpeg' ||
        m.format === 'jpg' ||
        m.format === 'webp';
      row.downloadOk = true;
      if (row.width && row.height && sourceWidth && sourceHeight) {
        row.alignedWithSource =
          row.width === sourceWidth && row.height === sourceHeight;
        row.alignmentNotes = row.alignedWithSource
          ? 'mask dimensions == source dimensions (0 offset)'
          : `mask ${row.width}x${row.height} vs source ${sourceWidth}x${sourceHeight}`;
      } else {
        row.alignedWithSource = null;
        row.alignmentNotes = 'dimension compare incomplete';
      }
    } catch (e) {
      row.downloadError =
        e instanceof Error ? e.message.slice(0, 160) : 'download_failed';
    }
    materialized.push(row);
  }

  const ephemeralMasks: EphemeralHdMaskPayload[] = materialized.map((m) => ({
    concernType: m.concernType,
    region: m.region,
    rawScore: m.rawScore,
    uiScore: m.uiScore,
    outputMaskName: m.outputMaskName,
    scoreOnly: m.scoreOnly,
    width: m.width,
    height: m.height,
    alignedWithSource: m.alignedWithSource,
    contentType: m.contentType,
    maskBase64: m.bytes ? m.bytes.toString('base64') : undefined,
  }));

  for (const m of materialized) {
    if (m.bytes) m.bytes = undefined;
  }

  return { materialized, ephemeralMasks };
}

/** Strip hd_ prefix for existing Skin score mapping (one model tree). */
export function normalizeHdConcernType(type: string): string {
  const t = type.toLowerCase();
  return t.startsWith('hd_') ? t.slice(3) : t;
}
