/**
 * Phase 3.5 — Skin Intelligence validation & contracts.
 * Run: npm run test:phase3.5
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  assertContractOk,
  auditSkinIntelligencePipeline,
  CONTRACT_VERSION,
} from './skin-intelligence/validation/contract-audit';
import {
  ANALYSIS_FIXTURES,
  metricsForFixture,
  normalizeReportForSnapshot,
  runFixturePipeline,
} from './skin-intelligence/validation/fixtures';
import { mapToCanonicalSkinModel } from './skin-intelligence/provider-skin.mapper';
import { buildSkinFindings } from './skin-intelligence/skin-finding.engine';
import { compareProgress, providersCompatible } from './skin-intelligence/progress.engine';
import { computeSkinVitalityIndexV2 } from './skin-intelligence/svi-v2.engine';
import { SKIN_VITALITY_CALCULATION_VERSION } from './contracts/result-provenance';
import { buildResultMeta } from '../ports/shared/result-meta';
import { isPerfectMockFallbackAllowed } from '../config/production-integrity';

const goldensDir = path.join(
  process.cwd(),
  'src/intelligence/skin-intelligence/validation/goldens',
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
    console.log(`[phase3.5] wrote golden ${id}`);
    return;
  }
  const expected = JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, unknown>;
  assert.deepEqual(
    normalized,
    expected,
    `Golden mismatch for ${id} — unexpected Skin Intelligence change`,
  );
}

function metaForTests() {
  return buildResultMeta({
    source: 'provider_measured',
    provider: 'perfect_corp',
    providerVersion: 'youcam-s2s',
    confidence: 75,
    isMock: false,
    isProduction: false,
    calculationVersion: 'svi-v2',
  });
}

function testPipelineContracts(): void {
  for (const fixture of ANALYSIS_FIXTURES) {
    const out = runFixturePipeline(fixture);
    const model = mapToCanonicalSkinModel({
      portMetrics: metricsForFixture(fixture),
      legacy: fixture.legacy,
      meta: metaForTests(),
    });
    const findings = buildSkinFindings(model);
    const audit = auditSkinIntelligencePipeline({
      model,
      findings,
      report: out.report,
    });
    assertContractOk(audit, fixture.id);
    assert.equal(out.sviScore, out.report.svi.score);
  }
}

function testSnapshotsAndGoldens(): void {
  for (const fixture of ANALYSIS_FIXTURES) {
    const out = runFixturePipeline(fixture);
    const normalized = normalizeReportForSnapshot(out.report);
    const snap = {
      id: fixture.id,
      svi: out.report.svi.score,
      sviConfidence: out.report.svi.confidence,
      formulaId: out.report.svi.formulaId,
      findingIds: out.report.allFindings.map((f) => f.id).sort(),
      recoIds: out.report.recommendations.map((r) => r.id).sort(),
      unavailable: out.report.metrics
        .filter((m) => m.availability === 'unavailable')
        .map((m) => m.id)
        .sort(),
      report: normalized,
    };
    loadOrWriteGolden(fixture.id, snap);
  }
}

function testExplainability(): void {
  const fixture = ANALYSIS_FIXTURES.find((f) => f.id === 'mixed')!;
  const out = runFixturePipeline(fixture);
  for (const f of out.report.allFindings) {
    assert.ok(f.evidenceAr && f.evidenceEn, f.id);
    assert.ok(f.source, f.id);
    assert.ok(f.limitations.length, f.id);
    assert.ok(f.confidence, f.id);
    assert.equal(typeof f.recommendationEligible, 'boolean');
    assert.equal(typeof f.priority, 'number');
  }
  for (const m of out.report.metrics) {
    assert.ok(m.explanation.reasonAr && m.explanation.reasonEn, m.id);
    assert.ok(m.explanation.howAr && m.explanation.howEn, m.id);
    assert.ok(m.explanation.evidenceAr && m.explanation.evidenceEn, m.id);
    assert.ok(m.explanation.confidenceAr && m.explanation.confidenceEn, m.id);
    assert.ok(m.explanation.limitationsAr && m.explanation.limitationsEn, m.id);
  }
}

function testLocalization(): void {
  for (const fixture of ANALYSIS_FIXTURES) {
    const out = runFixturePipeline(fixture);
    assert.ok(out.report.executiveSummaryAr.length > 5);
    assert.ok(out.report.executiveSummaryEn.length > 5);
    for (const m of out.report.metrics) {
      assert.ok(m.displayNameAr);
      assert.ok(m.displayNameEn);
      assert.notEqual(m.displayNameAr, m.displayNameEn);
    }
  }
}

function testSviRegression(): void {
  assert.equal(SKIN_VITALITY_CALCULATION_VERSION, 'svi-v2');
  const healthy = runFixturePipeline(ANALYSIS_FIXTURES.find((f) => f.id === 'healthy')!);
  const dry = runFixturePipeline(ANALYSIS_FIXTURES.find((f) => f.id === 'dry')!);
  assert.equal(healthy.report.svi.version, 'svi-v2');
  assert.equal(healthy.report.svi.formulaId, 'svi-v2-dynamic-denom');
  assert.ok(Array.isArray(healthy.report.svi.positiveContributors));
  assert.ok(Array.isArray(healthy.report.svi.negativeContributors));
  assert.ok(Array.isArray(healthy.report.svi.unavailableExcluded));
  assert.ok(
    dry.sviScore <= healthy.sviScore,
    `expected dry (${dry.sviScore}) <= healthy (${healthy.sviScore})`,
  );
  const sparse = runFixturePipeline(
    ANALYSIS_FIXTURES.find((f) => f.id === 'unavailable_heavy')!,
  );
  assert.ok(
    sparse.report.svi.unavailableExcluded.length >=
      healthy.report.svi.unavailableExcluded.length,
  );
}

function testRecommendationEvidence(): void {
  const out = runFixturePipeline(ANALYSIS_FIXTURES.find((f) => f.id === 'mixed')!);
  const findingIds = new Set(out.report.allFindings.map((f) => f.id));
  for (const r of out.report.recommendations) {
    assert.equal(r.cosmeticOnly, true);
    if (r.category === 'educational') continue;
    assert.ok(
      r.evidence.metricIds.length + r.evidence.findingIds.length > 0,
      r.id,
    );
    for (const fid of r.evidence.findingIds) {
      assert.ok(findingIds.has(fid), `${r.id} -> ${fid}`);
    }
  }
}

function testProgressRules(): void {
  const a = runFixturePipeline(ANALYSIS_FIXTURES.find((f) => f.id === 'healthy')!);
  const b = runFixturePipeline(ANALYSIS_FIXTURES.find((f) => f.id === 'dry')!);
  const ok = compareProgress({
    previous: a.snapshot,
    current: {
      ...b.snapshot,
      captureVersion: a.snapshot.captureVersion,
      qualityVersion: a.snapshot.qualityVersion,
      provider: a.snapshot.provider,
    },
    sameCaptureQuality: true,
    compatibleProvider: true,
  });
  assert.equal(ok.comparable, true);
  assert.ok(['improved', 'stable', 'declined'].includes(ok.overallTrend));

  const blocked = compareProgress({
    previous: a.snapshot,
    current: b.snapshot,
    sameCaptureQuality: false,
    compatibleProvider: true,
  });
  assert.equal(blocked.comparable, false);
  assert.equal(blocked.overallTrend, 'unknown');
  assert.ok(blocked.unavailableReasonAr && blocked.unavailableReasonEn);

  assert.equal(providersCompatible('perfect_corp', 'perfect_corp'), true);
  assert.equal(providersCompatible('perfect_corp', 'mock_skin'), false);
}

function testProviderIndependenceStatic(): void {
  const root = path.join(process.cwd(), 'src/intelligence/skin-intelligence');
  const files = [
    'svi-v2.engine.ts',
    'recommendation.engine.ts',
    'report.engine.ts',
    'progress.engine.ts',
    'explanation.engine.ts',
    'skin-finding.engine.ts',
    'canonical-skin.model.ts',
  ];
  for (const f of files) {
    const src = fs.readFileSync(path.join(root, f), 'utf8');
    assert.equal(src.includes('perfect-corp'), false, f);
    assert.equal(src.includes('youcam'), false, f);
    assert.equal(src.includes('rawYouCam'), false, f);
  }
  const mapper = fs.readFileSync(path.join(root, 'provider-skin.mapper.ts'), 'utf8');
  assert.equal(mapper.includes('rawYouCam'), false);
}

function testFlutterDtoFieldParity(): void {
  const required = [
    'analysisId',
    'provider',
    'formulaVersion',
    'captureVersion',
    'qualityVersion',
    'skinVersion',
    'intelligenceVersion',
    'reportVersion',
    'generatedAt',
    'confidence',
    'executiveSummaryAr',
    'executiveSummaryEn',
    'positiveFindings',
    'priorityFindings',
    'metrics',
    'svi',
    'recommendations',
    'progress',
    'retakeGuidanceAr',
    'retakeGuidanceEn',
  ];
  const out = runFixturePipeline(ANALYSIS_FIXTURES[0]!);
  for (const key of required) {
    assert.ok(key in out.report, `DTO missing ${key}`);
  }
  const flutterEntity = path.join(
    process.cwd(),
    '../lib/features/intelligence/domain/entities/skin_intelligence_report.dart',
  );
  assert.ok(fs.existsSync(flutterEntity), 'Flutter SkinIntelligenceReport entity missing');
  const dart = fs.readFileSync(flutterEntity, 'utf8');
  for (const key of [
    'executiveSummaryAr',
    'retakeGuidanceAr',
    'positiveFindings',
    'priorityFindings',
    'SkinIntelSvi',
  ]) {
    assert.ok(dart.includes(key), `Flutter entity missing ${key}`);
  }
  assert.equal(dart.includes('rawYouCam'), false);
}

function testBackwardCompatibility(): void {
  const legacyStored = {
    version: 2,
    miraReport: {
      overallBeautyScore: 71,
      scoreSchemaVersion: 2,
      provenance: { calculationVersion: 'svi-v1' },
    },
  };
  assert.equal(legacyStored.miraReport.overallBeautyScore, 71);
  assert.equal(
    (legacyStored.miraReport as { skinIntelligence?: unknown }).skinIntelligence,
    undefined,
  );
  const neu = runFixturePipeline(ANALYSIS_FIXTURES[0]!);
  assert.ok(neu.report.reportVersion);
  assert.equal(neu.report.svi.version, 'svi-v2');
}

function testContractVersionDocumented(): void {
  assert.equal(CONTRACT_VERSION, 'skin-intel-contract-v1');
  const contractDoc = path.join(
    process.cwd(),
    '../docs/contracts/skin_intelligence_contract.md',
  );
  assert.ok(fs.existsSync(contractDoc), 'skin_intelligence_contract.md missing');
  const md = fs.readFileSync(contractDoc, 'utf8');
  assert.ok(md.includes('skin-intel-contract-v1'));
  assert.ok(md.includes('Unavailable'));
  assert.ok(md.includes('Provider independence'));
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
  testPipelineContracts();
  testSnapshotsAndGoldens();
  testExplainability();
  testLocalization();
  testSviRegression();
  testRecommendationEvidence();
  testProgressRules();
  testProviderIndependenceStatic();
  testFlutterDtoFieldParity();
  testBackwardCompatibility();
  testContractVersionDocumented();
  testPhase0Regression();
  assert.ok(typeof computeSkinVitalityIndexV2 === 'function');
  console.log('phase3.5-validation: OK');
}

main();
