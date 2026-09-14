/**
 * Server face presence via TensorFlow.js BlazeFace.
 * Never infers faceCount from image dimensions alone.
 */
import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as tf from '@tensorflow/tfjs';
import * as blazeface from '@tensorflow-models/blazeface';
import sharp from 'sharp';
import { CAPTURE_QUALITY_THRESHOLDS } from '../../ports/image-quality/capture-quality.thresholds';
import { isProductionEnv } from '../../config/production-integrity';

export const FACE_PRESENCE_DETECTOR = Symbol('FACE_PRESENCE_DETECTOR');
export const BLAZEFACE_MODEL_SOURCE =
  'https://tfhub.dev/tensorflow/tfjs-model/blazeface/1/default/1';
export const BLAZEFACE_MODEL_VERSION = 'tfhub-blazeface-1-default-1';
export const BLAZEFACE_PACKAGE_VERSION = '0.1.0';

export type BlazeFaceRuntimeState = 'AVAILABLE' | 'LOADING' | 'UNAVAILABLE';

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
  implements FacePresenceDetector, OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(BlazeFacePresenceDetector.name);
  private model: blazeface.BlazeFaceModel | null = null;
  private initPromise: Promise<void> | null = null;
  private state: BlazeFaceRuntimeState = 'UNAVAILABLE';

  constructor(
    private readonly config: ConfigService = {
      get: <T>(_key: string, fallback?: T): T => fallback as T,
    } as ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    if (!isProductionEnv(this.config.get<string>('NODE_ENV'))) return;
    try {
      await this.ensureModel();
    } catch (error) {
      this.logger.error(
        `BlazeFace startup preload failed: ${safeErrorMessage(error)}`,
      );
      throw error;
    }
  }

  async detect(imageBytes: Buffer): Promise<FacePresenceResult> {
    try {
      await this.ensureModel();
    } catch {
      throw new ServiceUnavailableException({
        code: 'face_detector_unavailable',
        message: 'تعذر تجهيز التحقق من الوجه على الخادم. حاولي لاحقاً.',
        messageEn: 'Server face verification is unavailable. Try again later.',
      });
    }
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
        detectorVersion: `blazeface@${BLAZEFACE_PACKAGE_VERSION}+tfjs`,
        maxScore,
      };
    } finally {
      tensor.dispose();
    }
  }

  async onModuleDestroy(): Promise<void> {
    this.model?.dispose();
    this.model = null;
    this.initPromise = null;
    this.state = 'UNAVAILABLE';
  }

  runtimeStatus(): {
    state: BlazeFaceRuntimeState;
    modelSource: string;
    modelVersion: string;
    packageVersion: string;
    loadStrategy: 'production_startup_preload';
    timeoutMs: number;
    cache: 'process_memory';
  } {
    return {
      state: this.state,
      modelSource: BLAZEFACE_MODEL_SOURCE,
      modelVersion: BLAZEFACE_MODEL_VERSION,
      packageVersion: BLAZEFACE_PACKAGE_VERSION,
      loadStrategy: 'production_startup_preload',
      timeoutMs: this.loadTimeoutMs(),
      cache: 'process_memory',
    };
  }

  private empty(): FacePresenceResult {
    return {
      faceCount: 0,
      faces: [],
      detectorId: 'blazeface_tfjs',
      detectorVersion: `blazeface@${BLAZEFACE_PACKAGE_VERSION}+tfjs`,
      maxScore: 0,
    };
  }

  protected loadModel(): Promise<blazeface.BlazeFaceModel> {
    return blazeface.load();
  }

  protected async ensureModel(): Promise<void> {
    if (this.model) return;
    if (!this.initPromise) {
      this.initPromise = (async () => {
        this.state = 'LOADING';
        try {
          await tf.setBackend('cpu');
          await tf.ready();
          this.model = await withTimeout(
            this.loadModel(),
            this.loadTimeoutMs(),
          );
          this.state = 'AVAILABLE';
          this.logger.log(
            'BlazeFace model preloaded (cpu, process cache) — face presence ready',
          );
        } catch (error) {
          this.state = 'UNAVAILABLE';
          throw error;
        }
      })();
    }
    await this.initPromise;
  }

  private loadTimeoutMs(): number {
    const configured = Number(
      this.config.get<string>('BLAZEFACE_MODEL_LOAD_TIMEOUT_MS') ?? 20_000,
    );
    return Number.isFinite(configured) && configured > 0
      ? Math.min(configured, 120_000)
      : 20_000;
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () =>
        reject(
          new Error(`BlazeFace model load timed out after ${timeoutMs}ms`),
        ),
      timeoutMs,
    );
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function safeErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'unknown model load error';
}
