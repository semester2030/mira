/**
 * Phase 4F — Face Intelligence Validation & Contracts.
 * Run: npm run test:phase4f
 *
 * Failure policy: auditors throw. Never silent repair / invent values.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  FACE_CONTRACT_VERSION,
  FACE_VALIDATION_VERSION,
  assertContractOk,
  auditFaceIntelligencePipeline,
} from './face-intelligence/validation/contract-audit';
import {
  FACE_ANALYSIS_FIXTURES,
  normalizeFaceReportForSnapshot,
  runFaceFixturePipeline,
} from './face-intelligence/validation/fixtures';
import { isPerfectMockFallbackAllowed } from '../config/production-integrity';

const goldensDir = path.join(
  process.cwd(),
  'src/intelligence/face-intelligence/validation/goldens',
);

function goldenPath(id: string): string {
  return path.join(goldensDir, `${id}.golden.json`);
}

function loadOrWriteGolden(id: string, normalized: Record<string, unknown>): void {
  if (!fs.existsSync(goldensDir)) {
    fs.mkdirSync(goldensDir, { recursive: true });
  }
  const file = goldenPath(id);
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, `${JSON.stringify(normalized, null, 2)}\n`, 'utf8');
    console.log(`[phase4f] wrote golden ${id}`);
    return;
  }
  const expected = JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, unknown>;
  assert.deepEqual(
    normalized,
    expected,
    `Golden mismatch for ${id} — unexpected Face Intelligence change (no silent formula edit)`,
  );
}

function testPipelineContracts(): void {
  for (const fixture of FACE_ANALYSIS_FIXTURES) {
    const out = runFaceFixturePipeline(fixture);
    const audit = auditFaceIntelligencePipeline({
      model: {
        version: out.report.faceVersion as 'face-model-v1',
        intelligenceVersion: out.report.intelligenceVersion as 'face-intel-v1',
        foundationVersion: 'face-foundation-v1',
        metrics: out.report.metrics.map((m) => ({
          id: m.id as never,
          displayNameAr: m.displayNameAr,
          displayNameEn: m.displayNameEn,
          normalizedValue: m.normalizedValue,
          categoricalValue: m.categoricalValue,
          confidence: m.confidence,
          availability: m.availability,
          source: m.source as never,
          limitations: m.limitations,
          unavailableReason: m.unavailableReason,
        })),
        provider: out.report.provider,
        isMock: out.report.metadata.isMock,
        limitations: out.report.limitations,
        measurementEligible: out.report.measurementEligible,
        eligibilityReasonCodes: out.report.eligibilityReasonCodes,
      },
      findings: out.report.findings,
      recommendations: out.report.recommendations,
      report: out.report,
    });
    assertContractOk(audit, fixture.id);
  }
}

function testSnapshotsAndGoldens(): void {
  for (const fixture of FACE_ANALYSIS_FIXTURES) {
    const out = runFaceFixturePipeline(fixture);
    const normalized = normalizeFaceReportForSnapshot(out.report);
    const snap = {
      id: fixture.id,
      contractVersion: FACE_CONTRACT_VERSION,
      validationVersion: FACE_VALIDATION_VERSION,
      shapeId: out.report.shape.shapeId ?? null,
      shapeAvailability: out.report.shape.availability,
      findingIds: out.report.findings.map((f) => f.id).sort(),
      recoIds: out.report.recommendations.map((r) => r.id).sort(),
      layerIds: out.report.featureLayers.map((l) => l.id).sort(),
      unavailable: out.report.metrics
        .filter((m) => m.availability === 'unavailable')
        .map((m) => m.id)
        .sort(),
      confidence: out.report.confidence,
      measurementEligible: out.report.measurementEligible,
      report: normalized,
    };
    loadOrWriteGolden(fixture.id, snap);
  }
}

function testLocalizationPairs(): void {
  for (const fixture of FACE_ANALYSIS_FIXTURES) {
    const out = runFaceFixturePipeline(fixture);
    assert.ok(out.report.executiveSummaryAr.trim());
    assert.ok(out.report.executiveSummaryEn.trim());
    for (const m of out.report.metrics) {
      assert.ok(m.displayNameAr.trim(), m.id);
      assert.ok(m.displayNameEn.trim(), m.id);
    }
  }
}

function testProviderIndependence(): void {
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
    // Ban real payload fields / imports — allow the string only inside leakage ban lists.
    assert.equal(
      /rawYouCam\s*[:=]/.test(src) || /import\s+.*rawYouCam/.test(src),
      false,
      f,
    );
  }

  // Skin goldens must remain untouched by Face Intel validation.
  const skinGolden = path.join(
    process.cwd(),
    'src/intelligence/skin-intelligence/validation/goldens/healthy.golden.json',
  );
  assert.ok(fs.existsSync(skinGolden), 'Skin golden missing — regression risk');
}

function testAttractivenessAndHealthMapSeparation(): void {
  for (const fixture of FACE_ANALYSIS_FIXTURES) {
    const out = runFaceFixturePipeline(fixture);
    const blob = JSON.stringify(out.report).toLowerCase();
    assert.equal(/\battractiveness score\b/.test(blob), false, fixture.id);
    assert.ok(
      out.report.metadata.schemaNote.toLowerCase().includes('facehealthmap'),
      fixture.id,
    );
    assert.ok(
      out.report.limitations.some((l) => l.includes('FaceHealthMap')),
      fixture.id,
    );
  }
}

function testIneligibleNeverInvent(): void {
  const fixture = FACE_ANALYSIS_FIXTURES.find((f) => f.id === 'ineligible_yaw')!;
  const out = runFaceFixturePipeline(fixture);
  assert.equal(out.report.measurementEligible, false);
  assert.equal(out.report.shape.availability, 'unavailable');
  for (const m of out.report.metrics) {
    if (m.availability === 'unavailable') {
      assert.equal(m.normalizedValue, undefined, m.id);
    }
  }
  assert.equal(out.report.findings.length, 0);
}

function testContractsPresent(): void {
  const docs = path.join(process.cwd(), '../docs/contracts');
  for (const name of [
    'face_intelligence_contract.md',
    'face_measurement_contract.md',
    'face_findings_contract.md',
    'face_recommendation_contract.md',
    'face_report_contract.md',
    'face_validation_contract.md',
  ]) {
    assert.ok(fs.existsSync(path.join(docs, name)), name);
  }
  const dep = path.join(
    process.cwd(),
    '../docs/architecture/local-face-map-builder-deprecation.md',
  );
  assert.ok(fs.existsSync(dep), 'LocalFaceMapBuilder deprecation plan missing');
}

function testPhase0MockStillBlockedInProduction(): void {
  assert.equal(
    isPerfectMockFallbackAllowed({
      NODE_ENV: 'production',
      PERFECT_CORP_FALLBACK_MOCK: 'true',
    }),
    false,
  );
}

function testRegressionPriorFacePhases(): void {
  const scripts = [
    'test:phase4a',
    'test:phase4b',
    'test:phase4c',
    'test:phase4d',
    'test:phase4e',
  ];
  for (const script of scripts) {
    const r = spawnSync('npm', ['run', script], {
      cwd: process.cwd(),
      encoding: 'utf8',
      env: process.env,
    });
    assert.equal(
      r.status,
      0,
      `Regression ${script} failed:\n${r.stdout}\n${r.stderr}`,
    );
  }
}

function testSkinPhase35StillGreen(): void {
  const r = spawnSync('npm', ['run', 'test:phase3.5'], {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: process.env,
  });
  assert.equal(
    r.status,
    0,
    `Phase 3.5 regression failed:\n${r.stdout}\n${r.stderr}`,
  );
}

function main(): void {
  testPipelineContracts();
  testSnapshotsAndGoldens();
  testLocalizationPairs();
  testProviderIndependence();
  testAttractivenessAndHealthMapSeparation();
  testIneligibleNeverInvent();
  testContractsPresent();
  testPhase0MockStillBlockedInProduction();
  // Heavy regressions last (already built once via npm script wrapper).
  testRegressionPriorFacePhases();
  testSkinPhase35StillGreen();
  console.log('phase4f-validation: OK');
}

main();
