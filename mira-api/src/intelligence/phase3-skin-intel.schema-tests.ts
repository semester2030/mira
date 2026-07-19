/**
 * Phase 3 — Professional Skin Intelligence Engine schema tests.
 * Run: npm run test:phase3-skin-intel
 */
import assert from 'node:assert/strict';
import { SkinAnalysisResult } from '../ai/contracts/skin-analysis-result.interface';
import { mapLegacySkinToMetrics } from '../ports/adapters/perfect-corp-skin.adapter';
import { buildResultMeta } from '../ports/shared/result-meta';
import { mapToCanonicalSkinModel } from '../intelligence/skin-intelligence/provider-skin.mapper';
import { buildSkinFindings } from '../intelligence/skin-intelligence/skin-finding.engine';
import { computeSkinVitalityIndexV2 } from '../intelligence/skin-intelligence/svi-v2.engine';
import { explainAllMetrics, explainMetricById } from '../intelligence/skin-intelligence/explanation.engine';
import { buildRecommendations } from '../intelligence/skin-intelligence/recommendation.engine';
import {
  compareProgress,
  providersCompatible,
  snapshotFromModel,
} from '../intelligence/skin-intelligence/progress.engine';
import { runSkinIntelligencePipeline } from '../intelligence/skin-intelligence';
import { metricById } from '../intelligence/skin-intelligence/canonical-skin.model';
import { SKIN_VITALITY_CALCULATION_VERSION } from '../intelligence/contracts/result-provenance';
import { isPerfectMockFallbackAllowed } from '../config/production-integrity';

function sampleSkin(): SkinAnalysisResult {
  return {
    beautyScore: 70,
    skinTypeAr: 'مختلطة',
    skinTypeEn: 'Combination',
    hydration: 60,
    oiliness: 40,
    pores: 2,
    wrinkles: 1,
    darkSpots: 1,
    acne: 1,
    redness: 1,
    undertoneAr: 'محايد',
    undertoneEn: 'Neutral',
    skinToneAr: 'متوسط',
    skinToneEn: 'Medium',
    recommendationsAr: [],
    recommendationsEn: [],
    concernScores: {
      moisture: 60,
      pore: 70,
      wrinkle: 80,
      acne: 75,
      redness: 72,
      age_spot: 68,
      // radiance intentionally missing
    },
  };
}

function testProviderMapping(): void {
  const metrics = mapLegacySkinToMetrics(sampleSkin(), 'provider_measured');
  const meta = buildResultMeta({
    source: 'provider_measured',
    provider: 'perfect_corp',
    confidence: 75,
    isMock: false,
    isProduction: false,
  });
  const model = mapToCanonicalSkinModel({
    portMetrics: metrics,
    legacy: sampleSkin(),
    meta,
  });
  const hydration = metricById(model, 'hydration');
  assert.equal(hydration?.availability, 'available');
  assert.equal(hydration?.normalizedValue, 60);
  assert.ok(hydration?.source);
  assert.ok((hydration?.confidence ?? 0) > 0);
  assert.ok(hydration?.limitations.length);

  const radiance = metricById(model, 'radiance');
  assert.equal(radiance?.availability, 'unavailable');
  assert.equal(radiance?.normalizedValue, undefined);
  assert.equal(radiance?.recommendationEligible, false);

  const elasticity = metricById(model, 'elasticity');
  assert.equal(elasticity?.availability, 'unavailable');
}

function testMissingNeverFabricated(): void {
  const emptyPorts = mapLegacySkinToMetrics(
    { ...sampleSkin(), concernScores: {} },
    'provider_measured',
  ).map((m) => ({ ...m, available: false, value: undefined }));
  const model = mapToCanonicalSkinModel({
    portMetrics: emptyPorts,
    legacy: {
      ...sampleSkin(),
      concernScores: {},
      undertoneAr: '',
      undertoneEn: '',
    },
    meta: buildResultMeta({
      source: 'provider_measured',
      provider: 'perfect_corp',
      confidence: 50,
      isMock: false,
    }),
  });
  const unavailable = model.metrics.filter((m) => m.availability === 'unavailable');
  assert.ok(unavailable.length >= 5, 'expected several unavailable metrics');
  for (const m of unavailable) {
    assert.equal(m.normalizedValue, undefined);
    assert.equal(m.confidence, 0);
    assert.equal(m.recommendationEligible, false);
  }
  // Never invent radiance when missing from provider
  assert.equal(metricById(model, 'radiance')?.availability, 'unavailable');
}

