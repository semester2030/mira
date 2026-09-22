import { Injectable, Logger } from '@nestjs/common';
import sharp from 'sharp';
import {
  NormalizedRect,
  OutfitSegmentMapDto,
  OutfitSegmentRegionDto,
  OutfitSegmentZone,
} from '../contracts/outfit-segment-map.interface';
import {
  bboxFromVisionVertices,
  polygonToRect,
  refineGarmentContour,
} from './outfit-contour-refiner';
import {
  labelToArabic,
  shouldShowRegion,
  zoneForObject,
} from './outfit-fashion-taxonomy';
import { FashnGeometryProvider } from '../../vision/providers/fashn-geometry.provider';
import { RegionRole } from '../../vision/schema/fashion-vision-document.v1';
import { isFashnQuotaOrUnavailable } from '../../vision/vision-orchestrator.service';

// ─────────────────────────────────────────────────────────────────────────────
// VISION PLATFORM — Phase 8
// FASHN geometry only — no Google Vision.
// Reference: docs/mira-vision-platform.html
// ─────────────────────────────────────────────────────────────────────────────

import {
  isSpecularHighlight,
  matchRgb,
} from '../../vision/color/professional-color-matcher';

interface VisionObject {
  name: string;
  score: number;
  rect: NormalizedRect;
  polygon: Array<{ x: number; y: number }>;
}

@Injectable()
export class OutfitSegmentationService {
  private readonly logger = new Logger(OutfitSegmentationService.name);

  constructor(private readonly fashnGeometry: FashnGeometryProvider) {}

  async segment(imageBuffer: Buffer): Promise<OutfitSegmentMapDto> {
    const meta = await sharp(imageBuffer).metadata();
    const imageWidth = meta.width ?? 0;
    const imageHeight = meta.height ?? 0;

    const { objects, degraded } = await this.fetchGeometryObjects(imageBuffer);

    // Degraded full-body stub includes face/neck/background — never paint as fabric.
    if (degraded || objects.length === 0) {
      return {
        regions: [],
        upperBodyColors: [],
        lowerBodyColors: [],
        shoeColors: [],
        accessoryColors: [],
        imageWidth,
        imageHeight,
        source: degraded ? 'fashn_geometry_degraded' : 'deterministic',
        isVisualTrusted: false,
        validationMessage: degraded
          ? 'تجزئة الملابس الدقيقة غير متاحة — لن تُعرض حدود تقريبية كأنها قماش.'
          : undefined,
      };
    }

    const regions: OutfitSegmentRegionDto[] = [];

    for (const object of objects) {
      const polygon = await refineGarmentContour(
        imageBuffer,
        object.rect,
        object.polygon,
      );
      const rect = polygonToRect(polygon);
      const colors = await this.extractColors(imageBuffer, rect, polygon);
      regions.push({
        zone: zoneForObject(object.name, rect.top + rect.height / 2),
        normalizedRect: rect,
        normalizedPolygon: polygon,
        labelAr: labelToArabic(object.name),
        labelEn: object.name,
        colors,
        confidence: object.score,
      });
    }

    const visible = regions.filter(shouldShowRegion);
    const deduped = this.dedupeRegions(visible);

    return {
      regions: deduped,
      upperBodyColors: this.colorsForZone(deduped, 'upperBody'),
      lowerBodyColors: this.colorsForZone(deduped, 'lowerBody'),
      shoeColors: this.colorsForZone(deduped, 'feet'),
      accessoryColors: this.colorsForZone(deduped, 'accessories'),
      imageWidth,
      imageHeight,
      source: 'fashn_geometry_contour',
      isVisualTrusted: deduped.length > 0,
    };
  }

