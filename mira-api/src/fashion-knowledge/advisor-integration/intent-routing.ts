/**
 * FK-10 — Fashion intent routing (additive; Advisor extension-point ready).
 * Does not own shopping / recommendation intents.
 */
export const FashionAdvisorIntent = {
  OUTFIT_ADVICE: 'OUTFIT_ADVICE',
  COLOR_COORDINATION: 'COLOR_COORDINATION',
  OCCASION_SUITABILITY: 'OCCASION_SUITABILITY',
  SHOE_ADVICE: 'SHOE_ADVICE',
  BAG_ADVICE: 'BAG_ADVICE',
  JEWELRY_ADVICE: 'JEWELRY_ADVICE',
  ACCESSORY_ADVICE: 'ACCESSORY_ADVICE',
  FABRIC_SILHOUETTE: 'FABRIC_SILHOUETTE',
  CULTURAL_STYLING: 'CULTURAL_STYLING',
  STYLE_ALTERNATIVES: 'STYLE_ALTERNATIVES',
  RELIGIOUS_OUT_OF_SCOPE: 'RELIGIOUS_OUT_OF_SCOPE',
  SHOPPING_OUT_OF_SCOPE: 'SHOPPING_OUT_OF_SCOPE',
  NON_FASHION: 'NON_FASHION',
} as const;

export type FashionAdvisorIntent =
  (typeof FashionAdvisorIntent)[keyof typeof FashionAdvisorIntent];

interface IntentRule {
  intent: FashionAdvisorIntent;
  patterns: RegExp[];
}

const RULES: IntentRule[] = [
  {
    intent: FashionAdvisorIntent.RELIGIOUS_OUT_OF_SCOPE,
    patterns: [/حرام/i, /حلال/i, /شرعًا/i, /شرعا/i, /فتوى/i, /\bharam\b/i],
  },
  {
    intent: FashionAdvisorIntent.SHOPPING_OUT_OF_SCOPE,
    patterns: [/شراء/i, /تسوق/i, /سعر/i, /SKU/i, /اشتري/i, /marketplace/i],
  },
  {
    intent: FashionAdvisorIntent.CULTURAL_STYLING,
    patterns: [/سعودي/i, /خليج/i, /ثقاف/i, /احتشام/i, /saudi/i, /gulf/i],
  },
  {
    intent: FashionAdvisorIntent.SHOE_ADVICE,
    patterns: [/حذاء/i, /أحذية/i, /shoes?/i],
  },
  {
    intent: FashionAdvisorIntent.BAG_ADVICE,
    patterns: [/شنطة/i, /حقيبة/i, /bags?/i],
  },
  {
    intent: FashionAdvisorIntent.JEWELRY_ADVICE,
    patterns: [/مجوهر/i, /إكسسوار ذهب/i, /jewelry/i],
  },
  {
    intent: FashionAdvisorIntent.ACCESSORY_ADVICE,
    patterns: [/إكسسوار/i, /اكسسوار/i, /accessor/i],
  },
  {
    intent: FashionAdvisorIntent.FABRIC_SILHOUETTE,
    patterns: [/قماش/i, /قصة/i, /قصات/i, /تناسب القصات/i, /silhouette/i, /fabric/i],
  },
  {
    intent: FashionAdvisorIntent.COLOR_COORDINATION,
    patterns: [/لون/i, /ألوان/i, /تناسق الألوان/i, /color/i, /contrast/i],
  },
  {
    intent: FashionAdvisorIntent.OCCASION_SUITABILITY,
    patterns: [/مناسبة/i, /زفاف/i, /زواج/i, /wedding/i, /هل .+ مناسب/i],
  },
  {
    intent: FashionAdvisorIntent.STYLE_ALTERNATIVES,
    patterns: [/بديل/i, /خيارات/i, /أكثر هدوء/i, /أكثر جرأة/i, /alternative/i],
  },
  {
    intent: FashionAdvisorIntent.OUTFIT_ADVICE,
    patterns: [
      /إطلال/i,
      /اطلال/i,
      /وش رايك/i,
      /وش رأيك/i,
      /تنسيق/i,
      /outfit/i,
      /ستايل/i,
    ],
  },
];

export function detectFashionAdvisorIntent(message: string): FashionAdvisorIntent {
  const text = message.trim();
  if (!text) return FashionAdvisorIntent.NON_FASHION;
  for (const rule of RULES) {
    if (rule.patterns.some((p) => p.test(text))) return rule.intent;
  }
  return FashionAdvisorIntent.NON_FASHION;
}

export function isFashionPrescriptiveIntent(
  intent: FashionAdvisorIntent,
): boolean {
  return (
    intent !== FashionAdvisorIntent.NON_FASHION &&
    intent !== FashionAdvisorIntent.SHOPPING_OUT_OF_SCOPE &&
    intent !== FashionAdvisorIntent.RELIGIOUS_OUT_OF_SCOPE
  );
}

export function isReligiousOutOfScope(intent: FashionAdvisorIntent): boolean {
  return intent === FashionAdvisorIntent.RELIGIOUS_OUT_OF_SCOPE;
}
