/**
 * Phase 4B — Face Geometry schema tests + goldens.
 * Run: npm run test:phase4b
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  FACE_GEOMETRY_FORMULA_ID,
  FACE_GEOMETRY_VERSION,
  runFaceFoundationPipeline,
  runFaceGeometryPipeline,
  computeFaceGeometry,
} from './face-intelligence';
import type { GeometryAnchors } from './face-intelligence';
import { CAPTURE_QUALITY_THRESHOLDS } from '../ports/image-quality/capture-quality.thresholds';

function frontalAnchors(overrides?: Partial<GeometryAnchors>): GeometryAnchors {
  return {
    version: 'geometry-anchors-v1',
    foreheadTop: { x: 0.5, y: 0.15 },
    browMid: { x: 0.5, y: 0.32 },
    noseTip: { x: 0.5, y: 0.52 },
    noseBase: { x: 0.5, y: 0.58 },
    chin: { x: 0.5, y: 0.88 },
    leftEyeOuter: { x: 0.32, y: 0.35 },
    leftEyeInner: { x: 0.42, y: 0.35 },
    rightEyeInner: { x: 0.58, y: 0.35 },
    rightEyeOuter: { x: 0.68, y: 0.35 },
    leftMouth: { x: 0.4, y: 0.68 },
    rightMouth: { x: 0.6, y: 0.68 },
    leftFace: { x: 0.28, y: 0.5 },
    rightFace: { x: 0.72, y: 0.5 },
    leftAla: { x: 0.44, y: 0.55 },
    rightAla: { x: 0.56, y: 0.55 },
    leftJaw: { x: 0.34, y: 0.72 },
    rightJaw: { x: 0.66, y: 0.72 },
    source: 'synthetic_test',
    ...overrides,
  };
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
    'src/intelligence/face-intelligence/geometry/goldens',
  );
}

function assertGolden(id: string, payload: unknown): void {
  const dir = goldenDir();
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${id}.golden.json`);
  const normalized = JSON.parse(JSON.stringify(payload));
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, `${JSON.stringify(normalized, null, 2)}\n`, 'utf8');
    console.log(`[phase4b] wrote golden ${id}`);
    return;
  }
  const expected = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.deepEqual(normalized, expected, `Golden mismatch: ${id}`);
}

function testComputesWhenEligibleWithAnchors(): void {
  const out = runFaceGeometryPipeline({
    analysisId: 'geo1',
    pose: eligiblePose,
    landmarks: {
      pointCount: 468,
      hasOutline: true,
      regionIdsPresent: ['forehead', 'nose', 'chin'],
      trackingQuality: 'high',
    },
    anchors: frontalAnchors(),
  });

  assert.equal(out.geometryVersion, FACE_GEOMETRY_VERSION);
  assert.equal(out.formulaId, FACE_GEOMETRY_FORMULA_ID);
  assert.equal(out.eligibility.eligible, true);

  const byId = Object.fromEntries(out.model.metrics.map((m) => [m.id, m]));
  for (const id of [
    'facialThirdsBalance',
    'eyeSpacingRatio',
    'faceWidthHeightRatio',
    'noseToFaceWidthRatio',
    'mouthToFaceWidthRatio',
    'symmetryCautious',
  ]) {
    assert.equal(byId[id]?.availability, 'available', id);
    assert.ok((byId[id]?.normalizedValue ?? -1) >= 0, id);
    assert.ok((byId[id]?.confidence ?? 0) > 0, id);
  }
  assert.equal(byId.faceShape?.availability, 'unavailable');
  assert.equal(byId.faceShape?.unavailableReason, 'awaiting_face_shape_engine_4c');
}

function testUnavailableWithoutAnchors(): void {
  const out = runFaceGeometryPipeline({
    pose: eligiblePose,
    landmarks: { pointCount: 468, hasOutline: true },
  });
  const geom = out.model.metrics.filter((m) => m.id !== 'faceShape');
  assert.ok(geom.every((m) => m.availability === 'unavailable'));
  assert.ok(
    geom.every((m) => m.unavailableReason === 'missing_or_invalid_geometry_anchors'),
  );
}

function testUnavailableWhenNotEligible(): void {
  const out = runFaceGeometryPipeline({
    pose: {
      faceCount: 1,
      faceAreaRatio: 0.3,
      headYawDegrees: CAPTURE_QUALITY_THRESHOLDS.maxYawDegrees + 5,
      facePresent: true,
      captureQualityAcceptable: true,
    },
    anchors: frontalAnchors(),
    landmarks: { pointCount: 468, hasOutline: true },
  });
  assert.equal(out.eligibility.eligible, false);
  assert.ok(
    out.model.metrics
      .filter((m) => m.id !== 'faceShape')
      .every((m) => m.availability === 'unavailable'),
  );
}

function testDeterministicGoldens(): void {
  const a = computeFaceGeometry({
    eligible: true,
    eligibilityReasons: [],
    anchors: frontalAnchors(),
    trackingQuality: 'high',
  });
  const b = computeFaceGeometry({
    eligible: true,
    eligibilityReasons: [],
    anchors: frontalAnchors(),
    trackingQuality: 'high',
  });
  assert.deepEqual(a.raw, b.raw);
  assert.equal(a.metrics[0]?.normalizedValue, b.metrics[0]?.normalizedValue);

  assertGolden('frontal_high', {
    version: a.version,
    formulaId: a.formulaId,
    raw: a.raw,
    metrics: a.metrics.map((m) => ({
      id: m.id,
      availability: m.availability,
      normalizedValue: m.normalizedValue,
      confidence: m.confidence,
      categoricalValue: m.categoricalValue,
    })),
  });
}

function testNoAttractivenessScore(): void {
  const out = runFaceGeometryPipeline({
    pose: eligiblePose,
    anchors: frontalAnchors(),
    landmarks: { pointCount: 468, hasOutline: true },
  });
  const blob = JSON.stringify(out).toLowerCase();
  assert.equal(/\battractiveness score\b/.test(blob), false);
  assert.ok(blob.includes('not attractiveness'));
}

function testFoundationStillWorks(): void {
  const f = runFaceFoundationPipeline({
    pose: eligiblePose,
    landmarks: { pointCount: 468, hasOutline: true },
  });
  assert.equal(f.readyForGeometry, true);
  assert.ok(f.model.metrics.every((m) => m.availability === 'unavailable'));
}

function testNoSkinCoupling(): void {
  const root = path.join(process.cwd(), 'src/intelligence/face-intelligence');
  const walk = (dir: string): string[] => {
    const out: string[] = [];
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) out.push(...walk(p));
      else if (e.name.endsWith('.ts')) out.push(p);
    }
    return out;
  };
  for (const f of walk(root)) {
    const src = fs.readFileSync(f, 'utf8');
    assert.equal(/from ['"].*skin-intelligence/.test(src), false, f);
    assert.equal(src.includes('rawYouCam'), false, f);
  }
}

function main(): void {
  testComputesWhenEligibleWithAnchors();
  testUnavailableWithoutAnchors();
  testUnavailableWhenNotEligible();
  testDeterministicGoldens();
  testNoAttractivenessScore();
  testFoundationStillWorks();
  testNoSkinCoupling();
  console.log('phase4b-geometry: OK');
}

main();
