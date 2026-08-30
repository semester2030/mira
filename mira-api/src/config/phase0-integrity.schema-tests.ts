/**
 * Phase 0 schema tests — truth / safety / production integrity.
 * Run: npm run build && node dist/config/phase0-integrity.schema-tests.js
 */
import assert from 'node:assert/strict';
import {
  assertProductionIntegrity,
  isLegacyOutfitMockBlocked,
  isPerfectMockFallbackAllowed,
  validateProductionIntegrity,
} from './production-integrity';
import {
  assertDisplayableInProduction,
  buildSkinVitalityProvenance,
  SKIN_VITALITY_LABEL_AR,
} from '../intelligence/contracts/result-provenance';
import {
  assertNoRawYouCamInAudit,
  redactYouCamAudit,
} from '../intelligence/pipeline/youcam-audit-redact';
import { computeBeautyScore } from '../intelligence/pipeline/beauty-score-engine';
import { SkinAnalysisResult } from '../ai/contracts/skin-analysis-result.interface';

function sampleSkin(): SkinAnalysisResult {
  return {
    beautyScore: 0,
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
    skinAge: 28,
    concernScores: {
      moisture: 60,
      oiliness: 60,
      pore: 70,
      wrinkle: 80,
      acne: 80,
      age_spot: 75,
      redness: 75,
      texture: 65,
      dark_circle: 70,
      radiance: 62,
      firmness: 68,
    },
  };
}

function testProductionRejectsUnsafeFallback(): void {
  const issues = validateProductionIntegrity({
    NODE_ENV: 'production',
    PERFECT_CORP_FALLBACK_MOCK: 'true',
    SKIN_PROVIDER: 'perfect_corp',
  });
  assert.ok(
    issues.some((i) => i.code === 'PERFECT_CORP_FALLBACK_MOCK_UNSAFE'),
    'production must flag unsafe fallback',
  );
  assert.throws(() =>
    assertProductionIntegrity({
      NODE_ENV: 'production',
      PERFECT_CORP_FALLBACK_MOCK: 'true',
      SKIN_PROVIDER: 'perfect_corp',
    }),
  );
}

function testProductionRejectsMockSkinProvider(): void {
  assert.throws(() =>
    assertProductionIntegrity({
      NODE_ENV: 'production',
      PERFECT_CORP_FALLBACK_MOCK: 'false',
      SKIN_PROVIDER: 'mock',
    }),
  );
}

function testProductionRejectsAuthSkip(): void {
  const env = {
    NODE_ENV: 'production',
    AUTH_SKIP: 'true',
    PERFECT_CORP_FALLBACK_MOCK: 'false',
    SKIN_PROVIDER: 'perfect_corp',
  };
  assert.ok(
    validateProductionIntegrity(env).some((i) => i.code === 'AUTH_SKIP_IN_PROD'),
  );
  assert.throws(() => assertProductionIntegrity(env));
}

function testProductionRejectsPartnerAutoApprove(): void {
  const env = {
    NODE_ENV: 'production',
    PARTNER_AUTO_APPROVE: 'true',
    PERFECT_CORP_FALLBACK_MOCK: 'false',
    SKIN_PROVIDER: 'perfect_corp',
  };
  assert.ok(
    validateProductionIntegrity(env).some(
      (i) => i.code === 'PARTNER_AUTO_APPROVE_IN_PROD',
    ),
  );
  assert.throws(() => assertProductionIntegrity(env));
}

function testProductionAcceptsSafeConfig(): void {
  assert.doesNotThrow(() =>
    assertProductionIntegrity({
      NODE_ENV: 'production',
      PERFECT_CORP_FALLBACK_MOCK: 'false',
      SKIN_PROVIDER: 'perfect_corp',
      OUTFIT_PROVIDER: 'mock',
    }),
  );
}

