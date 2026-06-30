import sharp from 'sharp';
import {
  NormalizedPoint,
  NormalizedRect,
} from '../contracts/outfit-segment-map.interface';

function isSkinTone(r: number, g: number, b: number): boolean {
  const maxC = Math.max(r, g, b);
  const minC = Math.min(r, g, b);
  if (maxC - minC < 12) return false;
  return r > 95 && g > 40 && b > 20 && r > g && r > b && r - g > 12;
}

function isBackground(r: number, g: number, b: number): boolean {
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  return lum > 238 || (lum > 210 && maxChroma(r, g, b) < 18);
}

function maxChroma(r: number, g: number, b: number): number {
  return Math.max(r, g, b) - Math.min(r, g, b);
}

function isGarmentPixel(r: number, g: number, b: number): boolean {
  if (isSkinTone(r, g, b) || isBackground(r, g, b)) return false;
  return maxChroma(r, g, b) > 14;
}

function isEdge(mask: Uint8Array, x: number, y: number, w: number, h: number): boolean {
  if (!mask[y * w + x]) return false;
  const neighbors = [
    [x - 1, y],
    [x + 1, y],
    [x, y - 1],
    [x, y + 1],
  ];
  for (const [nx, ny] of neighbors) {
    if (nx < 0 || ny < 0 || nx >= w || ny >= h || !mask[ny * w + nx]) return true;
  }
  return false;
}

function rectFromPolygon(points: NormalizedPoint[]): NormalizedRect {
  let minX = 1;
  let minY = 1;
  let maxX = 0;
  let maxY = 0;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  return {
    left: minX,
    top: minY,
    width: Math.max(0.01, maxX - minX),
    height: Math.max(0.01, maxY - minY),
  };
}

function quadFromRect(rect: NormalizedRect): NormalizedPoint[] {
  return [
    { x: rect.left, y: rect.top },
    { x: rect.left + rect.width, y: rect.top },
    { x: rect.left + rect.width, y: rect.top + rect.height },
    { x: rect.left, y: rect.top + rect.height },
  ];
}

function simplifyPoints(
  points: NormalizedPoint[],
  maxPoints: number,
): NormalizedPoint[] {
  if (points.length <= maxPoints) return points;
  const step = Math.ceil(points.length / maxPoints);
  const out: NormalizedPoint[] = [];
  for (let i = 0; i < points.length; i += step) out.push(points[i]);
  if (out.length > 2 && out[0] !== out[out.length - 1]) {
    out.push(out[0]);
  }
  return out;
}

function orderConvexHull(points: NormalizedPoint[]): NormalizedPoint[] {
  if (points.length < 3) return points;
  const cx = points.reduce((s, p) => s + p.x, 0) / points.length;
  const cy = points.reduce((s, p) => s + p.y, 0) / points.length;
  return [...points].sort(
    (a, b) => Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx),
  );
}

/**
 * Refines a Vision bbox into a pixel-aware garment contour using sharp + heuristics.
 */
export async function refineGarmentContour(
  imageBuffer: Buffer,
  bbox: NormalizedRect,
  visionPolygon?: NormalizedPoint[],
): Promise<NormalizedPoint[]> {
  const meta = await sharp(imageBuffer).metadata();
  const imgW = meta.width ?? 0;
  const imgH = meta.height ?? 0;
  if (imgW < 8 || imgH < 8) {
    return visionPolygon?.length ? visionPolygon : quadFromRect(bbox);
  }

  const padX = bbox.width * 0.02;
  const padY = bbox.height * 0.02;
  const normLeft = Math.max(0, bbox.left - padX);
  const normTop = Math.max(0, bbox.top - padY);
  const normRight = Math.min(1, bbox.left + bbox.width + padX);
  const normBottom = Math.min(1, bbox.top + bbox.height + padY);

  const left = Math.floor(normLeft * imgW);
  const top = Math.floor(normTop * imgH);
  const width = Math.max(4, Math.floor(normRight * imgW) - left);
  const height = Math.max(4, Math.floor(normBottom * imgH) - top);

  const { data } = await sharp(imageBuffer)
    .extract({ left, top, width, height })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const mask = new Uint8Array(width * height);
  let garmentCount = 0;
  for (let i = 0; i < width * height; i++) {
    const r = data[i * 3];
    const g = data[i * 3 + 1];
    const b = data[i * 3 + 2];
    if (isGarmentPixel(r, g, b)) {
      mask[i] = 1;
      garmentCount++;
    }
  }

  if (garmentCount < width * height * 0.08) {
    return visionPolygon?.length ? visionPolygon : quadFromRect(bbox);
  }

  const edgePoints: NormalizedPoint[] = [];
  const step = Math.max(1, Math.floor(Math.min(width, height) / 80));
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      if (!isEdge(mask, x, y, width, height)) continue;
      edgePoints.push({
        x: (left + x) / imgW,
        y: (top + y) / imgH,
      });
    }
  }

  if (edgePoints.length < 8) {
    return visionPolygon?.length ? visionPolygon : quadFromRect(bbox);
  }

  const hull = orderConvexHull(edgePoints);
  const simplified = simplifyPoints(hull, 36);
  if (simplified.length >= 3) return simplified;

  return visionPolygon?.length ? visionPolygon : quadFromRect(bbox);
}

export function bboxFromVisionVertices(
  vertices: Array<{ x?: number; y?: number }>,
): { rect: NormalizedRect; polygon: NormalizedPoint[] } | null {
  if (vertices.length < 2) return null;
  let minX = 1;
  let minY = 1;
  let maxX = 0;
  let maxY = 0;
  const polygon: NormalizedPoint[] = [];
  for (const v of vertices) {
    const x = v.x ?? 0;
    const y = v.y ?? 0;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
    polygon.push({ x, y });
  }
  if (maxX <= minX || maxY <= minY) return null;
  return {
    rect: {
      left: minX,
      top: minY,
      width: maxX - minX,
      height: maxY - minY,
    },
    polygon,
  };
}

export { quadFromRect, rectFromPolygon as polygonToRect };
