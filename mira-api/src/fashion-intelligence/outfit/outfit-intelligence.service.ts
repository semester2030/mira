import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CanonicalGarment } from '../garment/canonical-garment';
import { resolveFashionFeatureFlags } from '../feature-flags';
import { getFashionCapability } from '../capability/fashion-capability-catalog';
import { fashionTelemetry } from '../telemetry/fashion-telemetry';
import {
  assertNoFashionProviderLeakage,
  toPublicFashionRuntime,
  fashionRuntime,
} from '../runtime/fashion-runtime-state';
import { toPublicCanonicalOutfit } from './canonical-outfit';
import { OutfitContextInput } from './context-engine';
import {
  OutfitEvaluationEngine,
  OutfitEvaluationResult,
} from './evaluation-engine';
import { assertValidOutfit, assertValidEvidenceGraph } from './outfit-validators';
import { OutfitEvidenceGraph } from './outfit-evidence-graph';
import { CompatibilityEngine } from './compatibility-engine';
import { HarmonyEngine } from './harmony-engine';
import { OutfitEvidenceGraphBuilder } from './outfit-evidence-graph';
import { CompositionEngine } from './composition-engine';
import { ContextEngine } from './context-engine';
import { deterministicEvalTraceId, deterministicOutfitId } from './outfit-identity';

export interface AnalyzeOutfitResult {
  success: boolean;
  outfit: ReturnType<typeof toPublicCanonicalOutfit>;
  /** Internal — not for public HTTP by default */
  evidenceGraph: OutfitEvidenceGraph;
  capabilityId: 'analyze_outfit';
  runtime: ReturnType<typeof toPublicFashionRuntime>;
}

/**
 * Outfit Intelligence Service — Mira-owned composition + evaluation.
 * Does not call providers. Does not modify GI / Wardrobe schemas.
 */
@Injectable()
export class OutfitIntelligenceService {
  private readonly evaluator = new OutfitEvaluationEngine();

  constructor(private readonly config: ConfigService) {}

  private flags() {
    return resolveFashionFeatureFlags((k, d) => this.config.get(k, d));
  }

  private assertCap(id: string): void {
    const flags = this.flags();
    const cap = getFashionCapability(id);
    if (!flags.fashionOutfitIntelEnabled || !cap?.executionEnabled) {
      throw new Error(
        `${id} disabled (FASHION_OUTFIT_INTEL_ENABLED / capability)`,
      );
    }
  }

  analyzeOutfit(
    garments: CanonicalGarment[],
    context: OutfitContextInput = {},
    opts?: { traceId?: string },
  ): AnalyzeOutfitResult {
    this.assertCap('analyze_outfit');
    const ordered = [...garments].sort((a, b) =>
      a.garmentId.localeCompare(b.garmentId),
    );
    const outfitId = deterministicOutfitId({
      garmentIds: ordered.map((g) => g.garmentId),
      occasionId: context.occasionId,
      climate: context.climate,
      season: context.season,
      modestyPolicy: context.modestyPolicy,
    });
    const traceId = opts?.traceId ?? deterministicEvalTraceId(outfitId);
    fashionTelemetry.track({
      name: 'fashion_capability_requested',
      traceId,
      capabilityId: 'analyze_outfit',
    });

    const result = this.evaluator.evaluate(garments, context, { traceId });
    assertValidOutfit(result.outfit, result.evidenceGraph);
    assertNoFashionProviderLeakage(toPublicCanonicalOutfit(result.outfit));

    fashionTelemetry.track({
      name: 'fashion_attempt_recorded',
      traceId,
      capabilityId: 'analyze_outfit',
      runtimeStatus: result.outfit.runtime.status,
      props: { garmentCount: result.outfit.garmentIds.length },
    });

    return {
      success: true,
      outfit: toPublicCanonicalOutfit(result.outfit),
      evidenceGraph: result.evidenceGraph,
      capabilityId: 'analyze_outfit',
      runtime: result.outfit.runtime,
    };
  }

  /** Capability: compatibility — set evaluation only */
  evaluateCompatibility(garments: CanonicalGarment[]) {
    this.assertCap('compatibility');
    const ordered = [...garments].sort((a, b) =>
      a.garmentId.localeCompare(b.garmentId),
    );
    const graph = new OutfitEvidenceGraphBuilder('cap_compatibility');
    const versionId = graph.add({
      kind: 'version',
      claim: 'cap:compatibility',
      polarity: 'neutral',
      strength: 1,
      subjectRefs: ordered.map((g) => g.garmentId),
      sourceRefs: ['capability.compatibility'],
      engineId: 'versioning',
    });
    const slots = new CompositionEngine().compose(ordered, graph).slots;
    const result = new CompatibilityEngine().evaluate(ordered, slots, graph);
    for (const eid of result.evidenceIds) {
      graph.link(eid, versionId, 'derived_from');
    }
    graph.finalizeLaw31({ rootEvidenceId: versionId });
    const built = graph.build();
    assertValidEvidenceGraph(built);
    assertNoFashionProviderLeakage({
      evidenceIds: result.evidenceIds,
      runtime: toPublicFashionRuntime(
        fashionRuntime({
          status: 'AVAILABLE',
          stage: 'mapping',
          reasonCode: 'cap_compatibility',
          capabilityId: 'compatibility',
          capabilityVersion: 'outfit-schema-v1',
          traceId: 'cap_compatibility',
        }),
      ),
    });
    return { ...result, evidenceGraph: built };
  }

