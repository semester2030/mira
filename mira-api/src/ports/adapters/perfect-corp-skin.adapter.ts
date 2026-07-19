import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SkinAnalysisResult } from '../../ai/contracts/skin-analysis-result.interface';
import { PerfectCorpSkinProvider } from '../../ai/mocks/perfect-corp-skin.provider';
import { isProductionEnv } from '../../config/production-integrity';
import {
  classifyProviderFailure,
  ProviderPortError,
  createProviderError,
} from '../shared/provider-error';
import { buildResultMeta, newTraceId } from '../shared/result-meta';
import {
  SkinAnalysisPort,
  SkinAnalysisPortResult,
  SkinAnalysisRequest,
  SkinMetric,
} from '../skin/skin-analysis.port';

function metric(
  id: string,
  value: number | undefined,
  source: SkinMetric['source'],
): SkinMetric {
  if (value == null || !Number.isFinite(value)) {
    return { id, available: false, source: 'unavailable' };
  }
  return {
    id,
    value,
    available: true,
    source,
    confidence: 70,
  };
}

export function mapLegacySkinToMetrics(
  skin: SkinAnalysisResult,
  source: SkinMetric['source'],
): SkinMetric[] {
  const scores = skin.concernScores ?? {};
  return [
    metric('hydration', skin.hydration, source),
    metric('oiliness', skin.oiliness, source),
    metric('pores', scores.pore ?? skin.pores, source),
    metric('wrinkles', scores.wrinkle ?? skin.wrinkles, source),
    metric('acne', scores.acne ?? skin.acne, source),
    metric('redness', scores.redness ?? skin.redness, source),
    metric('pigmentation', scores.age_spot ?? skin.darkSpots, source),
    metric('radiance', scores.radiance, source),
    metric('firmness', scores.firmness, source),
    metric('texture', scores.texture, source),
    metric('dark_circles', scores.dark_circle, source),
  ];
}

/**
 * Maps Perfect Corp (via existing provider) → internal SkinAnalysisPortResult.
 * Never invents missing metrics. Never silent mock (Phase 0 preserved in delegate).
 */
@Injectable()
export class PerfectCorpSkinAdapter implements SkinAnalysisPort {
  constructor(
    private readonly perfect: PerfectCorpSkinProvider,
    private readonly config: ConfigService,
  ) {}

  async analyze(request: SkinAnalysisRequest): Promise<SkinAnalysisPortResult> {
    const traceId = request.traceId ?? newTraceId('skin');
    const production = isProductionEnv(this.config.get<string>('NODE_ENV'));

    try {
      const out = await this.perfect.analyze(request.imageBytes);
      if (out.isMock === true && production) {
        throw new ProviderPortError(
          createProviderError({
            code: 'unsafe_mock_blocked',
            safeUserMessageKey: 'errors.unsafe_mock_blocked',
            provider: 'perfect_corp',
            traceId,
          }),
        );
      }

      const source = out.isMock ? 'mock' : 'provider_measured';
      const metrics = mapLegacySkinToMetrics(out.result, source as SkinMetric['source']);

      return {
        metrics,
        skinTypeAr: out.result.skinTypeAr,
        skinTypeEn: out.result.skinTypeEn,
        undertoneAr: out.result.undertoneAr,
        undertoneEn: out.result.undertoneEn,
        legacyInternal: { ...out.result },
        meta: buildResultMeta({
          source: out.isMock ? 'mock' : 'provider_measured',
          provider: out.providerName ?? 'perfect_corp',
          providerVersion: 'youcam-s2s',
          confidence: out.isMock ? 0 : 75,
          isMock: out.isMock === true,
          isProduction: production,
          traceId,
          requestId: request.requestId,
          limitations: [
            'Metrics mapped from Perfect/YouCam where present; missing metrics stay unavailable.',
          ],
        }),
        _ephemeralRawYouCam: out.rawYouCam,
      };
    } catch (err) {
      if (err instanceof ProviderPortError) throw err;
      const message = err instanceof Error ? err.message : String(err);
      throw new ProviderPortError(
        classifyProviderFailure({
          message,
          provider: 'perfect_corp',
          traceId,
        }),
      );
    }
  }
}
