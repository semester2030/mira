import { BadRequestException, Inject, Injectable, Optional } from '@nestjs/common';
import sharp from 'sharp';
import { FACE_GATE_MESSAGES } from './youcam-face-errors';
import {
  FACE_PRESENCE_DETECTOR,
  FacePresenceDetector,
  FacePresenceResult,
} from './blazeface-face-presence.detector';
import { CAPTURE_QUALITY_THRESHOLDS } from '../../ports/image-quality/capture-quality.thresholds';

const MIN_EDGE_PX = 320;
const MAX_EDGE_PX = 8000;
const MAX_BYTES = 10 * 1024 * 1024;
const MAX_ASPECT_RATIO = 2.6;

export type FaceGateAssertResult = {
  structuralOk: true;
  face: FacePresenceResult;
};

/**
 * Structural checks + BlazeFace presence.
 * Never sets faceCount without detector evidence.
 */
@Injectable()
export class FaceGateService {
  constructor(
    @Optional()
    @Inject(FACE_PRESENCE_DETECTOR)
    private readonly faceDetector?: FacePresenceDetector,
  ) {}

  /** Structural validation only (legacy helper). Prefer assertAnalyzablePhoto. */
  async assertStructural(imageBuffer: Buffer): Promise<void> {
    if (!imageBuffer?.length) {
      throw new BadRequestException(FACE_GATE_MESSAGES.empty);
    }
    if (imageBuffer.length > MAX_BYTES) {
      throw new BadRequestException(FACE_GATE_MESSAGES.tooLarge);
    }

    let meta: sharp.Metadata;
    try {
      meta = await sharp(imageBuffer, { failOn: 'none' }).rotate().metadata();
    } catch {
      throw new BadRequestException(FACE_GATE_MESSAGES.invalidImage);
    }

    const width = meta.width ?? 0;
    const height = meta.height ?? 0;
    if (width < MIN_EDGE_PX || height < MIN_EDGE_PX) {
      throw new BadRequestException(FACE_GATE_MESSAGES.tooSmall);
    }
    if (width > MAX_EDGE_PX || height > MAX_EDGE_PX) {
      throw new BadRequestException(FACE_GATE_MESSAGES.tooLarge);
    }
    const shortEdge = Math.min(width, height);
    const longEdge = Math.max(width, height);
    if (longEdge / shortEdge > MAX_ASPECT_RATIO) {
      throw new BadRequestException(FACE_GATE_MESSAGES.extremeAspect);
    }
  }

  /**
   * Full gate: structure + real face detection.
   * Rejects when detector missing, faceCount ≠ 1, or score below threshold.
   */
  async assertAnalyzablePhoto(imageBuffer: Buffer): Promise<FaceGateAssertResult> {
    await this.assertStructural(imageBuffer);

    if (!this.faceDetector) {
      throw new BadRequestException({
        code: 'face_detector_unavailable',
        message: 'تعذر التحقق من الوجه على الخادم — أعيدي المحاولة لاحقاً.',
        messageEn: 'Server face verification unavailable — try again later.',
      });
    }

    const face = await this.faceDetector.detect(imageBuffer);
    const required = CAPTURE_QUALITY_THRESHOLDS.requiredFaceCount;
    const minScore = CAPTURE_QUALITY_THRESHOLDS.blazefaceMinScore;

    if (face.faceCount < 1 || face.maxScore < minScore) {
      throw new BadRequestException({
        code: 'no_face',
        message:
          'لم نتعرف على وجه حقيقي في الصورة — التقطي selfie واضح بإضاءة أمامية.',
        messageEn:
          'No real face detected — take a clear selfie with front lighting.',
        detector: face.detectorId,
        faceCount: face.faceCount,
        maxScore: face.maxScore,
      });
    }

    if (face.faceCount > required) {
      throw new BadRequestException({
        code: 'multiple_faces',
        message: 'وجدنا أكثر من وجه — التقطي صورة لوجه واحد فقط.',
        messageEn: 'Multiple faces detected — capture one face only.',
        detector: face.detectorId,
        faceCount: face.faceCount,
      });
    }

    return { structuralOk: true, face };
  }

  /** Detect faces without throwing (for ImageQualityPort signals). */
  async detectFaces(imageBuffer: Buffer): Promise<FacePresenceResult | null> {
    if (!this.faceDetector) return null;
    return this.faceDetector.detect(imageBuffer);
  }
}
