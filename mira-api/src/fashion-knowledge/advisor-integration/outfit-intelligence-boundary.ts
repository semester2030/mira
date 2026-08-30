/**
 * FK-12 — Strip/quarantine user-facing prescriptive fields from outfit-intelligence.
 * Analytical scores may remain; recommendations must not bypass Fashion Knowledge.
 */
export interface OutfitIntelligenceBoundaryInput {
  readonly visual: Record<string, unknown>;
  readonly analysis: Record<string, unknown>;
}

export interface OutfitIntelligenceBoundaryResult {
  readonly visual: Record<string, unknown>;
  readonly analysis: Record<string, unknown>;
  readonly fashionKnowledgeBoundary: {
    readonly applied: true;
    readonly strippedPrescriptiveFields: readonly string[];
    readonly noteAr: string;
  };
}

const PRESCRIPTIVE_FIELDS = [
  'recommendedColors',
  'rejectedColors',
  'suggestedAccessories',
  'suggestedMakeup',
  'recommendations',
  'styleVerdict',
] as const;

export function applyOutfitIntelligenceFashionBoundary(
  input: OutfitIntelligenceBoundaryInput,
): OutfitIntelligenceBoundaryResult {
  const analysis = { ...input.analysis };
  const stripped: string[] = [];
  for (const key of PRESCRIPTIVE_FIELDS) {
    if (key in analysis) {
      delete analysis[key];
      stripped.push(key);
    }
  }
  analysis.explanation =
    typeof analysis.explanation === 'string'
      ? `${String(analysis.explanation).slice(0, 280)} [تحليل وصفي — التوجيه التنسيقي الوصفي يمر عبر معرفة الأزياء وقفل الادعاء فقط]`
      : 'تحليل وصفي فقط — التوجيه التنسيقي عبر Fashion Knowledge.';
  analysis.fashionAdviceRoute = 'FASHION_KNOWLEDGE_CLAIM_LOCK_REQUIRED';
  return {
    visual: { ...input.visual },
    analysis,
    fashionKnowledgeBoundary: {
      applied: true,
      strippedPrescriptiveFields: stripped,
      noteAr:
        'أُزيلت الحقول الوصفية التنسيقية من هذا المسار. نصيحة التنسيق تمر عبر معرفة الأزياء وقفل الادعاء فقط.',
    },
  };
}
