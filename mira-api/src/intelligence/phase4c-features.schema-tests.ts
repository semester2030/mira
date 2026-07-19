/**
 * Phase 4C — Face Features (shape + findings) schema tests + goldens.
 * Run: npm run test:phase4c
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  FACE_SHAPE_FORMULA_ID,
  FACE_SHAPE_VERSION,
  runFaceFeaturesPipeline,
  runFaceGeometryPipeline,
  classifyFaceShape,
  FACE_SHAPE_IDS,
} from './face-intelligence';
import type { GeometryAnchors } from './face-intelligence';
import { CAPTURE_QUALITY_THRESHOLDS } from '../ports/image-quality/capture-quality.thresholds';

function baseAnchors(overrides?: Partial<GeometryAnchors>): GeometryAnchors {
  return {
    version: 'geometry-anchors-v1',
    foreheadTop: { x: 0.5, y: 0.18 },
    browMid: { x: 0.5, y: 0.34 },
    noseTip: { x: 0.5, y: 0.52 },
    noseBase: { x: 0.5, y: 0.58 },
    chin: { x: 0.5, y: 0.86 },
    leftEyeOuter: { x: 0.33, y: 0.36 },
    leftEyeInner: { x: 0.42, y: 0.36 },
    rightEyeInner: { x: 0.58, y: 0.36 },
    rightEyeOuter: { x: 0.67, y: 0.36 },
    leftMouth: { x: 0.4, y: 0.68 },
    rightMouth: { x: 0.6, y: 0.68 },
    leftFace: { x: 0.3, y: 0.52 },
    rightFace: { x: 0.7, y: 0.52 },
    leftAla: { x: 0.44, y: 0.55 },
    rightAla: { x: 0.56, y: 0.55 },
    leftJaw: { x: 0.34, y: 0.74 },
    rightJaw: { x: 0.66, y: 0.74 },
    source: 'synthetic_test',
    ...overrides,
  };
}

/** Tuned for oval-dominant hybrid scores. */
function ovalAnchors(): GeometryAnchors {
  return baseAnchors({
    foreheadTop: { x: 0.5, y: 0.22 },
    chin: { x: 0.5, y: 0.78 },
    leftFace: { x: 0.29, y: 0.5 },
    rightFace: { x: 0.71, y: 0.5 },
    leftEyeOuter: { x: 0.31, y: 0.36 },
    rightEyeOuter: { x: 0.69, y: 0.36 },
    leftJaw: { x: 0.325, y: 0.72 },
    rightJaw: { x: 0.675, y: 0.72 },
  });
}

function heartAnchors(): GeometryAnchors {
  return baseAnchors({
    foreheadTop: { x: 0.5, y: 0.22 },
    chin: { x: 0.5, y: 0.78 },
    leftFace: { x: 0.3, y: 0.5 },
    rightFace: { x: 0.7, y: 0.5 },
    leftEyeOuter: { x: 0.27, y: 0.36 },
    rightEyeOuter: { x: 0.73, y: 0.36 },
    leftJaw: { x: 0.39, y: 0.72 },
    rightJaw: { x: 0.61, y: 0.72 },
  });
}

function oblongAnchors(): GeometryAnchors {
  return baseAnchors({
    foreheadTop: { x: 0.5, y: 0.1 },
    chin: { x: 0.5, y: 0.94 },
    leftFace: { x: 0.34, y: 0.5 },
    rightFace: { x: 0.66, y: 0.5 },
    leftJaw: { x: 0.36, y: 0.76 },
    rightJaw: { x: 0.64, y: 0.76 },
    leftEyeOuter: { x: 0.35, y: 0.34 },
    rightEyeOuter: { x: 0.65, y: 0.34 },
  });
}

const eligiblePose = {
  faceCount: 1,
  faceAreaRatio: 0.3,
  headYawDegrees: 0,
  headPitchDegrees: 0,
  headRollDegrees: 0,
  facePresent: true,
  captureQualityAcceptable: true,
};

function goldenDir(): string {
  return path.join(
    process.cwd(),
    'src/intelligence/face-intelligence/features/goldens',
  );
}

