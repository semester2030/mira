import {
  FASHION_VISION_SCHEMA_VERSION,
  AnalysisGate,
  FashionVisionDocument,
  FusionPayload,
  GeometryPayload,
  ProvenanceAuditEntry,
  SemanticsPayload,
} from './fashion-vision-document.v1';

/** Placeholder semantics when OpenAI unavailable — valid ontology ids only. */
export function buildPendingSemanticsPlaceholder(): SemanticsPayload {
  return {
    garments: [
      {
        categoryId: 'outerwear',
        typeId: 'blazer',
        colors: ['black_pure'],
        providerConfidence: 0,
      },
    ],
    accessories: [],
    styleArchetypeId: 'business',
    layering: ['base'],
    dominantColorIds: ['black_pure'],
    secondaryColorIds: [],
  };
}

export function computeAnalysisGateFromSemantics(semantics: SemanticsPayload): AnalysisGate {
  const maxConf = semantics.garments.reduce(
    (max, g) => Math.max(max, g.providerConfidence),
    0,
  );
  if (maxConf >= 0.55) return 'proceed';
  if (maxConf >= 0.2) return 'degraded';
  return 'blocked';
}

export function applyConfidenceMultiplier(
  semantics: SemanticsPayload,
  multiplier: number,
): SemanticsPayload {
  const m = Math.min(1, Math.max(0, multiplier));
  return {
    ...semantics,
    garments: semantics.garments.map((g) => ({
      ...g,
      providerConfidence: g.providerConfidence * m,
    })),
    accessories: semantics.accessories.map((a) => ({
      ...a,
      providerConfidence: a.providerConfidence * m,
    })),
  };
}

export function buildFashionVisionDocumentFromParts(input: {
  geometry: GeometryPayload;
  semantics?: SemanticsPayload;
  providers: string[];
  analysisGate?: FashionVisionDocument['analysisGate'];
  orchestratorVersion?: string;
  pipelinePhase?: string;
  normalizationNotes?: string[];
  rejectReasons?: ProvenanceAuditEntry[];
  fusion?: FusionPayload;
}): FashionVisionDocument {
  const semantics = input.semantics ?? buildPendingSemanticsPlaceholder();
  const gate = input.analysisGate ?? computeAnalysisGateFromSemantics(semantics);

  const semanticConf = semantics.garments.reduce(
    (max, g) => Math.max(max, g.providerConfidence),
    0,
  );

  const defaultFusion: FusionPayload = {
    resolvedGarments: [
      {
        categoryId: semantics.garments[0]?.categoryId ?? 'outerwear',
        typeId: semantics.garments[0]?.typeId ?? 'unknown',
        confidence: gate === 'proceed' ? 0.65 : 0.35,
      },
    ],
    conflicts: [],
    fieldConfidence: [
      { field: 'geometry', confidence: 0.75 },
      { field: 'semantics', confidence: semanticConf },
    ],
    overallConfidence:
      gate === 'proceed' ? Math.min(0.85, (0.75 + semanticConf) / 2) : semanticConf * 0.6,
  };

  return {
    schemaVersion: FASHION_VISION_SCHEMA_VERSION,
    analysisGate: gate,
    provenance: {
      providers: input.providers,
      timestamp: new Date().toISOString(),
      orchestratorVersion: input.orchestratorVersion ?? '1.0.0',
      pipelinePhase: input.pipelinePhase,
      normalizationNotes: input.normalizationNotes?.length
        ? input.normalizationNotes
        : undefined,
      rejectReasons: input.rejectReasons?.length ? input.rejectReasons : undefined,
    },
    geometry: input.geometry,
    semantics,
    fusion: input.fusion ?? defaultFusion,
  };
}
