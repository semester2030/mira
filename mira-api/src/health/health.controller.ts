/**
 * Operational Hardening — extend /health with Face / Skin intelligence versions.
 * Never exposes secrets or API keys.
 */
import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { resolvePerfectCorpConfig } from '../ai/config/perfect-corp.config';
import {
  isPerfectMockFallbackAllowed,
  validateProductionIntegrity,
} from '../config/production-integrity';
import {
  FACE_FOUNDATION_VERSION,
  FACE_GEOMETRY_VERSION,
  FACE_INTELLIGENCE_RELEASE,
  FACE_INTELLIGENCE_RELEASE_STATUS,
  FACE_INTELLIGENCE_VERSION,
  FACE_REPORT_VERSION,
  FACE_RECOMMENDATION_VERSION,
  FACE_SHAPE_VERSION,
  FACE_COMPATIBILITY_VERSION,
} from '../intelligence/face-intelligence';
import { CAPTURE_QUALITY_THRESHOLDS } from '../ports/image-quality/capture-quality.thresholds';
import {
  BEAUTY_EXPERIENCE_ARCHITECTURE,
  BEAUTY_EXPERIENCE_COMPAT,
  BEAUTY_EXPERIENCE_RELEASE,
  BEAUTY_EXPERIENCE_STATUS,
  BEAUTY_CAPABILITY_REGISTRY_VERSION,
  BEAUTY_SESSION_VERSION,
} from '../beauty-experience/release';
import { BEAUTY_CAPABILITY_CATALOG_VERSION } from '../beauty-experience/capability/catalog-release';
import {
  PROVIDER_READINESS_STATUS,
  PROVIDER_READINESS_VERSION,
} from '../beauty-experience/provider-readiness/release';
import { createProviderReadinessPlatform } from '../beauty-experience/provider-readiness/platform';
import {
  BEAUTY_INTEGRATION_RELEASE,
  BEAUTY_INTEGRATION_STATUS,
} from '../beauty-experience/integration/release';
import {
  FASHION_CAPABILITY_CATALOG_VERSION,
  FASHION_GARMENT_SCHEMA_VERSION,
  FASHION_INTELLIGENCE_ARCHITECTURE,
  FASHION_INTELLIGENCE_RELEASE,
  FASHION_INTELLIGENCE_STATUS,
  FASHION_MANIFEST_VERSION,
  FASHION_SESSION_VERSION,
  FASHION_WARDROBE_SCHEMA_VERSION,
} from '../fashion-intelligence/release';
import { RedisService } from '../redis/redis.service';
import { BlazeFacePresenceDetector } from '../ai/face-gate/blazeface-face-presence.detector';

@Controller('health')
export class HealthController {
  constructor(
    private readonly config: ConfigService,
    private readonly redis: RedisService = new RedisService(config),
    private readonly blazeFace: BlazeFacePresenceDetector =
      new BlazeFacePresenceDetector(config),
  ) {}