function assertGolden(id: string, payload: unknown): void {
  const dir = goldenDir();
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${id}.golden.json`);
  const normalized = JSON.parse(JSON.stringify(payload));
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, `${JSON.stringify(normalized, null, 2)}\n`, 'utf8');
    console.log(`[phase4c] wrote golden ${id}`);
    return;
  }
  const expected = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.deepEqual(normalized, expected, `Golden mismatch: ${id}`);
}

function testClassifiesOvalWhenEligible(): void {
  const out = runFaceFeaturesPipeline({
    analysisId: 'feat1',
    pose: eligiblePose,
    landmarks: {
      pointCount: 468,
      hasOutline: true,
      regionIdsPresent: ['forehead', 'nose', 'chin'],
      trackingQuality: 'high',
    },
    anchors: ovalAnchors(),
  });

  assert.equal(out.shapeVersion, FACE_SHAPE_VERSION);
  assert.equal(out.shapeFormulaId, FACE_SHAPE_FORMULA_ID);
  assert.equal(out.shape.availability, 'available');
  assert.equal(out.shape.shapeId, 'oval');
  assert.ok((out.shape.confidence ?? 0) > 0);

  const faceShape = out.model.metrics.find((m) => m.id === 'faceShape');
  assert.equal(faceShape?.availability, 'available');
  assert.equal(faceShape?.categoricalValue, 'oval');
  assert.ok(out.findings.some((f) => f.id === 'face_shape_oval'));
}

function testHeartAndOblongClasses(): void {
  const heart = classifyFaceShape({
    eligible: true,
    eligibilityReasons: [],
    anchors: heartAnchors(),
    trackingQuality: 'high',
  });
  assert.equal(heart.availability, 'available');
  assert.equal(heart.shapeId, 'heart');

  const oblong = classifyFaceShape({
    eligible: true,
    eligibilityReasons: [],
    anchors: oblongAnchors(),
    trackingQuality: 'high',
  });
  assert.equal(oblong.availability, 'available');
  assert.equal(oblong.shapeId, 'oblong');
}

function testUnavailableWhenNotEligible(): void {
  const out = runFaceFeaturesPipeline({
    pose: {
      faceCount: 1,
      faceAreaRatio: 0.3,
      headYawDegrees: CAPTURE_QUALITY_THRESHOLDS.maxYawDegrees + 5,
      facePresent: true,
      captureQualityAcceptable: true,
    },
    anchors: ovalAnchors(),
    landmarks: { pointCount: 468, hasOutline: true },
  });
  assert.equal(out.eligibility.eligible, false);
  assert.equal(out.shape.availability, 'unavailable');
  const faceShape = out.model.metrics.find((m) => m.id === 'faceShape');
  assert.equal(faceShape?.availability, 'unavailable');
  assert.equal(out.findings.length, 0);
}

function testGeometryPipelineStillLeavesShapeAwaiting(): void {
  const geo = runFaceGeometryPipeline({
    pose: eligiblePose,
    anchors: ovalAnchors(),
    landmarks: { pointCount: 468, hasOutline: true, trackingQuality: 'high' },
  });
  const faceShape = geo.model.metrics.find((m) => m.id === 'faceShape');
  assert.equal(faceShape?.availability, 'unavailable');
  assert.equal(faceShape?.unavailableReason, 'awaiting_face_shape_engine_4c');
}

function testDeterministicGolden(): void {
  const a = classifyFaceShape({
    eligible: true,
    eligibilityReasons: [],
    anchors: ovalAnchors(),
    trackingQuality: 'high',
  });
  const b = classifyFaceShape({
    eligible: true,
    eligibilityReasons: [],
    anchors: ovalAnchors(),
    trackingQuality: 'high',
  });
  assert.deepEqual(a.signals, b.signals);
  assert.equal(a.shapeId, b.shapeId);

  assertGolden('oval_high', {
    version: a.version,
    formulaId: a.formulaId,
    availability: a.availability,
    shapeId: a.shapeId,
    confidence: a.confidence,
    signals: a.signals,
    scores: a.scores,
  });
}

function testNoAttractivenessOrSkinCoupling(): void {
  const out = runFaceFeaturesPipeline({
    pose: eligiblePose,
    anchors: ovalAnchors(),
    landmarks: { pointCount: 468, hasOutline: true, trackingQuality: 'high' },
  });
  const blob = JSON.stringify(out).toLowerCase();
  assert.equal(/\battractiveness score\b/.test(blob), false);
  assert.ok(blob.includes('not attractiveness'));
  // Disclaimer may mention undertone only to declare independence.
  assert.ok(blob.includes('separate from skin type / undertone'));
  assert.equal(/\bskin_type\b/.test(blob), false);
  assert.equal(blob.includes('rawyoucam'), false);

  const root = path.join(process.cwd(), 'src/intelligence/face-intelligence');
  const walk = (dir: string): string[] => {
    const outFiles: string[] = [];
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) outFiles.push(...walk(p));
      else if (e.name.endsWith('.ts')) outFiles.push(p);
    }
    return outFiles;
  };
  for (const f of walk(root)) {
    const src = fs.readFileSync(f, 'utf8');
    assert.equal(/from ['"].*skin-intelligence/.test(src), false, f);
  }
}

function testCatalogComplete(): void {
  assert.equal(FACE_SHAPE_IDS.length, 7);
}

function main(): void {
  testClassifiesOvalWhenEligible();
  testHeartAndOblongClasses();
  testUnavailableWhenNotEligible();
  testGeometryPipelineStillLeavesShapeAwaiting();
  testDeterministicGolden();
  testNoAttractivenessOrSkinCoupling();
  testCatalogComplete();
  console.log('phase4c-features: OK');
}

main();
