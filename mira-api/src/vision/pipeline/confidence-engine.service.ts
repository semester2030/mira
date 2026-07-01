import { Injectable } from '@nestjs/common';
import {
  AnalysisGate,
  FieldConfidence,
  FusionPayload,
  GeometryPayload,
  ResolvedGarment,
  SemanticsPayload,
  VisionConflict,
} from '../schema/fashion-vision-document.v1';

export interface ConfidenceEngineInput {
  geometry: GeometryPayload;
  semantics: SemanticsPayload;
  conflicts: VisionConflict[];
  resolvedGarments: ResolvedGarment[];
  hasCriticalConflict: boolean;
  /** Gates from earlier pipeline stages (validator, conflict resolver). */
  upstreamGate?: AnalysisGate;
}

export interface ConfidenceEngineResult {
  fusion: FusionPayload;
  analysisGate: AnalysisGate;
  userMessageAr?: string;
}

const PROCEED_THRESHOLD = 0.65;
const DEGRADED_THRESHOLD = 0.4;

const BLOCKED_UX_MESSAGE_AR =
  'لم نتحقق من إطلالتك — التقطي صورة كاملة لجسمك وملابسك (لا سكرينشوت ولا صور تطبيقات).';

/**
 * Per-field + overall confidence and final analysisGate — Phase 6.
 * proceed if overall ≥ 0.65 and no critical conflict.
 */
@Injectable()
export class ConfidenceEngineService {
  compute(input: ConfidenceEngineInput): ConfidenceEngineResult {
    const geometryConfidence = this.scoreGeometry(input.geometry);
    const semanticConfidence = this.scoreSemantics(input.semantics);
    const conflictPenalty = this.conflictPenalty(input.conflicts);

    const overallConfidence = Math.min(
      1,
      Math.max(0, geometryConfidence * 0.4 + semanticConfidence * 0.6 - conflictPenalty),
    );

    const fieldConfidence: FieldConfidence[] = [
      { field: 'geometry', confidence: geometryConfidence },
      { field: 'semantics', confidence: semanticConfidence },
      { field: 'fusion', confidence: overallConfidence },
    ];

    const gateFromConfidence = this.gateFromScore(overallConfidence);
    let analysisGate = this.mergeGates(
      input.upstreamGate ?? 'proceed',
      gateFromConfidence,
      input.hasCriticalConflict ? 'blocked' : 'proceed',
    );

    if (input.hasCriticalConflict) {
      analysisGate = 'blocked';
    } else if (
      overallConfidence >= PROCEED_THRESHOLD &&
      !input.conflicts.some((c) => c.severity === 'high') &&
      (input.upstreamGate ?? 'proceed') !== 'blocked'
    ) {
      analysisGate = this.mergeGates(analysisGate, 'proceed');
    }

    const fusion: FusionPayload = {
      resolvedGarments: input.resolvedGarments.length
        ? input.resolvedGarments
        : this.fallbackResolvedGarments(input.semantics),
      conflicts: input.conflicts,
      fieldConfidence,
      overallConfidence,
    };

    return {
      fusion,
      analysisGate,
      userMessageAr: analysisGate === 'blocked' ? BLOCKED_UX_MESSAGE_AR : undefined,
    };
  }

  private scoreGeometry(geometry: GeometryPayload): number {
    const segmentCount = geometry.segments.length;
    const topologyBonus =
      geometry.topology.silhouetteHint !== 'unknown' ? 0.08 : 0;
    return Math.min(0.92, 0.55 + segmentCount * 0.08 + topologyBonus);
  }

  private scoreSemantics(semantics: SemanticsPayload): number {
    if (!semantics.garments.length) return 0;
    const maxGarment = semantics.garments.reduce(
      (max, g) => Math.max(max, g.providerConfidence),
      0,
    );
    const accessoryBoost =
      semantics.accessories.length > 0
        ? semantics.accessories.reduce((max, a) => Math.max(max, a.providerConfidence), 0) *
          0.15
        : 0;
    return Math.min(1, maxGarment + accessoryBoost);
  }

  private conflictPenalty(conflicts: VisionConflict[]): number {
    return conflicts.reduce((sum, c) => {
      if (c.severity === 'high') return sum + 0.25;
      if (c.severity === 'medium') return sum + 0.12;
      return sum + 0.05;
    }, 0);
  }

  private gateFromScore(overall: number): AnalysisGate {
    if (overall >= PROCEED_THRESHOLD) return 'proceed';
    if (overall >= DEGRADED_THRESHOLD) return 'degraded';
    return 'blocked';
  }

  private mergeGates(...gates: AnalysisGate[]): AnalysisGate {
    if (gates.includes('blocked')) return 'blocked';
    if (gates.includes('degraded')) return 'degraded';
    return 'proceed';
  }

  private fallbackResolvedGarments(semantics: SemanticsPayload): ResolvedGarment[] {
    const primary = semantics.garments[0];
    if (!primary) {
      return [{ categoryId: 'outerwear', typeId: 'unknown', confidence: 0 }];
    }
    return [
      {
        categoryId: primary.categoryId,
        typeId: primary.typeId,
        confidence: primary.providerConfidence,
      },
    ];
  }
}

export { BLOCKED_UX_MESSAGE_AR, PROCEED_THRESHOLD };