function testSviDynamicDenominator(): void {
  const full = runSkinIntelligencePipeline({
    legacy: sampleSkin(),
    portMetrics: mapLegacySkinToMetrics(sampleSkin(), 'provider_measured'),
    meta: buildResultMeta({
      source: 'provider_measured',
      provider: 'perfect_corp',
      confidence: 75,
      isMock: false,
    }),
  });

  const sparseSkin: SkinAnalysisResult = {
    ...sampleSkin(),
    concernScores: { moisture: 90 },
    oiliness: 10,
  };
  const sparseMetrics = mapLegacySkinToMetrics(sparseSkin, 'provider_measured');
  // force most unavailable
  for (const m of sparseMetrics) {
    if (m.id !== 'hydration') {
      m.available = false;
      delete m.value;
    }
  }
  const sparse = runSkinIntelligencePipeline({
    legacy: sparseSkin,
    portMetrics: sparseMetrics,
    meta: buildResultMeta({
      source: 'provider_measured',
      provider: 'perfect_corp',
      confidence: 75,
      isMock: false,
    }),
  });

  assert.ok(full.report.svi.unavailableExcluded.length >= 1);
  assert.ok(sparse.report.svi.unavailableExcluded.length > full.report.svi.unavailableExcluded.length);
  assert.equal(full.report.svi.version, 'svi-v2');
  assert.equal(SKIN_VITALITY_CALCULATION_VERSION, 'svi-v2');
  // Deterministic
  const again = computeSkinVitalityIndexV2(
    mapToCanonicalSkinModel({
      portMetrics: mapLegacySkinToMetrics(sampleSkin(), 'provider_measured'),
      legacy: sampleSkin(),
      meta: buildResultMeta({
        source: 'provider_measured',
        provider: 'perfect_corp',
        confidence: 75,
        isMock: false,
      }),
    }),
  );
  assert.equal(again.score, full.sviScore);
}

function testFindingEngine(): void {
  const model = mapToCanonicalSkinModel({
    portMetrics: mapLegacySkinToMetrics(sampleSkin(), 'provider_measured'),
    legacy: sampleSkin(),
    meta: buildResultMeta({
      source: 'provider_measured',
      provider: 'perfect_corp',
      confidence: 75,
      isMock: false,
    }),
  });
  const findings = buildSkinFindings(model);
  assert.ok(findings.length > 0);
  for (const f of findings) {
    assert.ok(f.evidenceAr.length > 0);
    assert.ok(f.evidenceEn.length > 0);
    assert.ok(f.source);
  }
}

function testRecommendations(): void {
  const out = runSkinIntelligencePipeline({
    legacy: sampleSkin(),
    portMetrics: mapLegacySkinToMetrics(sampleSkin(), 'provider_measured'),
    meta: buildResultMeta({
      source: 'provider_measured',
      provider: 'perfect_corp',
      confidence: 75,
      isMock: false,
    }),
  });
  assert.ok(out.report.recommendations.length >= 1);
  for (const r of out.report.recommendations) {
    assert.equal(r.cosmeticOnly, true);
    assert.ok(r.reasonAr.length > 0 || r.category === 'educational');
    // Actionable body must not be a medical Rx; educational disclaimers may negate prescribe/diagnose.
    if (r.category !== 'educational') {
      assert.equal(/^prescribe /i.test(r.bodyEn), false);
      assert.equal(/^diagnose /i.test(r.bodyEn), false);
    }
    assert.ok(r.limitations.some((l) => /cosmetic/i.test(l)));
  }
}

