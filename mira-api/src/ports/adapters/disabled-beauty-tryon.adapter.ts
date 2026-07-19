import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { isProductionEnv } from '../../config/production-integrity';
import {
  createProviderError,
  ProviderPortError,
} from '../shared/provider-error';
import { buildResultMeta, newTraceId } from '../shared/result-meta';
import {
  BeautyTryOnPort,
  TryOnCapability,
  TryOnRequest,
  TryOnResult,
} from '../beauty-tryon/beauty-tryon.port';

/**
 * @deprecated Prefer FoundationBeautyExperienceAdapter via BEAUTY_EXPERIENCE_PORT.
 * Kept for BeautyTryOnPort / Phase 1 compatibility.
 * Phase 1 / Phase 5A placeholder — capability unavailable.
 * Never returns fake images or simulated success.
 * Real try-on is NOT implemented here — see beauty-experience subsystem.
 */
@Injectable()
export class DisabledBeautyTryOnAdapter implements BeautyTryOnPort {
  constructor(private readonly config: ConfigService) {}

  async listCapabilities(): Promise<TryOnCapability[]> {
    return [
      {
        id: 'makeup_vto',
        available: false,
        reason: 'Disabled until Phase 5 Perfect Corp licensed adapter',
      },
    ];
  }

  async tryOn(request: TryOnRequest): Promise<TryOnResult> {
    const traceId = request.traceId ?? newTraceId('tryon');
    const enabled =
      this.config.get<string>('BEAUTY_TRYON_ENABLED', 'false') === 'true';
    if (enabled) {
      // Config validation should prevent this; defense in depth.
      throw new ProviderPortError(
        createProviderError({
          code: 'unsupported_capability',
          safeUserMessageKey: 'errors.unsupported_capability',
          provider: 'beauty_tryon',
          traceId,
          internalDetails:
            'BEAUTY_TRYON_ENABLED=true but no real adapter registered',
        }),
      );
    }

    return {
      success: false,
      capabilities: await this.listCapabilities(),
      meta: buildResultMeta({
        source: 'unavailable',
        provider: 'disabled_beauty_tryon',
        confidence: 0,
        isMock: false,
        canDisplay: false,
        unavailableReason: 'Beauty try-on is not enabled in this release',
        isProduction: isProductionEnv(this.config.get<string>('NODE_ENV')),
        traceId,
        limitations: ['Phase 5 will provide Perfect Corp adapter'],
      }),
    };
  }
}