  /** Capability: color_harmony */
  evaluateColorHarmony(garments: CanonicalGarment[]) {
    this.assertCap('color_harmony');
    const ordered = [...garments].sort((a, b) =>
      a.garmentId.localeCompare(b.garmentId),
    );
    const graph = new OutfitEvidenceGraphBuilder('cap_harmony');
    const versionId = graph.add({
      kind: 'version',
      claim: 'cap:color_harmony',
      polarity: 'neutral',
      strength: 1,
      subjectRefs: ordered.map((g) => g.garmentId),
      sourceRefs: ['capability.color_harmony'],
      engineId: 'versioning',
    });
    const result = new HarmonyEngine().evaluate(ordered, graph);
    for (const eid of result.evidenceIds) {
      graph.link(eid, versionId, 'derived_from');
    }
    graph.finalizeLaw31({ rootEvidenceId: versionId });
    const built = graph.build();
    assertValidEvidenceGraph(built);
    assertNoFashionProviderLeakage({
      evidenceIds: result.evidenceIds,
      runtime: toPublicFashionRuntime(
        fashionRuntime({
          status: 'AVAILABLE',
          stage: 'mapping',
          reasonCode: 'cap_harmony',
          capabilityId: 'color_harmony',
          capabilityVersion: 'outfit-schema-v1',
          traceId: 'cap_harmony',
        }),
      ),
    });
    return { ...result, evidenceGraph: built };
  }

  /** Capability: occasion_matching */
  evaluateOccasion(garments: CanonicalGarment[], occasionId: string) {
    this.assertCap('occasion_matching');
    const ordered = [...garments].sort((a, b) =>
      a.garmentId.localeCompare(b.garmentId),
    );
    const graph = new OutfitEvidenceGraphBuilder('cap_occasion');
    const versionId = graph.add({
      kind: 'version',
      claim: 'cap:occasion_matching',
      polarity: 'neutral',
      strength: 1,
      subjectRefs: ordered.map((g) => g.garmentId),
      sourceRefs: ['capability.occasion_matching'],
      engineId: 'versioning',
    });
    const result = new ContextEngine().evaluate(ordered, { occasionId }, graph);
    for (const eid of result.evidenceIds) {
      graph.link(eid, versionId, 'derived_from');
    }
    graph.finalizeLaw31({ rootEvidenceId: versionId });
    const built = graph.build();
    assertValidEvidenceGraph(built);
    assertNoFashionProviderLeakage({
      evidenceIds: result.evidenceIds,
      runtime: toPublicFashionRuntime(
        fashionRuntime({
          status: 'AVAILABLE',
          stage: 'mapping',
          reasonCode: 'cap_occasion',
          capabilityId: 'occasion_matching',
          capabilityVersion: 'outfit-schema-v1',
          traceId: 'cap_occasion',
        }),
      ),
    });
    return { ...result, evidenceGraph: built };
  }

  /** Capability: season_matching */
  evaluateSeason(garments: CanonicalGarment[], season: string) {
    this.assertCap('season_matching');
    const ordered = [...garments].sort((a, b) =>
      a.garmentId.localeCompare(b.garmentId),
    );
    const graph = new OutfitEvidenceGraphBuilder('cap_season');
    const versionId = graph.add({
      kind: 'version',
      claim: 'cap:season_matching',
      polarity: 'neutral',
      strength: 1,
      subjectRefs: ordered.map((g) => g.garmentId),
      sourceRefs: ['capability.season_matching'],
      engineId: 'versioning',
    });
    const result = new ContextEngine().evaluate(ordered, { season }, graph);
    for (const eid of result.evidenceIds) {
      graph.link(eid, versionId, 'derived_from');
    }
    graph.finalizeLaw31({ rootEvidenceId: versionId });
    const built = graph.build();
    assertValidEvidenceGraph(built);
    assertNoFashionProviderLeakage({
      evidenceIds: result.evidenceIds,
      runtime: toPublicFashionRuntime(
        fashionRuntime({
          status: 'AVAILABLE',
          stage: 'mapping',
          reasonCode: 'cap_season',
          capabilityId: 'season_matching',
          capabilityVersion: 'outfit-schema-v1',
          traceId: 'cap_season',
        }),
      ),
    });
    return { ...result, evidenceGraph: built };
  }

  /** Capability: compare_looks */
  compareLooks(
    a: CanonicalGarment[],
    b: CanonicalGarment[],
    context: OutfitContextInput = {},
  ) {
    this.assertCap('compare_looks');
    const result = this.evaluator.compare(a, b, context);
    assertValidOutfit(result.a.outfit, result.a.evidenceGraph);
    assertValidOutfit(result.b.outfit, result.b.evidenceGraph);
    assertNoFashionProviderLeakage(toPublicCanonicalOutfit(result.a.outfit));
    assertNoFashionProviderLeakage(toPublicCanonicalOutfit(result.b.outfit));
    return {
      a: toPublicCanonicalOutfit(result.a.outfit),
      b: toPublicCanonicalOutfit(result.b.outfit),
      winner: result.winner,
    };
  }

  /** Raw evaluate for tests */
  evaluateRaw(
    garments: CanonicalGarment[],
    context?: OutfitContextInput,
  ): OutfitEvaluationResult {
    return this.evaluator.evaluate(garments, context ?? {});
  }
}
