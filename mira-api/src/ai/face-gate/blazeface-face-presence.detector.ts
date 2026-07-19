/**
 * Server face presence via TensorFlow.js BlazeFace.
 * Never infers faceCount from image dimensions alone.
 */
import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import * as tf from '@tensorflow/tfjs';
import * as blazeface from '@tensorflow-models/blazeface';
import sharp from 'sharp';
import { CAPTURE_QUALITY_THRESHOLDS } from '../../ports/image-quality/capture-quality.thresholds';

export const FACE_PRESENCE_DETECTOR = Symbol('FACE_PRESENCE_DETECTOR');

export type DetectedFace = {
  /** Normalized score 0–1 from BlazeFace probability. */
  score: number;
  box: { x: number; y: number; width: number; height: number };
};

export type FacePresenceResult = {
  faceCount: number;
  faces: DetectedFace[];
  /** Detector identity for audit / docs. */
  detectorId: 'blazeface_tfjs';
  detectorVersion: string;
  /** Max score among detections (0 if none). */
  maxScore: number;
};

export interface FacePresenceDetector {
  detect(imageBytes: Buffer): Promise<FacePresenceResult>;
}

@Injectable()
export class BlazeFacePresenceDetector
  implements FacePresenceDetector, OnModuleDestroy
{
  private readonly logger = new Logger(BlazeFacePresenceDetector.name);
  private model: blazeface.BlazeFaceModel | null = null;
  private initPromise: Promise<void> | null = null;

  async detect(imageBytes: Buffer): Promise<FacePresenceResult> {
    await this.ensureModel();
    const model = this.model!;
    const { data, info } = await sharp(imageBytes, { failOn: 'none' })
      .rotate()
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    if (info.channels !== 3) {
      return this.empty();
    }

    const tensor = tf.tensor3d(
      new Uint8Array(data),
      [info.height, info.width, 3],
    );
    try {
      const predictions = await model.estimateFaces(tensor, false);
      const minScore = CAPTURE_QUALITY_THRESHOLDS.blazefaceMinScore;
      const faces: DetectedFace[] = [];

      for (const p of predictions) {
        const score = Array.isArray(p.probability)
          ? Number(p.probability[0] ?? 0)
          : Number(p.probability ?? 0);
        if (score < minScore) continue;
        const topLeft = p.topLeft as [number, number];
        const bottomRight = p.bottomRight as [number, number];
        const x = topLeft[0];
        const y = topLeft[1];
        const width = bottomRight[0] - topLeft[0];
        const height = bottomRight[1] - topLeft[1];
        faces.push({ score, box: { x, y, width, height } });
      }

      const maxScore =
        faces.length === 0
          ? 0
          : Math.max(...faces.map((f) => f.score));

      return {
        faceCount: faces.length,
        faces,
        detectorId: 'blazeface_tfjs',
        detectorVersion: 'blazeface@0.0.7+tfjs',
        maxScore,
      };
    } finally {
      tensor.dispose();
    }
  }

  async onModuleDestroy(): Promise<void> {
    this.model = null;
  }

  private empty(): FacePresenceResult {
    return {
      faceCount: 0,
      faces: [],
      detectorId: 'blazeface_tfjs',
      detectorVersion: 'blazeface@0.0.7+tfjs',
      maxScore: 0,
    };
  }

  private async ensureModel(): Promise<void> {
    if (this.model) return;
    if (!this.initPromise) {
      this.initPromise = (async () => {
        await tf.setBackend('cpu');
        await tf.ready();
        this.model = await blazeface.load();
        this.logger.log(
          'BlazeFace model loaded (cpu) — server face presence ready',
        );
      })();
    }
    await this.initPromise;
  }
}
