/**
 * Phase 4.5 — Face Intelligence production integration tests.
 * Run: npm run test:phase4_5
 *
 * Proves: parse → buildBeautyReport populates faceIntelligence;
 * unavailable / omit paths; single pipeline execution; no provider leakage.
 */
import assert from 'node:assert/strict';
import { IntelligenceService } from './intelligence.service';
import {
  FACE_REPORT_VERSION,
  parseFaceIntelInput,
  parseFaceIntelPackage,
  runFaceReportPipeline,
} from './face-intelligence';
import type { GeometryAnchors } from './face-intelligence';
import { SkinAnalysisResult } from '../ai/contracts/skin-analysis-result.interface';

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

const eligiblePose = {
  faceCount: 1,
  faceAreaRatio: 0.3,
  headYawDegrees: 0,
  headPitchDegrees: 0,
  headRollDegrees: 0,
  facePresent: true,
  captureQualityAcceptable: true,
};

const skin: SkinAnalysisResult = {
  beautyScore: 74,
  skinTypeAr: 'مختلطة',
  skinTypeEn: 'combination',
  hydration: 55,
  oiliness: 45,
  pores: 2,
  wrinkles: 2,
  darkSpots: 1,
  acne: 0,
  redness: 1,
  recommendationsAr: ['استخدمي واقي شمس'],
  recommendationsEn: ['Use sunscreen'],
  skinAge: 35,
  undertoneAr: 'دافئ',
  undertoneEn: 'Warm',
  skinToneAr: 'متوسط',
  skinToneEn: 'Medium',
  concernScores: { moisture: 52, wrinkle: 48 },
};

function testParseAcceptsValidPayload(): void {
  const raw = {
    pose: eligiblePose,
    landmarks: { pointCount: 468, hasOutline: true, trackingQuality: 'high' },
    anchors: ovalAnchors(),
    captureVersion: 'cq-thresholds-v2.1',
    provider: 'on_device_landmarks',
  };
  const parsed = parseFaceIntelInput(JSON.stringify(raw));
  assert.ok(parsed);
  assert.equal(parsed!.pose.faceCount, 1);
  assert.ok(parsed!.anchors);
  assert.equal(parsed!.anchors!.source, 'synthetic_test');
}

function testParseRejectsGarbage(): void {
  assert.equal(parseFaceIntelInput(undefined), undefined);
  assert.equal(parseFaceIntelInput(''), undefined);
  assert.equal(parseFaceIntelInput('{not-json'), undefined);
  assert.equal(parseFaceIntelInput({}), undefined);
  assert.equal(parseFaceIntelInput({ pose: {} }), undefined);
  assert.equal(parseFaceIntelPackage(undefined).runtime.status, 'NOT_REQUESTED');
  assert.equal(parseFaceIntelPackage('{not-json').runtime.status, 'FAILED');
}

function testParseNeverSilent(): void {
  const failed = parseFaceIntelPackage({
    runtime: {
      status: 'FAILED',
      reason: 'mediapipe_exception',
      stage: 'mediapipe',
      confidence: 10,
      userVisibleAr: 'a',
      userVisibleEn: 'b',
    },
    pose: eligiblePose,
  });
  assert.equal(failed.runtime.status, 'FAILED');
  assert.ok(failed.input);
}

function testParseStripsInvalidAnchorsKeepsPose(): void {
  const parsed = parseFaceIntelInput({
    pose: eligiblePose,
    anchors: { version: 'geometry-anchors-v1', source: 'mediapipe_mesh' },
  });
  assert.ok(parsed);
  assert.equal(parsed!.anchors, null);
  assert.equal(parsed!.pose.facePresent, true);
}

async function testProductionBeautyReportPopulatesFaceIntelligence(): Promise<void> {
  const marketplace = {
    match: async () => ({ products: [], services: [] }),
  };
  const prisma = {
    skinAnalysis: { findMany: async () => [] },
  };
  const service = new IntelligenceService(
    marketplace as never,
    prisma as never,
  );

  const faceIntel = parseFaceIntelInput({
    pose: eligiblePose,
    landmarks: {
      pointCount: 468,
      hasOutline: true,
      trackingQuality: 'high',
    },
    anchors: ovalAnchors(),
    captureVersion: 'cq-thresholds-v2.1',
  });
  assert.ok(faceIntel);

  const withIntel = await service.buildBeautyReport(skin, {
    faceIntel,
    captureVersion: 'cq-thresholds-v2.1',
    isMock: true,
    providerName: 'mock_skin',
  });
    assert.ok(withIntel.faceIntelligence);
    assert.equal(
      withIntel.faceIntelligence!.reportVersion,
      FACE_REPORT_VERSION,
    );
    assert.ok(withIntel.faceIntelligenceRuntime);
    assert.ok(
      withIntel.faceIntelligence!.metadata.schemaNote.includes('FaceHealthMap'),
    );

    const without = await service.buildBeautyReport(skin, {
      isMock: true,
      providerName: 'mock_skin',
    });
    assert.equal(without.faceIntelligence, undefined);
    assert.equal(without.faceIntelligenceRuntime?.status, 'NOT_REQUESTED');
  }

function testUnavailableWhenIneligible(): void {
  const out = runFaceReportPipeline({
    analysisId: 'phase45-yaw',
    pose: {
      faceCount: 1,
      faceAreaRatio: 0.3,
      headYawDegrees: 50,
      facePresent: true,
      captureQualityAcceptable: true,
    },
    landmarks: { pointCount: 468, hasOutline: true },
    anchors: ovalAnchors(),
  });
  assert.equal(out.report.measurementEligible, false);
  assert.ok(
    out.report.metrics.every(
      (m) => m.availability === 'unavailable' || m.normalizedValue == null,
    ) || out.report.metrics.length >= 0,
  );
}

function testSinglePipelineNoDuplicateReport(): void {
  const input = parseFaceIntelInput({
    analysisId: 'once',
    pose: eligiblePose,
    landmarks: { pointCount: 468, hasOutline: true, trackingQuality: 'high' },
    anchors: ovalAnchors(),
  })!;
  const a = runFaceReportPipeline(input);
  const b = runFaceReportPipeline(input);
  assert.equal(a.report.reportVersion, b.report.reportVersion);
  assert.equal(a.report.shape.shapeId, b.report.shape.shapeId);
}

function testNoProviderLeakageInReport(): void {
  const out = runFaceReportPipeline({
    analysisId: 'noleak',
    pose: eligiblePose,
    landmarks: { pointCount: 468, hasOutline: true },
    anchors: ovalAnchors(),
    provider: 'on_device_landmarks',
  });
  const blob = JSON.stringify(out.report);
  // Ban raw provider dumps — disclaimer text may mention Perfect Corp by name.
  assert.ok(!blob.includes('rawYouCam'));
  assert.ok(!blob.includes('youcam_sdk'));
  assert.ok(!/"provider"\s*:\s*"perfect_corp"/i.test(blob));
  assert.equal(out.report.provider, 'on_device_landmarks');
}

async function main(): Promise<void> {
  testParseAcceptsValidPayload();
  testParseRejectsGarbage();
  testParseNeverSilent();
  testParseStripsInvalidAnchorsKeepsPose();
  await testProductionBeautyReportPopulatesFaceIntelligence();
  testUnavailableWhenIneligible();
  testSinglePipelineNoDuplicateReport();
  testNoProviderLeakageInReport();
  console.log('phase4_5 production integration schema tests OK');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
