import { CanonicalGarment } from '../garment/canonical-garment';
import {
  fashionRuntime,
  toPublicFashionRuntime,
} from '../runtime/fashion-runtime-state';
import {
  CanonicalOutfit,
  FASHION_OUTFIT_EVALUATION_VERSION,
  FASHION_OUTFIT_MAPPING_VERSION,
  outfitSchemaVersion,
} from './canonical-outfit';
import { CompositionEngine } from './composition-engine';
import { CompatibilityEngine } from './compatibility-engine';
import { HarmonyEngine } from './harmony-engine';
import { LayeringEngine } from './layering-engine';
import { ContextEngine, OutfitContextInput } from './context-engine';
import { MetricsEngine } from './metrics-engine';
import { OutfitConfidenceEngine } from './confidence-engine';
import { OutfitLimitationEngine } from './limitation-engine';
import { OutfitExplainabilityEngine } from './explainability-engine';
import {
  OutfitEvidenceGraph,
  OutfitEvidenceGraphBuilder,
} from './outfit-evidence-graph';
import {
  deterministicEvalTraceId,
  deterministicOutfitId,
  OUTFIT_MAPPING_EPOCH_ISO,
} from './outfit-identity';

export interface OutfitEvaluationResult {
  outfit: CanonicalOutfit;
  evidenceGraph: OutfitEvidenceGraph;
}

/**
 * Evaluation Engine — orchestrates approved pipeline.
 * Evidence → Metrics → Confidence (Law #31).
 */
export class OutfitEvaluationEngine {
  constructor(
    private readonly composition = new CompositionEngine(),
    private readonly compatibility = new CompatibilityEngine(),
    private readonly harmony = new HarmonyEngine(),
    private readonly layering = new LayeringEngine(),
    private readonly context = new ContextEngine(),
    private readonly metrics = new MetricsEngine(),
    private readonly confidence = new OutfitConfidenceEngine(),
    private readonly limitations = new OutfitLimitationEngine(),
    private readonly explain = new OutfitExplainabilityEngine(),
  ) {}

  evaluate(
    garments: CanonicalGarment[],
    context: OutfitContextInput = {},
    opts?: { traceId?: string },
  ): OutfitEvaluationResult {
    // Deterministic input order
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
    const graph = new OutfitEvidenceGraphBuilder(`oeg_${outfitId}`);

    const versionEvidenceId = graph.add({
      kind: 'version',
      claim: `eval:${FASHION_OUTFIT_EVALUATION_VERSION}|map:${FASHION_OUTFIT_MAPPING_VERSION}`,
      polarity: 'neutral',
      strength: 1,
      subjectRefs: [outfitId],
      sourceRefs: ['outfit.versioning'],
      engineId: 'versioning',
    });

    const composed = this.composition.compose(ordered, graph);
    const uniqueGarments = ordered.filter((g) =>
      composed.garmentIds.includes(g.garmentId),
    );

    const compat = this.compatibility.evaluate(
      uniqueGarments,
      composed.slots,
      graph,
    );
    const harm = this.harmony.evaluate(uniqueGarments, graph);
    const layer = this.layering.evaluate(composed.slots, graph);
    const ctx = this.context.evaluate(uniqueGarments, context, graph);

    // Connect engine bundles to version root before build
    for (const eid of [
      ...composed.evidenceIds,
      ...compat.evidenceIds,
      ...harm.evidenceIds,
      ...layer.evidenceIds,
      ...ctx.evidenceIds,
    ]) {
      graph.link(eid, versionEvidenceId, 'derived_from');
    }
    graph.finalizeLaw31({ rootEvidenceId: versionEvidenceId });

    const evidenceGraph = graph.build();

    const occasionEvidenceIds = evidenceGraph.records
      .filter((r) => r.kind === 'context.occasion')
      .map((r) => r.evidenceId);
    const weatherEvidenceIds = evidenceGraph.records
      .filter((r) => r.kind === 'context.weather')
      .map((r) => r.evidenceId);
    const modestyEvidenceIds = evidenceGraph.records
      .filter((r) => r.kind === 'context.modesty')
      .map((r) => r.evidenceId);

    // Include version evidence in completeness metric citation chain via composition ids + version
    const compositionEvidenceIds = [
      ...composed.evidenceIds,
      versionEvidenceId,
    ];

    const metricList = this.metrics.fromEvidence({
      graph: evidenceGraph,
      compatibilityEvidenceIds: compat.evidenceIds,
      harmonyEvidenceIds: harm.evidenceIds,
      layeringEvidenceIds: layer.evidenceIds,
      occasionEvidenceIds,
      weatherEvidenceIds,
      modestyEvidenceIds,
      compositionEvidenceIds,
    });

    const conf = this.confidence.aggregate({
      graph: evidenceGraph,
      metrics: metricList,
    });

    const limitationCodes = [
      ...composed.limitationCodes,
      ...compat.limitationCodes,
      ...harm.limitationCodes,
      ...layer.limitationCodes,
      ...ctx.limitationCodes,
    ];
    const limitationList = this.limitations.build(limitationCodes);
    const explainability = this.explain.build({
      graph: evidenceGraph,
      limitationCodes,
      alwaysCite: [versionEvidenceId],
    });

    const status =
      composed.garmentIds.length === 0
        ? ('FAILED' as const)
        : compat.hardConflicts.length || !layer.legal
          ? ('DEGRADED' as const)
          : limitationCodes.length > 2
            ? ('PARTIAL' as const)
            : ('AVAILABLE' as const);

    const { stage, reasonCode, reasonEn, reasonAr } = runtimeSemantics(
      status,
      composed.garmentIds.length,
      limitationCodes,
    );

    const runtime = toPublicFashionRuntime(
      fashionRuntime({
        status,
        stage,
        reasonCode,
        reasonEn,
        reasonAr,
        capabilityId: 'analyze_outfit',
        capabilityVersion: outfitSchemaVersion(),
        traceId,
      }),
    );

    const now = OUTFIT_MAPPING_EPOCH_ISO;
    const outfit: CanonicalOutfit = {
      outfitId,
      version: outfitSchemaVersion(),
      garmentIds: composed.garmentIds,
      slots: composed.slots,
      metrics: metricList,
      confidence: conf.overall,
      fieldConfidence: conf.fields,
      limitations: limitationList,
      explainability,
      context: ctx.context,
      evidenceGraphRef: evidenceGraph.graphId,
      runtime,
      evaluationVersion: FASHION_OUTFIT_EVALUATION_VERSION,
      mappingVersion: FASHION_OUTFIT_MAPPING_VERSION,
      createdAt: now,
      updatedAt: now,
    };

    return { outfit, evidenceGraph };
  }

