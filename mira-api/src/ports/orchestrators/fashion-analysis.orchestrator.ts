import {
  BadRequestException,
  GatewayTimeoutException,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { resolveProviderPortsConfig } from '../config/provider-ports.config';
import { VisionFashionAdapter } from '../adapters/vision-fashion.adapter';
import {
  ProviderPortError,
  toClientProviderError,
} from '../shared/provider-error';
import { newTraceId } from '../shared/result-meta';
import {
  FashionAnalysisPortResult,
  FashionAnalysisRequest,
} from '../fashion/fashion-analysis.port';
import {
  ANALYSIS_TELEMETRY_PORT,
  AnalysisTelemetryPort,
} from '../telemetry/analysis-telemetry.port';

@Injectable()
export class FashionAnalysisOrchestrator {
  constructor(
    private readonly visionAdapter: VisionFashionAdapter,
    private readonly config: ConfigService,
    @Inject(ANALYSIS_TELEMETRY_PORT)
    private readonly telemetry: AnalysisTelemetryPort,
  ) {}

  async analyze(
    request: FashionAnalysisRequest,
  ): Promise<FashionAnalysisPortResult> {
    const traceId = request.traceId ?? newTraceId('fashion');
    const cfg = resolveProviderPortsConfig({
      NODE_ENV: this.config.get<string>('NODE_ENV'),
      FASHION_PROVIDER: this.config.get<string>('FASHION_PROVIDER'),
      OUTFIT_PROVIDER: this.config.get<string>('OUTFIT_PROVIDER'),
    });
    const started = Date.now();

    this.telemetry.track({
      name: 'analysis_started',
      feature: 'fashion',
      provider: 'vision_platform',
      traceId,
      environment: cfg.environment,
    });

    if (cfg.fashionProvider === 'legacy_outfit_mock') {
      this.telemetry.track({
        name: 'unsafe_mock_blocked',
        feature: 'fashion',
        provider: 'legacy_outfit_mock',
        traceId,
      });
      throw new ServiceUnavailableException({
        ...toClientProviderError({
          code: 'unsafe_mock_blocked',
          retryable: false,
          safeUserMessageKey: 'errors.unsafe_mock_blocked',
          provider: 'legacy_outfit_mock',
          traceId,
        }),
      });
    }

    if (!request.imageBytes?.length) {
      throw new BadRequestException({
        ...toClientProviderError({
          code: 'invalid_input',
          retryable: false,
          safeUserMessageKey: 'errors.invalid_input',
          provider: 'fashion_orchestrator',
          traceId,
        }),
      });
    }

    this.telemetry.track({
      name: 'provider_called',
      feature: 'fashion',
      provider: 'vision_platform',
      traceId,
    });

    try {
      const result = await this.withTimeout(
        this.visionAdapter.analyze({ ...request, traceId }),
        cfg.fashionTimeoutMs,
        traceId,
      );

      this.telemetry.track({
        name: 'provider_succeeded',
        feature: 'fashion',
        provider: 'vision_platform',
        traceId,
        latencyMs: Date.now() - started,
        safeProps: { gate: result.analysisGate },
      });
      this.telemetry.track({
        name: 'analysis_completed',
        feature: 'fashion',
        provider: 'vision_platform',
        traceId,
        latencyMs: Date.now() - started,
      });
      return result;
    } catch (err) {
      if (err instanceof ProviderPortError) {
        this.telemetry.track({
          name: 'provider_failed',
          feature: 'fashion',
          provider: err.providerError.provider,
          traceId,
          errorCode: err.providerError.code,
          latencyMs: Date.now() - started,
        });
        const client = toClientProviderError(err.providerError);
        if (err.providerError.code === 'provider_timeout') {
          throw new GatewayTimeoutException(client);
        }
        if (err.providerError.code === 'invalid_input') {
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
            provider: 'fashion_orchestrator',
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
