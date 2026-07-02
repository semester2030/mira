import { Injectable } from '@nestjs/common';
import { MceContextSnapshotV1 } from '../contracts/mce-context-snapshot.v1';

export type MceConsultationIntent =
  | 'styling'
  | 'occasion'
  | 'accessory'
  | 'makeup'
  | 'skin'
  | 'general';

interface IntentRule {
  intent: MceConsultationIntent;
  patterns: RegExp[];
}

const OUTFIT_RULES: IntentRule[] = [
  {
    intent: 'makeup',
    patterns: [/مكياج/i, /أحمر\s*شفاه/i, /آيلاينر/i, /كحل/i, /بلاشر/i, /هايلايتر/i],
  },
  {
    intent: 'accessory',
    patterns: [
      /إكسسوار/i,
      /اكسسوار/i,
      /حقيب/i,
      /حذاء/i,
      /حذ/i,
      /ساعة/i,
      /وشاح/i,
      /عقد/i,
      /أقراط/i,
      /قرط/i,
    ],
  },
  {
    intent: 'occasion',
    patterns: [
      /مناسبة/i,
      /العمل/i,
      /زفاف/i,
      /سهرة/i,
      /جامعة/i,
      /مقابلة/i,
      /عيد/i,
      /مناسب/i,
      /رسمي/i,
    ],
  },
  {
    intent: 'styling',
    patterns: [
      /أسلوب/i,
      /اسلوب/i,
      /لون/i,
      /ألوان/i,
      /تناسق/i,
      /إطلالة/i,
      /اطلالة/i,
      /قطعة/i,
      /بلوز/i,
      /فستان/i,
      /بنطلون/i,
      /تنسيق/i,
    ],
  },
];

const SKIN_RULES: IntentRule[] = [
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
    ],
  },
];

@Injectable()
export class MceIntentClassifierService {
  classify(message: string, snapshot: MceContextSnapshotV1): MceConsultationIntent {
    const text = message.trim();
    if (!text) return 'general';

    const rules: IntentRule[] = [];
    if (snapshot.outfit) rules.push(...OUTFIT_RULES);
    if (snapshot.skin) rules.push(...SKIN_RULES);

    for (const rule of rules) {
      if (rule.patterns.some((p) => p.test(text))) {
        return rule.intent;
      }
    }

    if (snapshot.outfit && !snapshot.skin) return 'styling';
    if (snapshot.skin && !snapshot.outfit) return 'skin';
    return 'general';
  }

  intentHintAr(intent: MceConsultationIntent): string {
    return (
      {
        styling: 'ركّزي على الأسلوب والألوان والتناسق — دون اقتراح تغيير قصّة القطع.',
        occasion: 'قيّمي ملاءمة الإطلالة للمناسبة المذكورة في السياق.',
        accessory: 'اقترحي إكسسوارات محددة متوافقة مع الألوان والمناسبة.',
        makeup: 'نصائح مكياج عامة متوافقة مع الإطلالة — دون وصف طبي.',
        skin: 'اربطي الإجابة بتقرير البشرة المخزّن فقط.',
        general: 'أجيبي باختصار ووضوح مع الاستشهاد بالحقائق المتاحة.',
      } satisfies Record<MceConsultationIntent, string>
    )[intent];
  }
}
