/**
 * Operational Hardening — production-grade integration E2E (software stages).
 * Stages: payload → parse → IntelligenceService → report DTO → runtime → health.
 * Native Camera/MediaPipe require device; documented as Stage 0 preconditions.
 *
 * Run: npm run test:face-operational-e2e
 */
import assert from 'node:assert/strict';
import { IntelligenceService } from './intelligence.service';
import {
  FACE_REPORT_VERSION,
  parseFaceIntelPackage,
  runFaceReportPipeline,
} from './face-intelligence';
import type { GeometryAnchors } from './face-intelligence';
import { SkinAnalysisResult } from '../ai/contracts/skin-analysis-result.interface';
import { HealthController } from '../health/health.controller';
import { ConfigService } from '@nestjs/config';
import { runEngineeringLawAudit } from './face-intelligence/operational/engineering-law-audit';

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

const STAGE_LOG: string[] = [];

function stage(name: string): void {
  STAGE_LOG.push(name);
  console.log(`[e2e] ${name}`);
}

async function testAvailablePath(): Promise<void> {
  stage('1_client_payload');
  const payload = {
    runtime: {
      status: 'AVAILABLE',
      reason: 'face_intel_inputs_ready',
      stage: 'anchors',
      confidence: 90,
      userVisibleAr: 'تم تجهيز قراءة الملامح.',
      userVisibleEn: 'Face feature reading is ready.',
    },
    pose: eligiblePose,
    landmarks: { pointCount: 468, hasOutline: true, trackingQuality: 'high' },
    anchors: ovalAnchors(),
    captureVersion: 'cq-thresholds-v2.1',
    provider: 'on_device_landmarks',
  };

  stage('2_parse');
  const parsed = parseFaceIntelPackage(JSON.stringify(payload));
  assert.equal(parsed.runtime.status, 'AVAILABLE');
  assert.ok(parsed.input);

  stage('3_api_face_pipeline_once');
  const once = runFaceReportPipeline(parsed.input!);
  assert.equal(once.reportVersion, FACE_REPORT_VERSION);

  stage('4_buildBeautyReport');
  const service = new IntelligenceService(
    { match: async () => ({ products: [], services: [] }) } as never,
    { skinAnalysis: { findMany: async () => [] } } as never,
  );
  const report = await service.buildBeautyReport(skin, {
    faceIntel: parsed.input,
    faceIntelRuntime: parsed.runtime,
    isMock: true,
    providerName: 'mock_skin',
    captureVersion: 'cq-thresholds-v2.1',
  });

  stage('5_dto_assertions');
  assert.ok(report.faceIntelligence);
  assert.equal(report.faceIntelligence!.reportVersion, FACE_REPORT_VERSION);
  assert.ok(report.faceIntelligenceRuntime);
  assert.equal(report.faceIntelligenceRuntime!.status, 'AVAILABLE');
  const blob = JSON.stringify(report.faceIntelligence);
  assert.ok(!blob.includes('rawYouCam'));
}

async function testFailedNoSilentDrop(): Promise<void> {
  stage('failed_runtime_explicit');
  const parsed = parseFaceIntelPackage({
    runtime: {
      status: 'FAILED',
      reason: 'mediapipe_exception',
      stage: 'mediapipe',
      confidence: 10,
      userVisibleAr: 'x',
      userVisibleEn: 'y',
    },
    pose: eligiblePose,
  });
  assert.equal(parsed.runtime.status, 'FAILED');
  assert.ok(parsed.input);
  assert.notEqual(parsed.runtime.status, undefined);
}

async function testNotRequested(): Promise<void> {
  stage('not_requested');
  const parsed = parseFaceIntelPackage(undefined);
  assert.equal(parsed.runtime.status, 'NOT_REQUESTED');
  assert.equal(parsed.input, undefined);
}

function testHealthSurface(): void {
  stage('health');
  const controller = new HealthController({
    get: (key: string, def?: string) => {
      if (key === 'SKIN_PROVIDER') return 'mock';
      if (key === 'NODE_ENV') return 'test';
      return def;
    },
  } as unknown as ConfigService);
  const body = controller.check() as {
    intelligence?: { faceIntelligence?: { reportVersion?: string } };
  };
  assert.ok(body.intelligence?.faceIntelligence?.reportVersion);
  assert.equal(
    body.intelligence!.faceIntelligence!.reportVersion,
    FACE_REPORT_VERSION,
  );
  const raw = JSON.stringify(body);
  assert.ok(!raw.includes('PERFECT_API_KEY='));
  assert.ok(!/"apiKey"\s*:\s*"[^"]+"/.test(raw));
}

function testEngLaws(): void {
  stage('engineering_laws');
  const audit = runEngineeringLawAudit();
  assert.equal(audit.passed, true);
}

async function main(): Promise<void> {
  await testAvailablePath();
  await testFailedNoSilentDrop();
  await testNotRequested();
  testHealthSurface();
  testEngLaws();
  console.log('[e2e] stages:', STAGE_LOG.join(' → '));
  console.log('face operational e2e OK');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
