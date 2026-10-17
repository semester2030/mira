import { MceAssistantPayloadV1 } from '../contracts/mce-context-snapshot.v1';

export const SCOPE_REDIRECT_AR =
  'هذا خارج اختصاص ميرا. أقدر أساعدك في الجمال والعناية والبشرة والشعر والمكياج والعطور والملابس والألوان والإكسسوارات والمناسبات والمنتجات. إذا أعجبتك ألوان صورة، اطلبي استلهام إطلالة منها.';

export interface ScopeDecision {
  allow: boolean;
  replyAr: string;
}

const allowDecision = { allow: true, replyAr: '' };

/** What the user is asking Mira to produce, not a flat noun list. */
export function requestedOutcome(message: string): 'beauty' | 'other' | 'unclear' {
  const text = message.trim();
  if (!text) return 'unclear';
  const wantsColorCode = /كود اللون|كود لون|درجة اللون|hex|rgb/i.test(text) && /لون|فستان|قطعة|حذاء|حقيبة/.test(text);
  const wantsCode = !wantsColorCode && /برمج|اكتب كود|دالة|سكريبت|برنامج يحسب|احسبي بالكود/.test(text);
  const wantsVehicleWork = /زيت السيارة|غيار الزيت|تغيير زيت|محرك السيارة|فرامل/.test(text);
  const wantsBeautyResult =
    /إطلال|اطلال|مكياج|بشرة|عناية|شعر|عطر|حذاء|حقيبة|إكسسوار|اكسسوار|تنسيق|فستان|لون|ألوان/.test(text);
  const wantsInspiration = /استوح|استلهم|إلهام|الهام/.test(text);
  const wantsDescription = /صف |وصف |اشرح|ما هذا|ما هذه|عرّفي|عرفي/.test(text);
  const animalSubject = /قطة|شاهين|صقر|صقور|طائر/.test(text);
  if (wantsCode || wantsVehicleWork) return 'other';
  if (wantsInspiration && (wantsBeautyResult || /لون|ألوان/.test(text))) return 'beauty';
  if (animalSubject && wantsDescription && !wantsBeautyResult) return 'other';
  if (wantsBeautyResult) return 'beauty';
  if (animalSubject && !wantsInspiration) return 'other';
  return 'unclear';
}

export function decideConsultationScope(
  message: string,
  history: Array<{ role: 'user' | 'assistant'; content: string }> = [],
): ScopeDecision {
  const text = message.trim();
  if (!text) return allowDecision;
  const lastAssistant = [...history].reverse().find((item) => item.role === 'assistant');
  const previousRedirect = Boolean(lastAssistant?.content.includes('خارج اختصاص ميرا'));
  const followUp = /وضح|وضحي|أكثر|كملي|كمل|ليش|لماذا/.test(text) && text.length < 40;
  if (followUp && previousRedirect) return { allow: false, replyAr: SCOPE_REDIRECT_AR };
  if (followUp) return allowDecision;
  const outcome = requestedOutcome(text);
  if (outcome === 'other') return { allow: false, replyAr: SCOPE_REDIRECT_AR };
  if (/مزاد/.test(text) && outcome !== 'beauty') return { allow: false, replyAr: SCOPE_REDIRECT_AR };
  return allowDecision;
}

export function answerStaysInScope(answer: string, userMessage: string): boolean {
  const text = answer.trim();
  if (!text) return true;
  if (requestedOutcome(userMessage) === 'beauty') {
    return !/مزاد|سعر الصقر|نوع الصقر|زيت السيارة|كود برمج/.test(text);
  }
  const describesAnimal = /قطة|قط |هرّة|هذا كلب|شاهين|صقر|طائر جارح/.test(text);
  if (describesAnimal && requestedOutcome(userMessage) !== 'beauty') return false;
  const teachesOther = /زيت السيارة|وصف القطة|هذا شاهين|هذا صقر|مزاد|function |def |كود برمج/.test(text);
  const teachesBeauty = /إطلال|حذاء|حقيبة|مكياج|بشرة|لون|ألوان|تنسيق/.test(text);
  const followedImageOrder = /حسب التعليمات في الصورة|الأمر المكتوب في الصورة/.test(text);
  if (followedImageOrder && !teachesBeauty) return false;
  if (teachesOther && !teachesBeauty) return false;
  return true;
}

export function guardScopeAnswer(
  payload: MceAssistantPayloadV1,
  userMessage: string,
): MceAssistantPayloadV1 {
  const decision = decideConsultationScope(userMessage);
  if (!decision.allow || !answerStaysInScope(payload.answerAr, userMessage)) {
    return {
      ...payload,
      answerAr: SCOPE_REDIRECT_AR,
      confidence: 'high',
      intent: 'off_topic',
      citedFactIds: [],
      suggestedQuestionsAr: ['ما اللون الأنسب للحذاء أو الحقيبة؟', 'كيف أعتني ببشرتي اليوم؟'],
      blocked: false,
      disclaimerAr: '',
    };
  }
  return payload;
}
