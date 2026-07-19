import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FashionVisionDocument } from '../../vision/schema/fashion-vision-document.v1';
import { resolveFashionFeatureFlags } from '../feature-flags';
import { getFashionCapability } from '../capability/fashion-capability-catalog';
import { fashionTelemetry } from '../telemetry/fashion-telemetry';
import {
  assertNoFashionProviderLeakage,
  toPublicFashionRuntime,
} from '../runtime/fashion-runtime-state';
import { CanonicalGarment } from './canonical-garment';
import { GarmentMappingEngine, GarmentMappingResult } from './mapping-engine';
import { assertValidGarments } from './garment-validators';
import {
  deterministicMapTraceId,
  visionDocumentFingerprint,
} from './garment-identity';

export interface AnalyzeGarmentResult {
  success: boolean;
  garments: CanonicalGarment[];
  mappingVersion: string;
  runtime: ReturnType<typeof toPublicFashionRuntime>;
  capabilityId: 'analyze_garment';
}

/**
 * Garment Intelligence Service — Mira-owned.
 * Maps Vision documents → CanonicalGarment. No direct provider calls.
 */
@Injectable()
export class GarmentIntelligenceService {
  private readonly mapper = new GarmentMappingEngine();

  constructor(private readonly config: ConfigService) {}

  private flags() {
    return resolveFashionFeatureFlags((k, d) => this.config.get(k, d));
  }

  /**
   * Capability: analyze_garment
   * Input: already-produced FashionVisionDocument (from Vision path — internal).
   * Does not call FASHN/OpenAI.
   */
  analyzeGarment(
    doc: FashionVisionDocument,
    opts?: { traceId?: string },
  ): AnalyzeGarmentResult {
    const flags = this.flags();
    const cap = getFashionCapability('analyze_garment');
    const traceId =
      opts?.traceId ??
      deterministicMapTraceId(visionDocumentFingerprint(doc));

    fashionTelemetry.track({
      name: 'fashion_capability_requested',
      traceId,
      capabilityId: 'analyze_garment',
    });

    if (!flags.fashionGarmentIntelEnabled || !cap?.executionEnabled) {
      fashionTelemetry.track({
        name: 'fashion_capability_blocked',
        traceId,
        capabilityId: 'analyze_garment',
        runtimeStatus: 'BLOCKED',
      });
      throw new Error(
        'analyze_garment disabled (FASHION_GARMENT_INTEL_ENABLED / capability)',
      );
    }

    const mapped = this.mapper.mapFromVisionDocument(doc, { traceId });
    assertValidGarments(mapped.garments);
    for (const g of mapped.garments) {
      assertNoFashionProviderLeakage(g);
    }

    fashionTelemetry.track({
      name: 'fashion_attempt_recorded',
      traceId,
      capabilityId: 'analyze_garment',
      runtimeStatus: mapped.runtime.status,
      props: { garmentCount: mapped.garments.length },
    });

    return {
      success: true,
      garments: mapped.garments,
      mappingVersion: mapped.mappingVersion,
      runtime: mapped.runtime,
      capabilityId: 'analyze_garment',
    };
  }

  /** Map only — used by VisionFashionAdapter bridge */
  mapVisionDocument(
    doc: FashionVisionDocument,
    opts?: { traceId?: string },
  ): GarmentMappingResult {
    return this.mapper.mapFromVisionDocument(doc, opts);
  }
}
