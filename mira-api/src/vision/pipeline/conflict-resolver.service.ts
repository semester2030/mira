import { Injectable } from '@nestjs/common';
import {
  AnalysisGate,
  GeometryPayload,
  ResolvedGarment,
  SemanticGarment,
  SemanticsPayload,
  VisionConflict,
} from '../schema/fashion-vision-document.v1';

export interface ConflictResolverResult {
  conflicts: VisionConflict[];
  semantics: SemanticsPayload;
  resolvedGarments: ResolvedGarment[];
  suggestedGate: AnalysisGate;
  hasCriticalConflict: boolean;
}

const OUTERWEAR_TYPES = new Set(['blazer', 'jacket', 'coat']);
const ONE_PIECE_TYPES = new Set(['dress', 'abaya']);

function isGeometryOnePiece(geometry: GeometryPayload): boolean {
  return (
    geometry.topology.onePiece === true ||
    geometry.topology.silhouetteHint === 'one_piece'
  );
}

function isSemanticTwoPiece(semantics: SemanticsPayload): boolean {
  const categories = new Set(semantics.garments.map((g) => g.categoryId));
  if (categories.has('tops') && categories.has('bottoms')) return true;

  const types = new Set(semantics.garments.map((g) => g.typeId));
  const hasLower = types.has('pants') || types.has('jeans') || types.has('skirt');
  const hasUpper =
    types.has('shirt') ||
    types.has('blouse') ||
    types.has('top') ||
    types.has('blazer') ||
    types.has('jacket') ||
    types.has('coat');
  if (hasLower && hasUpper) return true;

  return semantics.garments.length >= 2 && ![...types].some((t) => ONE_PIECE_TYPES.has(t));
}

function garmentTypes(semantics: SemanticsPayload): string[] {
  return semantics.garments.map((g) => g.typeId);
}

/**
 * Compare FASHN geometry vs OpenAI semantics — Phase 6 (3 rules v1).
 * Reference: docs/mira-vision-platform.html
 */
@Injectable()
export class ConflictResolverService {
  resolve(
    geometry: GeometryPayload,
    semantics: SemanticsPayload,
  ): ConflictResolverResult {
    const conflicts: VisionConflict[] = [];
    let workingSemantics: SemanticsPayload = {
      ...semantics,
      garments: semantics.garments.map((g) => ({ ...g })),
      accessories: semantics.accessories.map((a) => ({ ...a })),
      layering: [...semantics.layering],
      dominantColorIds: [...semantics.dominantColorIds],
      secondaryColorIds: [...semantics.secondaryColorIds],
    };

    this.ruleOnePieceVsTwoPiece(geometry, workingSemantics, conflicts);
    this.ruleBlazerVsDress(workingSemantics, conflicts);
    workingSemantics = this.ruleUnifyBlazerJacket(workingSemantics, conflicts);

    const hasCriticalConflict = conflicts.some((c) => c.severity === 'high');
    const hasMediumConflict = conflicts.some((c) => c.severity === 'medium');

    let suggestedGate: AnalysisGate = 'proceed';
    if (hasCriticalConflict) suggestedGate = 'blocked';
    else if (hasMediumConflict) suggestedGate = 'degraded';

    const resolvedGarments = this.buildResolvedGarments(workingSemantics);

    return {
      conflicts,
      semantics: workingSemantics,
      resolvedGarments,
      suggestedGate,
      hasCriticalConflict,
    };
  }

  /** Rule 1 — one-piece (FASHN) vs two-piece (OpenAI) → blocked. */
  private ruleOnePieceVsTwoPiece(
    geometry: GeometryPayload,
    semantics: SemanticsPayload,
    conflicts: VisionConflict[],
  ): void {
    if (!isGeometryOnePiece(geometry)) return;
    if (!isSemanticTwoPiece(semantics)) return;

    conflicts.push({
      code: 'CONFLICT_ONE_PIECE_VS_TWO_PIECE',
      message:
        'FASHN detected one-piece silhouette but OpenAI described separate garment pieces',
      severity: 'high',
      geometryValue: geometry.topology.silhouetteHint,
      semanticValue: 'two_piece',
    });
  }

  /** Rule 2 — Blazer vs Dress (semantic distance) → blocked or degraded. */
  private ruleBlazerVsDress(
    semantics: SemanticsPayload,
    conflicts: VisionConflict[],
  ): void {
    const types = garmentTypes(semantics);
    const hasBlazer = types.includes('blazer');
    const hasDress = types.includes('dress');
    if (!hasBlazer || !hasDress) return;

    const blazer = semantics.garments.find((g) => g.typeId === 'blazer');
    const dress = semantics.garments.find((g) => g.typeId === 'dress');
    const minConf = Math.min(
      blazer?.providerConfidence ?? 0,
      dress?.providerConfidence ?? 0,
    );

    conflicts.push({
      code: 'CONFLICT_BLAZER_VS_DRESS',
      message: 'Semantic types blazer and dress are incompatible for the same outfit',
      severity: minConf < 0.45 ? 'medium' : 'high',
      semanticValue: 'blazer+dress',
    });
  }

  /** Rule 3 — Blazer vs Jacket (close) → unify to outerwear. */
  private ruleUnifyBlazerJacket(
    semantics: SemanticsPayload,
    conflicts: VisionConflict[],
  ): SemanticsPayload {
    const types = garmentTypes(semantics);
    if (!types.includes('blazer') || !types.includes('jacket')) {
      return semantics;
    }

    const blazer = semantics.garments.find((g) => g.typeId === 'blazer');
    const jacket = semantics.garments.find((g) => g.typeId === 'jacket');
    const winner =
      (blazer?.providerConfidence ?? 0) >= (jacket?.providerConfidence ?? 0)
        ? 'blazer'
        : 'jacket';

    const garments = semantics.garments.map((g): SemanticGarment => {
      if (g.typeId !== 'blazer' && g.typeId !== 'jacket') return g;
      return {
        ...g,
        categoryId: 'outerwear',
        typeId: winner,
      };
    });

    conflicts.push({
      code: 'CONFLICT_OUTERWEAR_UNIFIED',
      message: `Close outerwear types blazer/jacket unified to ${winner}`,
      severity: 'low',
      semanticValue: `blazer+jacket→${winner}`,
      geometryValue: 'outerwear',
    });

    return { ...semantics, garments };
  }

  private buildResolvedGarments(semantics: SemanticsPayload): ResolvedGarment[] {
    const byKey = new Map<string, ResolvedGarment>();

    for (const g of semantics.garments) {
      const key = `${g.categoryId}:${g.typeId}`;
      const existing = byKey.get(key);
      const confidence = g.providerConfidence;
      if (!existing || confidence > existing.confidence) {
        byKey.set(key, {
          categoryId: g.categoryId,
          typeId: g.typeId,
          confidence,
        });
      }
    }

    return [...byKey.values()];
  }
}

export { isGeometryOnePiece, isSemanticTwoPiece };
