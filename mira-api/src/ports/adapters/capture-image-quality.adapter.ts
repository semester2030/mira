import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FaceGateService } from '../../ai/face-gate/face-gate.service';
import { isProductionEnv } from '../../config/production-integrity';
import { buildResultMeta, newTraceId } from '../shared/result-meta';
import {
  ImageQualityPort,
  ImageQualityRequest,
  ImageQualityResult,
  ImageQualitySignal,
} from '../image-quality/image-quality.port';
import {
  evaluateServerQualityGate,
  measurePixelMetrics,
} from '../image-quality/pixel-image-metrics';
import { CAPTURE_QUALITY_THRESHOLDS } from '../image-quality/capture-quality.thresholds';

const ALL_SIGNAL_IDS = [
  'faceCount',
  'faceCoverage',
  'faceCentering',
  'yaw',
  'pitch',
  'roll',
  'eyeVisibility',
  'mouthVisibility',
  'occlusion',
  'hairObstruction',
  'glassesReflection',
  'blur',
  'brightness',
  'contrast',
  'dynamicRange',
  'overexposure',
  'underexposure',
  'shadowImbalance',
  'resolution',
  'resolutionShortEdge',
  'compressionQuality',
  'captureDistance',
  'cameraConfidence',
  'overallQuality',
  'overallConfidence',
] as const;

/**
 * Phase 2.1 — pixel quality + BlazeFace presence (no inferred faceCount).
 */
@Injectable()
export class CaptureImageQualityAdapter implements ImageQualityPort {
  constructor(
    private readonly faceGate: FaceGateService,
    private readonly config: ConfigService,
  ) {}

