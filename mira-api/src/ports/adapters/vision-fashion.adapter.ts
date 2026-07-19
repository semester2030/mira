import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  VisionOrchestratorService,
  VisionOutfitAnalyzeResponse,
} from '../../vision/vision-orchestrator.service';
import { FashionVisionDocument } from '../../vision/schema/fashion-vision-document.v1';
import { isProductionEnv } from '../../config/production-integrity';
import {
  classifyProviderFailure,
  ProviderPortError,
} from '../shared/provider-error';
import { buildResultMeta, newTraceId } from '../shared/result-meta';
import {
  FashionAnalysisPort,
  FashionAnalysisPortResult,
  FashionAnalysisRequest,
} from '../fashion/fashion-analysis.port';
import { GarmentMappingEngine } from '../../fashion-intelligence/garment/mapping-engine';
import {
  assertNonEmptyOnProceed,
  assertValidGarments,
} from '../../fashion-intelligence/garment/garment-validators';
import {
  assertNoFashionProviderLeakage,
  fashionRuntime,
  toPublicFashionRuntime,
} from '../../fashion-intelligence/runtime/fashion-runtime-state';
import { garmentSchemaVersion } from '../../fashion-intelligence/garment/canonical-garment';

/**
 * Canonical production fashion adapter around Vision Platform
 * (FASHN geometry + OpenAI semantic). Maps via Garment Intelligence.
 * Does not expose FashionVisionDocument or DetectedGarment on the public port.
 * Does not silently swallow GI/validation failures (6C.1 Critical #3).
 */
@Injectable()
export class VisionFashionAdapter implements FashionAnalysisPort {
  private readonly garmentMapper = new GarmentMappingEngine();

  constructor(
    private readonly vision: VisionOrchestratorService,
    private readonly config: ConfigService,
  ) {}

  async analyze(
    request: FashionAnalysisRequest,
  ): Promise<FashionAnalysisPortResult> {
    const traceId = request.traceId ?? newTraceId('fashion');
    try {
      const response: VisionOutfitAnalyzeResponse = await this.vision.analyze({
        imageBuffer: request.imageBytes,
        occasionId: request.occasionId,
        mode: request.mode ?? 'smart',
        skinSnapshot: request.skinSnapshot,
        locale: request.locale,
      });

      // FashionVisionDocument remains INTERNAL — never returned on this port.
      const doc = response.fashionVision as FashionVisionDocument;

      let garments;
      let mappingRuntime;
      try {
        const mapped = this.garmentMapper.mapFromVisionDocument(doc, { traceId });
        assertValidGarments(mapped.garments);
        assertNonEmptyOnProceed(mapped.garments, response.meta.analysisGate);
        for (const g of mapped.garments) {
          assertNoFashionProviderLeakage(g);
        }
        garments = mapped.garments;
        mappingRuntime = mapped.runtime;
      } catch (mapErr) {
        const message = mapErr instanceof Error ? mapErr.message : String(mapErr);
        // Explicit failure — do not return empty garments[] as success.
        throw new ProviderPortError(
          classifyProviderFailure({
            message: `garment_mapping_failed: ${message}`,
            provider: 'mira_garment_intelligence',
            traceId,
          }),
        );
      }

      const result: FashionAnalysisPortResult = {
        garments,
        warnings: [],
        limitations: [
          'Canonical path: Vision Platform → Garment Intelligence → CanonicalGarment.',
          'FashionVisionDocument is internal; DetectedGarment is not public.',
        ],
        analysisGate: response.meta.analysisGate,
        analysis: response.analysis,
        processingMs: response.meta.processingMs,
        userMessageAr: response.meta.userMessageAr,
        runtime: mappingRuntime,
        meta: buildResultMeta({
          source: 'inferred',
          // Opaque Mira-owned label — no FASHN/OpenAI identity strings
          provider: 'mira',
          providerVersion: garmentSchemaVersion(),
          calculationVersion: 'garment-mapping-v1',
          confidence: Math.round(
            (garments.reduce((s, g) => s + g.confidence, 0) /
              Math.max(1, garments.length)) *
              100,
          ),
          isMock: false,
          isProduction: isProductionEnv(this.config.get<string>('NODE_ENV')),
          traceId,
          requestId: request.requestId,
          limitations: [
            'Semantic attributes may be inferred; material estimated only.',
          ],
        }),
      };

      assertNoFashionProviderLeakage({
        garments: result.garments,
        meta: {
          provider: result.meta.provider,
          providerVersion: result.meta.providerVersion,
        },
      });

      return result;
    } catch (err) {
      if (err instanceof ProviderPortError) throw err;
      const message = err instanceof Error ? err.message : String(err);
      throw new ProviderPortError(
        classifyProviderFailure({
          message,
          provider: 'mira',
          traceId,
        }),
      );
    }
  }

  /** Build a FAILED runtime for observability helpers / tests. */
  static failedRuntime(traceId: string, reasonEn: string, reasonAr: string) {
    return toPublicFashionRuntime(
      fashionRuntime({
        status: 'FAILED',
        stage: 'mapping',
        reasonCode: 'garment_mapping_failed',
        reasonEn,
        reasonAr,
        capabilityId: 'analyze_garment',
        capabilityVersion: garmentSchemaVersion(),
        traceId,
      }),
    );
  }
}
