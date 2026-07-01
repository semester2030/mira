import sharp from 'sharp';

import {
  GarmentRecolorVisionContext,
  NormalizedRect,
} from './garment-recolor-context.types';

export type RegionMetrics = {
  meanLuma: number;
  p90Luma: number;
  lumaStd: number;
  laplacianVar: number;
  localContrast: number;
};

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

function toPixelRect(
  rect: NormalizedRect,
  width: number,
  height: number,
): { left: number; top: number; width: number; height: number } {
  const left = Math.floor(clamp01(rect.x) * width);
  const top = Math.floor(clamp01(rect.y) * height);
  const w = Math.max(1, Math.floor(clamp01(rect.w) * width));
  const h = Math.max(1, Math.floor(clamp01(rect.h) * height));
  return {
    left: Math.min(left, width - 1),
    top: Math.min(top, height - 1),
    width: Math.min(w, width - left),
    height: Math.min(h, height - top),
  };
}

async function rawLumaGrid(image: Buffer): Promise<{
  width: number;
  height: number;
  luma: Float32Array;
}> {
  const { data, info } = await sharp(image).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const luma = new Float32Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const o = i * channels;
    const r = data[o];
    const g = data[o + 1];
    const b = data[o + 2];
    luma[i] = 0.299 * r + 0.587 * g + 0.114 * b;
  }
  return { width, height, luma };
}

function metricsFromLuma(
  luma: Float32Array,
  width: number,
  height: number,
  rect: { left: number; top: number; width: number; height: number },
): RegionMetrics {
  const values: number[] = [];
  const lap: number[] = [];
  const right = rect.left + rect.width;
  const bottom = rect.top + rect.height;

  for (let y = rect.top; y < bottom; y++) {
    for (let x = rect.left; x < right; x++) {
      const v = luma[y * width + x];
      values.push(v);
      if (x > rect.left && y > rect.top && x < width - 1 && y < height - 1) {
        const c = luma[y * width + x];
        const lapVal =
          -4 * c +
          luma[(y - 1) * width + x] +
          luma[(y + 1) * width + x] +
          luma[y * width + (x - 1)] +
          luma[y * width + (x + 1)];
        lap.push(Math.abs(lapVal));
      }
    }
  }

  if (!values.length) {
    return { meanLuma: 0, p90Luma: 0, lumaStd: 0, laplacianVar: 0, localContrast: 0 };
  }

  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const sorted = [...values].sort((a, b) => a - b);
  const p90 = sorted[Math.floor(sorted.length * 0.9)] ?? mean;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
  const std = Math.sqrt(variance);
  const lapMean = lap.length ? lap.reduce((a, b) => a + b, 0) / lap.length : 0;
  const lapVar =
    lap.length > 1
      ? lap.reduce((a, b) => a + (b - lapMean) ** 2, 0) / lap.length
      : 0;

  return {
    meanLuma: mean / 255,
    p90Luma: p90 / 255,
    lumaStd: std / 255,
    laplacianVar: lapVar / (255 * 255),
    localContrast: std / 255,
  };
}

export async function measureRegion(
  image: Buffer,
  rect: NormalizedRect,
): Promise<RegionMetrics> {
  const meta = await sharp(image).metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  if (width < 2 || height < 2) {
    return { meanLuma: 0, p90Luma: 0, lumaStd: 0, laplacianVar: 0, localContrast: 0 };
  }
  const grid = await rawLumaGrid(image);
  return metricsFromLuma(grid.luma, grid.width, grid.height, toPixelRect(rect, width, height));
}

export function bboxIoU(a: NormalizedRect, b: NormalizedRect): number {
  const ax2 = a.x + a.w;
  const ay2 = a.y + a.h;
  const bx2 = b.x + b.w;
  const by2 = b.y + b.h;
  const ix = Math.max(0, Math.min(ax2, bx2) - Math.max(a.x, b.x));
  const iy = Math.max(0, Math.min(ay2, by2) - Math.max(a.y, b.y));
  const inter = ix * iy;
  const union = a.w * a.h + b.w * b.h - inter;
  if (union <= 0) return 0;
  return inter / union;
}

export function defaultFaceRect(): NormalizedRect {
  return { x: 0.15, y: 0.02, w: 0.7, h: 0.28 };
}

export function resolveGarmentRect(ctx?: GarmentRecolorVisionContext): NormalizedRect {
  if (ctx?.garmentBbox && ctx.garmentBbox.w > 0.05 && ctx.garmentBbox.h > 0.05) {
    return ctx.garmentBbox;
  }
  if (ctx?.regionRole === 'lower') {
    return { x: 0.12, y: 0.45, w: 0.76, h: 0.42 };
  }
  return { x: 0.1, y: 0.18, w: 0.8, h: 0.38 };
}

export function defaultBackgroundRect(): NormalizedRect {
  return { x: 0.02, y: 0.72, w: 0.2, h: 0.22 };
}

export function histogramSimilarity(a: RegionMetrics, b: RegionMetrics): number {
  const dMean = Math.abs(a.meanLuma - b.meanLuma);
  const dP90 = Math.abs(a.p90Luma - b.p90Luma);
  const dStd = Math.abs(a.lumaStd - b.lumaStd);
  const penalty = dMean * 2.2 + dP90 * 1.4 + dStd * 1.1;
  return clamp01(1 - penalty);
}
