import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import sharp from 'sharp';

import {
  GarmentRecolorVisionContext,
  NormalizedRect,
} from './garment-recolor-context.types';
import { resolveGarmentRect } from './image-region-metrics';

export type CropCompositeMeta = {
  cropRect: { left: number; top: number; width: number; height: number };
  polygonInCrop: number[][];
  featherPx: number;
  originalWidth: number;
  originalHeight: number;
};

@Injectable()
export class GarmentCropCompositeService {
  private readonly logger = new Logger(GarmentCropCompositeService.name);

  constructor(private readonly config: ConfigService) {}

  isEnabled(): boolean {
    return this.config.get<string>('QEL_CROP_FIRST', 'true') !== 'false';
  }

  /** Phase Q2 — padded polygon crop for FASHN Edit input. */
  async prepareCrop(
    original: Buffer,
    ctx?: GarmentRecolorVisionContext,
  ): Promise<{ cropBuffer: Buffer; meta: CropCompositeMeta } | null> {
    if (!this.isEnabled() || !ctx) return null;

    const meta = await sharp(original).metadata();
    const width = meta.width ?? 0;
    const height = meta.height ?? 0;
    if (width < 32 || height < 32) return null;

    const garmentRect = resolveGarmentRect(ctx);
    const polygon = resolvePolygon(ctx, garmentRect);
    const pad = this.config.get<number>('QEL_CROP_PADDING', 0.08);
    const paddedRect = padNormalizedRect(garmentRect, pad);
    const cropRect = toPixelRect(paddedRect, width, height);

    if (cropRect.width < 16 || cropRect.height < 16) return null;

    const polygonInCrop = polygonToCropSpace(polygon, paddedRect);

    const cropBuffer = await sharp(original)
      .extract({
        left: cropRect.left,
        top: cropRect.top,
        width: cropRect.width,
        height: cropRect.height,
      })
      .jpeg({ quality: 92 })
      .toBuffer();

    return {
      cropBuffer,
      meta: {
        cropRect,
        polygonInCrop,
        featherPx: this.config.get<number>('QEL_CROP_FEATHER_PX', 6),
        originalWidth: width,
        originalHeight: height,
      },
    };
  }

  /** Phase Q2 — feathered composite back onto original + edge color match. */
  async composite(
    original: Buffer,
    editedCrop: Buffer,
    meta: CropCompositeMeta,
  ): Promise<Buffer> {
    const { cropRect, polygonInCrop, featherPx } = meta;
    const { width: cropW, height: cropH } = cropRect;

    const matchedCrop = await this.matchCropLuminance(original, editedCrop, meta);

    const resizedEdited = await sharp(matchedCrop)
      .resize(cropW, cropH, { fit: 'fill' })
      .removeAlpha()
      .toBuffer();

    const maskPng = await this.buildFeatherMask(cropW, cropH, polygonInCrop, featherPx);
    const editedRgba = await sharp(resizedEdited)
      .ensureAlpha()
      .composite([{ input: maskPng, blend: 'dest-in' }])
      .png()
      .toBuffer();

    return sharp(original)
      .composite([{ input: editedRgba, left: cropRect.left, top: cropRect.top, blend: 'over' }])
      .jpeg({ quality: 92 })
      .toBuffer();
  }

  private async matchCropLuminance(
    original: Buffer,
    editedCrop: Buffer,
    meta: CropCompositeMeta,
  ): Promise<Buffer> {
    const { cropRect } = meta;
    const originalCrop = await sharp(original)
      .extract({
        left: cropRect.left,
        top: cropRect.top,
        width: cropRect.width,
        height: cropRect.height,
      })
      .stats();

    const editedStats = await sharp(editedCrop).stats();
    const origMean =
      (originalCrop.channels[0]?.mean ?? 128) * 0.299 +
      (originalCrop.channels[1]?.mean ?? 128) * 0.587 +
      (originalCrop.channels[2]?.mean ?? 128) * 0.114;
    const editMean =
      (editedStats.channels[0]?.mean ?? 128) * 0.299 +
      (editedStats.channels[1]?.mean ?? 128) * 0.587 +
      (editedStats.channels[2]?.mean ?? 128) * 0.114;

    if (editMean < 1) return editedCrop;

    const factor = Math.min(1.18, Math.max(0.82, origMean / editMean));
    if (Math.abs(factor - 1) < 0.03) return editedCrop;

    return sharp(editedCrop)
      .linear(factor, -(factor - 1) * 8)
      .toBuffer();
  }

  private async buildFeatherMask(
    width: number,
    height: number,
    polygonNorm: number[][],
    featherPx: number,
  ): Promise<Buffer> {
    const points = polygonNorm
      .map(([x, y]) => {
        const px = Math.round(clamp01(x) * width);
        const py = Math.round(clamp01(y) * height);
        return `${px},${py}`;
      })
      .join(' ');

    const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <polygon points="${points}" fill="white"/>
    </svg>`;

    let mask = sharp(Buffer.from(svg)).png();
    if (featherPx > 0) {
      mask = mask.blur(Math.max(1, featherPx));
    }
    return mask.toBuffer();
  }
}

function resolvePolygon(ctx: GarmentRecolorVisionContext, rect: NormalizedRect): number[][] {
  const raw = ctx.garmentPolygon;
  if (Array.isArray(raw) && raw.length >= 3) {
    const cleaned = raw
      .filter((p) => Array.isArray(p) && p.length >= 2)
      .map(([x, y]) => [clamp01(Number(x)), clamp01(Number(y))] as [number, number]);
    if (cleaned.length >= 3) return cleaned;
  }
  return polygonFromRect(rect);
}

function polygonFromRect(rect: NormalizedRect): number[][] {
  return [
    [rect.x, rect.y],
    [rect.x + rect.w, rect.y],
    [rect.x + rect.w, rect.y + rect.h],
    [rect.x, rect.y + rect.h],
  ];
}

function padNormalizedRect(rect: NormalizedRect, pad: number): NormalizedRect {
  const p = Math.max(0, Math.min(0.2, pad));
  return {
    x: clamp01(rect.x - p * rect.w),
    y: clamp01(rect.y - p * rect.h),
    w: clamp01(rect.w * (1 + 2 * p)),
    h: clamp01(rect.h * (1 + 2 * p)),
  };
}

function polygonToCropSpace(polygon: number[][], crop: NormalizedRect): number[][] {
  return polygon.map(([x, y]) => [
    crop.w > 0 ? clamp01((x - crop.x) / crop.w) : 0,
    crop.h > 0 ? clamp01((y - crop.y) / crop.h) : 0,
  ]);
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

function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.min(1, Math.max(0, v));
}
