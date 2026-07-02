import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { FashnGeometryProvider } from '../providers/fashn-geometry.provider';
import { GarmentRecolorVisionContext } from './garment-recolor-context.types';
import {
  bboxIoU,
  defaultBackgroundRect,
  defaultFaceRect,
  histogramSimilarity,
  measureRegion,
  resolveGarmentRect,
} from './image-region-metrics';
import { QelCalibrationService } from './qel-calibration.service';

export type QelSubScores = {
  identityScore: number;
  edgeScore: number;
  materialScore: number;
  regionIntegrityScore: number;
  colorConsistencyScore: number;
};

export type QelEvaluation = {
  accepted: boolean;
  weightedScore: number;
  threshold: number;
  subScores: QelSubScores;
  rejectReasons: string[];
  phase: 'Q1' | 'Q2' | 'Q3';
  cropFirst?: boolean;
  calibrationProfile?: string;
};

@Injectable()
export class GarmentQelService {
  private readonly logger = new Logger(GarmentQelService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly geometry: FashnGeometryProvider,
    private readonly calibration: QelCalibrationService,
  ) {}

  async evaluate(params: {
    original: Buffer;
    edited: Buffer;
    visionContext?: GarmentRecolorVisionContext;
    targetColorHex?: string;
    cropFirst?: boolean;
  }): Promise<QelEvaluation> {
    const profile = this.calibration.getProfile();
    const threshold = profile.threshold;
    const minSegmentIoU = profile.minSegmentIoU;
    const weights = profile.weights;
    const rejectReasons: string[] = [];

    const faceRect = defaultFaceRect();
    const garmentRect = resolveGarmentRect(params.visionContext);
    const bgRect = defaultBackgroundRect();

    const [faceBefore, faceAfter, garmentBefore, garmentAfter, bgBefore, bgAfter] =
      await Promise.all([
        measureRegion(params.original, faceRect),
        measureRegion(params.edited, faceRect),
        measureRegion(params.original, garmentRect),
        measureRegion(params.edited, garmentRect),
        measureRegion(params.original, bgRect),
        measureRegion(params.edited, bgRect),
      ]);

    const identityScore = histogramSimilarity(faceBefore, faceAfter);
    const skinToneDelta = Math.abs(faceBefore.meanLuma - faceAfter.meanLuma);
    const skinScore = Math.max(0, 1 - skinToneDelta * 3.5);
    const identityBlended = identityScore * 0.65 + skinScore * 0.35;

    if (identityBlended < 0.72) {
      rejectReasons.push('تغيّر ملامح الوجه أو لون البشرة');
    }

    const bgSim = histogramSimilarity(bgBefore, bgAfter);
    const edgeBleed =
      Math.abs(garmentAfter.laplacianVar - garmentBefore.laplacianVar) /
      Math.max(0.001, garmentBefore.laplacianVar);
    const edgeScore = Math.max(
      0,
      Math.min(1, bgSim * 0.55 + (1 - Math.min(1, edgeBleed * 0.8)) * 0.45),
    );
    if (edgeScore < 0.62) {
      rejectReasons.push('تسرّب لون أو حواف غير نظيفة');
    }

    const glossBefore = garmentBefore.p90Luma - garmentBefore.meanLuma;
    const glossAfter = garmentAfter.p90Luma - garmentAfter.meanLuma;
    const glossDelta = Math.abs(glossAfter - glossBefore);
    const contrastDelta = Math.abs(garmentAfter.localContrast - garmentBefore.localContrast);
    const foldDelta =
      Math.abs(garmentAfter.laplacianVar - garmentBefore.laplacianVar) /
      Math.max(0.001, garmentBefore.laplacianVar);

    let materialScore = 1 - glossDelta * 2.2 - contrastDelta * 1.4 - Math.max(0, foldDelta - 0.42) * 0.35;
    materialScore = Math.max(0, Math.min(1, materialScore));

    const glossLevel = params.visionContext?.glossLevel;
    if (glossLevel === 'matte' && glossAfter > glossBefore + 0.1) {
      materialScore *= 0.62;
      rejectReasons.push('تحوّل القماش من مطفي إلى لامع');
    }

    if (materialScore < 0.48) {
      rejectReasons.push('انجراف خامة القماش');
    }

    let regionIntegrityScore = 1;
    const segmentDriftEnabled = this.config.get<string>('QEL_SEGMENT_DRIFT', 'true') !== 'false';
    if (segmentDriftEnabled) {
      try {
        const editedGeometry = await this.geometry.segment(params.edited);
        const garmentSeg =
          editedGeometry.segments.find((s) => s.regionRole === 'full_body') ??
          editedGeometry.segments.find((s) => s.regionRole === 'upper') ??
          editedGeometry.segments[0];
        const editedBbox = garmentSeg?.bbox;
        if (editedBbox) {
          const iou = bboxIoU(garmentRect, editedBbox);
          regionIntegrityScore = Math.max(0, Math.min(1, iou / minSegmentIoU));
          if (iou < minSegmentIoU) {
            rejectReasons.push('انجراف حدود القطعة بعد التعديل');
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(`Segment drift check skipped: ${msg}`);
        regionIntegrityScore = 0.75;
      }
    }

    const colorConsistencyScore = Math.max(
      0,
      1 - Math.abs(garmentAfter.meanLuma - garmentBefore.meanLuma) * 0.35,
    );

    const subScores: QelSubScores = {
      identityScore: round(identityBlended),
      edgeScore: round(edgeScore),
      materialScore: round(materialScore),
      regionIntegrityScore: round(regionIntegrityScore),
      colorConsistencyScore: round(colorConsistencyScore),
    };

    const weightedScore = round(
      subScores.identityScore * weights.identity +
        subScores.edgeScore * weights.edge +
        subScores.materialScore * weights.material +
        subScores.regionIntegrityScore * weights.region +
        subScores.colorConsistencyScore * weights.color,
    );

    const accepted = weightedScore >= threshold && rejectReasons.length === 0;

    return {
      accepted,
      weightedScore,
      threshold,
      subScores,
      rejectReasons,
      phase: params.cropFirst ? 'Q2' : 'Q3',
      cropFirst: params.cropFirst,
      calibrationProfile: profile.id,
    };
  }
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}
