import { CanonicalGarment } from '../garment/canonical-garment';
import { OutfitEvidenceGraphBuilder } from './outfit-evidence-graph';

export interface OutfitContextInput {
  occasionId?: string;
  climate?: string;
  season?: string;
  /** e.g. standard | modest | unevaluated */
  modestyPolicy?: string;
  temperatureC?: number;
}

export interface ContextResult {
  evidenceIds: string[];
  limitationCodes: string[];
  occasionSupport: number;
  weatherSupport: number;
  modestySupport: number;
  context: Required<Pick<OutfitContextInput, never>> & {
    occasionId?: string;
    climate?: string;
    season?: string;
    modestyPolicy?: string;
  };
}

/**
 * Context Engine — Occasion + Weather/Climate + Modesty evaluation only.
 * No recommendations.
 */
export class ContextEngine {
  evaluate(
    garments: CanonicalGarment[],
    input: OutfitContextInput,
    graph: OutfitEvidenceGraphBuilder,
  ): ContextResult {
    const evidenceIds: string[] = [];
    const limitationCodes: string[] = [];

    const occasion = this.occasion(garments, input.occasionId, graph, evidenceIds, limitationCodes);
    const weather = this.weather(
      garments,
      input,
      graph,
      evidenceIds,
      limitationCodes,
    );
    const modesty = this.modesty(
      garments,
      input.modestyPolicy,
      graph,
      evidenceIds,
      limitationCodes,
    );

    return {
      evidenceIds,
      limitationCodes,
      occasionSupport: occasion,
      weatherSupport: weather,
      modestySupport: modesty,
      context: {
        occasionId: input.occasionId,
        climate: input.climate,
        season: input.season,
        modestyPolicy: input.modestyPolicy ?? 'unevaluated',
      },
    };
  }

  private occasion(
    garments: CanonicalGarment[],
    occasionId: string | undefined,
    graph: OutfitEvidenceGraphBuilder,
    evidenceIds: string[],
    limitationCodes: string[],
  ): number {
    if (!occasionId) {
      limitationCodes.push('unknown_context:occasion');
      evidenceIds.push(
        graph.add({
          kind: 'context.occasion',
          claim: 'occasion_not_provided',
          polarity: 'neutral',
          strength: 0.2,
          subjectRefs: garments.map((g) => g.garmentId),
          sourceRefs: ['context.occasion'],
          engineId: 'context.occasion',
        }),
      );
      return 0.2;
    }
    const mapped = mapOccasion(occasionId);
    let hits = 0;
    let evidenced = 0;
    for (const g of garments) {
      const occ = g.attributes.occasion.map((o) => o.toLowerCase());
      const hints = g.attributes.styleHints.map((h) => h.toLowerCase());
      if (occ.length || hints.length) evidenced += 1;
      if (
        occ.includes(mapped) ||
        occ.includes(occasionId.toLowerCase()) ||
        hints.some((h) => h.includes(mapped) || h.includes(occasionId.toLowerCase()))
      ) {
        hits += 1;
      }
    }
    if (evidenced === 0) {
      limitationCodes.push('missing_evidence:occasion');
      evidenceIds.push(
        graph.add({
          kind: 'context.occasion',
          claim: `occasion_requested:${occasionId}|garment_occasion_unevidenced`,
          polarity: 'neutral',
          strength: 0.35,
          subjectRefs: garments.map((g) => g.garmentId),
          sourceRefs: ['context.occasion', 'garment.attributes.occasion'],
          engineId: 'context.occasion',
        }),
      );
      return 0.35;
    }
    const support = clamp01(hits / Math.max(1, garments.length));
    evidenceIds.push(
      graph.add({
        kind: 'context.occasion',
        claim: `occasion_fit:${occasionId}:hits=${hits}`,
        polarity: support >= 0.5 ? 'supports' : 'conflicts',
        strength: Math.max(0.4, support),
        subjectRefs: garments.map((g) => g.garmentId),
        sourceRefs: garments.map((g) => `garment.${g.garmentId}.occasion`),
        engineId: 'context.occasion',
      }),
    );
    return Math.max(0.4, support);
  }

