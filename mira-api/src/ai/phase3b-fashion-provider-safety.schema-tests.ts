import assert from 'node:assert/strict';
import { ConfigService } from '@nestjs/config';
import { ServiceUnavailableException } from '@nestjs/common';
import {
  isLegacyOutfitPathBlockedInProduction,
  validateProductionIntegrity,
} from '../config/production-integrity';
import { FashnOutfitProvider } from './mocks/fashn-outfit.provider';
import { OutfitHybridIntelligenceService } from './services/outfit-hybrid-intelligence.service';
import { MiraOccasion } from './contracts/mira-occasion';

function config(values: Record<string, unknown>): ConfigService {
  return {
    get: <T>(key: string, fallback?: T): T =>
      (key in values ? values[key] : fallback) as T,
  } as ConfigService;
}

async function testLegacyProviderNeverCallsExternalInProduction(): Promise<void> {
  const originalFetch = globalThis.fetch;
  try {
    for (const simulatedStatus of [401, 403, 429, 500]) {
      let calls = 0;
      globalThis.fetch = async () => {
        calls += 1;
        return {
          ok: false,
          status: simulatedStatus,
          statusText: String(simulatedStatus),
        } as Response;
      };
      const provider = new FashnOutfitProvider(
        config({
          NODE_ENV: 'production',
          FASHN_API_KEY: 'test-only',
          FASHN_BASE_URL: 'https://provider.invalid',
        }),
      );
      await assert.rejects(
        () => provider.analyze(Buffer.from('image'), MiraOccasion.Work),
        /disabled in production/,
      );
      assert.equal(calls, 0);
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function testMissingCredentialsFailClosedInProduction(): Promise<void> {
  const provider = new FashnOutfitProvider(config({ NODE_ENV: 'production' }));
  await assert.rejects(
    () => provider.analyze(Buffer.from('image'), MiraOccasion.Casual),
    /disabled in production/,
  );
}

async function testHybridDeterministicFallbackBlockedInProduction(): Promise<void> {
  const originalNodeEnv = process.env.NODE_ENV;
  let visionCalls = 0;
  let llmCalls = 0;
  process.env.NODE_ENV = 'production';
  try {
    const service = new OutfitHybridIntelligenceService(
      {
        analyze: async () => {
          visionCalls += 1;
          throw new Error('simulated malformed/empty/timeout response');
        },
      } as never,
      {
        reason: async () => {
          llmCalls += 1;
          throw new Error('simulated provider failure');
        },
      } as never,
    );

    await assert.rejects(
      () =>
        service.analyze(Buffer.from('image'), 'work', {
          skinType: 'normal',
        }),
      (error: unknown) =>
        error instanceof ServiceUnavailableException &&
        (error.getResponse() as { code?: string }).code ===
          'LEGACY_OUTFIT_INTELLIGENCE_UNAVAILABLE',
    );
    assert.equal(visionCalls, 0);
    assert.equal(llmCalls, 0);
  } finally {
    if (originalNodeEnv == null) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
  }
}

async function testDevelopmentMockRemainsTestOnly(): Promise<void> {
  const provider = new FashnOutfitProvider(config({ NODE_ENV: 'test' }));
  const result = await provider.analyze(
    Buffer.from('fixture'),
    MiraOccasion.Casual,
  );
  assert.equal(typeof result.compatibilityScore, 'number');
}

function testSelectorsAndEscapeHatch(): void {
  for (const selector of ['mock', 'fashn', 'invalid', undefined]) {
    assert.equal(
      isLegacyOutfitPathBlockedInProduction({
        NODE_ENV: 'production',
        OUTFIT_PROVIDER: selector,
      }),
      true,
    );
  }
  assert.ok(
    validateProductionIntegrity({
      NODE_ENV: 'production',
      SKIN_PROVIDER: 'perfect_corp',
      PERFECT_CORP_FALLBACK_MOCK: 'false',
      ALLOW_LEGACY_OUTFIT_MOCK_IN_PROD: 'true',
    }).some((x) => x.code === 'ALLOW_LEGACY_OUTFIT_MOCK_IN_PROD_UNSAFE'),
  );
}

async function main(): Promise<void> {
  await testLegacyProviderNeverCallsExternalInProduction();
  await testMissingCredentialsFailClosedInProduction();
  await testHybridDeterministicFallbackBlockedInProduction();
  await testDevelopmentMockRemainsTestOnly();
  testSelectorsAndEscapeHatch();
  console.log(
    'phase3b-fashion-provider-safety: PASS (synthetic production success = 0)',
  );
}

void main();