  @Get()
  check() {
    const perfect = resolvePerfectCorpConfig(this.config);
    const skinProvider = this.config.get<string>('SKIN_PROVIDER', 'mock');
    const fallbackEnv = this.config.get<string>('PERFECT_CORP_FALLBACK_MOCK');
    const fallbackAllowed = isPerfectMockFallbackAllowed({
      NODE_ENV: this.config.get<string>('NODE_ENV'),
      PERFECT_CORP_FALLBACK_MOCK: fallbackEnv,
    });
    const integrity = validateProductionIntegrity({
      NODE_ENV: this.config.get<string>('NODE_ENV'),
      PERFECT_CORP_FALLBACK_MOCK: fallbackEnv,
      SKIN_PROVIDER: skinProvider,
      OUTFIT_PROVIDER: this.config.get<string>('OUTFIT_PROVIDER'),
    });
    const readiness = createProviderReadinessPlatform().readinessReport();
    const readinessSummary = readiness.entries.map((e) => ({
      providerId: e.providerId,
      level: e.level,
      reasonCount: e.reasons.length,
    }));
    const redis = this.redis.runtimeStatus();
    const blazeFace = this.blazeFace.runtimeStatus();

    return {
      status: 'ok',
      service: 'mira-api',
      timestamp: new Date().toISOString(),
      phase0: {
        perfectCorpFallbackMockAllowed: fallbackAllowed,
        integrityIssues: integrity,
      },
      integrations: {
        skinProvider,
        perfectCorpKeySet: perfect.apiKey.length > 0,
        perfectCorpBaseUrl: perfect.baseUrl,
        perfectCorpFallbackMock: fallbackAllowed,
        hint: !perfect.apiKey.length
          ? 'PERFECT_API_KEY missing on server'
          : skinProvider !== 'perfect_corp'
            ? 'Set SKIN_PROVIDER=perfect_corp'
            : undefined,
      },
      runtimeDependencies: {
        redis,
        blazeFace,
      },
      intelligence: {
        captureQualityVersion: CAPTURE_QUALITY_THRESHOLDS.version,
        faceIntelligence: {
          release: FACE_INTELLIGENCE_RELEASE,
          status: FACE_INTELLIGENCE_RELEASE_STATUS,
          compatibilityVersion: FACE_COMPATIBILITY_VERSION,
          intelligenceVersion: FACE_INTELLIGENCE_VERSION,
          foundationVersion: FACE_FOUNDATION_VERSION,
          geometryVersion: FACE_GEOMETRY_VERSION,
          shapeVersion: FACE_SHAPE_VERSION,
          recommendationVersion: FACE_RECOMMENDATION_VERSION,
          reportVersion: FACE_REPORT_VERSION,
          productionPath: 'api_runFaceReportPipeline',
          clientMirrors: 'testing_future_offline_only',
          frozen: true,
        },
        skinIntelligence: {
          sviVersion: 'svi-v2',
          frozen: true,
        },
        beautyExperience: {
          release: BEAUTY_EXPERIENCE_RELEASE,
          status: BEAUTY_EXPERIENCE_STATUS,
          architectureVersion: BEAUTY_EXPERIENCE_ARCHITECTURE,
          compatibilityVersion: BEAUTY_EXPERIENCE_COMPAT,
          capabilityRegistryVersion: BEAUTY_CAPABILITY_REGISTRY_VERSION,
          capabilityCatalogVersion: BEAUTY_CAPABILITY_CATALOG_VERSION,
          capabilityCatalogFrozen: true,
          sessionVersion: BEAUTY_SESSION_VERSION,
          realTryOn: false,
          perfectSdk: false,
          banubaSdk: false,
          port: 'BeautyExperiencePort',
          legacyTryOnPort: 'BeautyTryOnPort (deprecated)',
          providerReadiness: {
            version: PROVIDER_READINESS_VERSION,
            status: PROVIDER_READINESS_STATUS,
            liveProviderCalls: false,
            summary: readinessSummary,
          },
          integration: {
            release: BEAUTY_INTEGRATION_RELEASE,
            status: BEAUTY_INTEGRATION_STATUS,
            providerExecutionEnabled: false,
            fabricatedTryOn: false,
          },
        },
        fashionIntelligence: {
          release: FASHION_INTELLIGENCE_RELEASE,
          status: FASHION_INTELLIGENCE_STATUS,
          architectureVersion: FASHION_INTELLIGENCE_ARCHITECTURE,
          manifestVersion: FASHION_MANIFEST_VERSION,
          wardrobeSchemaVersion: FASHION_WARDROBE_SCHEMA_VERSION,
          sessionVersion: FASHION_SESSION_VERSION,
          capabilityCatalogVersion: FASHION_CAPABILITY_CATALOG_VERSION,
          wardrobeFoundation: true,
          garmentIntelligence: true,
          garmentSchemaVersion: FASHION_GARMENT_SCHEMA_VERSION,
          outfitIntelligence: false,
          stylingIntelligence: false,
          knowledgeGraph: false,
          taxonomyService: false,
          providerExecution: false,
          fashnChanges: false,
          openaiChanges: false,
        },
        featureFlags: {
          faceIntelMultipart: true,
          faceIntelRuntimeStates: true,
          useMiraApiDefault: true,
          beautyExperienceFoundation: true,
          beautyRealTryOn: false,
          fashionWardrobeFoundation: true,
          fashionGarmentIntelligence: true,
        },
        providers: {
          skinConfigured: skinProvider,
          perfectCorpKeyPresent: perfect.apiKey.length > 0,
          // Never return the key value.
        },
      },
    };
  }
}