  private async fetchGeometryObjects(
    imageBuffer: Buffer,
  ): Promise<{ objects: VisionObject[]; degraded: boolean }> {
    try {
      const geometry = await this.fashnGeometry.segment(imageBuffer);
      return {
        objects: this.geometryToObjects(geometry.segments),
        degraded: false,
      };
    } catch (error) {
      if (isFashnQuotaOrUnavailable(error)) {
        this.logger.warn(
          `FASHN segmentation quota/unavailable — empty fabric map (no stub paint): ${String(error)}`,
        );
        // Keep analyze-path stub elsewhere; segmentation endpoint must not
        // return face-including bands as clothing regions.
        return { objects: [], degraded: true };
      }
      this.logger.warn(`FASHN segmentation failed: ${String(error)}`);
      return { objects: [], degraded: false };
    }
  }

  private geometryToObjects(
    segments: Array<{
      regionRole: RegionRole;
      bbox: { x: number; y: number; w: number; h: number };
      polygon: number[][];
      providerConfidence?: number;
    }>,
  ): VisionObject[] {
    return segments.map((seg) => {
      const name = regionRoleLabel(seg.regionRole);
      const rect: NormalizedRect = {
        left: seg.bbox.x,
        top: seg.bbox.y,
        width: seg.bbox.w,
        height: seg.bbox.h,
      };
      const polygon =
        seg.polygon.length >= 3
          ? seg.polygon.map((p) => ({ x: p[0] ?? 0, y: p[1] ?? 0 }))
          : bboxFromVisionVertices([
              { x: rect.left, y: rect.top },
              { x: rect.left + rect.width, y: rect.top },
              { x: rect.left + rect.width, y: rect.top + rect.height },
              { x: rect.left, y: rect.top + rect.height },
            ])?.polygon ?? [];

      // No invented 0.85 - index*0.01 ladder. Use provider score when present;
      // otherwise a single presence score (contour exists, not ranked trust).
      const score =
        typeof seg.providerConfidence === 'number' &&
        Number.isFinite(seg.providerConfidence)
          ? Math.min(1, Math.max(0, seg.providerConfidence))
          : 0.82;

      return {
        name,
        score,
        rect,
        polygon,
      };
    });
  }

