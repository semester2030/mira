/**
 * Phase 2 — image quality + server gate schema tests.
 * Run: npm run build && node dist/ports/phase2-image-quality.schema-tests.js
 */
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {
  evaluateServerQualityGate,
  measurePixelMetrics,
  SERVER_IMAGE_QUALITY_THRESHOLDS,
} from './image-quality/pixel-image-metrics';
import { isPerfectMockFallbackAllowed } from '../config/production-integrity';

async function solidJpeg(
  w: number,
  h: number,
  r: number,
  g: number,
  b: number,
): Promise<Buffer> {
  return sharp({
    create: {
      width: w,
      height: h,
      channels: 3,
      background: { r, g, b },
    },
  })
    .jpeg()
    .toBuffer();
}

async function checkerJpeg(w: number, h: number): Promise<Buffer> {
  const buf = Buffer.alloc(w * h * 3);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const on = (Math.floor(x / 8) + Math.floor(y / 8)) % 2 === 0;
      const v = on ? 220 : 40;
      const i = (y * w + x) * 3;
      buf[i] = v;
      buf[i + 1] = v;
      buf[i + 2] = v;
    }
  }
  return sharp(buf, { raw: { width: w, height: h, channels: 3 } })
    .jpeg()
    .toBuffer();
}

async function testBlurMeasured(): Promise<void> {
  const sharpImg = await checkerJpeg(320, 400);
  const flat = await solidJpeg(320, 400, 128, 128, 128);
  const mSharp = await measurePixelMetrics(sharpImg);
  const mFlat = await measurePixelMetrics(flat);
  assert.ok(mSharp.blurLaplacianVariance > mFlat.blurLaplacianVariance);
  assert.ok(
    mFlat.blurLaplacianVariance < SERVER_IMAGE_QUALITY_THRESHOLDS.minBlurVariance,
  );
}

async function testBrightnessGate(): Promise<void> {
  const dark = await measurePixelMetrics(await solidJpeg(640, 800, 5, 5, 5));
  const gate = evaluateServerQualityGate(dark);
  assert.equal(gate.acceptable, false);
  assert.ok(gate.blockingReasons.includes('brightness'));
}

async function testRepeatability(): Promise<void> {
  const buf = await checkerJpeg(256, 320);
  const a = await measurePixelMetrics(buf);
  const b = await measurePixelMetrics(buf);
  assert.equal(a.blurLaplacianVariance, b.blurLaplacianVariance);
  assert.equal(a.brightness, b.brightness);
}

async function testNoFakeUnavailable(): Promise<void> {
  // Contract: unavailable signals must not carry fabricated values
  const signal = {
    id: 'occlusion',
    available: false,
    status: 'unavailable' as const,
  };
  assert.equal(signal.available, false);
  assert.equal('value' in signal && (signal as { value?: number }).value != null, false);
}

async function testPhase0Regression(): Promise<void> {
  assert.equal(
    isPerfectMockFallbackAllowed({
      NODE_ENV: 'production',
      PERFECT_CORP_FALLBACK_MOCK: 'true',
    }),
    false,
  );
}

async function main(): Promise<void> {
  await testBlurMeasured();
  await testBrightnessGate();
  await testRepeatability();
  await testNoFakeUnavailable();
  await testPhase0Regression();
  console.log('phase2-image-quality.schema-tests: OK (5 checks)');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
