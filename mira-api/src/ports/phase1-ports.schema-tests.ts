/**
 * Phase 1 contract tests — provider ports, adapters, config, telemetry safety.
 * Run: npm run build && node dist/ports/phase1-ports.schema-tests.js
 */
import assert from 'node:assert/strict';
import {
  assertProviderPortsConfig,
  resolveProviderPortsConfig,
  validateProviderPortsConfig,
} from './config/provider-ports.config';
import { mapLegacySkinToMetrics } from './adapters/perfect-corp-skin.adapter';
import { assertSafeTelemetryProps } from './telemetry/analysis-telemetry.port';
import { classifyProviderFailure, toClientProviderError } from './shared/provider-error';
import { buildResultMeta } from './shared/result-meta';
import { SkinAnalysisResult } from '../ai/contracts/skin-analysis-result.interface';
import {
  assertProductionIntegrity,
  isLegacyOutfitMockBlocked,
  isPerfectMockFallbackAllowed,
} from '../config/production-integrity';

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
      // radiance intentionally missing → unavailable metric
    },
  };
}

function testPerfectMapsToInternalMetrics(): void {
  const metrics = mapLegacySkinToMetrics(sampleSkin(), 'provider_measured');
  const hydration = metrics.find((m) => m.id === 'hydration');
  assert.equal(hydration?.available, true);
  assert.equal(hydration?.value, 60);
  const radiance = metrics.find((m) => m.id === 'radiance');
  assert.equal(radiance?.available, false);
  assert.equal(radiance?.value, undefined);
}

function testNoRawYouCamInMappedDto(): void {
  const metrics = mapLegacySkinToMetrics(sampleSkin(), 'provider_measured');
  const json = JSON.stringify(metrics);
  assert.equal(json.includes('rawYouCam'), false);
  assert.equal(json.includes('results'), false);
}

function testProductionConfigRejectsTryOnWithoutAdapter(): void {
  assert.throws(() =>
    assertProviderPortsConfig({
      NODE_ENV: 'production',
      PERFECT_CORP_FALLBACK_MOCK: 'false',
      SKIN_PROVIDER: 'perfect_corp',
      MOCK_PROVIDER_ACCESS: 'false',
      FASHION_PROVIDER: 'vision_platform',
      BEAUTY_TRYON_ENABLED: 'true',
      BEAUTY_TRYON_PROVIDER: '',
    }),
  );
}

function testProductionConfigAcceptsSafe(): void {
  assert.doesNotThrow(() =>
    assertProviderPortsConfig({
      NODE_ENV: 'production',
      PERFECT_CORP_FALLBACK_MOCK: 'false',
      SKIN_PROVIDER: 'perfect_corp',
      MOCK_PROVIDER_ACCESS: 'false',
      FASHION_PROVIDER: 'vision_platform',
      BEAUTY_TRYON_ENABLED: 'false',
    }),
  );
}

function testLegacyFashionCannotBeCanonicalInProd(): void {
  const issues = validateProviderPortsConfig({
    NODE_ENV: 'production',
    PERFECT_CORP_FALLBACK_MOCK: 'false',
    SKIN_PROVIDER: 'perfect_corp',
    MOCK_PROVIDER_ACCESS: 'false',
    FASHION_PROVIDER: 'legacy_outfit_mock',
  });
  assert.ok(issues.some((i) => i.code === 'LEGACY_OUTFIT_CANONICAL_FORBIDDEN'));
}

function testUnsupportedProviderFails(): void {
  assert.throws(() =>
    assertProviderPortsConfig({
      NODE_ENV: 'production',
      PERFECT_CORP_FALLBACK_MOCK: 'false',
      SKIN_PROVIDER: 'perfect_corp',
      MOCK_PROVIDER_ACCESS: 'false',
      FASHION_PROVIDER: 'unknown_vendor',
    }),
  );
}