  private async extractColors(
    imageBuffer: Buffer,
    rect: NormalizedRect,
    polygon: Array<{ x: number; y: number }>,
  ): Promise<string[]> {
    const meta = await sharp(imageBuffer).metadata();
    const w = meta.width ?? 0;
    const h = meta.height ?? 0;
    if (w < 4 || h < 4) return [];

    const left = Math.floor(rect.left * w);
    const top = Math.floor(rect.top * h);
    const width = Math.max(2, Math.floor(rect.width * w));
    const height = Math.max(2, Math.floor(rect.height * h));

    const { data } = await sharp(imageBuffer)
      .extract({ left, top, width, height })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const buckets = new Map<string, { count: number; display: string }>();
    const step = Math.max(1, Math.floor(Math.sqrt((width * height) / 1200)));

    let sumR = 0;
    let sumG = 0;
    let sumB = 0;
    let pixelCount = 0;

    const inPoly = (nx: number, ny: number): boolean => {
      if (polygon.length < 3) return true;
      let inside = false;
      for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i].x;
        const yi = polygon[i].y;
        const xj = polygon[j].x;
        const yj = polygon[j].y;
        const intersect =
          yi > ny !== yj > ny &&
          nx < ((xj - xi) * (ny - yi)) / (yj - yi + 1e-9) + xi;
        if (intersect) inside = !inside;
      }
      return inside;
    };

    for (let y = 0; y < height; y += step) {
      for (let x = 0; x < width; x += step) {
        const nx = (left + x) / w;
        const ny = (top + y) / h;
        if (!inPoly(nx, ny)) continue;
        // Skip upper band of tall full-body boxes (face/hair leakage).
        if (rect.height > 0.55 && ny < rect.top + rect.height * 0.18) continue;
        const i = (y * width + x) * 3;
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        if (isSpecularHighlight(r, g, b)) continue;
        if (isLikelySkinOrHair(r, g, b)) continue;
        sumR += r;
        sumG += g;
        sumB += b;
        pixelCount += 1;
      }
    }

    if (pixelCount < 8) return [];

    const avgR = sumR / pixelCount;
    const avgG = sumG / pixelCount;
    const avgB = sumB / pixelCount;

    for (let y = 0; y < height; y += step) {
      for (let x = 0; x < width; x += step) {
        const nx = (left + x) / w;
        const ny = (top + y) / h;
        if (!inPoly(nx, ny)) continue;
        if (rect.height > 0.55 && ny < rect.top + rect.height * 0.18) continue;
        const i = (y * width + x) * 3;
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        if (isSpecularHighlight(r, g, b)) continue;
        if (isLikelySkinOrHair(r, g, b)) continue;
        const match = matchRgb(r, g, b, { avgR, avgG, avgB });
        const prev = buckets.get(match.id);
        buckets.set(match.id, {
          count: (prev?.count ?? 0) + 1,
          display: match.displayNameAr,
        });
      }
    }

    const ranked = [...buckets.entries()].sort((a, b) => b[1].count - a[1].count);
    const total = ranked.reduce((s, [, v]) => s + v.count, 0) || 1;
    // Adaptive count: keep significant fabric colors only (no forced fill to 4).
    return ranked
      .filter(([, v]) => v.count / total >= 0.12)
      .map(([, v]) => v.display);
  }

  private colorsForZone(
    regions: OutfitSegmentRegionDto[],
    zone: OutfitSegmentZone,
  ): string[] {
    const merged = regions
      .filter((r) => r.zone === zone)
      .flatMap((r) => r.colors);
    return [...new Set(merged)].slice(0, 5);
  }

  private dedupeRegions(regions: OutfitSegmentRegionDto[]): OutfitSegmentRegionDto[] {
    const kept: OutfitSegmentRegionDto[] = [];
    for (const region of regions) {
      const overlapsBetter = kept.some(
        (existing) =>
          this.iou(existing.normalizedRect, region.normalizedRect) > 0.55 &&
          existing.confidence >= region.confidence,
      );
      if (overlapsBetter) continue;
      for (let i = kept.length - 1; i >= 0; i--) {
        if (
          this.iou(kept[i].normalizedRect, region.normalizedRect) > 0.55 &&
          region.confidence > kept[i].confidence
        ) {
          kept.splice(i, 1);
        }
      }
      kept.push(region);
    }
    return kept;
  }

  private iou(a: NormalizedRect, b: NormalizedRect): number {
    const x1 = Math.max(a.left, b.left);
    const y1 = Math.max(a.top, b.top);
    const x2 = Math.min(a.left + a.width, b.left + b.width);
    const y2 = Math.min(a.top + a.height, b.top + b.height);
    const interW = Math.max(0, x2 - x1);
    const interH = Math.max(0, y2 - y1);
    const inter = interW * interH;
    const union = a.width * a.height + b.width * b.height - inter;
    return union <= 0 ? 0 : inter / union;
  }
}

function regionRoleLabel(role: RegionRole): string {
  switch (role) {
    case 'upper':
      return 'top';
    case 'lower':
      return 'pants';
    case 'outerwear':
      return 'jacket';
    case 'feet':
      return 'shoe';
    case 'accessory':
      return 'bag';
    case 'full_body':
      return 'dress';
    default:
      return 'clothing';
  }
}

/** Exclude skin / hair from fabric color buckets (not a medical classifier). */
function isLikelySkinOrHair(r: number, g: number, b: number): boolean {
  const maxC = Math.max(r, g, b);
  const minC = Math.min(r, g, b);
  const spread = maxC - minC;
  const lum = r * 0.299 + g * 0.587 + b * 0.114;
  // Skin-ish: red-dominant mid tones.
  if (r > 95 && g > 40 && b > 20 && r > g && r > b && r - g > 12 && spread > 12) {
    return true;
  }
  if (r > 180 && g > 140 && b > 120 && r - b < 40) return true;
  // Hair-ish: dark low-chroma browns/blacks.
  if (lum < 55 && spread < 35 && r >= g && g >= b && r - b < 45) return true;
  return false;
}
