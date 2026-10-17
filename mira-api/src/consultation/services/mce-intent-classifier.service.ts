import { Injectable } from '@nestjs/common';
import { MceContextSnapshotV1 } from '../contracts/mce-context-snapshot.v1';

export type MceConsultationIntent =
  | 'styling'
  | 'occasion'
  | 'accessory'
  | 'makeup'
  | 'hair'
  | 'product'
  | 'skin'
  | 'greeting'
  | 'off_topic'
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

const ALWAYS_RULES: IntentRule[] = [
  {
    intent: 'greeting',
    patterns: [/^(مرحبا|مرحبًا|السلام|هلا|أهلًا|اهلين)[.!\s]*$/i],
  },
  {
    intent: 'hair',
    patterns: [/شعر/i, /صبغ/i, /تسريح/i],
  },
  {
    intent: 'product',
    patterns: [/مكون/i, /مكوّن/i, /منتج/i, /عبوة/i],
  },
  {
    intent: 'off_topic',
    patterns: [/كرة قدم/i, /سياسة/i, /برمجة/i],
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

    const rules: IntentRule[] = [...ALWAYS_RULES, ...OUTFIT_RULES, ...SKIN_RULES];
    void snapshot;

    for (const rule of rules) {
      if (rule.patterns.some((p) => p.test(text))) {
        return rule.intent;
      }
    }

    return 'general';
  }

  intentHintAr(intent: MceConsultationIntent): string {
    return (
      {
        styling: 'ركّزي على الأسلوب والألوان والتناسق — دون اقتراح تغيير قصّة القطع.',
        occasion: 'قيّمي ملاءمة الإطلالة للمناسبة المذكورة في السياق.',
        accessory: 'اقترحي إكسسوارات محددة متوافقة مع الألوان والمناسبة.',
        makeup: 'نصائح مكياج عامة. استخدمي التقرير إن وُجد ولا تصفي علاجًا.',
        hair: 'نصائح شعر عامة دون تشخيص فروة الرأس.',
        product: 'ناقشي المنتج أو المكونات الظاهرة. إن لم تتضح فاطلبي صورة أوضح أو النص.',
        skin: 'إن وُجد تقرير فاستخدميه للحقائق الشخصية، وإلا فأجيبي عناية عامة دون اختراع درجات.',
        greeting: 'ردّي بتحية قصيرة ثم اتركي الباب مفتوحًا لسؤال جمال واحد.',
        off_topic: 'بلطف أعيدي الحديث إلى الجمال والعناية والإطلالات.',
        general: 'أجيبي باختصار. التقرير للحقائق الشخصية والمعرفة العامة للشرح.',
      } satisfies Record<MceConsultationIntent, string>
    )[intent];
  }
}
