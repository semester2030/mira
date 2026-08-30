/**
 * FK-10 — Public narration / Arabic fashion language policy.
 * Advisor may only use these patterns with Envelope claim text.
 */
import { PublicClaimStrength } from '../contracts/claim-strength';

export const ARABIC_FASHION_ALLOWED_PATTERNS = Object.freeze([
  'إذا كان هدفك إطلالة أكثر هدوءًا',
  'يمكنك تجربة',
  'خيار آخر',
  'إذا كنتِ تفضلين الحفاظ على الطابع الجريء',
  'بحسب المناسبة التي ذكرتِها',
  'لأن المعلومات المتاحة لا تحدد',
  'أحتاج منك',
]);

export const ARABIC_FASHION_FORBIDDEN_PATTERNS = Object.freeze([
  /هذا خطأ/i,
  /لا يليق بك/i,
  /سيجعل[كك] أجمل/i,
  /يجعلك أنحف/i,
  /هذه القاعدة معروفة عالميًا/i,
  /خبراء الموضة يقولون/i,
  /بحسب دليل .+ الرسمي/i,
  /حرام|حلال/i,
]);

export function narrateSuggestionAr(input: {
  readonly suggestion: string;
  readonly strength: PublicClaimStrength;
  readonly qualified: boolean;
  readonly preferenceConflict?: boolean;
}): string {
  const body = input.suggestion.trim();
  if (input.strength === PublicClaimStrength.UNAVAILABLE) {
    return 'لا تتوفر نصيحة أزياء مؤهلة للسرد.';
  }
  if (input.strength === PublicClaimStrength.PREFERENCE_DEPENDENT_OPTION) {
    return `إذا كنتِ تفضلين هذا الاتجاه، يمكنكِ تجربة: ${body}`;
  }
  if (
    input.qualified ||
    input.strength === PublicClaimStrength.QUALIFIED_SUGGESTION
  ) {
    const conflict = input.preferenceConflict
      ? ' مع احترام تفضيلكِ المصرّح به،'
      : '';
    return `إذا كان هدفكِ إطلالة بهذا الاتجاه،${conflict} يمكنكِ تجربة: ${body}`;
  }
  if (input.strength === PublicClaimStrength.CONVENTIONAL_GUIDANCE) {
    return `بحسب السياق المذكور، توجيه شائع هو: ${body}`;
  }
  if (input.strength === PublicClaimStrength.ESTABLISHED_GUIDANCE) {
    return `وفق مبدأ ميرا المعتمد: ${body}`;
  }
  return body;
}

export function narrateAlternativeAr(
  direction: string,
  qualification: string,
): string {
  const q = qualification?.trim() ? ` (${qualification})` : '';
  return `خيار آخر: ${direction}${q}`;
}

export function containsForbiddenFashionLanguage(text: string): boolean {
  return ARABIC_FASHION_FORBIDDEN_PATTERNS.some((p) => p.test(text));
}

/** Body-directed / Law #37 public response check. */
export function containsBodyJudgmentLanguage(text: string): boolean {
  return /أنحف|أطول ساق|يخفي البطن|شكل جسمك|يجعلك أجمل|أكثر جاذبية|slimmer|hides your stomach|lengthens legs/i.test(
    text,
  );
}

export function containsReligiousRulingLanguage(text: string): boolean {
  return /حرام|حلال|شرعًا|شرعا|فتوى|religious ruling/i.test(text);
}

export function containsCulturalStereotypeLanguage(text: string): boolean {
  return /كل السعوديات|السعوديات دائمًا|العرب لا يلبسون|ثقافتك تفرض/i.test(
    text,
  );
}
