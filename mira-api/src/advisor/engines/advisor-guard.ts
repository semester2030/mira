import { ADVISOR_DISCLAIMER_AR } from '../contracts/advisor-response.interface';

export interface GuardResult {
  blocked: boolean;
  reason?: string;
  safeReply?: string;
}

const BLOCK_PATTERNS: RegExp[] = [
  /تشخيص|diagnos/i,
  /وصفة\s*طب|prescription|rx\b/i,
  /دواء|antibiotic|isotretinoin|accutane|ستеро|steroid/i,
  /مرض\s*جلد|psoriasis|eczema\s*treat|سرطان|cancer/i,
  /مضمون\s*100|guaranteed\s*cure|شفاء\s*كامل/i,
  /وصف\s*علاج|prescribe/i,
];

const SAFE_MEDICAL_REDIRECT =
  'ميرا مستشارة عناية — لا نقدّم تشخيصاً طبياً ولا وصف أدوية. إذا لديكِ أعراض مقلقة أو حالة مستمرة، ننصح بزيارة طبيبة جلدية. يمكنني مساعدتكِ في فهم تقريرك وروتين العناية المناسب.';

export function checkAdvisorGuard(message: string): GuardResult {
  const text = message.trim();
  if (!text) {
    return {
      blocked: true,
      reason: 'empty',
      safeReply: 'اكتبي سؤالكِ عن العناية أو الروتين أو المنتجات الموصى بها.',
    };
  }

  for (const pattern of BLOCK_PATTERNS) {
    if (pattern.test(text)) {
      return {
        blocked: true,
        reason: pattern.source,
        safeReply: SAFE_MEDICAL_REDIRECT,
      };
    }
  }

  return { blocked: false };
}

export function guardDisclaimer(): string {
  return ADVISOR_DISCLAIMER_AR;
}
