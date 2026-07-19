import { CaptureQualitySignals } from '../../intelligence/pipeline/beauty-score-engine';
import { ImageQualityResult } from './image-quality.port';

/** Map measured IQ signals → SVI capture multipliers (formula unchanged). */
export function captureSignalsFromImageQuality(
  quality: ImageQualityResult,
): CaptureQualitySignals | undefined {
  const byId = new Map(quality.signals.map((s) => [s.id, s]));
  const brightness = byId.get('brightness');
  const blur = byId.get('blur');
  const yaw = byId.get('yaw');
  const pitch = byId.get('pitch');
  const roll = byId.get('roll');

  if (brightness?.status !== 'measured' || blur?.status !== 'measured') {
    return undefined;
  }

  const lightingQuality = Math.min(1, Math.max(0, brightness.value ?? 0));
  const blurVar = blur.value ?? 0;
  const blurAmount = Math.min(1, Math.max(0, 1 - blurVar / 200));

  const angles = [yaw?.value, pitch?.value, roll?.value]
    .filter((v): v is number => typeof v === 'number')
    .map((v) => Math.abs(v));
  const faceAngleDegrees =
    angles.length > 0 ? Math.max(...angles) : 10;

  return {
    lightingQuality,
    faceAngleDegrees,
    blurAmount,
  };
}
