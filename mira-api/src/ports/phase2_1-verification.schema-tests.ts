/**
 * Phase 2.1 — face presence, provider protection, thresholds, honesty.
 * Run: npm run build && node dist/ports/phase2_1-verification.schema-tests.js
 */
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { BlazeFacePresenceDetector } from '../ai/face-gate/blazeface-face-presence.detector';
import { FaceGateService } from '../ai/face-gate/face-gate.service';
import { CAPTURE_QUALITY_THRESHOLDS } from './image-quality/capture-quality.thresholds';
import {
  evaluateServerQualityGate,
  measurePixelMetrics,
} from './image-quality/pixel-image-metrics';
import { isPerfectMockFallbackAllowed } from '../config/production-integrity';

async function jpegFromSvg(svg: string): Promise<Buffer> {
  return sharp(Buffer.from(svg)).jpeg({ quality: 92 }).toBuffer();
}

async function solidJpeg(
  w: number,
  h: number,
  r: number,
  g: number,
  b: number,
): Promise<Buffer> {
  return sharp({
    create: { width: w, height: h, channels: 3, background: { r, g, b } },
  })
    .jpeg()
    .toBuffer();
}

/** Photo-like oval face that BlazeFace accepts in lab. */
function realFaceSvg(): string {
  return `<svg width="480" height="640">
    <rect width="100%" height="100%" fill="#2a2a32"/>
    <ellipse cx="240" cy="300" rx="120" ry="160" fill="#e0b090"/>
    <circle cx="200" cy="270" r="12" fill="#333"/>
    <circle cx="280" cy="270" r="12" fill="#333"/>
    <ellipse cx="240" cy="360" rx="30" ry="12" fill="#a06060"/>
  </svg>`;
}

function cartoonSvg(): string {
  return `<svg width="480" height="640">
    <rect fill="#fff" width="100%" height="100%"/>
    <circle cx="240" cy="320" r="40" fill="#ff0"/>
    <circle cx="225" cy="310" r="4" fill="#000"/>
    <circle cx="255" cy="310" r="4" fill="#000"/>
  </svg>`;
}

function landscapeSvg(): string {
  return `<svg width="640" height="480">
    <rect width="100%" height="66%" fill="#649fdc"/>
    <rect y="320" width="100%" height="34%" fill="#3c783c"/>
  </svg>`;
}

function objectSvg(): string {
  return `<svg width="480" height="640">
    <rect fill="#ddd" width="100%" height="100%"/>
    <rect x="120" y="200" width="240" height="180" fill="#4a90d9"/>
    <rect x="200" y="380" width="80" height="120" fill="#333"/>
  </svg>`;
}

async function testBlazeFaceScenarios(): Promise<void> {
  const detector = new BlazeFacePresenceDetector();
  const real = await detector.detect(await jpegFromSvg(realFaceSvg()));
  assert.equal(real.faceCount, 1, 'real face should detect 1');
  assert.ok(
    real.maxScore >= CAPTURE_QUALITY_THRESHOLDS.blazefaceMinScore,
    'real face score',
  );

  const blank = await detector.detect(await solidJpeg(480, 640, 128, 128, 128));
  assert.equal(blank.faceCount, 0, 'blank');

  const cartoon = await detector.detect(await jpegFromSvg(cartoonSvg()));
  assert.equal(cartoon.faceCount, 0, 'tiny cartoon emoji');

  const landscape = await detector.detect(await jpegFromSvg(landscapeSvg()));
  assert.equal(landscape.faceCount, 0, 'landscape');

  const object = await detector.detect(await jpegFromSvg(objectSvg()));
  assert.equal(object.faceCount, 0, 'object');

  const nonFace = await detector.detect(await solidJpeg(480, 640, 200, 50, 50));
  assert.equal(nonFace.faceCount, 0, 'non-face solid');
}

async function testFaceGateNeverInfersCount(): Promise<void> {
  const detector = new BlazeFacePresenceDetector();
  const gate = new FaceGateService(detector);

  await assert.rejects(async () => {
    await gate.assertAnalyzablePhoto(await solidJpeg(640, 800, 128, 128, 128));
  });

  const ok = await gate.assertAnalyzablePhoto(await jpegFromSvg(realFaceSvg()));
  assert.equal(ok.face.faceCount, 1);
  assert.equal(ok.face.detectorId, 'blazeface_tfjs');
}

async function testProviderProtectionFlow(): Promise<void> {
  /** Simulates SkinAnalysisService order: quality → orchestrator. */
  let providerCalls = 0;
  const orchestrator = {
    analyze: async () => {
      providerCalls += 1;
      return { ok: true };
    },
  };

  const detector = new BlazeFacePresenceDetector();
  const gate = new FaceGateService(detector);

  // Fail path: blank image
  const blank = await solidJpeg(640, 800, 10, 10, 10);
  const metrics = await measurePixelMetrics(blank);
  const pixelGate = evaluateServerQualityGate(metrics);
  assert.equal(pixelGate.acceptable, false);

  let blocked = false;
  try {
    await gate.assertAnalyzablePhoto(blank);
  } catch {
    blocked = true;
  }
  if (!pixelGate.acceptable || blocked) {
    // do not call provider
  } else {
    await orchestrator.analyze();
  }
  assert.equal(providerCalls, 0, 'provider must not run on quality/face fail');

  // Pass path: real face + acceptable pixels
  const good = await jpegFromSvg(realFaceSvg());
  const goodMetrics = await measurePixelMetrics(good);
  const goodPixel = evaluateServerQualityGate(goodMetrics);
  await gate.assertAnalyzablePhoto(good);
  if (goodPixel.acceptable) {
    await orchestrator.analyze();
  }
  assert.equal(providerCalls, 1, 'provider runs only after gates pass');
}

async function testThresholdsUnified(): Promise<void> {
  assert.equal(CAPTURE_QUALITY_THRESHOLDS.version, 'cq-thresholds-v2.1');
  assert.equal(CAPTURE_QUALITY_THRESHOLDS.maxYawDegrees, 35);
  assert.equal(CAPTURE_QUALITY_THRESHOLDS.maxPitchDegrees, 30);
  assert.equal(CAPTURE_QUALITY_THRESHOLDS.maxRollDegrees, 28);
  assert.equal(
    CAPTURE_QUALITY_THRESHOLDS.contrastDynamicRangeRole,
    'informational',
  );
}

async function testRepeatability(): Promise<void> {
  const buf = await jpegFromSvg(realFaceSvg());
  const a = await measurePixelMetrics(buf);
  const b = await measurePixelMetrics(buf);
  assert.equal(a.blurLaplacianVariance, b.blurLaplacianVariance);
  assert.equal(a.brightness, b.brightness);
  const detector = new BlazeFacePresenceDetector();
  const f1 = await detector.detect(buf);
  const f2 = await detector.detect(buf);
  assert.equal(f1.faceCount, f2.faceCount);
  assert.ok(Math.abs(f1.maxScore - f2.maxScore) < 1e-6);
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
  await testThresholdsUnified();
  await testBlazeFaceScenarios();
  await testFaceGateNeverInfersCount();
  await testProviderProtectionFlow();
  await testRepeatability();
  await testPhase0Regression();
  console.log('phase2.1-verification.schema-tests: OK (6 suites)');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