  compare(
    a: CanonicalGarment[],
    b: CanonicalGarment[],
    context: OutfitContextInput = {},
  ): { a: OutfitEvaluationResult; b: OutfitEvaluationResult; winner: 'a' | 'b' | 'tie' } {
    const ra = this.evaluate(a, context);
    const rb = this.evaluate(b, context);
    const diff = ra.outfit.confidence - rb.outfit.confidence;
    const winner = Math.abs(diff) < 0.02 ? 'tie' : diff > 0 ? 'a' : 'b';
    return { a: ra, b: rb, winner };
  }
}

function runtimeSemantics(
  status: 'FAILED' | 'DEGRADED' | 'PARTIAL' | 'AVAILABLE',
  garmentCount: number,
  limitationCodes: string[],
): {
  stage: 'mapping' | 'terminal';
  reasonCode: string;
  reasonEn: string;
  reasonAr: string;
} {
  switch (status) {
    case 'FAILED':
      return {
        stage: 'terminal',
        reasonCode: 'outfit_evaluation_failed_empty',
        reasonEn: 'Outfit evaluation failed — empty garment set.',
        reasonAr: 'فشل تقييم الإطلالة — مجموعة قطع فارغة.',
      };
    case 'DEGRADED':
      return {
        stage: 'mapping',
        reasonCode: 'outfit_evaluation_degraded',
        reasonEn: `Outfit evaluated with hard conflicts (${garmentCount} garment(s)).`,
        reasonAr: `تم تقييم الإطلالة مع تعارضات قاسية (${garmentCount} قطعة).`,
      };
    case 'PARTIAL':
      return {
        stage: 'mapping',
        reasonCode: 'outfit_evaluation_partial',
        reasonEn: `Outfit evaluated with limitations (${limitationCodes.length}).`,
        reasonAr: `تم تقييم الإطلالة مع قيود (${limitationCodes.length}).`,
      };
    default:
      return {
        stage: 'mapping',
        reasonCode: 'outfit_evaluation_complete',
        reasonEn: `Evaluated outfit with ${garmentCount} garment(s).`,
        reasonAr: `تم تقييم إطلالة بـ ${garmentCount} قطعة.`,
      };
  }
}
