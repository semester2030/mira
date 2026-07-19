/**
 * Phase 4D — Face Recommendations schema tests.
 * Run: npm run test:phase4d
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  FACE_RECOMMENDATION_ENGINE_ID,
  FACE_RECOMMENDATION_VERSION,
  runFaceRecommendationPipeline,
  runFaceFeaturesPipeline,
  buildFaceRecommendations,
  assertFaceRecommendationEvidence,
} from './face-intelligence';
import type { GeometryAnchors } from './face-intelligence';
import { CAPTURE_QUALITY_THRESHOLDS } from '../ports/image-quality/capture-quality.thresholds';

function ovalAnchors(): GeometryAnchors {
  return {
    version: 'geometry-anchors-v1',
    foreheadTop: { x: 0.5, y: 0.22 },
    browMid: { x: 0.5, y: 0.34 },
    noseTip: { x: 0.5, y: 0.52 },
    noseBase: { x: 0.5, y: 0.58 },
    chin: { x: 0.5, y: 0.78 },
    leftEyeOuter: { x: 0.31, y: 0.36 },
    leftEyeInner: { x: 0.42, y: 0.36 },
    rightEyeInner: { x: 0.58, y: 0.36 },
    rightEyeOuter: { x: 0.69, y: 0.36 },
    leftMouth: { x: 0.4, y: 0.68 },
    rightMouth: { x: 0.6, y: 0.68 },
    leftFace: { x: 0.29, y: 0.5 },
    rightFace: { x: 0.71, y: 0.5 },
    leftAla: { x: 0.44, y: 0.55 },
    rightAla: { x: 0.56, y: 0.55 },
    leftJaw: { x: 0.325, y: 0.72 },
    rightJaw: { x: 0.675, y: 0.72 },
    source: 'synthetic_test',
  };
}

function heartAnchors(): GeometryAnchors {
  return {
    ...ovalAnchors(),
    leftEyeOuter: { x: 0.27, y: 0.36 },
    rightEyeOuter: { x: 0.73, y: 0.36 },
    leftJaw: { x: 0.39, y: 0.72 },
    rightJaw: { x: 0.61, y: 0.72 },
    leftFace: { x: 0.3, y: 0.5 },
    rightFace: { x: 0.7, y: 0.5 },
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
    'src/intelligence/face-intelligence/recommendation/goldens',
  );
}

function assertGolden(id: string, payload: unknown): void {
  const dir = goldenDir();
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${id}.golden.json`);
  const normalized = JSON.parse(JSON.stringify(payload));
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, `${JSON.stringify(normalized, null, 2)}\n`, 'utf8');
    console.log(`[phase4d] wrote golden ${id}`);
    return;
  }
  const expected = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.deepEqual(normalized, expected, `Golden mismatch: ${id}`);
}

function testProducesEvidenceBackedRecos(): void {
  const out = runFaceRecommendationPipeline({
    analysisId: 'reco1',
    pose: eligiblePose,
    landmarks: {
      pointCount: 468,
      hasOutline: true,
      trackingQuality: 'high',
    },
    anchors: ovalAnchors(),
  });

  assert.equal(out.recommendationVersion, FACE_RECOMMENDATION_VERSION);
  assert.equal(out.recommendationEngineId, FACE_RECOMMENDATION_ENGINE_ID);
  assert.ok(out.recommendations.length >= 2);
  assert.ok(
    out.recommendations.some((r) => r.id === 'edu_face_styling_disclaimer'),
  );
  assert.ok(out.recommendations.some((r) => r.id === 'rec_hairstyle_oval'));
  assertFaceRecommendationEvidence(out.recommendations);

  for (const r of out.recommendations) {
    assert.equal(r.cosmeticOnly, true);
    assert.equal(r.productLockIn, false);
    if (r.category !== 'educational' || r.evidence.findingIds.length > 0) {
      if (r.id !== 'edu_face_styling_disclaimer') {
        assert.ok(
          r.evidence.findingIds.length > 0 || r.evidence.metricIds.length > 0,
          r.id,
        );
      }
    }
  }
}

function testHeartGetsAccessoriesAndContour(): void {
  const out = runFaceRecommendationPipeline({
    pose: eligiblePose,
    landmarks: { pointCount: 468, hasOutline: true, trackingQuality: 'high' },
    anchors: heartAnchors(),
  });
  assert.ok(out.recommendations.some((r) => r.id === 'rec_hairstyle_heart'));
  assert.ok(out.recommendations.some((r) => r.id === 'rec_contour_heart'));
  assert.ok(
    out.recommendations.some((r) => r.id === 'rec_accessories_narrow_lower') ||
      out.findings.some((f) => f.id === 'narrower_lower_face'),
  );
}

function testNoRecosBeyondDisclaimerWhenIneligible(): void {
  const out = runFaceRecommendationPipeline({
    pose: {
      faceCount: 1,
      faceAreaRatio: 0.3,
      headYawDegrees: CAPTURE_QUALITY_THRESHOLDS.maxYawDegrees + 5,
      facePresent: true,
      captureQualityAcceptable: true,
    },
    landmarks: { pointCount: 468, hasOutline: true },
    anchors: ovalAnchors(),
  });
  assert.equal(out.eligibility.eligible, false);
  assert.equal(out.findings.length, 0);
  assert.equal(out.recommendations.length, 1);
  assert.equal(out.recommendations[0]?.id, 'edu_face_styling_disclaimer');
}

function testFeaturesPipelineHasNoRecommendationsField(): void {
  const feat = runFaceFeaturesPipeline({
    pose: eligiblePose,
    landmarks: { pointCount: 468, hasOutline: true, trackingQuality: 'high' },
    anchors: ovalAnchors(),
  });
  assert.equal('recommendations' in feat, false);
}

function testDeterministicGolden(): void {
  const a = runFaceRecommendationPipeline({
    pose: eligiblePose,
    landmarks: { pointCount: 468, hasOutline: true, trackingQuality: 'high' },
    anchors: ovalAnchors(),
  });
  const b = runFaceRecommendationPipeline({
    pose: eligiblePose,
    landmarks: { pointCount: 468, hasOutline: true, trackingQuality: 'high' },
    anchors: ovalAnchors(),
  });
  assert.deepEqual(
    a.recommendations.map((r) => r.id),
    b.recommendations.map((r) => r.id),
  );

  assertGolden('oval_styling', {
    version: a.recommendationVersion,
    engineId: a.recommendationEngineId,
    shapeId: a.shape.shapeId,
    recommendationIds: a.recommendations.map((r) => r.id),
    categories: a.recommendations.map((r) => r.category),
    evidence: a.recommendations.map((r) => ({
      id: r.id,
      findingIds: r.evidence.findingIds,
      metricIds: r.evidence.metricIds,
      productLockIn: r.productLockIn,
    })),
  });
}

function testNoAttractivenessOrPerfectLock(): void {
  const out = runFaceRecommendationPipeline({
    pose: eligiblePose,
    landmarks: { pointCount: 468, hasOutline: true, trackingQuality: 'high' },
    anchors: ovalAnchors(),
  });
  const blob = JSON.stringify(out).toLowerCase();
  assert.equal(/\battractiveness score\b/.test(blob), false);
  assert.ok(blob.includes('no perfect'));
  assert.equal(blob.includes('sku:'), false);
  assert.equal(blob.includes('youcam'), false);

  const root = path.join(process.cwd(), 'src/intelligence/face-intelligence');
  const walk = (dir: string): string[] => {
    const files: string[] = [];
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) files.push(...walk(p));
      else if (e.name.endsWith('.ts')) files.push(p);
    }
    return files;
  };
  for (const f of walk(root)) {
    const src = fs.readFileSync(f, 'utf8');
    assert.equal(/from ['"].*skin-intelligence/.test(src), false, f);
  }
}

function testEmptyFindingsOnlyDisclaimer(): void {
  const recos = buildFaceRecommendations({
    model: {
      version: 'face-model-v1',
      intelligenceVersion: 'face-intel-v1',
      foundationVersion: 'face-foundation-v1',
      metrics: [],
      provider: 'test',
      isMock: false,
      limitations: [],
      measurementEligible: false,
      eligibilityReasonCodes: [],
    },
    findings: [],
  });
  assert.equal(recos.length, 1);
  assert.equal(recos[0]?.category, 'educational');
}

function main(): void {
  testProducesEvidenceBackedRecos();
  testHeartGetsAccessoriesAndContour();
  testNoRecosBeyondDisclaimerWhenIneligible();
  testFeaturesPipelineHasNoRecommendationsField();
  testDeterministicGolden();
  testNoAttractivenessOrPerfectLock();
  testEmptyFindingsOnlyDisclaimer();
  console.log('phase4d-recommendations: OK');
}

main();
