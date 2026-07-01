import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** Phase Q4 — calibrated weights/thresholds. Reference: #atelier-qel */
export type QelCalibrationProfile = {
  id: string;
  label: string;
  threshold: number;
  minSegmentIoU: number;
  weights: {
    identity: number;
    edge: number;
    material: number;
    region: number;
    color: number;
  };
};

const BASELINE: QelCalibrationProfile = {
  id: 'baseline',
  label: 'Q4 baseline — production default',
  threshold: 0.85,
  minSegmentIoU: 0.55,
  weights: {
    identity: 0.35,
    edge: 0.25,
    material: 0.2,
    region: 0.15,
    color: 0.05,
  },
};

const STRICT: QelCalibrationProfile = {
  id: 'strict',
  label: 'Q4 strict — higher trust bar',
  threshold: 0.88,
  minSegmentIoU: 0.62,
  weights: {
    identity: 0.4,
    edge: 0.22,
    material: 0.2,
    region: 0.13,
    color: 0.05,
  },
};

const PROFILES: Record<string, QelCalibrationProfile> = {
  baseline: BASELINE,
  strict: STRICT,
};

@Injectable()
export class QelCalibrationService {
  constructor(private readonly config: ConfigService) {}

  getProfile(): QelCalibrationProfile {
    const raw = this.config.get<string>('QEL_CALIBRATION_PROFILE')?.trim();
    if (raw && PROFILES[raw.toLowerCase()]) {
      return PROFILES[raw.toLowerCase()];
    }

    if (raw?.startsWith('{')) {
      try {
        const parsed = JSON.parse(raw) as Partial<QelCalibrationProfile>;
        return normalizeProfile(parsed);
      } catch {
        return BASELINE;
      }
    }

    const thresholdOverride = this.config.get<number>('QEL_ACCEPT_THRESHOLD');
    if (thresholdOverride && thresholdOverride > 0 && thresholdOverride < 1) {
      return { ...BASELINE, threshold: thresholdOverride };
    }

    return BASELINE;
  }
}

function normalizeProfile(partial: Partial<QelCalibrationProfile>): QelCalibrationProfile {
  const base = BASELINE;
  const w = partial.weights;
  const weights = {
    identity: w?.identity ?? base.weights.identity,
    edge: w?.edge ?? base.weights.edge,
    material: w?.material ?? base.weights.material,
    region: w?.region ?? base.weights.region,
    color: w?.color ?? base.weights.color,
  };
  const sum = weights.identity + weights.edge + weights.material + weights.region + weights.color;
  const normalized =
    sum > 0
      ? {
          identity: weights.identity / sum,
          edge: weights.edge / sum,
          material: weights.material / sum,
          region: weights.region / sum,
          color: weights.color / sum,
        }
      : base.weights;

  return {
    id: partial.id ?? 'custom',
    label: partial.label ?? 'Q4 custom profile',
    threshold: partial.threshold ?? base.threshold,
    minSegmentIoU: partial.minSegmentIoU ?? base.minSegmentIoU,
    weights: normalized,
  };
}
