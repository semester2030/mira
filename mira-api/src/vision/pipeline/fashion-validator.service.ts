import { Injectable } from '@nestjs/common';
import {
  AnalysisGate,
  FashionVisionDocument,
  FashionVisionValidationError,
} from '../schema/fashion-vision-document.v1';

export interface FashionRuleValidationResult {
  valid: boolean;
  errors: FashionVisionValidationError[];
  warnings: FashionVisionValidationError[];
  suggestedGate: AnalysisGate;
}

const ACCESSORY_CATEGORIES = new Set(['bags', 'heels', 'jewelry', 'scarves']);

function err(path: string, code: string, message: string): FashionVisionValidationError {
  return { path, code, message };
}

/**
 * Fashion logic rules v1 — Phase 5.
 * At least 5 rules unit-tested in vision-pipeline.schema-tests.ts
 */
@Injectable()
export class FashionValidatorService {
  validate(document: FashionVisionDocument): FashionRuleValidationResult {
    const errors: FashionVisionValidationError[] = [];
    const warnings: FashionVisionValidationError[] = [];

    this.ruleDominantColorsAlignWithGarments(document, errors);
    this.ruleTopologyMatchesGarmentCategories(document, errors);
    this.ruleAccessoryCategories(document, errors);
    this.ruleMinimumSemanticConfidence(document, errors);
    this.ruleLayeringDepth(document, warnings);
    this.ruleArchetypeWhenConfident(document, warnings);

    const suggestedGate: AnalysisGate = errors.length > 0
      ? 'blocked'
      : warnings.length > 0
        ? 'degraded'
        : document.analysisGate;

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      suggestedGate,
    };
  }

  /** Rule 1 — dominant colors must appear on at least one garment. */
  private ruleDominantColorsAlignWithGarments(
    doc: FashionVisionDocument,
    errors: FashionVisionValidationError[],
  ): void {
    const garmentColors = new Set<string>();
    for (const g of doc.semantics.garments) {
      g.colors.forEach((c) => garmentColors.add(c));
    }
    for (const id of doc.semantics.dominantColorIds) {
      if (!garmentColors.has(id) && !doc.semantics.secondaryColorIds.includes(id)) {
        errors.push(
          err(
            'semantics.dominantColorIds',
            'RULE_DOMINANT_COLOR_MISMATCH',
            `dominant color ${id} not found on garments`,
          ),
        );
      }
    }
  }

  /** Rule 2 — one-piece topology must not declare separate tops + bottoms. */
  private ruleTopologyMatchesGarmentCategories(
    doc: FashionVisionDocument,
    errors: FashionVisionValidationError[],
  ): void {
    if (!doc.geometry.topology.onePiece) return;

    const categories = new Set(doc.semantics.garments.map((g) => g.categoryId));
    if (categories.has('tops') && categories.has('bottoms')) {
      errors.push(
        err(
          'geometry.topology',
          'RULE_TOPOLOGY_CONFLICT',
          'onePiece topology conflicts with tops+bottoms garments',
        ),
      );
    }
  }

  /** Rule 3 — accessories use accessory taxonomy categories only. */
  private ruleAccessoryCategories(
    doc: FashionVisionDocument,
    errors: FashionVisionValidationError[],
  ): void {
    doc.semantics.accessories.forEach((a, i) => {
      if (!ACCESSORY_CATEGORIES.has(a.categoryId)) {
        errors.push(
          err(
            `semantics.accessories[${i}].categoryId`,
            'RULE_ACCESSORY_CATEGORY',
            `accessory category must be bags|heels|jewelry|scarves`,
          ),
        );
      }
    });
  }

  /** Rule 4 — at least one garment with meaningful confidence. */
  private ruleMinimumSemanticConfidence(
    doc: FashionVisionDocument,
    errors: FashionVisionValidationError[],
  ): void {
    const maxConf = doc.semantics.garments.reduce(
      (max, g) => Math.max(max, g.providerConfidence),
      0,
    );
    if (maxConf < 0.15) {
      errors.push(
        err(
          'semantics.garments',
          'RULE_MIN_CONFIDENCE',
          'no garment with providerConfidence >= 0.15',
        ),
      );
    }
  }

  /** Rule 5 — multi-garment outfits need layering depth >= 2. */
  private ruleLayeringDepth(
    doc: FashionVisionDocument,
    warnings: FashionVisionValidationError[],
  ): void {
    if (doc.semantics.garments.length >= 2 && doc.semantics.layering.length < 2) {
      warnings.push(
        err(
          'semantics.layering',
          'RULE_LAYERING_SHALLOW',
          'multi-garment outfit should declare layering depth >= 2',
        ),
      );
    }
  }

  /** Rule 6 — high-confidence semantics should declare styleArchetypeId. */
  private ruleArchetypeWhenConfident(
    doc: FashionVisionDocument,
    warnings: FashionVisionValidationError[],
  ): void {
    const maxConf = doc.semantics.garments.reduce(
      (max, g) => Math.max(max, g.providerConfidence),
      0,
    );
    if (maxConf >= 0.5 && !doc.semantics.styleArchetypeId) {
      warnings.push(
        err(
          'semantics.styleArchetypeId',
          'RULE_ARCHETYPE_MISSING',
          'styleArchetypeId recommended when confidence >= 0.5',
        ),
      );
    }
  }
}
