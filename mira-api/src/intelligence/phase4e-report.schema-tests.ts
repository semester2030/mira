/**
 * Phase 4E — Face Report schema tests + goldens.
 * Run: npm run test:phase4e
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  FACE_REPORT_VERSION,
  runFaceReportPipeline,
  runFaceRecommendationPipeline,
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
    'src/intelligence/face-intelligence/report/goldens',
  );
}

function assertGolden(id: string, payload: unknown): void {
  const dir = goldenDir();
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${id}.golden.json`);
  const normalized = JSON.parse(JSON.stringify(payload));
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, `${JSON.stringify(normalized, null, 2)}\n`, 'utf8');
    console.log(`[phase4e] wrote golden ${id}`);
    return;
  }
  const expected = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.deepEqual(normalized, expected, `Golden mismatch: ${id}`);
}

function testBuildsSiblingReport(): void {
  const out = runFaceReportPipeline({
    analysisId: 'face-report-1',
    pose: eligiblePose,
    landmarks: { pointCount: 468, hasOutline: true, trackingQuality: 'high' },
    anchors: ovalAnchors(),
  });

  assert.equal(out.reportVersion, FACE_REPORT_VERSION);
  assert.equal(out.report.reportVersion, FACE_REPORT_VERSION);
  assert.equal(out.report.analysisId, 'face-report-1');
  assert.equal(out.report.shape.availability, 'available');
  assert.equal(out.report.shape.shapeId, 'oval');
  assert.ok(out.report.metrics.length >= 7);
  assert.ok(out.report.recommendations.length >= 1);
  assert.ok(out.report.featureLayers.length >= 1);
  assert.ok(out.report.executiveSummaryAr.includes('بيضاوي'));
  assert.ok(
    out.report.metadata.schemaNote.includes('never FaceHealthMap'),
  );
}

function testNoProviderLeakageOrAttractiveness(): void {
  const out = runFaceReportPipeline({
    analysisId: 'leak-check',
    pose: eligiblePose,
    landmarks: { pointCount: 468, hasOutline: true, trackingQuality: 'high' },
    anchors: ovalAnchors(),
  });
  const blob = JSON.stringify(out.report).toLowerCase();
  assert.equal(blob.includes('rawyoucam'), false);
  assert.equal(blob.includes('youcam'), false);
  assert.equal(/\battractiveness score\b/.test(blob), false);
  assert.ok(blob.includes('not attractiveness'));
  assert.ok(out.report.limitations.some((l) => l.includes('FaceHealthMap')));
  assert.ok(out.report.metadata.schemaNote.includes('never FaceHealthMap'));
}

function testUnavailableWhenIneligible(): void {
  const out = runFaceReportPipeline({
    analysisId: 'ineligible',
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
  assert.equal(out.report.measurementEligible, false);
  assert.equal(out.report.shape.availability, 'unavailable');
  assert.equal(out.report.findings.length, 0);
  assert.ok(
    out.report.recommendations.every(
      (r) => r.id === 'edu_face_styling_disclaimer' || r.category === 'educational',
    ),
  );
}

function testMetricsNeverInventUnavailableValues(): void {
  const out = runFaceReportPipeline({
    analysisId: 'no-anchors',
    pose: eligiblePose,
    landmarks: { pointCount: 468, hasOutline: true },
  });
  for (const m of out.report.metrics) {
    if (m.availability === 'unavailable') {
      assert.equal(m.normalizedValue, undefined);
    }
  }
}

function testRecoPipelineHasNoReportField(): void {
  const reco = runFaceRecommendationPipeline({
    pose: eligiblePose,
    landmarks: { pointCount: 468, hasOutline: true, trackingQuality: 'high' },
    anchors: ovalAnchors(),
  });
  assert.equal('report' in reco, false);
}

function testDeterministicGolden(): void {
  const a = runFaceReportPipeline({
    analysisId: 'golden',
    pose: eligiblePose,
    landmarks: { pointCount: 468, hasOutline: true, trackingQuality: 'high' },
    anchors: ovalAnchors(),
  });
  const b = runFaceReportPipeline({
    analysisId: 'golden',
    pose: eligiblePose,
    landmarks: { pointCount: 468, hasOutline: true, trackingQuality: 'high' },
    anchors: ovalAnchors(),
  });

  const strip = (r: typeof a.report) => ({
    reportVersion: r.reportVersion,
    shape: r.shape,
    metricIds: r.metrics.map((m) => ({
      id: m.id,
      availability: m.availability,
      categoricalValue: m.categoricalValue,
      normalizedValue: m.normalizedValue,
      confidence: m.confidence,
    })),
    findingIds: r.findings.map((f) => f.id),
    layerIds: r.featureLayers.map((l) => l.id),
    recommendationIds: r.recommendations.map((x) => x.id),
    confidence: r.confidence,
    measurementEligible: r.measurementEligible,
  });

  assert.deepEqual(strip(a.report), strip(b.report));
  assertGolden('oval_face_report', strip(a.report));
}

function testNoSkinIntelligenceImport(): void {
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

  const contractPath = path.join(
    process.cwd(),
    '../docs/contracts/mira-beauty-report.interface.ts',
  );
  void contractPath;
  const beauty = fs.readFileSync(
    path.join(
      process.cwd(),
      'src/intelligence/contracts/mira-beauty-report.interface.ts',
    ),
    'utf8',
  );
  assert.ok(beauty.includes('faceIntelligence?'));
  assert.ok(beauty.includes('Never overload FaceHealthMap'));
}

function main(): void {
  testBuildsSiblingReport();
  testNoProviderLeakageOrAttractiveness();
  testUnavailableWhenIneligible();
  testMetricsNeverInventUnavailableValues();
  testRecoPipelineHasNoReportField();
  testDeterministicGolden();
  testNoSkinIntelligenceImport();
  console.log('phase4e-report: OK');
}

main();
