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

// ─────────────────────────────────────────────────────────────────────────────
// VISION PLATFORM — Phase 8
// FASHN geometry only — no Google Vision.
// Reference: docs/mira-vision-platform.html
// ─────────────────────────────────────────────────────────────────────────────

const COLOR_NAMES: Array<[string, number, number, number]> = [
  ['أسود', 20, 20, 20],
  ['أبيض', 245, 245, 245],
  ['بيج', 210, 190, 160],
  ['كريمي', 235, 225, 200],
  ['رمادي', 128, 128, 128],
  ['كحلي', 25, 40, 80],
  ['أزرق', 40, 80, 180],
  ['زيتوني', 100, 110, 60],
  ['ذهبي', 200, 170, 80],
  ['وردي', 230, 150, 170],
  ['أحمر', 180, 40, 50],
  ['بني', 120, 80, 50],
];

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

    const objects = await this.fetchGeometryObjects(imageBuffer);
    const regions: OutfitSegmentRegionDto[] = [];

    for (const object of objects) {
      const polygon = await refineGarmentContour(
        imageBuffer,
        object.rect,
        object.polygon,
      );
      const rect = polygonToRect(polygon);
      const colors = await this.extractColors(imageBuffer, rect);
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
      source: objects.length > 0 ? 'fashn_geometry_contour' : 'deterministic',
    };
  }

  private async fetchGeometryObjects(imageBuffer: Buffer): Promise<VisionObject[]> {
    try {
      const geometry = await this.fashnGeometry.segment(imageBuffer);
      return geometry.segments.map((seg, index) => {
        const name = regionRoleLabel(seg.regionRole);
        const rect: NormalizedRect = {
          left: seg.bbox.x,
          top: seg.bbox.y,
          width: seg.bbox.w,
          height: seg.bbox.h,
        };
        const polygon =
          seg.polygon.length >= 3
            ? seg.polygon.map(([x, y]) => ({ x, y }))
            : bboxFromVisionVertices([
                { x: rect.left, y: rect.top },
                { x: rect.left + rect.width, y: rect.top },
                { x: rect.left + rect.width, y: rect.top + rect.height },
                { x: rect.left, y: rect.top + rect.height },
              ])?.polygon ?? [];

        return {
          name,
          score: 0.85 - index * 0.01,
          rect,
          polygon,
        };
      });
    } catch (error) {
      this.logger.warn(`FASHN segmentation failed: ${String(error)}`);
      return [];
    }
  }

  private async extractColors(
    imageBuffer: Buffer,
    rect: NormalizedRect,
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

    const buckets = new Map<string, number>();
    const step = Math.max(1, Math.floor(Math.sqrt((width * height) / 1200)));

    for (let y = 0; y < height; y += step) {
      for (let x = 0; x < width; x += step) {
        const i = (y * width + x) * 3;
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const name = this.rgbName(r, g, b);
        buckets.set(name, (buckets.get(name) ?? 0) + 1);
      }
    }

    return [...buckets.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([name]) => name);
  }

  private rgbName(r: number, g: number, b: number): string {
    let best = 'مختلط';
    let bestDist = Number.MAX_SAFE_INTEGER;
    for (const [name, cr, cg, cb] of COLOR_NAMES) {
      const d = (r - cr) ** 2 + (g - cg) ** 2 + (b - cb) ** 2;
      if (d < bestDist) {
        bestDist = d;
        best = name;
      }
    }
    return best;
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