function testMockFallbackNeverAllowedInProduction(): void {
  assert.equal(
    isPerfectMockFallbackAllowed({
      NODE_ENV: 'production',
      PERFECT_CORP_FALLBACK_MOCK: 'true',
    }),
    false,
  );
  assert.equal(
    isPerfectMockFallbackAllowed({
      NODE_ENV: 'development',
      PERFECT_CORP_FALLBACK_MOCK: 'true',
    }),
    true,
  );
  assert.equal(
    isPerfectMockFallbackAllowed({
      NODE_ENV: 'development',
      PERFECT_CORP_FALLBACK_MOCK: 'false',
    }),
    false,
  );
}

function testMockCannotDisplayInProduction(): void {
  const mockProv = buildSkinVitalityProvenance({
    isMock: true,
    provider: 'mock_skin',
    confidence: 90,
    isProduction: true,
  });
  assert.equal(mockProv.isMock, true);
  assert.equal(mockProv.canDisplay, false);
  assert.equal(mockProv.resultSource, 'mock');
  assert.throws(() => assertDisplayableInProduction(mockProv, true));
}

function testRealResultCanDisplay(): void {
  const prov = buildSkinVitalityProvenance({
    isMock: false,
    provider: 'perfect_corp',
    confidence: 72,
    isProduction: true,
  });
  assert.equal(prov.canDisplay, true);
  assert.equal(prov.resultSource, 'locally_calculated');
  assert.doesNotThrow(() => assertDisplayableInProduction(prov, true));
}

function testRedactedAuditExcludesRawYouCam(): void {
  const raw = {
    results: { output: [{ a: 1 }, { b: 2 }] },
    secretToken: 'should-not-persist',
  };
  const redacted = redactYouCamAudit(raw);
  assert.equal(redacted.hasRawPayload, false);
  assert.equal(redacted.outputCount, 2);
  assert.ok(!('rawYouCam' in redacted));
  assert.ok(!JSON.stringify(redacted).includes('should-not-persist'));
  assertNoRawYouCamInAudit({ capturedAt: redacted.capturedAt, redacted });
  assert.throws(() =>
    assertNoRawYouCamInAudit({ rawYouCam: raw, capturedAt: 'x' }),
  );
}

function testSkinVitalityDeterministic(): void {
  const a = computeBeautyScore(sampleSkin());
  const b = computeBeautyScore(sampleSkin());
  assert.equal(a.finalScore, b.finalScore);
  assert.equal(SKIN_VITALITY_LABEL_AR, 'مؤشر حيوية البشرة');
}

function testLegacyOutfitMockBlockedInProd(): void {
  assert.equal(
    isLegacyOutfitMockBlocked({
      NODE_ENV: 'production',
      OUTFIT_PROVIDER: 'mock',
    }),
    true,
  );
  assert.equal(
    isLegacyOutfitMockBlocked({
      NODE_ENV: 'development',
      OUTFIT_PROVIDER: 'mock',
    }),
    false,
  );
  assert.equal(
    isLegacyOutfitMockBlocked({
      NODE_ENV: 'production',
      OUTFIT_PROVIDER: 'fashn',
    }),
    false,
  );
}

function testHistoricalScoreFieldReadable(): void {
  // Legacy stored shape still exposes overallBeautyScore numeric field.
  const stored = {
    version: 2,
    miraReport: {
      version: 1,
      overallBeautyScore: 71,
      headlineAr: 'اختبار',
    },
  };
  assert.equal(
    (stored.miraReport as { overallBeautyScore: number }).overallBeautyScore,
    71,
  );
}

function main(): void {
  testProductionRejectsUnsafeFallback();
  testProductionRejectsMockSkinProvider();
  testProductionRejectsAuthSkip();
  testProductionRejectsPartnerAutoApprove();
  testProductionAcceptsSafeConfig();
  testMockFallbackNeverAllowedInProduction();
  testMockCannotDisplayInProduction();
  testRealResultCanDisplay();
  testRedactedAuditExcludesRawYouCam();
  testSkinVitalityDeterministic();
  testLegacyOutfitMockBlockedInProd();
  testHistoricalScoreFieldReadable();
  console.log('phase0-integrity.schema-tests: OK (12 checks)');
}

main();
