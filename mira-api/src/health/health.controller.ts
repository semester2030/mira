import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { resolvePerfectCorpConfig } from '../ai/config/perfect-corp.config';

@Controller('health')
export class HealthController {
  constructor(private readonly config: ConfigService) {}

  @Get()
  check() {
    const perfect = resolvePerfectCorpConfig(this.config);
    const skinProvider = this.config.get<string>('SKIN_PROVIDER', 'mock');
    const fallbackMock =
      this.config.get<string>('PERFECT_CORP_FALLBACK_MOCK', 'true') !== 'false';

    return {
      status: 'ok',
      service: 'mira-api',
      timestamp: new Date().toISOString(),
      integrations: {
        skinProvider,
        perfectCorpKeySet: perfect.apiKey.length > 0,
        perfectCorpBaseUrl: perfect.baseUrl,
        perfectCorpFallbackMock: fallbackMock,
        hint: !perfect.apiKey.length
          ? 'PERFECT_API_KEY missing on server'
          : skinProvider !== 'perfect_corp'
            ? 'Set SKIN_PROVIDER=perfect_corp'
            : undefined,
      },
    };
  }
}
