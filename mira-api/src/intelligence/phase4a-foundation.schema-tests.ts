/**
 * Phase 4A — Face Foundation schema tests.
 * Run: npm run test:phase4a
 *
 * Scope: eligibility, landmark summary, skeleton model, no invented metrics,
 * no Perfect/YouCam leakage, threshold reuse, regression vs skin package isolation.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  ALL_FACE_METRIC_IDS,
  buildSkeletonCanonicalFaceModel,
  FACE_FOUNDATION_VERSION,
  FACE_MODEL_VERSION,
} from './face-intelligence/canonical-face.model';
import { evaluateMeasurementEligibility } from './face-intelligence/measurement-eligibility';
import {
  emptyLandmarkFrame,
  summarizeLandmarkInput,
} from './face-intelligence/landmark-frame';
import { runFaceFoundationPipeline } from './face-intelligence';
import { CAPTURE_QUALITY_THRESHOLDS } from '../ports/image-quality/capture-quality.thresholds';
import { isPerfectMockFallbackAllowed } from '../config/production-integrity';

function testEligibilityAcceptsFrontal(): void {
  const r = evaluateMeasurementEligibility({
    faceCount: 1,
    faceAreaRatio: 0.25,
    headYawDegrees: 5,
    headPitchDegrees: 3,
    headRollDegrees: 2,
    facePresent: true,
    captureQualityAcceptable: true,
  });
  assert.equal(r.eligible, true);
  assert.equal(r.reasonCodes.length, 0);
  assert.equal(r.thresholdVersion, CAPTURE_QUALITY_THRESHOLDS.version);
}

function testEligibilityRejectsYaw(): void {
  const r = evaluateMeasurementEligibility({
    faceCount: 1,
    faceAreaRatio: 0.25,
    headYawDegrees: CAPTURE_QUALITY_THRESHOLDS.maxYawDegrees + 1,
    facePresent: true,
    captureQualityAcceptable: true,
  });
  assert.equal(r.eligible, false);
  assert.ok(r.reasonCodes.includes('head_turned'));
}

function testEligibilityReusesThresholdPack(): void {
  assert.equal(CAPTURE_QUALITY_THRESHOLDS.version, 'cq-thresholds-v2.1');
  assert.equal(CAPTURE_QUALITY_THRESHOLDS.maxYawDegrees, 35);
  assert.equal(CAPTURE_QUALITY_THRESHOLDS.maxPitchDegrees, 30);
  assert.equal(CAPTURE_QUALITY_THRESHOLDS.maxRollDegrees, 28);
}

function testSkeletonNeverInvented(): void {
  const model = buildSkeletonCanonicalFaceModel({
    measurementEligible: true,
    eligibilityReasonCodes: [],
  });
  assert.equal(model.version, FACE_MODEL_VERSION);
  assert.equal(model.metrics.length, ALL_FACE_METRIC_IDS.length);
  for (const m of model.metrics) {
    assert.equal(m.availability, 'unavailable');
    assert.equal(m.normalizedValue, undefined);
    assert.equal(m.confidence, 0);
    assert.ok(m.unavailableReason);
    assert.ok(m.displayNameAr && m.displayNameEn);
  }
}

function testIneligibleKeepsUnavailable(): void {
  const out = runFaceFoundationPipeline({
    pose: {
      faceCount: 0,
      facePresent: false,
      captureQualityAcceptable: true,
    },
    landmarks: { pointCount: 468, hasOutline: true, regionIdsPresent: ['nose'] },
  });
  assert.equal(out.eligibility.eligible, false);
  assert.equal(out.readyForGeometry, false);
  assert.ok(out.model.metrics.every((m) => m.availability === 'unavailable'));
}

function testReadyForGeometryRequiresEligibilityAndLandmarks(): void {
  const ready = runFaceFoundationPipeline({
    analysisId: 't1',
    pose: {
      faceCount: 1,
      faceAreaRatio: 0.3,
      headYawDegrees: 0,
      facePresent: true,
      captureQualityAcceptable: true,
    },
    landmarks: {
      pointCount: 468,
      hasOutline: true,
      regionIdsPresent: ['forehead', 'nose', 'chin'],
      trackingQuality: 'high',
      source: 'mediapipe_mesh',
    },
  });
  assert.equal(ready.eligibility.eligible, true);
  assert.equal(ready.readyForGeometry, true);
  assert.equal(ready.version, FACE_FOUNDATION_VERSION);
  // Still no metric values in 4A
  assert.ok(ready.model.metrics.every((m) => m.normalizedValue == null));

  const noMesh = runFaceFoundationPipeline({
    pose: {
      faceCount: 1,
      faceAreaRatio: 0.3,
      facePresent: true,
      captureQualityAcceptable: true,
    },
  });
  assert.equal(noMesh.eligibility.eligible, true);
  assert.equal(noMesh.readyForGeometry, false);
  assert.equal(noMesh.landmarks.source, 'unavailable');
}

function testLandmarkSummaryNoRawLeakage(): void {
  const s = summarizeLandmarkInput({
    pointCount: 100,
    hasOutline: true,
    regionIdsPresent: ['cheek'],
  });
  const json = JSON.stringify(s);
  assert.equal(json.includes('rawYouCam'), false);
  assert.equal(json.includes('perfect'), false);
  assert.equal(emptyLandmarkFrame('x').pointCount, 0);
}

function testNoSkinIntelligenceCoupling(): void {
  const root = path.join(process.cwd(), 'src/intelligence/face-intelligence');
  for (const f of fs.readdirSync(root)) {
    if (!f.endsWith('.ts')) continue;
    const src = fs.readFileSync(path.join(root, f), 'utf8');
    // Imports / path coupling only (comments may mention sibling domains).
    assert.equal(/from ['"].*skin-intelligence/.test(src), false, f);
    assert.equal(/from ['"].*svi-v2/.test(src), false, f);
    assert.equal(/from ['"].*perfect-corp/.test(src), false, f);
    assert.equal(src.includes('rawYouCam'), false, f);
    assert.equal(/import\s+.*FaceHealthMap/.test(src), false, f);
  }
}

function testNoAttractivenessClaims(): void {
  const out = runFaceFoundationPipeline({
    pose: { faceCount: 1, faceAreaRatio: 0.2, facePresent: true },
  });
  const blob = JSON.stringify(out).toLowerCase();
  assert.ok(blob.includes('not attractiveness'));
  assert.equal(/\battractiveness score\b/.test(blob), false);
}

function testPhase0Regression(): void {
  assert.equal(
    isPerfectMockFallbackAllowed({
      NODE_ENV: 'production',
      PERFECT_CORP_FALLBACK_MOCK: 'true',
    }),
    false,
  );
}

function main(): void {
  testEligibilityAcceptsFrontal();
  testEligibilityRejectsYaw();
  testEligibilityReusesThresholdPack();
  testSkeletonNeverInvented();
  testIneligibleKeepsUnavailable();
  testReadyForGeometryRequiresEligibilityAndLandmarks();
  testLandmarkSummaryNoRawLeakage();
  testNoSkinIntelligenceCoupling();
  testNoAttractivenessClaims();
  testPhase0Regression();
  console.log('phase4a-foundation: OK');
}

main();
