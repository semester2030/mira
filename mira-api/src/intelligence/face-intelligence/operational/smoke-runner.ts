/**
 * Production smoke runner — post-deploy verification checklist executable.
 * Does not call Perfect Corp. Verifies health + local Face pipeline + no leakage.
 *
 * Run: npm run smoke:face-intel
 * Optional: FACE_SMOKE_BASE_URL=https://mira-api-n4p3.onrender.com/api/v1
 */
import assert from 'node:assert/strict';
import {
  FACE_REPORT_VERSION,
  parseFaceIntelPackage,
  runFaceReportPipeline,
} from '../index';
import type { GeometryAnchors } from '../index';

function anchors(): GeometryAnchors {
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

async function maybeFetchHealth(baseUrl: string | undefined): Promise<void> {
  if (!baseUrl) {
    console.log('[smoke] skip remote health (set FACE_SMOKE_BASE_URL to enable)');
    return;
  }
  const url = `${baseUrl.replace(/\/$/, '')}/health`;
  const res = await fetch(url);
  assert.equal(res.ok, true, `health HTTP ${res.status}`);
  const body = (await res.json()) as {
    intelligence?: { faceIntelligence?: { reportVersion?: string } };
  };
  assert.equal(
    body.intelligence?.faceIntelligence?.reportVersion,
    FACE_REPORT_VERSION,
  );
  console.log('[smoke] remote health OK', url);
}

async function main(): Promise<void> {
  console.log('[smoke] local Face pipeline');
  const parsed = parseFaceIntelPackage({
    runtime: {
      status: 'AVAILABLE',
      reason: 'smoke',
      stage: 'smoke',
      confidence: 90,
      userVisibleAr: '',
      userVisibleEn: '',
    },
    pose: {
      faceCount: 1,
      faceAreaRatio: 0.3,
      facePresent: true,
      captureQualityAcceptable: true,
      headYawDegrees: 0,
      headPitchDegrees: 0,
      headRollDegrees: 0,
    },
    landmarks: { pointCount: 468, hasOutline: true, trackingQuality: 'high' },
    anchors: anchors(),
  });
  assert.ok(parsed.input);
  const out = runFaceReportPipeline(parsed.input!);
  assert.equal(out.report.reportVersion, FACE_REPORT_VERSION);
  const blob = JSON.stringify(out.report);
  assert.ok(!blob.includes('raw' + 'YouCam'));
  console.log('[smoke] expected: faceIntelligence reportVersion=', FACE_REPORT_VERSION);
  console.log('[smoke] expected: Flutter shows FaceIntelligenceSection when DTO present');
  console.log('[smoke] expected: runtime AVAILABLE|UNAVAILABLE|FAILED never silent');

  await maybeFetchHealth(process.env.FACE_SMOKE_BASE_URL);
  console.log('face intel smoke OK');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
