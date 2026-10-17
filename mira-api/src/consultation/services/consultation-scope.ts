import { MceAssistantPayloadV1 } from '../contracts/mce-context-snapshot.v1';

export const SCOPE_REDIRECT_AR =
  'هذا خارج اختصاص ميرا. أقدر أساعدك في الجمال والعناية والبشرة والشعر والمكياج والعطور والإطلالات والألوان والإكسسوارات والمناسبات والمنتجات. إذا أعجبتك ألوان الصورة، اطلبي استلهام إطلالة منها.';

const BEAUTY_APPLICATION =
  /استوح|استلهم|إلهام|الهام|إطلال|اطلال|مكياج|شعر|عطر|إكسسوار|اكسسوار|تنسيق|لون|ألوان|بشر|عناية|مناسب|منتج|قماش|كريم|مرطب|سيروم|لبس|قطعة|مكياج|تسريح|صبغ/;

const OFF_SCOPE_DETAIL =
  /مزاد|صقر|صقور|طائر|تشريح|كرة قدم|سياسة|برمجة|سهم|عملة رقمية/;

const OBJECT_IDENTIFICATION =
  /ما هذا|ما هذه|ما اسم|ايش هذا|إيش هذا|اشرح|صف لي|وصف |كم سعر|ما هو|ما هي/;

export interface ScopeDecision {
  allow: boolean;
  replyAr: string;
}

export function beautyApplication(message: string): boolean {
  return BEAUTY_APPLICATION.test(message);
}

export function decideConsultationScope(
  message: string,
  history: Array<{ role: 'user' | 'assistant'; content: string }> = [],
): ScopeDecision {
  const text = message.trim();
  const allow = { allow: true, replyAr: '' };
  if (!text) return allow;
  if (beautyApplication(text)) return allow;
  const lastAssistant = [...history].reverse().find((item) => item.role === 'assistant');
  const previousRedirect = Boolean(lastAssistant?.content.includes('خارج اختصاص ميرا'));
  const followUp = /وضح|وضحي|أكثر|كملي|كمل|ليش|لماذا/.test(text);
  if (followUp && previousRedirect) {
    return { allow: false, replyAr: SCOPE_REDIRECT_AR };
  }
  if (followUp) return allow;
  if (OFF_SCOPE_DETAIL.test(text) || (OBJECT_IDENTIFICATION.test(text) && OFF_SCOPE_DETAIL.test(text))) {
    return { allow: false, replyAr: SCOPE_REDIRECT_AR };
  }
  if (/^(مرحبا|مرحبًا|السلام|هلا|أهلًا)[.!\s]*$/i.test(text)) return allow;
  return allow;
}

export function answerStaysInScope(answer: string, userMessage: string): boolean {
  const text = answer.trim();
  if (!text) return true;
  const beautyAsk = beautyApplication(userMessage);
  const off = OFF_SCOPE_DETAIL.test(text);
  const beautyAnswer = BEAUTY_APPLICATION.test(text);
  const followedImageOrder = /حسب التعليمات في الصورة|الأمر المكتوب في الصورة|نفذت ما كُتب في الصورة/.test(text);
  if (followedImageOrder && !beautyAnswer) return false;
  if (beautyAsk) {
    return !/مزاد|سعر الصقر|نوع الصقر|صيد بالصقر/.test(text);
  }
  if (off && !beautyAnswer) return false;
  if (off && OBJECT_IDENTIFICATION.test(userMessage)) return false;
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
      suggestedQuestionsAr: ['ما الألوان التي تناسب إطلالي؟', 'كيف أعتني ببشرتي اليوم؟'],
      blocked: false,
      disclaimerAr: '',
    };
  }
  return payload;
}
