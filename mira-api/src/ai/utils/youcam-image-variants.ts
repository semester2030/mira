import sharp from 'sharp';

const RECOVERABLE_YOUCAM_ERRORS = [
  'error_src_face_too_small',
  'face_too_small',
  'error_lighting_dark',
  'error_lighting',
] as const;

export function isRecoverableYouCamError(message: string): boolean {
  const lower = message.toLowerCase();
  return RECOVERABLE_YOUCAM_ERRORS.some((token) => lower.includes(token));
}

/** Progressive JPEG variants — retried silently before surfacing an error. */
export async function buildYouCamImageVariants(input: Buffer): Promise<Buffer[]> {
  const oriented = sharp(input, { failOn: 'none' }).rotate();
  const meta = await oriented.metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;

  if (width < 32 || height < 32) {
    return [input];
  }

  const jpeg = { quality: 92, mozjpeg: true } as const;

  const base = await oriented.clone().jpeg(jpeg).toBuffer();

  const bright = await oriented
    .clone()
    .modulate({ brightness: 1.2, saturation: 1.04 })
    .sharpen({ sigma: 0.6 })
    .jpeg(jpeg)
    .toBuffer();

  const zoomedBright = await centerZoom(
    oriented.clone(),
    width,
    height,
    0.78,
  )
    .modulate({ brightness: 1.28, saturation: 1.05 })
    .sharpen({ sigma: 0.8 })
    .jpeg(jpeg)
    .toBuffer();

  const zoomedMore = await centerZoom(
    oriented.clone(),
    width,
    height,
    0.68,
  )
    .modulate({ brightness: 1.35, saturation: 1.06 })
    .sharpen({ sigma: 1 })
    .jpeg(jpeg)
    .toBuffer();

  return [base, bright, zoomedBright, zoomedMore];
}

function centerZoom(
  pipeline: sharp.Sharp,
  width: number,
  height: number,
  fraction: number,
): sharp.Sharp {
  const cropW = Math.max(1, Math.round(width * fraction));
  const cropH = Math.max(1, Math.round(height * fraction));
  const left = Math.max(0, Math.round((width - cropW) / 2));
  const top = Math.max(0, Math.round((height - cropH) / 2));

  return pipeline
    .extract({
      left,
      top,
      width: Math.min(cropW, width - left),
      height: Math.min(cropH, height - top),
    })
    .resize(width, height, { fit: 'fill' });
}
