/**
 * Limitation Engine — never hide uncertainty.
 */
const LIMITATION_TEXT: Record<string, { en: string; ar: string }> = {
  color_missing: {
    en: 'No evidenced color ids.',
    ar: 'لا توجد ألوان موثّقة.',
  },
  material_missing: {
    en: 'Material not evidenced.',
    ar: 'الخامة غير موثّقة.',
  },
  material_estimated: {
    en: 'Material is estimated — not measured fabric.',
    ar: 'الخامة تقديرية — ليست قياساً نسيجياً.',
  },
  fit_missing: {
    en: 'Fit not evidenced.',
    ar: 'القصة غير موثّقة.',
  },
  pattern_missing: {
    en: 'Pattern not evidenced — not fabricated.',
    ar: 'النقش غير موثّق — لم يُختلق.',
  },
  sleeve_missing: {
    en: 'Sleeve not evidenced.',
    ar: 'الكم غير موثّق.',
  },
  neckline_missing: {
    en: 'Neckline not evidenced.',
    ar: 'فتحة العنق غير موثّقة.',
  },
  style_hints_missing: {
    en: 'Style hints not evidenced.',
    ar: 'إشارات الأسلوب غير موثّقة.',
  },
  season_not_evidenced: {
    en: 'Season not evidenced from vision — omitted.',
    ar: 'الموسم غير موثّق من الرؤية — محذوف.',
  },
  occasion_not_evidenced: {
    en: 'Occasion not evidenced from vision — omitted.',
    ar: 'المناسبة غير موثّقة من الرؤية — محذوفة.',
  },
  category_unknown: {
    en: 'Category unresolved.',
    ar: 'الفئة غير محسومة.',
  },
  type_unknown: {
    en: 'Type unresolved.',
    ar: 'النوع غير محسوم.',
  },
  catalog_unresolved: {
    en: 'No catalog piece resolved.',
    ar: 'لم تُحل قطعة من الكتالوج.',
  },
  catalog_ambiguous: {
    en: 'Multiple catalog matches — deterministic pick with ambiguity.',
    ar: 'عدة مطابقات كتالوج — اختيار حتمي مع غموض.',
  },
  mapping_incomplete: {
    en: 'Mapping incomplete.',
    ar: 'التعيين غير مكتمل.',
  },
  provider_uncertain: {
    en: 'Upstream observation uncertain.',
    ar: 'ملاحظة المصدر غير مؤكدة.',
  },
  analysis_gate_degraded: {
    en: 'Vision analysis gate degraded.',
    ar: 'بوابة تحليل الرؤية متدهورة.',
  },
  analysis_gate_blocked: {
    en: 'Vision analysis gate blocked.',
    ar: 'بوابة تحليل الرؤية محظورة.',
  },
};

export class LimitationEngine {
  build(codes: string[]): string[] {
    const unique = [...new Set(codes)];
    return unique.map((code) => {
      const base = code.split(':')[0] ?? code;
      const meta = LIMITATION_TEXT[base];
      if (meta) {
        return `${code}: ${meta.en}`;
      }
      if (code.startsWith('color_unmapped:')) {
        return `${code}: Color label not in library.`;
      }
      if (code.startsWith('category_unmapped:')) {
        return `${code}: Category not in ontology.`;
      }
      if (code.startsWith('type_unmapped:')) {
        return `${code}: Type not in ontology.`;
      }
      return code;
    });
  }

  textsForExplain(codes: string[]): Array<{ code: string; en: string; ar: string }> {
    return [...new Set(codes)].map((code) => {
      const base = code.split(':')[0] ?? code;
      const meta = LIMITATION_TEXT[base];
      return {
        code,
        en: meta?.en ?? code,
        ar: meta?.ar ?? code,
      };
    });
  }
}