  private weather(
    garments: CanonicalGarment[],
    input: OutfitContextInput,
    graph: OutfitEvidenceGraphBuilder,
    evidenceIds: string[],
    limitationCodes: string[],
  ): number {
    const season = input.season;
    const climate = input.climate;
    const temp = input.temperatureC;
    if (!season && !climate && temp == null) {
      limitationCodes.push('unknown_context:weather');
      evidenceIds.push(
        graph.add({
          kind: 'context.weather',
          claim: 'weather_context_not_provided',
          polarity: 'neutral',
          strength: 0.25,
          subjectRefs: garments.map((g) => g.garmentId),
          sourceRefs: ['context.weather'],
          engineId: 'context.weather',
        }),
      );
      return 0.25;
    }

    let support = 0.5;
    const materials = garments
      .map((g) => g.attributes.material.value?.toLowerCase())
      .filter(Boolean) as string[];

    if (temp != null && temp >= 30 && materials.includes('wool')) {
      support = 0.35;
      evidenceIds.push(
        graph.add({
          kind: 'context.weather',
          claim: 'hot_climate_heavy_material',
          polarity: 'conflicts',
          strength: 0.7,
          subjectRefs: garments.map((g) => g.garmentId),
          sourceRefs: ['context.temperature', 'garment.material'],
          engineId: 'context.weather',
        }),
      );
    } else if (season) {
      let seasonHits = 0;
      for (const g of garments) {
        if (g.attributes.season.map((s) => s.toLowerCase()).includes(season.toLowerCase())) {
          seasonHits += 1;
        }
      }
      if (garments.every((g) => g.attributes.season.length === 0)) {
        limitationCodes.push('missing_evidence:season');
        evidenceIds.push(
          graph.add({
            kind: 'context.weather',
            claim: `season_requested:${season}|garment_season_unevidenced`,
            polarity: 'neutral',
            strength: 0.35,
            subjectRefs: garments.map((g) => g.garmentId),
            sourceRefs: ['context.season'],
            engineId: 'context.weather',
          }),
        );
        support = 0.35;
      } else {
        support = clamp01(0.45 + (seasonHits / Math.max(1, garments.length)) * 0.5);
        evidenceIds.push(
          graph.add({
            kind: 'context.weather',
            claim: `season_fit:${season}:hits=${seasonHits}`,
            polarity: support >= 0.5 ? 'supports' : 'neutral',
            strength: support,
            subjectRefs: garments.map((g) => g.garmentId),
            sourceRefs: garments.map((g) => `garment.${g.garmentId}.season`),
            engineId: 'context.weather',
          }),
        );
      }
    } else if (climate) {
      // Climate alone is NOT garment fit — note context + require garment attrs
      const hasSeasonOrMaterial = garments.some(
        (g) =>
          g.attributes.season.length > 0 ||
          Boolean(g.attributes.material.value),
      );
      if (!hasSeasonOrMaterial) {
        limitationCodes.push('missing_evidence:climate');
        evidenceIds.push(
          graph.add({
            kind: 'context.weather',
            claim: `climate_noted_unevidenced:${climate}`,
            polarity: 'neutral',
            strength: 0.25,
            subjectRefs: garments.map((g) => g.garmentId),
            sourceRefs: ['context.climate'],
            engineId: 'context.weather',
          }),
        );
        support = 0.25;
      } else {
        // Climate with garment season/material — weak heuristic only
        let hits = 0;
        for (const g of garments) {
          if (g.attributes.season.length || g.attributes.material.value) hits += 1;
        }
        support = clamp01(0.35 + (hits / Math.max(1, garments.length)) * 0.35);
        evidenceIds.push(
          graph.add({
            kind: 'context.weather',
            claim: `climate_with_garment_attrs:${climate}:hits=${hits}`,
            polarity: support >= 0.5 ? 'supports' : 'neutral',
            strength: support,
            subjectRefs: garments.map((g) => g.garmentId),
            sourceRefs: [
              'context.climate',
              ...garments.map((g) => `garment.${g.garmentId}.season_or_material`),
            ],
            engineId: 'context.weather',
          }),
        );
      }
    }

    return support;
  }

  private modesty(
    garments: CanonicalGarment[],
    policy: string | undefined,
    graph: OutfitEvidenceGraphBuilder,
    evidenceIds: string[],
    limitationCodes: string[],
  ): number {
    const p = (policy ?? 'unevaluated').toLowerCase();
    if (p === 'unevaluated' || !policy) {
      limitationCodes.push('modesty_unevaluated');
      evidenceIds.push(
        graph.add({
          kind: 'context.modesty',
          claim: 'modesty_unevaluated',
          polarity: 'neutral',
          strength: 0.2,
          subjectRefs: garments.map((g) => g.garmentId),
          sourceRefs: ['context.modesty_policy'],
          engineId: 'context.modesty',
        }),
      );
      return 0.2;
    }
    if (p === 'standard') {
      // Standard policy still requires garment-level coverage signals — no auto-pass
      const covering = garments.filter((g) =>
        ['abaya', 'coat', 'dress', 'pants', 'jeans', 'skirt', 'blouse', 'shirt', 'top'].includes(
          g.identity.typeId,
        ),
      );
      if (covering.length === 0) {
        limitationCodes.push('missing_evidence:modesty_standard');
        evidenceIds.push(
          graph.add({
            kind: 'context.modesty',
            claim: 'modesty_policy_standard_unevidenced',
            polarity: 'neutral',
            strength: 0.3,
            subjectRefs: garments.map((g) => g.garmentId),
            sourceRefs: ['context.modesty_policy'],
            engineId: 'context.modesty',
          }),
        );
        return 0.3;
      }
      const support = clamp01(covering.length / Math.max(1, garments.length));
      evidenceIds.push(
        graph.add({
          kind: 'context.modesty',
          claim: `modesty_policy_standard:covering=${covering.length}`,
          polarity: support >= 0.5 ? 'supports' : 'neutral',
          strength: Math.max(0.35, support),
          subjectRefs: garments.map((g) => g.garmentId),
          sourceRefs: garments.map((g) => `garment.${g.garmentId}.type`),
          engineId: 'context.modesty',
        }),
      );
      return Math.max(0.35, support);
    }
    // modest policy: prefer full coverage types
    const covering = garments.filter((g) =>
      ['abaya', 'coat', 'dress', 'pants', 'jeans', 'skirt'].includes(g.identity.typeId),
    );
    const support = clamp01(covering.length / Math.max(1, garments.length));
    evidenceIds.push(
      graph.add({
        kind: 'context.modesty',
        claim: `modesty_policy:${p}:covering=${covering.length}`,
        polarity: support >= 0.5 ? 'supports' : 'conflicts',
        strength: Math.max(0.35, support),
        subjectRefs: garments.map((g) => g.garmentId),
        sourceRefs: garments.map((g) => `garment.${g.garmentId}.type`),
        engineId: 'context.modesty',
      }),
    );
    return Math.max(0.35, support);
  }
}

function mapOccasion(id: string): string {
  const k = id.toLowerCase();
  const map: Record<string, string> = {
    work: 'office',
    interview: 'interview',
    wedding: 'wedding',
    evening: 'evening',
    casual: 'casual',
    university: 'casual',
    eid: 'eid',
  };
  return map[k] ?? k;
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}
