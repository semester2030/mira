import { ServiceUnavailableException } from '@nestjs/common';

export const OUTFIT_CAMERA_PAUSED_MESSAGE =
  'تصوير الإطلالة بالكاميرا متوقف مؤقتًا للتطوير. اختاري صورة من الاستديو لتحليل إطلالتك';

export function outfitCameraCaptureEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.OUTFIT_CAMERA_CAPTURE_ENABLED === 'true';
}

/** Gallery and unspecified stills continue. An explicit camera start is refused while the flag is off. */
export function assertOutfitCaptureSource(
  captureSource: string | undefined,
  env: NodeJS.ProcessEnv = process.env,
): void {
  if (captureSource !== 'camera') return;
  if (outfitCameraCaptureEnabled(env)) return;
  throw new ServiceUnavailableException({
    code: 'OUTFIT_CAMERA_PAUSED',
    message: OUTFIT_CAMERA_PAUSED_MESSAGE,
  });
}
