import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MockSkinAnalysisProvider } from '../../ai/mocks/mock-skin-analysis.provider';
import { isProductionEnv } from '../../config/production-integrity';
import {
  createProviderError,
  ProviderPortError,
} from '../shared/provider-error';
import { buildResultMeta, newTraceId } from '../shared/result-meta';
import {
  SkinAnalysisPort,
  SkinAnalysisPortResult,
  SkinAnalysisRequest,
} from '../skin/skin-analysis.port';
import { mapLegacySkinToMetrics } from './perfect-corp-skin.adapter';

/**
 * Test/dev only. Production must never instantiate for live traffic
 * (guarded by config + this adapter).
 */
@Injectable()
export class MockSkinAdapter implements SkinAnalysisPort {
  constructor(
    private readonly mock: MockSkinAnalysisProvider,
    private readonly config: ConfigService,
  ) {}

  async analyze(request: SkinAnalysisRequest): Promise<SkinAnalysisPortResult> {
    const traceId = request.traceId ?? newTraceId('skin_mock');
    if (isProductionEnv(this.config.get<string>('NODE_ENV'))) {
      throw new ProviderPortError(
        createProviderError({
          code: 'unsafe_mock_blocked',
          safeUserMessageKey: 'errors.unsafe_mock_blocked',
          provider: 'mock_skin',
          traceId,
        }),
      );
    }

    const allow =
      this.config.get<string>('MOCK_PROVIDER_ACCESS', 'true') !== 'false';
    if (!allow) {
      throw new ProviderPortError(
        createProviderError({
          code: 'unsafe_mock_blocked',
          safeUserMessageKey: 'errors.unsafe_mock_blocked',
          provider: 'mock_skin',
          traceId,
        }),
      );
    }

    const out = await this.mock.analyze(request.imageBytes);
    return {
      metrics: mapLegacySkinToMetrics(out.result, 'mock'),
      skinTypeAr: out.result.skinTypeAr,
      skinTypeEn: out.result.skinTypeEn,
      undertoneAr: out.result.undertoneAr,
      undertoneEn: out.result.undertoneEn,
      legacyInternal: { ...out.result },
      meta: buildResultMeta({
        source: 'mock',
        provider: 'mock_skin',
        confidence: 0,
        isMock: true,
        isProduction: false,
        canDisplay: true,
        traceId,
        requestId: request.requestId,
        limitations: ['Mock skin adapter — development/tests only'],
      }),
    };
  }
}
