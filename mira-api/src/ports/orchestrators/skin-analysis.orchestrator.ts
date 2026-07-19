import {
  Injectable,
  ServiceUnavailableException,
  BadRequestException,
  GatewayTimeoutException,
  Inject,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SkinAnalysisResult } from '../../ai/contracts/skin-analysis-result.interface';
import { isProductionEnv } from '../../config/production-integrity';
import { PerfectCorpSkinAdapter } from '../adapters/perfect-corp-skin.adapter';
import { MockSkinAdapter } from '../adapters/mock-skin.adapter';
import {
  ProviderPortError,
  toClientProviderError,
} from '../shared/provider-error';
import { newTraceId } from '../shared/result-meta';
import {
  SkinAnalysisPortResult,
  SkinAnalysisRequest,
} from '../skin/skin-analysis.port';
import {
  ANALYSIS_TELEMETRY_PORT,
  AnalysisTelemetryPort,
} from '../telemetry/analysis-telemetry.port';
import { resolveProviderPortsConfig } from '../config/provider-ports.config';

export interface SkinOrchestratorOutput {
  portResult: SkinAnalysisPortResult;
  skinInternal: SkinAnalysisResult;
  isMock: boolean;
  providerName: string;
  rawYouCam?: Record<string, unknown>;
  traceId: string;
}

@Injectable()
export class SkinAnalysisOrchestrator {
  constructor(
    private readonly perfectAdapter: PerfectCorpSkinAdapter,
    private readonly mockAdapter: MockSkinAdapter,
    private readonly config: ConfigService,
    @Inject(ANALYSIS_TELEMETRY_PORT)
    private readonly telemetry: AnalysisTelemetryPort,
  ) {}

  async analyze(request: SkinAnalysisRequest): Promise<SkinOrchestratorOutput> {
    const traceId = request.traceId ?? newTraceId('skin');
    const cfg = resolveProviderPortsConfig({
      NODE_ENV: this.config.get<string>('NODE_ENV'),
      SKIN_PROVIDER: this.config.get<string>('SKIN_PROVIDER'),
      MOCK_PROVIDER_ACCESS: this.config.get<string>('MOCK_PROVIDER_ACCESS'),
      PERFECT_CORP_FALLBACK_MOCK: this.config.get<string>(
        'PERFECT_CORP_FALLBACK_MOCK',
      ),
    });
    const started = Date.now();

    this.telemetry.track({
      name: 'analysis_started',
      feature: 'skin',
      provider: cfg.skinProvider,
      traceId,
      environment: cfg.environment,
    });

    if (!request.imageBytes?.length) {
      this.telemetry.track({
        name: 'analysis_blocked',
        feature: 'skin',
        traceId,
        errorCode: 'invalid_input',
      });
      throw new BadRequestException({
        ...toClientProviderError({
          code: 'invalid_input',
          retryable: false,
          safeUserMessageKey: 'errors.invalid_input',
          provider: 'skin_orchestrator',
          traceId,
        }),
      });
    }

    const production = isProductionEnv(this.config.get<string>('NODE_ENV'));
    const useMock = cfg.skinProvider === 'mock';
    if (useMock && production) {
      this.telemetry.track({
        name: 'unsafe_mock_blocked',
        feature: 'skin',
        provider: 'mock_skin',
        traceId,
      });
      throw new ServiceUnavailableException({
        ...toClientProviderError({
          code: 'unsafe_mock_blocked',
          retryable: false,
          safeUserMessageKey: 'errors.unsafe_mock_blocked',
          provider: 'mock_skin',
          traceId,
        }),
      });
    }

    const adapter = useMock ? this.mockAdapter : this.perfectAdapter;
    this.telemetry.track({
      name: 'provider_called',
      feature: 'skin',
      provider: useMock ? 'mock_skin' : 'perfect_corp',
      traceId,
    });

    try {
      const timeoutMs = cfg.skinTimeoutMs;
      const portResult = await this.withTimeout(
        adapter.analyze({ ...request, traceId }),
        timeoutMs,
        traceId,
      );

      if (portResult.meta.isMock && production) {
        this.telemetry.track({
          name: 'unsafe_mock_blocked',
          feature: 'skin',
          provider: portResult.meta.provider,
          traceId,
        });
        throw new ServiceUnavailableException({
          ...toClientProviderError({
            code: 'unsafe_mock_blocked',
            retryable: false,
            safeUserMessageKey: 'errors.unsafe_mock_blocked',
            provider: portResult.meta.provider,
            traceId,
          }),
        });
      }

      if (!portResult.meta.canDisplay && production) {
        this.telemetry.track({
          name: 'result_unavailable',
          feature: 'skin',
          provider: portResult.meta.provider,
          traceId,
        });
        throw new ServiceUnavailableException({
          ...toClientProviderError({
            code: 'provider_unavailable',
            retryable: true,
            safeUserMessageKey: 'errors.provider_unavailable',
            provider: portResult.meta.provider,
            traceId,
          }),
        });
      }

      const skinInternal = portResult.legacyInternal as unknown as SkinAnalysisResult;
      const rawYouCam = portResult._ephemeralRawYouCam;
      // Strip ephemeral raw before leaving orchestrator boundary for persistence callers
      delete portResult._ephemeralRawYouCam;

      this.telemetry.track({
        name: 'provider_succeeded',
        feature: 'skin',
        provider: portResult.meta.provider,
        traceId,
        latencyMs: Date.now() - started,
        safeProps: {
          isMock: portResult.meta.isMock,
          confidence: portResult.meta.confidence,
        },
      });
      this.telemetry.track({
        name: 'analysis_completed',
        feature: 'skin',
        provider: portResult.meta.provider,
        traceId,
        latencyMs: Date.now() - started,
      });

      return {
        portResult,
        skinInternal,
        isMock: portResult.meta.isMock,
        providerName: portResult.meta.provider,
        rawYouCam,
        traceId,
      };
    } catch (err) {
      if (err instanceof ServiceUnavailableException || err instanceof BadRequestException) {
        throw err;
      }
      if (err instanceof ProviderPortError) {
        this.telemetry.track({
          name: 'provider_failed',
          feature: 'skin',
          provider: err.providerError.provider,
          traceId,
          errorCode: err.providerError.code,
          latencyMs: Date.now() - started,
        });
        const client = toClientProviderError(err.providerError);
        if (err.providerError.code === 'provider_timeout') {
          throw new GatewayTimeoutException(client);
        }
        if (
          err.providerError.code === 'invalid_input' ||
          err.providerError.code === 'no_face' ||
          err.providerError.code === 'image_quality_failure'
        ) {
          throw new BadRequestException(client);
        }
        throw new ServiceUnavailableException(client);
      }
      throw err;
    }
  }

  private withTimeout<T>(
    promise: Promise<T>,
    ms: number,
    traceId: string,
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(
          new ProviderPortError({
            code: 'provider_timeout',
            retryable: true,
            safeUserMessageKey: 'errors.provider_timeout',
            provider: 'skin_orchestrator',
            traceId,
          }),
        );
      }, ms);
      promise
        .then((v) => {
          clearTimeout(timer);
          resolve(v);
        })
        .catch((e) => {
          clearTimeout(timer);
          reject(e);
        });
    });
  }
}