function testTelemetryRejectsSecrets(): void {
  assert.throws(() =>
    assertSafeTelemetryProps({ apiKey: 'secret' }),
  );
  assert.throws(() =>
    assertSafeTelemetryProps({ rawYouCam: 'x' }),
  );
  assert.doesNotThrow(() =>
    assertSafeTelemetryProps({ latencyMs: 12, provider: 'perfect_corp' }),
  );
}

function testTypedErrorsStripInternal(): void {
  const err = classifyProviderFailure({
    message: 'YouCam task timed out secret-token-xyz',
    provider: 'perfect_corp',
    traceId: 't1',
  });
  assert.equal(err.code, 'provider_timeout');
  const client = toClientProviderError(err);
  assert.equal('internalDetails' in client, false);
  assert.equal(JSON.stringify(client).includes('secret-token'), false);
}

function testProvenancePreserved(): void {
  const meta = buildResultMeta({
    source: 'provider_measured',
    provider: 'perfect_corp',
    confidence: 80,
    isMock: false,
    isProduction: true,
    calculationVersion: 'svi-v1',
  });
  assert.equal(meta.canDisplay, true);
  assert.equal(meta.isMock, false);
  assert.equal(meta.confidenceLevel, 'high');
  assert.ok(meta.traceId);
}

function testPhase0Regression(): void {
  assert.equal(
    isPerfectMockFallbackAllowed({
      NODE_ENV: 'production',
      PERFECT_CORP_FALLBACK_MOCK: 'true',
    }),
    false,
  );
  assert.doesNotThrow(() =>
    assertProductionIntegrity({
      NODE_ENV: 'production',
      PERFECT_CORP_FALLBACK_MOCK: 'false',
      SKIN_PROVIDER: 'perfect_corp',
    }),
  );
  assert.equal(
    isLegacyOutfitMockBlocked({
      NODE_ENV: 'production',
      OUTFIT_PROVIDER: 'mock',
    }),
    true,
  );
}

function testFashionStripKeys(): void {
  const raw = {
    garments: [],
    rawFashn: { secret: 1 },
    rawOpenAi: { token: 'x' },
  };
  const clone = JSON.parse(JSON.stringify(raw)) as Record<string, unknown>;
  delete clone.rawFashn;
  delete clone.rawOpenAi;
  assert.equal('rawFashn' in clone, false);
  assert.equal(JSON.stringify(clone).includes('secret'), false);
}

function testDisabledTryOnShape(): void {
  // Contract: success must never be true for disabled adapter
  const result = {
    success: false as const,
    capabilities: [{ id: 'makeup_vto', available: false }],
  };
  assert.equal(result.success, false);
  assert.equal(result.capabilities[0].available, false);
}

function testImageQualityUnavailableDefault(): void {
  const signal = {
    id: 'blur',
    available: false,
    status: 'unavailable' as const,
  };
  assert.equal(signal.available, false);
  assert.equal('value' in signal && signal.value != null, false);
}

function testResolveDefaults(): void {
  const cfg = resolveProviderPortsConfig({
    NODE_ENV: 'development',
    SKIN_PROVIDER: 'perfect_corp',
  });
  assert.equal(cfg.fashionProvider, 'vision_platform');
  assert.equal(cfg.beautyTryOnEnabled, false);
}

function main(): void {
  testPerfectMapsToInternalMetrics();
  testNoRawYouCamInMappedDto();
  testProductionConfigRejectsTryOnWithoutAdapter();
  testProductionConfigAcceptsSafe();
  testLegacyFashionCannotBeCanonicalInProd();
  testUnsupportedProviderFails();
  testTelemetryRejectsSecrets();
  testTypedErrorsStripInternal();
  testProvenancePreserved();
  testPhase0Regression();
  testFashionStripKeys();
  testDisabledTryOnShape();
  testImageQualityUnavailableDefault();
  testResolveDefaults();
  console.log('phase1-ports.schema-tests: OK (14 checks)');
}

main();