function testExplanationEngine(): void {
  const model = mapToCanonicalSkinModel({
    portMetrics: mapLegacySkinToMetrics(sampleSkin(), 'provider_measured'),
    legacy: sampleSkin(),
    meta: buildResultMeta({
      source: 'provider_measured',
      provider: 'perfect_corp',
      confidence: 75,
      isMock: false,
    }),
  });
  const expl = explainMetricById(model, 'hydration');
  assert.ok(expl);
  assert.ok(expl!.reasonEn.toLowerCase().includes('provider') || expl!.reasonEn.length > 10);
  assert.ok(expl!.limitationsEn.length > 0);
  assert.ok(expl!.confidenceEn.length > 0);

  const unavailable = explainMetricById(model, 'radiance');
  assert.equal(unavailable?.availability, 'unavailable');
  assert.equal(unavailable?.levelEn, 'Unavailable');

  const all = explainAllMetrics(model);
  assert.equal(all.length, model.metrics.length);
}

function testProgressEngine(): void {
  const a = runSkinIntelligencePipeline({
    analysisId: 'a1',
    legacy: sampleSkin(),
    portMetrics: mapLegacySkinToMetrics(sampleSkin(), 'provider_measured'),
    meta: buildResultMeta({
      source: 'provider_measured',
      provider: 'perfect_corp',
      confidence: 75,
      isMock: false,
    }),
    captureVersion: 'cq-thresholds-v2.1',
    qualityVersion: 'iq-v2.1+qc-v1.1',
  });

  const betterSkin = {
    ...sampleSkin(),
    concernScores: { ...sampleSkin().concernScores, moisture: 90, pore: 90 },
    hydration: 90,
  };
  const b = runSkinIntelligencePipeline({
    analysisId: 'a2',
    legacy: betterSkin,
    portMetrics: mapLegacySkinToMetrics(betterSkin, 'provider_measured'),
    meta: buildResultMeta({
      source: 'provider_measured',
      provider: 'perfect_corp',
      confidence: 75,
      isMock: false,
    }),
    previousSnapshot: a.snapshot,
    captureVersion: 'cq-thresholds-v2.1',
    qualityVersion: 'iq-v2.1+qc-v1.1',
  });
  assert.equal(b.report.progress.comparable, true);
  assert.ok(['improved', 'stable', 'declined'].includes(b.report.progress.overallTrend));

  const blocked = compareProgress({
    previous: a.snapshot,
    current: b.snapshot,
    sameCaptureQuality: false,
    compatibleProvider: true,
  });
  assert.equal(blocked.comparable, false);
  assert.equal(blocked.overallTrend, 'unknown');

  assert.equal(providersCompatible('perfect_corp', 'perfect_corp'), true);
  assert.equal(providersCompatible('perfect_corp', 'mock_skin'), false);
}

function testNoProviderLeakage(): void {
  const out = runSkinIntelligencePipeline({
    legacy: sampleSkin(),
    portMetrics: mapLegacySkinToMetrics(sampleSkin(), 'provider_measured'),
    meta: buildResultMeta({
      source: 'provider_measured',
      provider: 'perfect_corp',
      confidence: 75,
      isMock: false,
    }),
  });
  const json = JSON.stringify(out.report);
  assert.equal(json.includes('rawYouCam'), false);
  assert.equal(json.includes('secret'), false);
  assert.ok(out.report.formulaVersion);
  assert.ok(out.report.skinVersion);
  assert.ok(out.report.captureVersion);
}

function testLocalization(): void {
  const out = runSkinIntelligencePipeline({
    legacy: sampleSkin(),
    portMetrics: mapLegacySkinToMetrics(sampleSkin(), 'provider_measured'),
    meta: buildResultMeta({
      source: 'provider_measured',
      provider: 'perfect_corp',
      confidence: 75,
      isMock: false,
    }),
  });
  assert.ok(out.report.executiveSummaryAr.length > 10);
  assert.ok(out.report.executiveSummaryEn.length > 10);
  assert.ok(out.report.retakeGuidanceAr.includes('إضاءة') || out.report.retakeGuidanceAr.length > 10);
  assert.ok(out.report.retakeGuidanceEn.toLowerCase().includes('lighting'));
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
  testProviderMapping();
  testMissingNeverFabricated();
  testSviDynamicDenominator();
  testFindingEngine();
  testRecommendations();
  testExplanationEngine();
  testProgressEngine();
  testNoProviderLeakage();
  testLocalization();
  testPhase0Regression();
  console.log('phase3-skin-intel: OK');
}

main();
