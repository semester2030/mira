import sharp from 'sharp';
import { GeometryPayload, GeometrySegment } from '../schema/fashion-vision-document.v1';

function polygonFromBbox(x: number, y: number, w: number, h: number): number[][] {
  return [
    [x, y],
    [x + w, y],
    [x + w, y + h],
    [x, y + h],
  ];
}

function segmentFromBbox(
  id: string,
  regionRole: GeometrySegment['regionRole'],
  x: number,
  y: number,
  w: number,
  h: number,
): GeometrySegment {
  return {
    id,
    regionRole,
    bbox: { x, y, w, h },
    polygon: polygonFromBbox(x, y, w, h),
  };
}

/**
 * Derive upper/lower geometry from FASHN background-remove PNG (alpha mask).
 * FASHN has no dedicated segmentation API — subject cutout → normalized bboxes.
 */
export async function geometryFromFashnMaskPng(pngBuffer: Buffer): Promise<GeometryPayload> {
  const { data, info } = await sharp(pngBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  if (width < 2 || height < 2) {
    throw new Error('FASHN mask too small');
  }

  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  let found = false;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const alpha = data[(y * width + x) * channels + (channels - 1)];
      if (alpha > 32) {
        found = true;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (!found) {
    throw new Error('FASHN mask contains no subject pixels');
  }

  const nx = (v: number) => Math.min(1, Math.max(0, v / width));
  const ny = (v: number) => Math.min(1, Math.max(0, v / height));

  const subjectH = maxY - minY + 1;
  const splitPx = minY + subjectH * 0.42;

  const upper = segmentFromBbox(
    'fashn-upper',
    'upper',
    nx(minX),
    ny(minY),
    nx(maxX - minX + 1),
    ny(Math.max(1, splitPx - minY)),
  );

  const lower = segmentFromBbox(
    'fashn-lower',
    'lower',
    nx(minX),
    ny(splitPx),
    nx(maxX - minX + 1),
    ny(maxY - splitPx + 1),
  );

  return {
    segments: [upper, lower],
    topology: {
      pieceCount: 2,
      onePiece: false,
      silhouetteHint: 'two_piece',
    },
  };
}
