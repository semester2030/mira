/**
 * FK-5 — Color theory fact vs fashion styling convention vs subjective suggestion.
 */
export const ColorKnowledgeLayer = {
  COLOR_THEORY_FACT: 'COLOR_THEORY_FACT',
  FASHION_STYLING_CONVENTION: 'FASHION_STYLING_CONVENTION',
  SUBJECTIVE_STYLE_SUGGESTION: 'SUBJECTIVE_STYLE_SUGGESTION',
} as const;

export type ColorKnowledgeLayer =
  (typeof ColorKnowledgeLayer)[keyof typeof ColorKnowledgeLayer];

export interface ColorKnowledgeLayerPolicy {
  readonly layer: ColorKnowledgeLayer;
  readonly mayUseLowSubjectivity: boolean;
  readonly assertsOutfitQuality: boolean;
  readonly notes: string;
}

export const COLOR_KNOWLEDGE_LAYER_POLICIES: Readonly<
  Record<ColorKnowledgeLayer, ColorKnowledgeLayerPolicy>
> = Object.freeze({
  COLOR_THEORY_FACT: {
    layer: ColorKnowledgeLayer.COLOR_THEORY_FACT,
    mayUseLowSubjectivity: true,
    assertsOutfitQuality: false,
    notes:
      'Hue geometry / value / saturation relationships. Never “beautiful outfit”.',
  },
  FASHION_STYLING_CONVENTION: {
    layer: ColorKnowledgeLayer.FASHION_STYLING_CONVENTION,
    mayUseLowSubjectivity: false,
    assertsOutfitQuality: false,
    notes: 'Conventional styling guidance — qualify; preference may override',
  },
  SUBJECTIVE_STYLE_SUGGESTION: {
    layer: ColorKnowledgeLayer.SUBJECTIVE_STYLE_SUGGESTION,
    mayUseLowSubjectivity: false,
    assertsOutfitQuality: false,
    notes: 'Aesthetic preference — HIGH_SUBJECTIVITY / USER_DEPENDENT',
  },
});
