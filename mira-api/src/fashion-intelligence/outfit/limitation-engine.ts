const LIMITATION_TEXT: Record<string, { en: string; ar: string }> = {
  duplicate_garments: {
    en: 'Duplicate garment ids in outfit.',
    ar: 'معرفات قطع مكررة في الإطلالة.',
  },
  incomplete_outfit: {
    en: 'Outfit incomplete — body coverage missing.',
    ar: 'الإطلالة غير مكتملة — تغطية الجسم ناقصة.',
  },
  invalid_compatibility: {
    en: 'Hard compatibility conflict.',
    ar: 'تعارض توافق قاسٍ.',
  },
  soft_compatibility_conflicts: {
    en: 'Soft compatibility conflicts present.',
    ar: 'تعارضات توافق خفيفة.',
  },
  invalid_layering: {
    en: 'Invalid layering / coverage.',
    ar: 'طبقات أو تغطية غير صالحة.',
  },
  layering_coverage_warn: {
    en: 'Layering coverage warning.',
    ar: 'تحذير تغطية الطبقات.',
  },
  modesty_unevaluated: {
    en: 'Modesty not evaluated — policy unevaluated.',
    ar: 'الاحتشام غير مُقيَّم — السياسة غير مفعّلة.',
  },
  'unknown_context:occasion': {
    en: 'Occasion context not provided.',
    ar: 'سياق المناسبة غير مُقدَّم.',
  },
  'unknown_context:weather': {
    en: 'Weather/climate context not provided.',
    ar: 'سياق الطقس/المناخ غير مُقدَّم.',
  },
  'missing_evidence:compatibility': {
    en: 'Compatibility evidence thin.',
    ar: 'أدلة التوافق ضعيفة.',
  },
  'missing_evidence:harmony_color': {
    en: 'No evidenced colors for harmony.',
    ar: 'لا ألوان موثّقة للتناغم.',
  },
  'missing_evidence:harmony_style': {
    en: 'No evidenced style hints for harmony.',
    ar: 'لا إشارات أسلوب موثّقة للتناغم.',
  },
  'missing_evidence:occasion': {
    en: 'Occasion requested but garment occasion unevidenced.',
    ar: 'طُلبت مناسبة لكن مناسبة القطعة غير موثّقة.',
  },
  'missing_evidence:season': {
    en: 'Season requested but garment season unevidenced.',
    ar: 'طُلب موسم لكن موسم القطعة غير موثّق.',
  },
  'missing_evidence:climate': {
    en: 'Climate noted but garment season/material unevidenced.',
    ar: 'ذُكر المناخ لكن موسم/خامة القطعة غير موثّقة.',
  },
  'missing_evidence:modesty_standard': {
    en: 'Standard modesty policy without garment coverage evidence.',
    ar: 'سياسة احتشام قياسية بلا أدلة تغطية على القطع.',
  },
  unsupported_evaluation: {
    en: 'Unsupported evaluation path.',
    ar: 'مسار تقييم غير مدعوم.',
  },
};

export class OutfitLimitationEngine {
  build(codes: string[]): string[] {
    return [...new Set(codes)].map((code) => {
      const meta = LIMITATION_TEXT[code] ?? LIMITATION_TEXT[code.split(':').slice(0, 2).join(':')];
      if (meta) return `${code}: ${meta.en}`;
      return code;
    });
  }

  textsForExplain(
    codes: string[],
  ): Array<{ code: string; en: string; ar: string }> {
    return [...new Set(codes)].map((code) => {
      const meta = LIMITATION_TEXT[code];
      return {
        code,
        en: meta?.en ?? code,
        ar: meta?.ar ?? code,
      };
    });
  }
}
