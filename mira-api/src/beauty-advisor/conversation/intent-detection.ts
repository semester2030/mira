import type { AdvisorIntent } from '../contracts/conversation-state';

interface IntentRule {
  intent: AdvisorIntent;
  patterns: RegExp[];
}

const RULES: IntentRule[] = [
  {
    intent: 'blocked',
    patterns: [
      /تشخيص/i,
      /وصفة/i,
      /دواء/i,
      /prescription/i,
      /diagnos/i,
      /antibiot/i,
    ],
  },
  {
    intent: 'beauty_experience',
    patterns: [/تجربة\s*جمال/i, /تجربة\s*افتراض/i, /try[- ]?on/i, /تجريب/i],
  },
  {
    intent: 'face',
    patterns: [/وجه/i, /ملامح/i, /هندسة\s*الوجه/i, /face\b/i],
  },
  {
    intent: 'skin',
    patterns: [
      /بشر/i,
      /ترطيب/i,
      /روتين/i,
      /سيروم/i,
      /واقي/i,
      /مسام/i,
      /حب\s*شباب/i,
      /تقشير/i,
      /مرطب/i,
      /skin/i,
    ],
  },
  {
    intent: 'styling',
    patterns: [
      /أسلوب/i,
      /اسلوب/i,
      /ستايل/i,
      /أهداف\s*الأسلوب/i,
      /style/i,
      /تنسيق/i,
    ],
  },
  {
    intent: 'outfit',
    patterns: [
      /إطلال/i,
      /اطلال/i,
      /outfit/i,
      /مناسبة/i,
      /تناسق/i,
      /layers?/i,
    ],
  },
  {
    intent: 'garment',
    patterns: [/قطعة/i, /بلوز/i, /فستان/i, /بنطلون/i, /garment/i, /قماش/i],
  },
  {
    intent: 'wardrobe',
    patterns: [/خزانة/i, /wardrobe/i, /ملابسي/i],
  },
  {
    intent: 'goals',
    patterns: [/هدف/i, /أهداف/i, /goal/i, /خطة/i],
  },
  {
    intent: 'unsupported',
    patterns: [/شراء/i, /تسوق/i, /سعر/i, /marketplace/i, /checkout/i, /اشتري/i],
  },
];

export function detectAdvisorIntent(message: string): AdvisorIntent {
  const text = message.trim();
  if (!text) return 'general';
  for (const rule of RULES) {
    if (rule.patterns.some((p) => p.test(text))) {
      return rule.intent;
    }
  }
  return 'general';
}
