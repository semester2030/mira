import { CAPTURE_QUALITY_THRESHOLDS } from './capture-quality.thresholds';
import sharp from 'sharp';

export type PixelMetrics = {
  blurLaplacianVariance: number;
  brightness: number;
  contrast: number;
  overExposureRatio: number;
  underExposureRatio: number;
  shadowImbalance: number;
  width: number;
  height: number;
  shortEdge: number;
  bytesPerPixel: number;
};

function luma(r: number, g: number, b: number): number {
  return r * 0.299 + g * 0.587 + b * 0.114;
}

export async function measurePixelMetrics(
  imageBytes: Buffer,
): Promise<PixelMetrics> {
  const { data, info } = await sharp(imageBytes, { failOn: 'none' })
    .rotate()
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const width = info.width;
  const height = info.height;
  const channels = info.channels;
  const xStep = Math.max(1, Math.floor(width / 48));
  const yStep = Math.max(1, Math.floor(height / 72));

  const sampleLuma = (x: number, y: number): number => {
    const cx = Math.min(Math.max(x, 0), width - 1);
    const cy = Math.min(Math.max(y, 0), height - 1);
    const i = (cy * width + cx) * channels;
    return luma(data[i], data[i + 1], data[i + 2]);
  };

  let brightSum = 0;
  let brightN = 0;
  let over = 0;
  let under = 0;
  const samples: number[] = [];

  for (let y = 0; y < height; y += yStep) {
    for (let x = 0; x < width; x += xStep) {
      const l = sampleLuma(x, y);
      brightSum += l;
      brightN++;
      samples.push(l);
      if (l > 245) over++;
      if (l < 18) under++;
    }
  }

  const brightness = brightN === 0 ? 0 : brightSum / brightN / 255;
  const mean =
    samples.length === 0
      ? 0
      : samples.reduce((a, b) => a + b, 0) / samples.length;
  let sumSq = 0;
  for (const s of samples) {
    const d = s - mean;
    sumSq += d * d;
  }
  const contrast =
    samples.length < 2
      ? 0
      : Math.min(1, Math.sqrt(sumSq / samples.length) / 255);

  let lapSum = 0;
  let lapSumSq = 0;
  let lapN = 0;
  for (let y = yStep; y < height - yStep; y += yStep) {
    for (let x = xStep; x < width - xStep; x += xStep) {
      const c = sampleLuma(x, y);
      const lap = Math.abs(
        -4 * c +
          sampleLuma(x - xStep, y) +
          sampleLuma(x + xStep, y) +
          sampleLuma(x, y - yStep) +
          sampleLuma(x, y + yStep),
      );
      lapSum += lap;
      lapSumSq += lap * lap;
      lapN++;
    }
  }
  const lapMean = lapN === 0 ? 0 : lapSum / lapN;
  const blurLaplacianVariance =
    lapN === 0 ? 0 : Math.max(0, lapSumSq / lapN - lapMean * lapMean);

  const mid = Math.floor(width / 2);
  let leftSum = 0;
  let leftN = 0;
  let rightSum = 0;
  let rightN = 0;
  for (let y = 0; y < height; y += yStep) {
    for (let x = 0; x < mid; x += xStep) {
      leftSum += sampleLuma(x, y);
      leftN++;
    }
    for (let x = mid; x < width; x += xStep) {
      rightSum += sampleLuma(x, y);
      rightN++;
    }
  }
  const shadowImbalance =
    leftN === 0 || rightN === 0
      ? 0
      : Math.abs(leftSum / leftN - rightSum / rightN) / 255;

  const shortEdge = Math.min(width, height);
  return {
    blurLaplacianVariance,
    brightness,
    contrast,
    overExposureRatio: brightN === 0 ? 0 : over / brightN,
    underExposureRatio: brightN === 0 ? 0 : under / brightN,
    shadowImbalance,
    width,
    height,
    shortEdge,
    bytesPerPixel: width * height > 0 ? imageBytes.length / (width * height) : 0,
  };
}

export function evaluateServerQualityGate(metrics: PixelMetrics): {
  acceptable: boolean;
  blockingReasons: string[];
  confidencePercent: number;
} {
  const t = CAPTURE_QUALITY_THRESHOLDS;
  const blocking: string[] = [];

  if (metrics.blurLaplacianVariance < t.minBlurVariance) blocking.push('blur');
  if (
    metrics.brightness < t.minBrightness ||
    metrics.brightness > t.maxBrightness
  ) {
    blocking.push('brightness');
  }
  if (metrics.overExposureRatio > t.maxOverExposureRatio) {
    blocking.push('overexposure');
  }
  if (metrics.underExposureRatio > t.maxUnderExposureRatio) {
    blocking.push('underexposure');
  }
  if (metrics.shadowImbalance > t.maxShadowImbalance) {
    blocking.push('shadow_imbalance');
  }
  if (metrics.shortEdge < t.minShortEdgePx) blocking.push('resolution');

  // contrast / dynamicRange: informational only — intentionally not blocking

  if (blocking.length > 0) {
    return { acceptable: false, blockingReasons: blocking, confidencePercent: 0 };
  }

  let score = 100;
  if (metrics.blurLaplacianVariance < t.warnBlurVariance) score -= 18;
  if (
    metrics.brightness < t.idealBrightnessLow ||
    metrics.brightness > t.idealBrightnessHigh
  ) {
    score -= 12;
  }
  if (metrics.shadowImbalance > t.warnShadowImbalance) score -= 8;
  const confidencePercent = Math.max(55, Math.min(100, Math.round(score)));
  const acceptable = confidencePercent >= 70;
  return {
    acceptable,
    blockingReasons: acceptable ? [] : ['overall_poor'],
    confidencePercent,
  };
}

/** @deprecated Use CAPTURE_QUALITY_THRESHOLDS — kept for import compatibility. */
export const SERVER_IMAGE_QUALITY_THRESHOLDS = CAPTURE_QUALITY_THRESHOLDS;