  async evaluate(request: ImageQualityRequest): Promise<ImageQualityResult> {
    const traceId = request.traceId ?? newTraceId('iq');
    const byId = new Map<string, ImageQualitySignal>();
    for (const id of ALL_SIGNAL_IDS) {
      byId.set(id, {
        id,
        available: false,
        status: 'unavailable',
        limitations: ['Not measured on server for this signal'],
      });
    }

    const setMeasured = (
      id: string,
      value: number,
      unit?: string,
      limitations?: string[],
    ) => {
      byId.set(id, {
        id,
        value,
        available: true,
        status: 'measured',
        unit,
        limitations,
      });
    };

    let overallAcceptable: boolean | null = null;
    let confidence = 0;
    const limitations: string[] = [];

    if (!request.imageBytes?.length) {
      return {
        signals: [...byId.values()],
        overallAcceptable: false,
        meta: buildResultMeta({
          source: 'local_measured',
          provider: 'image_quality_gate',
          calculationVersion: 'iq-v2.1+qc-v1.1',
          confidence: 0,
          isMock: false,
          isProduction: isProductionEnv(this.config.get<string>('NODE_ENV')),
          traceId,
          limitations: ['Empty image buffer'],
        }),
      };
    }

    try {
      const metrics = await measurePixelMetrics(request.imageBytes);
      setMeasured('blur', metrics.blurLaplacianVariance, 'laplacian_variance', [
        'Subsampled luma Laplacian variance',
      ]);
      setMeasured('brightness', metrics.brightness, 'mean_luma_0_1');
      setMeasured('contrast', metrics.contrast, 'luma_stddev_0_1', [
        `Role=${CAPTURE_QUALITY_THRESHOLDS.contrastDynamicRangeRole} — not used in proceed/block`,
      ]);
      setMeasured(
        'dynamicRange',
        Math.min(1, metrics.contrast * 2),
        'proxy_0_1',
        [
          `Role=${CAPTURE_QUALITY_THRESHOLDS.contrastDynamicRangeRole} — derived from contrast; not HDR`,
        ],
      );
      setMeasured('overexposure', metrics.overExposureRatio, 'pixel_ratio');
      setMeasured('underexposure', metrics.underExposureRatio, 'pixel_ratio');
      setMeasured('shadowImbalance', metrics.shadowImbalance, 'luma_delta_0_1');
      setMeasured('resolutionShortEdge', metrics.shortEdge, 'px');
      setMeasured('resolution', metrics.width * metrics.height, 'px_area');
      setMeasured(
        'compressionQuality',
        metrics.bytesPerPixel,
        'bytes_per_pixel',
        ['Heuristic from buffer size / pixel area'],
      );

      const gate = evaluateServerQualityGate(metrics);
      overallAcceptable = gate.acceptable;
      confidence = gate.confidencePercent;
      if (!gate.acceptable) {
        limitations.push(...gate.blockingReasons.map((r) => `blocked:${r}`));
      }

      setMeasured('overallQuality', confidence / 100, 'score_0_1');
      setMeasured('overallConfidence', confidence / 100, 'score_0_1', [
        'qc-v1.1 server map',
      ]);
    } catch {
      overallAcceptable = false;
      limitations.push('pixel_metrics_failed');
    }

    if (request.context === 'skin') {
      const detection = await this.faceGate.detectFaces(request.imageBytes);
      if (!detection) {
        overallAcceptable = false;
        limitations.push('blocked:face_detector_unavailable');
        // faceCount stays unavailable — never invent 1
      } else {
        setMeasured('faceCount', detection.faceCount, 'count', [
          `Detector=${detection.detectorId} maxScore=${detection.maxScore.toFixed(3)} minScore=${CAPTURE_QUALITY_THRESHOLDS.blazefaceMinScore}`,
        ]);

        const primary = detection.faces[0];
        try {
          const sharpLib = (await import('sharp')).default;
          const meta = await sharpLib(request.imageBytes, { failOn: 'none' })
            .rotate()
            .metadata();
          const iw = meta.width ?? 0;
          const ih = meta.height ?? 0;
          if (primary && iw > 0 && ih > 0) {
            const coverage =
              (primary.box.width * primary.box.height) / (iw * ih);
            setMeasured('faceCoverage', coverage, 'area_ratio', [
              'BlazeFace box area / image area',
            ]);
            const cx = (primary.box.x + primary.box.width / 2) / iw - 0.5;
            const cy = (primary.box.y + primary.box.height / 2) / ih - 0.46;
            const centering = Math.max(
              0,
              1 - (Math.abs(cx) + Math.abs(cy)) / 2,
            );
            setMeasured('faceCentering', centering, 'score_0_1', [
              'Derived from BlazeFace box center',
            ]);
          }
        } catch {
          // leave faceCoverage / faceCentering unavailable
        }

        // Pose (yaw/pitch/roll) not provided by BlazeFace — stay unavailable
        for (const id of ['yaw', 'pitch', 'roll'] as const) {
          byId.set(id, {
            id,
            available: false,
            status: 'unavailable',
            limitations: [
              'BlazeFace does not export Euler angles — measured on-device (ML Kit)',
            ],
          });
        }

        if (
          detection.faceCount !== CAPTURE_QUALITY_THRESHOLDS.requiredFaceCount ||
          detection.maxScore < CAPTURE_QUALITY_THRESHOLDS.blazefaceMinScore
        ) {
          overallAcceptable = false;
          confidence = 0;
          limitations.push(
            detection.faceCount > 1
              ? 'blocked:multiple_faces'
              : 'blocked:no_face',
          );
        }
      }
    }

    for (const id of [
      'occlusion',
      'hairObstruction',
      'glassesReflection',
      'captureDistance',
      'cameraConfidence',
      'eyeVisibility',
      'mouthVisibility',
    ] as const) {
      const cur = byId.get(id);
      if (cur && cur.status === 'unavailable') {
        byId.set(id, {
          ...cur,
          limitations: ['Not implemented — no fabricated value'],
        });
      }
    }

    return {
      signals: [...byId.values()],
      overallAcceptable,
      meta: buildResultMeta({
        source: 'local_measured',
        provider: 'image_quality_gate',
        calculationVersion: 'iq-v2.1+qc-v1.1',
        confidence,
        isMock: false,
        isProduction: isProductionEnv(this.config.get<string>('NODE_ENV')),
        traceId,
        limitations:
          limitations.length > 0
            ? limitations
            : [
                `Phase 2.1 BlazeFace + pixels · thresholds=${CAPTURE_QUALITY_THRESHOLDS.version}`,
              ],
      }),
    };
  }
}
