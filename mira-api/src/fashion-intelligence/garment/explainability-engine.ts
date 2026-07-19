import { GarmentExplainability } from './canonical-garment';
import { LimitationEngine } from './limitation-engine';

/**
 * Explainability Engine — structured reason codes, EN/AR, evidence refs.
 * No marketing copy.
 */
export class ExplainabilityEngine {
  private readonly limitations = new LimitationEngine();

  build(input: {
    garmentId: string;
    categoryId: string;
    typeId: string;
    limitationCodes: string[];
    evidenceRefs: string[];
  }): GarmentExplainability[] {
    const out: GarmentExplainability[] = [
      {
        code: 'classified',
        reasonEn: `Classified as category=${input.categoryId} type=${input.typeId}.`,
        reasonAr: `صُنّف كفئة=${input.categoryId} نوع=${input.typeId}.`,
        evidenceRefs: [...input.evidenceRefs],
      },
    ];
    for (const t of this.limitations.textsForExplain(input.limitationCodes)) {
      out.push({
        code: t.code,
        reasonEn: t.en,
        reasonAr: t.ar,
        evidenceRefs: [...input.evidenceRefs],
      });
    }
    return out;
  }
}
